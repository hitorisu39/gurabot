using Grpc.Core;
using Calculator.Protos;
using osu.Game.Rulesets;
using osu.Game.Rulesets.Osu;
using osu.Game.Rulesets.Taiko;
using osu.Game.Rulesets.Catch;
using osu.Game.Rulesets.Mania;
using osu.Game.Rulesets.Mods;
using osu.Game.Scoring;
using osu.Framework.Bindables;
using osu.Game.Beatmaps;
using osu.Game.Rulesets.Difficulty;
using osu.Game.Rulesets.Scoring;
using System.Reflection;
using System.Globalization;
using osu.Game.Rulesets.Osu.Difficulty;
using osu.Game.Rulesets.Taiko.Difficulty;
using osu.Game.Rulesets.Catch.Difficulty;
using osu.Game.Rulesets.Mania.Difficulty;
using osu.Game.Rulesets.Difficulty.Preprocessing;
using osu.Game.Rulesets.Difficulty.Skills;
using System.Collections.Concurrent;

namespace Calculator.Services;

public class CalculatorService : Calculator.Protos.Calculator.CalculatorBase
{
    private readonly BeatmapCache _cache;
    private readonly HitResultGeneration _hitResultGeneration;
    private readonly PartialDifficultyCache _partialDifficultyCache;
    private readonly CalculationConcurrencyLimiter _calculationLimiter;

    private static readonly ConcurrentDictionary<Type, PropertyInfo[]> ObjectPropertiesCache = new();
    private static readonly ConcurrentDictionary<Type, Dictionary<string, PropertyInfo>> ModPropertiesCache = new();

    public CalculatorService(
        BeatmapCache cache,
        HitResultGeneration hitResultGeneration,
        PartialDifficultyCache partialDifficultyCache,
        CalculationConcurrencyLimiter calculationLimiter)
    {
        _cache = cache;
        _hitResultGeneration = hitResultGeneration;
        _partialDifficultyCache = partialDifficultyCache;
        _calculationLimiter = calculationLimiter;
    }

    private Ruleset GetRuleset(uint id) => id switch
    {
        0 => new OsuRuleset(),
        1 => new TaikoRuleset(),
        2 => new CatchRuleset(),
        3 => new ManiaRuleset(),
        _ => throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid ruleset ID"))
    };

    private Mod[] ParseMods(Ruleset ruleset, IEnumerable<ModMessage> modMessages, double? customClockRate)
    {
        var availableMods = ruleset.CreateAllMods().ToList();
        var result = new List<Mod>();

        foreach (var reqMod in modMessages)
        {
            var mod = availableMods.FirstOrDefault(m => m.Acronym == reqMod.Acronym);
            if (mod == null) continue;

            var modType = mod.GetType();
            var properties = ModPropertiesCache.GetOrAdd(modType, t => 
                t.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase)
                 .ToDictionary(p => p.Name.Replace("_", ""), StringComparer.OrdinalIgnoreCase));

            foreach (var setting in reqMod.Settings)
            {
                var normalized = setting.Key.Replace("_", "");
                if (properties.TryGetValue(normalized, out var prop))
                {
                    if (prop.GetValue(mod) is IParseable parseableBindable)
                    {
                        parseableBindable.Parse(setting.Value, CultureInfo.InvariantCulture);
                    }
                }
            }

            result.Add(mod);
        }

        if (customClockRate.HasValue)
        {
            var existingRateMod = result.OfType<ModRateAdjust>().FirstOrDefault();

            if (existingRateMod != null)
            {
                existingRateMod.SpeedChange.Value = customClockRate.Value;
            }
            else if (Math.Abs(customClockRate.Value - 1.0) > 0.000001)
            {
                var targetAcronym = customClockRate.Value > 1.0 ? "DT" : "HT";
                var rateMod = availableMods
                    .FirstOrDefault(mod => mod.Acronym == targetAcronym) as ModRateAdjust;

                if (rateMod != null)
                {
                    rateMod.SpeedChange.Value = customClockRate.Value;
                    result.Add(rateMod);
                }
            }
        }

