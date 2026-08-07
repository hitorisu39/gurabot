using System.Collections.Concurrent;
using System.Globalization;
using System.Reflection;
using System.Runtime.ExceptionServices;
using System.Threading.Channels;
using Calculator.Protos;
using Grpc.Core;
using osu.Framework.Bindables;
using osu.Game.Beatmaps;
using osu.Game.Rulesets;
using osu.Game.Rulesets.Catch;
using osu.Game.Rulesets.Difficulty;
using osu.Game.Rulesets.Difficulty.Preprocessing;
using osu.Game.Rulesets.Difficulty.Skills;
using osu.Game.Rulesets.Mania;
using osu.Game.Rulesets.Mods;
using osu.Game.Rulesets.Osu;
using osu.Game.Rulesets.Scoring;
using osu.Game.Rulesets.Taiko;
using osu.Game.Scoring;

namespace Calculator.Services;

public class CalculatorService : Calculator.Protos.Calculator.CalculatorBase
{
    private readonly BeatmapCache _cache;
    private readonly HitResultGeneration _hitResultGeneration;
    private readonly PartialDifficultyService _partialDifficultyService;
    private readonly FullDifficultyCache _fullDifficultyCache;
    private readonly CalculationConcurrencyLimiter _calculationLimiter;
    private readonly ILogger<CalculatorService> _logger;

    private static readonly ConcurrentDictionary<Type, ReadableProperty[]> ReadablePropertiesCache = new();
    private static readonly ConcurrentDictionary<Type, IReadOnlyDictionary<string, PropertyInfo>> ModPropertiesCache =
        new();
    private static readonly ConcurrentDictionary<Type, SkillMetadata> SkillMetadataCache = new();

    public CalculatorService(
        BeatmapCache cache,
        HitResultGeneration hitResultGeneration,
        PartialDifficultyService partialDifficultyService,
        FullDifficultyCache fullDifficultyCache,
        CalculationConcurrencyLimiter calculationLimiter,
        ILogger<CalculatorService> logger
    )
    {
        _cache = cache;
        _hitResultGeneration = hitResultGeneration;
        _partialDifficultyService = partialDifficultyService;
        _fullDifficultyCache = fullDifficultyCache;
        _calculationLimiter = calculationLimiter;
        _logger = logger;
    }

    private static Ruleset GetRuleset(uint id) =>
        id switch
        {
            0 => new OsuRuleset(),
            1 => new TaikoRuleset(),
            2 => new CatchRuleset(),
            3 => new ManiaRuleset(),
            _ => throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid ruleset ID")),
        };

