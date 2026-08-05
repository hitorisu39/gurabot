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
    private readonly PartialDifficultyService _partialDifficultyService;
    private readonly CalculationConcurrencyLimiter _calculationLimiter;
    private readonly ILogger<CalculatorService> _logger;

    private static readonly ConcurrentDictionary<Type, PropertyInfo[]> ObjectPropertiesCache = new();
    private static readonly ConcurrentDictionary<Type, Dictionary<string, PropertyInfo>> ModPropertiesCache = new();

    public CalculatorService(
        BeatmapCache cache,
        HitResultGeneration hitResultGeneration,
        PartialDifficultyService partialDifficultyService,
        CalculationConcurrencyLimiter calculationLimiter,
        ILogger<CalculatorService> logger)
    {
        _cache = cache;
        _hitResultGeneration = hitResultGeneration;
        _partialDifficultyService = partialDifficultyService;
        _calculationLimiter = calculationLimiter;
        _logger = logger;
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
            var properties =
                ModPropertiesCache.GetOrAdd(
                    modType,
                    type => type
                        .GetProperties(
                            BindingFlags.Public |
                            BindingFlags.Instance |
                            BindingFlags.IgnoreCase
                        )
                        .Where(property =>
                            property.GetIndexParameters().Length == 0 &&
                            property.GetGetMethod(nonPublic: false) is not null
                        )
                        .GroupBy(
                            property => property.Name.Replace("_", ""),
                            StringComparer.OrdinalIgnoreCase
                        )
                        .ToDictionary(
                            group => group.Key,
                            group => group.First(),
                            StringComparer.OrdinalIgnoreCase
                        )
                );

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
        var result = new Dictionary<string, double>();

        PropertyInfo[] properties =
            ObjectPropertiesCache.GetOrAdd(
                obj.GetType(),
                type => type.GetProperties(
                    BindingFlags.Public |
                    BindingFlags.Instance
                )
            );

        foreach (PropertyInfo property in properties)
        {
            if (
                property.GetIndexParameters().Length != 0 ||
                property.GetGetMethod(nonPublic: false) is null
            )
            {
                continue;
            }

            object? value;

            try
            {
                value = property.GetValue(obj);
            }
            catch (Exception exception)
            {
                throw new InvalidOperationException(
                    $"Failed to read property " +
                    $"{obj.GetType().FullName}.{property.Name}.",
                    exception
                );
            }

            string name =
                char.ToLowerInvariant(property.Name[0]) +
                property.Name[1..];

            switch (value)
            {
                case double doubleValue:
                    result[name] = doubleValue;
                    break;

                case int intValue:
                    result[name] = intValue;
                    break;
            }
        }

        return result;
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

    public override Task<DifficultyResponse> CalculateDifficulty(
        DifficultyRequest request,
        ServerCallContext context)
    {
        return _calculationLimiter.RunAsync(
            () => CalculateDifficultyCore(
                request,
                context.CancellationToken),
            context.CancellationToken);
    }

    private DifficultyResponse CalculateDifficultyCore(
        DifficultyRequest request,
        CancellationToken cancellationToken)
    {
        Ruleset ruleset = GetRuleset(request.RulesetId);

        Mod[] mods = ParseMods(
            ruleset,
            request.Mods,
            request.HasClockRate
                ? request.ClockRate
                : null);

        CachedWorkingBeatmap cachedBeatmap =
            _cache.GetBeatmap(request.BeatmapPath);

        DifficultyAttributes difficultyAttributes;
        IBeatmap playableBeatmap;
        DifficultyCalculator? difficultyCalculator = null;

        if (request.HasPassedObjects)
        {
            if (request.PassedObjects == 0)
            {
                throw new RpcException(
                    new Status(
                        StatusCode.InvalidArgument,
                        "passed_objects must be greater than zero."));
            }

            if (request.CalculateStrains)
            {
                throw new RpcException(
                    new Status(
                        StatusCode.Unimplemented,
                        "Strain calculation for partial difficulty is not supported."));
            }

            PartialDifficultyResult partial =
                _partialDifficultyService.Calculate(
                    cachedBeatmap,
                    ruleset,
                    request.RulesetId,
                    mods,
                    request.Mods,
                    request.HasClockRate
                        ? request.ClockRate
                        : null,
                    request.PassedObjects,
                    cancellationToken);

            difficultyAttributes = partial.Attributes;
            playableBeatmap = partial.PlayableBeatmap;
        }
        else
        {
            difficultyCalculator =
                ruleset.CreateDifficultyCalculator(
                    cachedBeatmap.WorkingBeatmap);

            difficultyAttributes =
                difficultyCalculator.Calculate(
                    mods,
                    cancellationToken);

            playableBeatmap =
                cachedBeatmap.WorkingBeatmap.GetPlayableBeatmap(
                    ruleset.RulesetInfo,
                    mods,
                    cancellationToken);
        }

        double clockRate = CalculateClockRate(mods);

        var response = new DifficultyResponse
        {
            Beatmap = CalculateAdjustedAttributes(
                playableBeatmap,
                clockRate)
        };

        response.Attributes.Add(
            ExtractAttributes(difficultyAttributes));

        if (request.CalculateStrains)
        {
            var strains = GetStrains(
                difficultyCalculator!,
                playableBeatmap,
                mods);

            response.Strains.AddRange(strains);
        }

        return response;
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
                        () => CalculatePerformanceCore(
                            request,
                            context.CancellationToken
                        ),
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
                _logger.LogError(
                    exception,
                    "Performance calculation failed. " +
                    "Ruleset={RulesetId}, Beatmap={BeatmapPath}, " +
                    "ReferenceId={ReferenceId}",
                    request.RulesetId,
                    request.BeatmapPath,
                    request.HasReferenceId
                        ? request.ReferenceId
                        : null
                );

                throw new RpcException(
                    new Status(
                        StatusCode.Internal,
                        "Performance calculation failed."
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
            () => CalculatePerformanceCore(
                request,
                context.CancellationToken
            ),
            context.CancellationToken
        );
    }

    private PerformanceResponse CalculatePerformanceCore(
        PerformanceRequest request,
        CancellationToken cancellationToken)
    {
        Ruleset ruleset = GetRuleset(request.RulesetId);

        Mod[] mods = ParseMods(
            ruleset,
            request.Mods,
            request.HasClockRate
                ? request.ClockRate
                : null
        );

        CachedWorkingBeatmap cachedBeatmap =
            _cache.GetBeatmap(request.BeatmapPath);

        bool isActual =
            request.Score.Kind == ScoreStateKind.Actual;

        if (request.HasPassedObjects && !isActual)
        {
            throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    "Partial performance calculation requires an actual score state."
                )
            );
        }

        DifficultyAttributes difficultyAttributes;
        IBeatmap playableBeatmap;

        if (request.HasPassedObjects)
        {
            if (request.PassedObjects == 0)
            {
                throw new RpcException(
                    new Status(
                        StatusCode.InvalidArgument,
                        "passed_objects must be greater than zero."
                    )
                );
            }

            PartialDifficultyResult partial =
                _partialDifficultyService.Calculate(
                    cachedBeatmap,
                    ruleset,
                    request.RulesetId,
                    mods,
                    request.Mods,
                    request.HasClockRate
                        ? request.ClockRate
                        : null,
                    request.PassedObjects,
                    cancellationToken
                );

            difficultyAttributes = partial.Attributes;
            playableBeatmap = partial.PlayableBeatmap;
        }
        else
        {
            playableBeatmap =
                cachedBeatmap.WorkingBeatmap.GetPlayableBeatmap(
                    ruleset.RulesetInfo,
                    mods
                );

            if (request.PrecalculatedDifficulty.Count > 0)
            {
                difficultyAttributes =
                    CreateDifficultyAttributes(
                        request.RulesetId,
                        mods,
                        request.PrecalculatedDifficulty
                    );
            }
            else
            {
                DifficultyCalculator difficultyCalculator =
                    ruleset.CreateDifficultyCalculator(
                        cachedBeatmap.WorkingBeatmap
                    );

                difficultyAttributes =
                    difficultyCalculator.Calculate(mods);
            }
        }

        Dictionary<HitResult, int> statistics;

        if (isActual)
        {
            statistics = BuildExactStatistics(request.Score);
            ValidateActualScore(request);
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

        if (!score.HasCountSliderTailHits)
        {
            add(
                score.HasCountIgnoreHit,
                score.CountIgnoreHit,
                HitResult.IgnoreHit
            );
        }

        if (!score.HasCountSliderTailMisses)
        {
            add(
                score.HasCountIgnoreMiss,
                score.CountIgnoreMiss,
                HitResult.IgnoreMiss
            );
        }

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
        PerformanceRequest request)
    {
        if (!request.HasPassedObjects)
        {
            return;
        }

        int playedEvents = GetPlayedEventCount(
            request.RulesetId,
            request.Score
        );

        if (playedEvents != request.PassedObjects)
        {
            throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    $"The score contains {playedEvents} played " +
                    $"events but passed_objects is " +
                    $"{request.PassedObjects}."
                )
            );
        }
    }

    private static int GetPlayedEventCount(
        uint rulesetId,
        ScoreState score)
    {
        static int get(bool present, uint value) =>
            present ? checked((int)value) : 0;

        return rulesetId switch
        {
            0 =>
                get(score.HasCount300, score.Count300) +
                get(score.HasCount100, score.Count100) +
                get(score.HasCount50, score.Count50) +
                get(score.HasCountMiss, score.CountMiss),

            1 =>
                get(score.HasCount300, score.Count300) +
                get(score.HasCount100, score.Count100) +
                get(score.HasCountMiss, score.CountMiss),

            2 =>
                get(score.HasCount300, score.Count300) +
                get(
                    score.HasCountLargeTickHits,
                    score.CountLargeTickHits
                ) +
                get(
                    score.HasCountSmallTickHits,
                    score.CountSmallTickHits
                ) +
                get(
                    score.HasCountSmallTickMisses,
                    score.CountSmallTickMisses
                ) +
                get(score.HasCountMiss, score.CountMiss),

            3 =>
                get(score.HasCountGeki, score.CountGeki) +
                get(score.HasCount300, score.Count300) +
                get(score.HasCountKatu, score.CountKatu) +
                get(score.HasCount100, score.Count100) +
                get(score.HasCount50, score.Count50) +
                get(score.HasCountMiss, score.CountMiss),

            _ => throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    "Invalid ruleset ID."
                )
            )
        };
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
}