        return result.ToArray();
    }

    private Dictionary<string, double> ExtractAttributes(object obj)
    {
        var dict = new Dictionary<string, double>();
        var properties = ObjectPropertiesCache.GetOrAdd(obj.GetType(), t => t.GetProperties(BindingFlags.Public | BindingFlags.Instance));

        foreach (var prop in properties)
        {
            var name = char.ToLowerInvariant(prop.Name[0]) + prop.Name[1..];
            
            if (prop.PropertyType == typeof(double)) 
                dict[name] = (double)prop.GetValue(obj)!;
            else if (prop.PropertyType == typeof(int)) 
                dict[name] = (int)prop.GetValue(obj)!;
        }
        return dict;
    }

    private IEnumerable<SkillStrain> GetStrains(DifficultyCalculator calculator, IBeatmap playableBeatmap, Mod[] mods)
    {
        Type calculatorType = calculator.GetType();

        MethodInfo createSkillsMethod = FindInstanceMethod(
            calculatorType,
            "CreateSkills",
            typeof(IBeatmap),
            typeof(Mod[])
        ) ?? throw new MissingMethodException(
            calculatorType.FullName,
            "CreateSkills(IBeatmap, Mod[])"
        );

        MethodInfo createHitObjectsMethod = FindInstanceMethod(
            calculatorType,
            "CreateDifficultyHitObjects",
            typeof(IBeatmap),
            typeof(Mod[])
        ) ?? throw new MissingMethodException(
            calculatorType.FullName,
            "CreateDifficultyHitObjects(IBeatmap, Mod[])"
        );

        MethodInfo sortObjectsMethod = FindInstanceMethod(
            calculatorType,
            "SortObjects",
            typeof(IEnumerable<DifficultyHitObject>)
        ) ?? throw new MissingMethodException(
            calculatorType.FullName,
            "SortObjects(IEnumerable<DifficultyHitObject>)"
        );

        var skills = createSkillsMethod.Invoke(
            calculator,
            new object[] { playableBeatmap, mods }
        ) as Skill[];

        if (skills == null)
        {
            throw new InvalidOperationException(
                $"{calculatorType.Name}.CreateSkills() returned an unexpected value."
            );
        }

        var unsortedHitObjects = createHitObjectsMethod.Invoke(
            calculator,
            new object[] { playableBeatmap, mods }
        ) as IEnumerable<DifficultyHitObject>;

        if (unsortedHitObjects == null)
        {
            throw new InvalidOperationException(
                $"{calculatorType.Name}.CreateDifficultyHitObjects() returned an unexpected value."
            );
        }

        var sortedHitObjects = sortObjectsMethod.Invoke(
            calculator,
            new object[] { unsortedHitObjects }
        ) as IEnumerable<DifficultyHitObject>;

        if (sortedHitObjects == null)
        {
            throw new InvalidOperationException(
                $"{calculatorType.Name}.SortObjects() returned an unexpected value."
            );
        }

        DifficultyHitObject[] hitObjects = sortedHitObjects.ToArray();

        if (hitObjects.Length == 0)
            return Array.Empty<SkillStrain>();

        foreach (DifficultyHitObject hitObject in hitObjects)
        {
            foreach (Skill skill in skills)
            {
                skill.Process(hitObject);
            }
        }

        double timelineEnd = hitObjects.Max(hitObject => hitObject.EndTime);

        var result = new List<SkillStrain>(skills.Length);
        var nameCounts = new Dictionary<string, int>();

        foreach (Skill skill in skills)
        {
            IReadOnlyList<double> values = skill.GetObjectDifficulties();

            if (values.Count != hitObjects.Length)
            {
                throw new InvalidOperationException(
                    $"Skill {skill.GetType().FullName} returned " +
                    $"{values.Count} object difficulties for " +
                    $"{hitObjects.Length} difficulty hit objects."
                );
            }

            if (values.Count == 0)
                continue;

            string name = GetUniqueSkillName(skill, nameCounts);

            var strain = new SkillStrain
            {
                SkillName = name
            };

            if (hitObjects[0].StartTime > 0)
            {
                strain.Points.Add(new SkillStrainPoint
                {
                    TimeMs = 0,
                    Value = 0
                });
            }

            for (int i = 0; i < values.Count; i++)
            {
                double value = values[i];

                if (!double.IsFinite(value))
                    value = 0;

                strain.Points.Add(new SkillStrainPoint
                {
                    TimeMs = Math.Max(0, hitObjects[i].StartTime),
                    Value = Math.Max(0, value)
                });
            }

            double lastPointTime = strain.Points[^1].TimeMs;

            if (timelineEnd > lastPointTime)
            {
                strain.Points.Add(new SkillStrainPoint
                {
                    TimeMs = timelineEnd,
                    Value = 0
                });
            }

            result.Add(strain);
        }

        return result;
    }

    private static MethodInfo? FindInstanceMethod(
        Type type,
        string methodName,
        params Type[] parameterTypes)
    {
        for (Type? current = type; current != null; current = current.BaseType)
        {
            MethodInfo? method = current.GetMethod(
                methodName,
                BindingFlags.Instance |
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.DeclaredOnly,
                binder: null,
                types: parameterTypes,
                modifiers: null
            );

            if (method != null)
                return method;
        }

        return null;
    }

    private string GetSkillName(object skill)
    {
        var name = skill.GetType().Name;
        
        var withSlidersField = skill.GetType().GetField("IncludeSliders", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        if (withSlidersField != null && withSlidersField.GetValue(skill) is false)
        {
            name += "NoSliders";
        }
        
        return name;
    }

    private string GetUniqueSkillName(
        Skill skill,
        Dictionary<string, int> nameCounts)
    {
        string name = GetSkillName(skill);

        if (!nameCounts.TryGetValue(name, out int count))
        {
            nameCounts[name] = 1;
            return name;
        }

        count++;
        nameCounts[name] = count;

        return $"{name}{count}";
    }

    private BeatmapAttributes CalculateAdjustedAttributes(IBeatmap beatmap, double clockRate)
    {
        var baseDifficulty = beatmap.Difficulty;
        double preempt = IBeatmapDifficultyInfo.DifficultyRange(baseDifficulty.ApproachRate, 1800, 1200, 450);
        
        double adjustedPreempt = preempt / clockRate;
        float adjustedAr = (float)IBeatmapDifficultyInfo.InverseDifficultyRange(adjustedPreempt, 1800, 1200, 450);
        double hitWindowGreat = IBeatmapDifficultyInfo.DifficultyRange(baseDifficulty.OverallDifficulty, 80, 50, 20);
        double adjustedWindow = hitWindowGreat / clockRate;
        float adjustedOd = (float)IBeatmapDifficultyInfo.InverseDifficultyRange(adjustedWindow, 80, 50, 20);

        return new BeatmapAttributes
        {
            Ar = adjustedAr,
            Od = adjustedOd,
            Cs = baseDifficulty.CircleSize,
            Hp = baseDifficulty.DrainRate,
            ClockRate = clockRate
        };
    }

    private double CalculateClockRate(IEnumerable<Mod> mods)
    {
        double rate = 1.0;
        foreach (var mod in mods.OfType<IApplicableToRate>())
        {
            rate = mod.ApplyToRate(0, rate);
        }
        return rate;
    }

    public override Task<DifficultyResponse> CalculateDifficulty(DifficultyRequest request, ServerCallContext context)
    {
        var ruleset = GetRuleset(request.RulesetId);
        var mods = ParseMods(ruleset, request.Mods, request.HasClockRate ? request.ClockRate : null);

        var cachedBeatmap = _cache.GetBeatmap(request.BeatmapPath);
        IWorkingBeatmap beatmap = cachedBeatmap.WorkingBeatmap;

        if (request.HasPassedObjects)
            beatmap = new TruncatedWorkingBeatmap(cachedBeatmap.WorkingBeatmap.Beatmap, (int)request.PassedObjects);

        var difficultyCalculator = ruleset.CreateDifficultyCalculator(beatmap);
        var difficultyAttributes = difficultyCalculator.Calculate(mods);

        var playableBeatmap = beatmap.GetPlayableBeatmap(ruleset.RulesetInfo, mods);
        var clockRate = CalculateClockRate(mods);

        var response = new DifficultyResponse
        {
            Beatmap = CalculateAdjustedAttributes(playableBeatmap, clockRate)
        };

        response.Attributes.Add(ExtractAttributes(difficultyAttributes));

        if (request.CalculateStrains)
        {
            var strains = GetStrains(difficultyCalculator, playableBeatmap, mods);
            response.Strains.AddRange(strains);
        }

        return Task.FromResult(response);
    }

    public override async Task CalculatePerformanceStream(
        IAsyncStreamReader<PerformanceRequest> requestStream,
        IServerStreamWriter<PerformanceResponse> responseStream,
        ServerCallContext context)
    {
        using var writeLock = new SemaphoreSlim(1, 1);

        var tasks = new List<Task>();

        await foreach (
            PerformanceRequest request in
            requestStream.ReadAllAsync(context.CancellationToken)
        )
        {
            tasks.Add(processRequest(request));
        }

        await Task.WhenAll(tasks);

        async Task processRequest(PerformanceRequest request)
        {
            try
            {
                PerformanceResponse response =
                    await _calculationLimiter.RunAsync(
                        () => CalculatePerformanceCore(request),
                        context.CancellationToken
                    );

                if (request.HasReferenceId)
                {
                    response.ReferenceId = request.ReferenceId;
                }

                await writeLock.WaitAsync(
                    context.CancellationToken
                );

                try
                {
                    await responseStream.WriteAsync(response);
                }
                finally
                {
                    writeLock.Release();
                }
            }
            catch (RpcException)
            {
                throw;
            }
            catch (Exception exception)
            {
                throw new RpcException(
                    new Status(
                        StatusCode.Unknown,
                        exception.Message
                    )
                );
            }
        }
    }

    public override Task<PerformanceResponse> CalculatePerformance(
        PerformanceRequest request,
        ServerCallContext context)
    {
        return _calculationLimiter.RunAsync(
            () => CalculatePerformanceCore(request),
            context.CancellationToken
        );
    }

    private PerformanceResponse CalculatePerformanceCore(
        PerformanceRequest request)
    {
        Ruleset ruleset = GetRuleset(request.RulesetId);

        Mod[] mods = ParseMods(
            ruleset,
            request.Mods,
            request.HasClockRate
                ? request.ClockRate
                : null
        );

        CachedWorkingBeatmap source =
            _cache.GetBeatmap(request.BeatmapPath);

        IWorkingBeatmap effectiveBeatmap =
            source.WorkingBeatmap;

        if (request.HasPassedObjects)
        {
            int sourceObjectCount =
                source.WorkingBeatmap.Beatmap.HitObjects.Count;

            if (
                request.PassedObjects == 0 ||
                request.PassedObjects > sourceObjectCount
            )
            {
                throw new RpcException(
                    new Status(
                        StatusCode.InvalidArgument,
                        $"passed_objects must be between 1 and " +
                        $"{sourceObjectCount}."
                    )
                );
            }

            effectiveBeatmap = new TruncatedWorkingBeatmap(
                source.WorkingBeatmap.Beatmap,
                checked((int)request.PassedObjects)
            );
        }

        DifficultyCalculator difficultyCalculator =
            ruleset.CreateDifficultyCalculator(effectiveBeatmap);

        DifficultyAttributes difficultyAttributes;

        if (
            !request.HasPassedObjects &&
            request.PrecalculatedDifficulty.Count > 0
        )
        {
            difficultyAttributes =
                CreateDifficultyAttributes(
                    request.RulesetId,
                    mods,
                    request.PrecalculatedDifficulty
                );
        }
        else if (request.HasPassedObjects)
        {
            var cacheKey = new PartialDifficultyCacheKey(
                source.Identity,
                request.RulesetId,
                BuildModsKey(
                    request.Mods,
                    request.HasClockRate
                        ? request.ClockRate
                        : null
                ),
                request.PassedObjects,
                difficultyCalculator.Version
            );

            IReadOnlyDictionary<string, double> cachedAttributes =
                _partialDifficultyCache.GetOrCreate(
                    cacheKey,
                    () =>
                    {
                        DifficultyAttributes calculated =
                            difficultyCalculator.Calculate(mods);

                        return ExtractAttributes(calculated);
                    }
                );

            difficultyAttributes =
                CreateDifficultyAttributes(
                    request.RulesetId,
                    mods,
                    cachedAttributes
                );
        }
        else
        {
            difficultyAttributes =
                difficultyCalculator.Calculate(mods);
        }

        IBeatmap playableBeatmap =
            effectiveBeatmap.GetPlayableBeatmap(
                ruleset.RulesetInfo,
                mods
            );

        bool isActual =
            request.Score.Kind == ScoreStateKind.Actual;

        Dictionary<HitResult, int> statistics;

        if (isActual)
        {
            statistics = BuildExactStatistics(request.Score);

            ValidateActualScore(
                request,
                playableBeatmap,
                statistics
            );
        }
        else
        {
            statistics = _hitResultGeneration.Generate(
                request.RulesetId,
                playableBeatmap,
                mods,
                request.Score
            );
        }

        double accuracy;

        if (isActual && request.Score.HasAccuracy)
        {
            accuracy = Math.Clamp(
                request.Score.Accuracy,
                0,
                1
            );
        }
        else
        {
            accuracy =
                _hitResultGeneration.GetAccuracyForRuleset(
                    request.RulesetId,
                    playableBeatmap,
                    statistics,
                    mods
                );
        }

        var scoreInfo = new ScoreInfo
        {
            Ruleset = ruleset.RulesetInfo,
            Mods = mods,

            MaxCombo = request.Score.HasMaxCombo
                ? checked((int)request.Score.MaxCombo)
                : difficultyAttributes.MaxCombo,

            Statistics = statistics,
            Accuracy = accuracy,
            BeatmapInfo = playableBeatmap.BeatmapInfo,

            TotalScore = request.HasTotalScore
                ? request.TotalScore
                : 0,

            LegacyTotalScore = request.HasLegacyTotalScore
                ? request.LegacyTotalScore
                : null
        };

        PerformanceCalculator? performanceCalculator =
            ruleset.CreatePerformanceCalculator();

        if (performanceCalculator == null)
        {
            throw new RpcException(
                new Status(
                    StatusCode.Unimplemented,
                    "Performance calculation is not supported " +
                    "for this ruleset."
                )
            );
        }

        PerformanceAttributes performanceAttributes =
            performanceCalculator.Calculate(
                scoreInfo,
                difficultyAttributes
            );

        double clockRate = CalculateClockRate(mods);

        var response = new PerformanceResponse
        {
            HitResults = new HitResultResponse
            {
                MaxCombo = (uint)scoreInfo.MaxCombo,
                Accuracy = accuracy,

                Count300 = (uint)statistics.GetValueOrDefault(
                    HitResult.Great
                ),

                Count100 = request.RulesetId == 2
                    ? (uint)statistics.GetValueOrDefault(
                        HitResult.LargeTickHit
                    )
                    : (uint)statistics.GetValueOrDefault(
                        HitResult.Ok
                    ),

                Count50 = request.RulesetId == 2
                    ? (uint)statistics.GetValueOrDefault(
                        HitResult.SmallTickHit
                    )
                    : (uint)statistics.GetValueOrDefault(
                        HitResult.Meh
                    ),

                CountMiss = (uint)statistics.GetValueOrDefault(
                    HitResult.Miss
                ),

                CountGeki = (uint)statistics.GetValueOrDefault(
                    HitResult.Perfect
                ),

                CountKatu = request.RulesetId == 2
                    ? (uint)statistics.GetValueOrDefault(
                        HitResult.SmallTickMiss
                    )
                    : (uint)statistics.GetValueOrDefault(
                        HitResult.Good
                    ),

                CountLargeTickHits =
                    (uint)statistics.GetValueOrDefault(
                        HitResult.LargeTickHit
                    ),

                CountSliderTailHits =
                    (uint)statistics.GetValueOrDefault(
                        HitResult.SliderTailHit
                    ),

                CountLargeTickMisses =
                    (uint)statistics.GetValueOrDefault(
                        HitResult.LargeTickMiss
                    ),

                CountSliderTailMisses =
                    (uint)statistics.GetValueOrDefault(
                        HitResult.IgnoreMiss
                    )
            },

            Difficulty = new DifficultyResponse
            {
                Beatmap = CalculateAdjustedAttributes(
                    playableBeatmap,
                    clockRate
                )
            }
        };

        response.Difficulty.Attributes.Add(
            ExtractAttributes(difficultyAttributes)
        );

        response.Attributes.Add(
            ExtractAttributes(performanceAttributes)
        );

        return response;
    }

    private Dictionary<HitResult, int> BuildExactStatistics(
        ScoreState score)
    {
        var result = new Dictionary<HitResult, int>();

        static int convert(uint value) => checked((int)value);

        void add(bool hasValue, uint value, HitResult hitResult)
        {
            if (hasValue)
            {
                result[hitResult] = convert(value);
            }
        }

        add(score.HasCount300, score.Count300, HitResult.Great);
        add(score.HasCount100, score.Count100, HitResult.Ok);
        add(score.HasCount50, score.Count50, HitResult.Meh);
        add(score.HasCountMiss, score.CountMiss, HitResult.Miss);
        add(score.HasCountGeki, score.CountGeki, HitResult.Perfect);
        add(score.HasCountKatu, score.CountKatu, HitResult.Good);

        add(
            score.HasCountSmallTickHits,
            score.CountSmallTickHits,
            HitResult.SmallTickHit
        );

        add(
            score.HasCountSmallTickMisses,
            score.CountSmallTickMisses,
            HitResult.SmallTickMiss
        );

        add(
            score.HasCountLargeTickHits,
            score.CountLargeTickHits,
            HitResult.LargeTickHit
        );

        add(
            score.HasCountLargeTickMisses,
            score.CountLargeTickMisses,
            HitResult.LargeTickMiss
        );

        add(
            score.HasCountSliderTailHits,
            score.CountSliderTailHits,
            HitResult.SliderTailHit
        );

        add(
            score.HasCountSliderTailMisses,
            score.CountSliderTailMisses,
            HitResult.IgnoreMiss
        );

        add(
            score.HasCountIgnoreHit,
            score.CountIgnoreHit,
            HitResult.IgnoreHit
        );

        add(
            score.HasCountIgnoreMiss,
            score.CountIgnoreMiss,
            HitResult.IgnoreMiss
        );

        add(
            score.HasCountSmallBonus,
            score.CountSmallBonus,
            HitResult.SmallBonus
        );

        add(
            score.HasCountLargeBonus,
            score.CountLargeBonus,
            HitResult.LargeBonus
        );

        return result;
    }

    private static void ValidateActualScore(
        PerformanceRequest request,
        IBeatmap playableBeatmap,
        IReadOnlyDictionary<HitResult, int> statistics)
    {
        if (
            request.RulesetId != 0 ||
            !request.HasPassedObjects
        )
        {
            return;
        }

        int primaryJudgements =
            statistics.GetValueOrDefault(HitResult.Great) +
            statistics.GetValueOrDefault(HitResult.Ok) +
            statistics.GetValueOrDefault(HitResult.Meh) +
            statistics.GetValueOrDefault(HitResult.Miss);

        if (primaryJudgements != request.PassedObjects)
        {
            throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    $"The score contains {primaryJudgements} basic " +
                    $"judgements but passed_objects is " +
                    $"{request.PassedObjects}."
                )
            );
        }

        if (playableBeatmap.HitObjects.Count != request.PassedObjects)
        {
            throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    $"The truncated beatmap contains " +
                    $"{playableBeatmap.HitObjects.Count} objects but " +
                    $"passed_objects is {request.PassedObjects}."
                )
            );
        }
    }

    private DifficultyAttributes CreateDifficultyAttributes(
        uint rulesetId,
        Mod[] mods,
        IReadOnlyDictionary<string, double> values)
    {
        DifficultyAttributes attributes = rulesetId switch
        {
            0 => new OsuDifficultyAttributes(),
            1 => new TaikoDifficultyAttributes(),
            2 => new CatchDifficultyAttributes(),
            3 => new ManiaDifficultyAttributes(),

            _ => throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    "Invalid ruleset ID"
                )
            )
        };

        attributes.Mods = mods;

        PropertyInfo[] properties =
            ObjectPropertiesCache.GetOrAdd(
                attributes.GetType(),
                type => type.GetProperties(
                    BindingFlags.Public |
                    BindingFlags.Instance |
                    BindingFlags.IgnoreCase
                )
            );

        foreach (
            KeyValuePair<string, double> value in values
        )
        {
            PropertyInfo? property =
                properties.FirstOrDefault(candidate =>
                    string.Equals(
                        candidate.Name,
                        value.Key,
                        StringComparison.OrdinalIgnoreCase
                    )
                );

            if (property is not { CanWrite: true })
            {
                continue;
            }

            Type targetType =
                Nullable.GetUnderlyingType(property.PropertyType) ??
                property.PropertyType;

            object converted = Convert.ChangeType(
                value.Value,
                targetType,
                CultureInfo.InvariantCulture
            );

            property.SetValue(attributes, converted);
        }

        return attributes;
    }

    private static string BuildModsKey(
        IEnumerable<ModMessage> mods,
        double? clockRate)
    {
        string modsKey = string.Join(
            ",",
            mods
                .OrderBy(mod => mod.Acronym)
                .Select(mod =>
                {
                    string settings = string.Join(
                        ";",
                        mod.Settings
                            .OrderBy(setting => setting.Key)
                            .Select(setting =>
                                $"{setting.Key}={setting.Value}"
                            )
                    );

                    return $"{mod.Acronym}[{settings}]";
                })
        );

        string rate = clockRate?.ToString(
            "R",
            CultureInfo.InvariantCulture
        ) ?? "default";

        return $"{modsKey}@{rate}";
    }
}