    private Mod[] ParseMods(Ruleset ruleset, IEnumerable<ModMessage> modMessages, double? customClockRate)
    {
        var result = new List<Mod>();

        foreach (ModMessage reqMod in modMessages)
        {
            Mod? mod = ruleset.CreateModFromAcronym(reqMod.Acronym);
            if (mod == null)
                continue;

            IReadOnlyDictionary<string, PropertyInfo> properties = ModPropertiesCache.GetOrAdd(
                mod.GetType(),
                static type =>
                    type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                        .Where(property =>
                            property.GetIndexParameters().Length == 0
                            && property.GetGetMethod(nonPublic: false) is not null
                        )
                        .GroupBy(property => property.Name, ModPropertyNameComparer.Instance)
                        .ToDictionary(group => group.Key, group => group.First(), ModPropertyNameComparer.Instance)
            );

            foreach (KeyValuePair<string, string> setting in reqMod.Settings)
            {
                if (!properties.TryGetValue(setting.Key, out PropertyInfo? property))
                    continue;

                if (property.GetValue(mod) is IParseable parseableBindable)
                    parseableBindable.Parse(setting.Value, CultureInfo.InvariantCulture);
            }

            result.Add(mod);
        }

        if (customClockRate.HasValue)
        {
            ModRateAdjust? existingRateMod = null;

            foreach (Mod mod in result)
            {
                if (mod is ModRateAdjust rateAdjust)
                {
                    existingRateMod = rateAdjust;
                    break;
                }
            }

            if (existingRateMod != null)
            {
                existingRateMod.SpeedChange.Value = customClockRate.Value;
            }
            else if (Math.Abs(customClockRate.Value - 1.0) > 0.000001)
            {
                string acronym = customClockRate.Value > 1.0 ? "DT" : "HT";
                if (ruleset.CreateModFromAcronym(acronym) is ModRateAdjust rateMod)
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
        ReadableProperty[] properties = ReadablePropertiesCache.GetOrAdd(
            obj.GetType(),
            static type =>
                type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                    .Where(property =>
                        property.GetIndexParameters().Length == 0 && property.GetGetMethod(nonPublic: false) is not null
                    )
                    .Select(property => new ReadableProperty(property, LowerFirst(property.Name)))
                    .ToArray()
        );

        var result = new Dictionary<string, double>(properties.Length);

        foreach (ReadableProperty readableProperty in properties)
        {
            object? value;

            try
            {
                value = readableProperty.Property.GetValue(obj);
            }
            catch (Exception exception)
            {
                throw new InvalidOperationException(
                    $"Failed to read property {obj.GetType().FullName}.{readableProperty.Property.Name}.",
                    exception
                );
            }

            switch (value)
            {
                case double doubleValue:
                    result[readableProperty.Name] = doubleValue;
                    break;

                case int intValue:
                    result[readableProperty.Name] = intValue;
                    break;
            }
        }

        return result;
    }

    private DifficultyWithStrainsResult CalculateDifficultyWithStrains(
        CachedWorkingBeatmap cachedBeatmap,
        Ruleset ruleset,
        uint rulesetId,
        Mod[] mods,
        IEnumerable<ModMessage> modMessages,
        double? customClockRate,
        CancellationToken cancellationToken
    )
    {
        DifficultyCalculator calculator = ruleset.CreateDifficultyCalculator(cachedBeatmap.WorkingBeatmap);

        SingleSnapshotDifficultyCalculator.PreparedDifficultyContext prepared =
            SingleSnapshotDifficultyCalculator.Prepare(calculator, mods, cancellationToken);

        Skill[] skills = SingleSnapshotDifficultyCalculator.CreateSkills(
            calculator,
            prepared.PlayableBeatmap,
            prepared.PlayableMods
        );

        DifficultyHitObject[] difficultyObjects = SingleSnapshotDifficultyCalculator
            .CreateSortedDifficultyHitObjects(calculator, prepared.PlayableBeatmap, prepared.PlayableMods)
            .ToArray();

        foreach (DifficultyHitObject difficultyObject in difficultyObjects)
        {
            foreach (Skill skill in skills)
            {
                cancellationToken.ThrowIfCancellationRequested();
                skill.Process(difficultyObject);
            }
        }

        DifficultyAttributes attributes = SingleSnapshotDifficultyCalculator.CreateDifficultyAttributes(
            calculator,
            prepared.PlayableBeatmap,
            prepared.PlayableMods,
            skills
        );

        IReadOnlyList<SkillStrain> strains = BuildStrains(skills, difficultyObjects);

        var cacheKey = new FullDifficultyCacheKey(
            cachedBeatmap.Identity,
            rulesetId,
            CalculationKeyBuilder.BuildModsKey(modMessages, customClockRate),
            calculator.Version
        );

        _fullDifficultyCache.Set(cacheKey, DifficultyAttributeSnapshot.Capture(attributes));

        return new DifficultyWithStrainsResult(attributes, prepared.PlayableBeatmap, prepared.PlayableMods, strains);
    }

    private static IReadOnlyList<SkillStrain> BuildStrains(Skill[] skills, DifficultyHitObject[] hitObjects)
    {
        if (hitObjects.Length == 0)
            return Array.Empty<SkillStrain>();

        double timelineEnd = hitObjects[0].EndTime;

        for (int i = 1; i < hitObjects.Length; i++)
        {
            if (hitObjects[i].EndTime > timelineEnd)
                timelineEnd = hitObjects[i].EndTime;
        }

        var result = new List<SkillStrain>(skills.Length);
        var nameCounts = new Dictionary<string, int>(skills.Length);

        foreach (Skill skill in skills)
        {
            IReadOnlyList<double> values = skill.GetObjectDifficulties();

            if (values.Count != hitObjects.Length)
            {
                throw new InvalidOperationException(
                    $"Skill {skill.GetType().FullName} returned {values.Count} object difficulties for "
                        + $"{hitObjects.Length} difficulty hit objects."
                );
            }

            if (values.Count == 0)
                continue;

            string name = GetUniqueSkillName(skill, nameCounts);
            var strain = new SkillStrain { SkillName = name };

            if (hitObjects[0].StartTime > 0)
            {
                strain.Points.Add(new SkillStrainPoint { TimeMs = 0, Value = 0 });
            }

            for (int i = 0; i < values.Count; i++)
            {
                double value = values[i];
                if (!double.IsFinite(value))
                    value = 0;

                strain.Points.Add(
                    new SkillStrainPoint { TimeMs = Math.Max(0, hitObjects[i].StartTime), Value = Math.Max(0, value) }
                );
            }

            double lastPointTime = strain.Points[^1].TimeMs;

            if (timelineEnd > lastPointTime)
            {
                strain.Points.Add(new SkillStrainPoint { TimeMs = timelineEnd, Value = 0 });
            }

            result.Add(strain);
        }

        return result;
    }

    private static string GetSkillName(Skill skill)
    {
        Type type = skill.GetType();

        SkillMetadata metadata = SkillMetadataCache.GetOrAdd(
            type,
            static skillType => new SkillMetadata(
                skillType.GetField(
                    "IncludeSliders",
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic
                )
            )
        );

        string name = type.Name;

        if (metadata.IncludeSlidersField != null && metadata.IncludeSlidersField.GetValue(skill) is false)
        {
            name += "NoSliders";
        }

        return name;
    }

    private static string GetUniqueSkillName(Skill skill, Dictionary<string, int> nameCounts)
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
            ClockRate = clockRate,
        };
    }

    private static double CalculateClockRate(Mod[] mods)
    {
        double rate = 1.0;

        foreach (Mod mod in mods)
        {
            if (mod is IApplicableToRate applicableToRate)
                rate = applicableToRate.ApplyToRate(0, rate);
        }

        return rate;
    }

    private FullDifficultyContext GetOrCalculateFullDifficulty(
        CachedWorkingBeatmap cachedBeatmap,
        Ruleset ruleset,
        uint rulesetId,
        Mod[] mods,
        IEnumerable<ModMessage> modMessages,
        double? customClockRate,
        CancellationToken cancellationToken
    )
    {
        DifficultyCalculator calculator = ruleset.CreateDifficultyCalculator(cachedBeatmap.WorkingBeatmap);

        var key = new FullDifficultyCacheKey(
            cachedBeatmap.Identity,
            rulesetId,
            CalculationKeyBuilder.BuildModsKey(modMessages, customClockRate),
            calculator.Version
        );

        DifficultyAttributes? locallyCalculatedAttributes = null;
        SingleSnapshotDifficultyCalculator.PreparedDifficultyContext? locallyPreparedContext = null;

        DifficultyAttributeSnapshot snapshot = _fullDifficultyCache.GetOrCreate(
            key,
            () =>
            {
                locallyCalculatedAttributes = calculator.Calculate(mods, cancellationToken);
                locallyPreparedContext = SingleSnapshotDifficultyCalculator.GetPreparedContext(calculator);
                return DifficultyAttributeSnapshot.Capture(locallyCalculatedAttributes);
            }
        );

        if (locallyCalculatedAttributes != null && locallyPreparedContext.HasValue)
        {
            SingleSnapshotDifficultyCalculator.PreparedDifficultyContext prepared = locallyPreparedContext.Value;
            return new FullDifficultyContext(
                locallyCalculatedAttributes,
                prepared.PlayableBeatmap,
                prepared.PlayableMods
            );
        }

        cancellationToken.ThrowIfCancellationRequested();

        Mod[] playableMods = CloneMods(mods);

        IBeatmap playableBeatmap = cachedBeatmap.WorkingBeatmap.GetPlayableBeatmap(
            ruleset.RulesetInfo,
            playableMods,
            cancellationToken
        );

        DifficultyAttributes attributes = snapshot.Restore(rulesetId, playableMods);

        return new FullDifficultyContext(attributes, playableBeatmap, playableMods);
    }

    private static Mod[] CloneMods(Mod[] mods)
    {
        if (mods.Length == 0)
            return Array.Empty<Mod>();

        var result = new Mod[mods.Length];
        for (int i = 0; i < mods.Length; i++)
        {
            result[i] = mods[i].DeepClone();
        }

        return result;
    }

    public override Task<DifficultyResponse> CalculateDifficulty(DifficultyRequest request, ServerCallContext context)
    {
        return _calculationLimiter.RunAsync(
            () => CalculateDifficultyCore(request, context.CancellationToken),
            context.CancellationToken
        );
    }

    private DifficultyResponse CalculateDifficultyCore(DifficultyRequest request, CancellationToken cancellationToken)
    {
        Ruleset ruleset = GetRuleset(request.RulesetId);
        double? customClockRate = request.HasClockRate ? request.ClockRate : null;
        Mod[] mods = ParseMods(ruleset, request.Mods, customClockRate);
        CachedWorkingBeatmap cachedBeatmap = _cache.GetBeatmap(request.BeatmapPath);

        DifficultyAttributes difficultyAttributes;
        IBeatmap playableBeatmap;
        Mod[] playableMods;
        IReadOnlyList<SkillStrain>? strains = null;

        if (request.HasPassedObjects)
        {
            if (request.PassedObjects == 0)
            {
                throw new RpcException(
                    new Status(StatusCode.InvalidArgument, "passed_objects must be greater than zero.")
                );
            }

            if (request.CalculateStrains)
            {
                throw new RpcException(
                    new Status(StatusCode.Unimplemented, "Strain calculation for partial difficulty is not supported.")
                );
            }

            PartialDifficultyResult partial = _partialDifficultyService.Calculate(
                cachedBeatmap,
                ruleset,
                request.RulesetId,
                mods,
                request.Mods,
                customClockRate,
                request.PassedObjects,
                cancellationToken
            );

            difficultyAttributes = partial.Attributes;
            playableBeatmap = partial.PlayableBeatmap;
            playableMods = difficultyAttributes.Mods;
        }
        else if (request.CalculateStrains)
        {
            DifficultyWithStrainsResult calculated = CalculateDifficultyWithStrains(
                cachedBeatmap,
                ruleset,
                request.RulesetId,
                mods,
                request.Mods,
                customClockRate,
                cancellationToken
            );

            difficultyAttributes = calculated.Attributes;
            playableBeatmap = calculated.PlayableBeatmap;
            playableMods = calculated.PlayableMods;
            strains = calculated.Strains;
        }
        else
        {
            FullDifficultyContext calculated = GetOrCalculateFullDifficulty(
                cachedBeatmap,
                ruleset,
                request.RulesetId,
                mods,
                request.Mods,
                customClockRate,
                cancellationToken
            );

            difficultyAttributes = calculated.Attributes;
            playableBeatmap = calculated.PlayableBeatmap;
            playableMods = calculated.PlayableMods;
        }

        double clockRate = CalculateClockRate(playableMods);

        var response = new DifficultyResponse { Beatmap = CalculateAdjustedAttributes(playableBeatmap, clockRate) };

        response.Attributes.Add(ExtractAttributes(difficultyAttributes));

        if (strains != null)
        {
            response.Strains.AddRange(strains);
        }

        return response;
    }

    public override async Task CalculatePerformanceStream(
        IAsyncStreamReader<PerformanceRequest> requestStream,
        IServerStreamWriter<PerformanceResponse> responseStream,
        ServerCallContext context
    )
    {
        using var writeLock = new SemaphoreSlim(1, 1);
        using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(context.CancellationToken);
        CancellationToken cancellationToken = linkedCancellation.Token;

        int workerCount = Math.Max(1, _calculationLimiter.MaxConcurrency);
        int queueCapacity = Math.Max(workerCount, workerCount * 2);

        Channel<PerformanceRequest> channel = Channel.CreateBounded<PerformanceRequest>(
            new BoundedChannelOptions(queueCapacity)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleWriter = true,
                SingleReader = workerCount == 1,
                AllowSynchronousContinuations = false,
            }
        );

        Exception? workerFailure = null;
        var workers = new Task[workerCount];

        for (int i = 0; i < workers.Length; i++)
        {
            workers[i] = consume();
        }

        try
        {
            await foreach (PerformanceRequest request in requestStream.ReadAllAsync(cancellationToken))
            {
                await channel.Writer.WriteAsync(request, cancellationToken);
            }

            channel.Writer.TryComplete();
            await Task.WhenAll(workers);
        }
        catch (OperationCanceledException) when (Volatile.Read(ref workerFailure) is Exception failure)
        {
            channel.Writer.TryComplete(failure);
            await ObserveWorkers(workers);
            ExceptionDispatchInfo.Capture(failure).Throw();
            throw;
        }
        catch
        {
            linkedCancellation.Cancel();
            channel.Writer.TryComplete();
            await ObserveWorkers(workers);
            throw;
        }

        async Task consume()
        {
            try
            {
                await foreach (PerformanceRequest request in channel.Reader.ReadAllAsync(cancellationToken))
                {
                    await processRequest(request);
                }
            }
            catch (OperationCanceledException) when (linkedCancellation.IsCancellationRequested)
            {
                if (context.CancellationToken.IsCancellationRequested || Volatile.Read(ref workerFailure) != null)
                {
                    return;
                }

                throw;
            }
            catch (Exception exception)
            {
                if (Interlocked.CompareExchange(ref workerFailure, exception, null) == null)
                {
                    channel.Writer.TryComplete(exception);
                    linkedCancellation.Cancel();
                }

                throw;
            }
        }

        async Task processRequest(PerformanceRequest request)
        {
            try
            {
                PerformanceResponse response = await _calculationLimiter.RunAsync(
                    () => CalculatePerformanceCore(request, cancellationToken),
                    cancellationToken
                );

                if (request.HasReferenceId)
                {
                    response.ReferenceId = request.ReferenceId;
                }

                await writeLock.WaitAsync(cancellationToken);

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
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                CalculatorLog.PerformanceCalculationFailed(
                    _logger,
                    exception,
                    request.RulesetId,
                    request.BeatmapPath,
                    request.HasReferenceId ? request.ReferenceId : null
                );

                throw new RpcException(new Status(StatusCode.Internal, "Performance calculation failed."));
            }
        }
    }

    private static async Task ObserveWorkers(Task[] workers)
    {
        try
        {
            await Task.WhenAll(workers);
        }
        catch { }
    }

    public override Task<PerformanceResponse> CalculatePerformance(
        PerformanceRequest request,
        ServerCallContext context
    )
    {
        return _calculationLimiter.RunAsync(
            () => CalculatePerformanceCore(request, context.CancellationToken),
            context.CancellationToken
        );
    }

    private PerformanceResponse CalculatePerformanceCore(
        PerformanceRequest request,
        CancellationToken cancellationToken
    )
    {
        Ruleset ruleset = GetRuleset(request.RulesetId);
        double? customClockRate = request.HasClockRate ? request.ClockRate : null;
        Mod[] mods = ParseMods(ruleset, request.Mods, customClockRate);
        CachedWorkingBeatmap cachedBeatmap = _cache.GetBeatmap(request.BeatmapPath);

        bool isActual = request.Score.Kind == ScoreStateKind.Actual;

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
        Mod[] playableMods;

        if (request.HasPassedObjects)
        {
            if (request.PassedObjects == 0)
            {
                throw new RpcException(
                    new Status(StatusCode.InvalidArgument, "passed_objects must be greater than zero.")
                );
            }

            PartialDifficultyResult partial = _partialDifficultyService.Calculate(
                cachedBeatmap,
                ruleset,
                request.RulesetId,
                mods,
                request.Mods,
                customClockRate,
                request.PassedObjects,
                cancellationToken
            );

            difficultyAttributes = partial.Attributes;
            playableBeatmap = partial.PlayableBeatmap;
            playableMods = difficultyAttributes.Mods;
        }
        else if (request.PrecalculatedDifficulty.Count > 0)
        {
            playableMods = CloneMods(mods);

            playableBeatmap = cachedBeatmap.WorkingBeatmap.GetPlayableBeatmap(
                ruleset.RulesetInfo,
                playableMods,
                cancellationToken
            );

            difficultyAttributes = DifficultyAttributeSnapshot.Create(
                request.RulesetId,
                playableMods,
                request.PrecalculatedDifficulty
            );
        }
        else
        {
            FullDifficultyContext calculated = GetOrCalculateFullDifficulty(
                cachedBeatmap,
                ruleset,
                request.RulesetId,
                mods,
                request.Mods,
                customClockRate,
                cancellationToken
            );

            difficultyAttributes = calculated.Attributes;
            playableBeatmap = calculated.PlayableBeatmap;
            playableMods = calculated.PlayableMods;
        }

        Dictionary<HitResult, int> statistics;

        if (isActual)
        {
            statistics = BuildExactStatistics(request.Score);
            ValidateActualScore(request);
        }
        else
        {
            statistics = _hitResultGeneration.Generate(request.RulesetId, playableBeatmap, playableMods, request.Score);
        }

        double accuracy;

        if (isActual && request.Score.HasAccuracy)
        {
            accuracy = Math.Clamp(request.Score.Accuracy, 0, 1);
        }
        else
        {
            accuracy = _hitResultGeneration.GetAccuracyForRuleset(
                request.RulesetId,
                playableBeatmap,
                statistics,
                playableMods
            );
        }

        var scoreInfo = new ScoreInfo
        {
            Ruleset = ruleset.RulesetInfo,
            Mods = playableMods,
            MaxCombo = request.Score.HasMaxCombo ? checked((int)request.Score.MaxCombo) : difficultyAttributes.MaxCombo,
            Statistics = statistics,
            Accuracy = accuracy,
            BeatmapInfo = playableBeatmap.BeatmapInfo,
            TotalScore = request.HasTotalScore ? request.TotalScore : 0,
            LegacyTotalScore = request.HasLegacyTotalScore ? request.LegacyTotalScore : null,
        };

        PerformanceCalculator? performanceCalculator = ruleset.CreatePerformanceCalculator();

        if (performanceCalculator == null)
        {
            throw new RpcException(
                new Status(StatusCode.Unimplemented, "Performance calculation is not supported for this ruleset.")
            );
        }

        PerformanceAttributes performanceAttributes = performanceCalculator.Calculate(scoreInfo, difficultyAttributes);

        double clockRate = CalculateClockRate(playableMods);

        var response = new PerformanceResponse
        {
            HitResults = new HitResultResponse
            {
                MaxCombo = (uint)scoreInfo.MaxCombo,
                Accuracy = accuracy,
                Count300 = (uint)statistics.GetValueOrDefault(HitResult.Great),
                Count100 =
                    request.RulesetId == 2
                        ? (uint)statistics.GetValueOrDefault(HitResult.LargeTickHit)
                        : (uint)statistics.GetValueOrDefault(HitResult.Ok),
                Count50 =
                    request.RulesetId == 2
                        ? (uint)statistics.GetValueOrDefault(HitResult.SmallTickHit)
                        : (uint)statistics.GetValueOrDefault(HitResult.Meh),
                CountMiss = (uint)statistics.GetValueOrDefault(HitResult.Miss),
                CountGeki = (uint)statistics.GetValueOrDefault(HitResult.Perfect),
                CountKatu =
                    request.RulesetId == 2
                        ? (uint)statistics.GetValueOrDefault(HitResult.SmallTickMiss)
                        : (uint)statistics.GetValueOrDefault(HitResult.Good),
                CountLargeTickHits = (uint)statistics.GetValueOrDefault(HitResult.LargeTickHit),
                CountSliderTailHits = (uint)statistics.GetValueOrDefault(HitResult.SliderTailHit),
                CountLargeTickMisses = (uint)statistics.GetValueOrDefault(HitResult.LargeTickMiss),
                CountSliderTailMisses = (uint)statistics.GetValueOrDefault(HitResult.IgnoreMiss),
            },

            Difficulty = new DifficultyResponse { Beatmap = CalculateAdjustedAttributes(playableBeatmap, clockRate) },
        };

        response.Difficulty.Attributes.Add(ExtractAttributes(difficultyAttributes));
        response.Attributes.Add(ExtractAttributes(performanceAttributes));

        return response;
    }

    private static Dictionary<HitResult, int> BuildExactStatistics(ScoreState score)
    {
        var result = new Dictionary<HitResult, int>(16);

        static int convert(uint value) => checked((int)value);

        void add(bool hasValue, uint value, HitResult hitResult)
        {
            if (hasValue)
                result[hitResult] = convert(value);
        }

        add(score.HasCount300, score.Count300, HitResult.Great);
        add(score.HasCount100, score.Count100, HitResult.Ok);
        add(score.HasCount50, score.Count50, HitResult.Meh);
        add(score.HasCountMiss, score.CountMiss, HitResult.Miss);
        add(score.HasCountGeki, score.CountGeki, HitResult.Perfect);
        add(score.HasCountKatu, score.CountKatu, HitResult.Good);
        add(score.HasCountSmallTickHits, score.CountSmallTickHits, HitResult.SmallTickHit);
        add(score.HasCountSmallTickMisses, score.CountSmallTickMisses, HitResult.SmallTickMiss);
        add(score.HasCountLargeTickHits, score.CountLargeTickHits, HitResult.LargeTickHit);
        add(score.HasCountLargeTickMisses, score.CountLargeTickMisses, HitResult.LargeTickMiss);
        add(score.HasCountSliderTailHits, score.CountSliderTailHits, HitResult.SliderTailHit);
        add(score.HasCountSliderTailMisses, score.CountSliderTailMisses, HitResult.IgnoreMiss);

        if (!score.HasCountSliderTailHits)
            add(score.HasCountIgnoreHit, score.CountIgnoreHit, HitResult.IgnoreHit);

        if (!score.HasCountSliderTailMisses)
            add(score.HasCountIgnoreMiss, score.CountIgnoreMiss, HitResult.IgnoreMiss);

        add(score.HasCountSmallBonus, score.CountSmallBonus, HitResult.SmallBonus);
        add(score.HasCountLargeBonus, score.CountLargeBonus, HitResult.LargeBonus);

        return result;
    }

    private static void ValidateActualScore(PerformanceRequest request)
    {
        if (!request.HasPassedObjects)
            return;

        int playedEvents = GetPlayedEventCount(request.RulesetId, request.Score);

        if (playedEvents != request.PassedObjects)
        {
            throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    $"The score contains {playedEvents} played events but passed_objects is {request.PassedObjects}."
                )
            );
        }
    }

    private static int GetPlayedEventCount(uint rulesetId, ScoreState score)
    {
        static int get(bool present, uint value) => present ? checked((int)value) : 0;

        return rulesetId switch
        {
            0 => get(score.HasCount300, score.Count300)
                + get(score.HasCount100, score.Count100)
                + get(score.HasCount50, score.Count50)
                + get(score.HasCountMiss, score.CountMiss),

            1 => get(score.HasCount300, score.Count300)
                + get(score.HasCount100, score.Count100)
                + get(score.HasCountMiss, score.CountMiss),

            2 => get(score.HasCount300, score.Count300)
                + get(score.HasCountLargeTickHits, score.CountLargeTickHits)
                + get(score.HasCountSmallTickHits, score.CountSmallTickHits)
                + get(score.HasCountSmallTickMisses, score.CountSmallTickMisses)
                + get(score.HasCountMiss, score.CountMiss),

            3 => get(score.HasCountGeki, score.CountGeki)
                + get(score.HasCount300, score.Count300)
                + get(score.HasCountKatu, score.CountKatu)
                + get(score.HasCount100, score.Count100)
                + get(score.HasCount50, score.Count50)
                + get(score.HasCountMiss, score.CountMiss),

            _ => throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid ruleset ID.")),
        };
    }

    private static string LowerFirst(string value)
    {
        if (string.IsNullOrEmpty(value))
            return value;

        return char.ToLowerInvariant(value[0]) + value[1..];
    }

    private readonly record struct ReadableProperty(PropertyInfo Property, string Name);

    private readonly record struct SkillMetadata(FieldInfo? IncludeSlidersField);

    private readonly record struct FullDifficultyContext(
        DifficultyAttributes Attributes,
        IBeatmap PlayableBeatmap,
        Mod[] PlayableMods
    );

    private readonly record struct DifficultyWithStrainsResult(
        DifficultyAttributes Attributes,
        IBeatmap PlayableBeatmap,
        Mod[] PlayableMods,
        IReadOnlyList<SkillStrain> Strains
    );

    private sealed class ModPropertyNameComparer : IEqualityComparer<string>
    {
        public static ModPropertyNameComparer Instance { get; } = new();

        public bool Equals(string? x, string? y)
        {
            if (ReferenceEquals(x, y))
                return true;

            if (x == null || y == null)
                return false;

            int xIndex = 0;
            int yIndex = 0;

            while (true)
            {
                while (xIndex < x.Length && x[xIndex] == '_')
                    xIndex++;

                while (yIndex < y.Length && y[yIndex] == '_')
                    yIndex++;

                bool xEnded = xIndex >= x.Length;
                bool yEnded = yIndex >= y.Length;

                if (xEnded || yEnded)
                    return xEnded && yEnded;

                if (char.ToUpperInvariant(x[xIndex]) != char.ToUpperInvariant(y[yIndex]))
                    return false;

                xIndex++;
                yIndex++;
            }
        }

        public int GetHashCode(string obj)
        {
            unchecked
            {
                int hash = 17;

                foreach (char character in obj)
                {
                    if (character == '_')
                        continue;

                    hash = hash * 31 + char.ToUpperInvariant(character);
                }

                return hash;
            }
        }
    }
}
