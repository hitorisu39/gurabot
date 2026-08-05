using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using Calculator.Protos;
using Grpc.Core;
using osu.Game.Beatmaps;
using osu.Game.Rulesets;
using osu.Game.Rulesets.Catch.Beatmaps;
using osu.Game.Rulesets.Catch.Difficulty;
using osu.Game.Rulesets.Catch.Objects;
using osu.Game.Rulesets.Difficulty;
using osu.Game.Rulesets.Mania.Difficulty;
using osu.Game.Rulesets.Mania.Objects;
using osu.Game.Rulesets.Mods;
using osu.Game.Rulesets.Objects;
using osu.Game.Rulesets.Osu.Difficulty;
using osu.Game.Rulesets.Taiko.Difficulty;

using ManiaNote = osu.Game.Rulesets.Mania.Objects.Note;
using TaikoHit = osu.Game.Rulesets.Taiko.Objects.Hit;

namespace Calculator.Services;

public sealed record PartialDifficultyResult(
    DifficultyAttributes Attributes,
    IBeatmap PlayableBeatmap,
    uint PlayedEvents,
    double ProgressTime,
    double SnapshotTime);

public sealed class PartialDifficultyService
{
    private static readonly ConcurrentDictionary<
        Type,
        PropertyInfo[]
    > readablePropertiesCache = new();

    private static readonly ConcurrentDictionary<
        Type,
        IReadOnlyDictionary<string, PropertyInfo>
    > writablePropertiesCache = new();

    private readonly PartialDifficultyCache cache;
    private readonly ILogger<PartialDifficultyService> logger;

    public PartialDifficultyService(
        PartialDifficultyCache cache,
        ILogger<PartialDifficultyService> logger)
    {
        this.cache = cache;
        this.logger = logger;
    }

    public PartialDifficultyResult Calculate(
        CachedWorkingBeatmap source,
        Ruleset ruleset,
        uint rulesetId,
        Mod[] mods,
        IEnumerable<ModMessage> modMessages,
        double? customClockRate,
        uint playedEvents,
        CancellationToken cancellationToken)
    {
        long totalStarted = Stopwatch.GetTimestamp();
        cancellationToken.ThrowIfCancellationRequested();

        DifficultyCalculator calculator =
            ruleset.CreateDifficultyCalculator(
                source.WorkingBeatmap);

        SingleSnapshotDifficultyCalculator.PreparedDifficultyContext prepared =
            SingleSnapshotDifficultyCalculator.Prepare(
                calculator,
                mods,
                cancellationToken);

        IBeatmap playableBeatmap = prepared.PlayableBeatmap;
        Mod[] playableMods = prepared.PlayableMods;

        double preparationMilliseconds =
            Stopwatch.GetElapsedTime(totalStarted).TotalMilliseconds;

        double progressTime = ResolveProgressTime(
            rulesetId,
            playableBeatmap,
            playedEvents);

        PartialSnapshot snapshot = ResolveSnapshot(
            playableBeatmap,
            progressTime);

        if (snapshot.TopLevelObjectCount <= 0)
        {
            throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    "The converted beatmap does not contain a calculable snapshot."));
        }

        var key = new PartialDifficultyCacheKey(
            source.Identity,
            rulesetId,
            BuildModsKey(modMessages, customClockRate),
            snapshot.TopLevelObjectCount,
            calculator.Version);

        bool cacheMiss = false;
        double calculationMilliseconds = 0;

        IReadOnlyDictionary<string, double> values =
            cache.GetOrCreate(
                key,
                () =>
                {
                    cacheMiss = true;
                    long calculationStarted = Stopwatch.GetTimestamp();

                    DifficultyAttributes calculated =
                        SingleSnapshotDifficultyCalculator.Calculate(
                            calculator,
                            playableBeatmap,
                            playableMods,
                            snapshot.TopLevelObjectCount,
                            cancellationToken);

                    calculationMilliseconds = Stopwatch
                        .GetElapsedTime(calculationStarted)
                        .TotalMilliseconds;

                    return ExtractAttributes(calculated);
                });

        DifficultyAttributes attributes =
            CreateDifficultyAttributes(
                rulesetId,
                playableMods,
                values);

        double totalMilliseconds = Stopwatch
            .GetElapsedTime(totalStarted)
            .TotalMilliseconds;

        logger.LogDebug(
            "Partial difficulty {CacheState}: ruleset={Ruleset}, " +
            "events={Events}, snapshotObjects={SnapshotObjects}, " +
            "progress={ProgressTime}, snapshot={SnapshotTime}, " +
            "prepareMs={PrepareMs:F2}, calculateMs={CalculateMs:F2}, " +
            "totalMs={TotalMs:F2}",
            cacheMiss ? "cache-miss" : "cache-hit",
            rulesetId,
            playedEvents,
            snapshot.TopLevelObjectCount,
            progressTime,
            snapshot.Time,
            preparationMilliseconds,
            calculationMilliseconds,
            totalMilliseconds);

        return new PartialDifficultyResult(
            attributes,
            playableBeatmap,
            playedEvents,
            progressTime,
            snapshot.Time);
    }

    private static double ResolveProgressTime(
        uint rulesetId,
        IBeatmap beatmap,
        uint playedEvents)
    {
        if (playedEvents == 0)
        {
            return double.NegativeInfinity;
        }

        int initialCapacity = rulesetId == 3
            ? checked(beatmap.HitObjects.Count * 2)
            : beatmap.HitObjects.Count;

        var events = new List<ProgressEvent>(initialCapacity);
        int sequence = 0;

        void add(double orderTime, double completionTime)
        {
            events.Add(new ProgressEvent(
                orderTime,
                completionTime,
                sequence++));
        }

        switch (rulesetId)
        {
            case 0:
                foreach (HitObject hitObject in beatmap.HitObjects)
                {
                    add(
                        hitObject.StartTime,
                        hitObject.GetEndTime());
                }

                break;

            case 1:
                foreach (HitObject hitObject in beatmap.HitObjects)
                {
                    if (hitObject is TaikoHit hit)
                    {
                        add(
                            hit.StartTime,
                            hit.GetEndTime());
                    }
                }

                break;

            case 2:
                foreach (
                    PalpableCatchHitObject hitObject in
                    CatchBeatmap.GetPalpableObjects(
                        beatmap.HitObjects))
                {
                    if (hitObject is Banana)
                    {
                        continue;
                    }

                    add(
                        hitObject.StartTime,
                        hitObject.GetEndTime());
                }

                break;

            case 3:
                foreach (HitObject hitObject in beatmap.HitObjects)
                {
                    switch (hitObject)
                    {
                        case HoldNote hold:
                            add(
                                hold.Head.StartTime,
                                hold.Head.GetEndTime());

                            add(
                                hold.Tail.StartTime,
                                hold.Tail.GetEndTime());

                            break;

                        case ManiaNote note:
                            add(
                                note.StartTime,
                                note.GetEndTime());

                            break;
                    }
                }

                break;

            default:
                throw new RpcException(
                    new Status(
                        StatusCode.InvalidArgument,
                        "Invalid ruleset ID."));
        }

        events.Sort(static (left, right) =>
        {
            int orderComparison =
                left.OrderTime.CompareTo(right.OrderTime);

            return orderComparison != 0
                ? orderComparison
                : left.Sequence.CompareTo(right.Sequence);
        });

        if (playedEvents > events.Count)
        {
            throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    $"Score contains {playedEvents} played " +
                    $"events, but the converted beatmap contains " +
                    $"only {events.Count} events."));
        }

        return events[checked((int)playedEvents - 1)]
            .CompletionTime;
    }

    private static PartialSnapshot ResolveSnapshot(
        IBeatmap beatmap,
        double progressTime)
    {
        if (beatmap.HitObjects.Count == 0)
        {
            return new PartialSnapshot(
                0,
                double.NegativeInfinity);
        }

        int selectedObjectCount = 0;
        double selectedTime = double.NegativeInfinity;

        for (int index = 0; index < beatmap.HitObjects.Count; index++)
        {
            HitObject hitObject = beatmap.HitObjects[index];
            double endTime = hitObject.GetEndTime();

            if (endTime <= progressTime)
            {
                selectedObjectCount = index + 1;
                selectedTime = endTime;
            }
        }

        if (selectedObjectCount > 0)
        {
            return new PartialSnapshot(
                selectedObjectCount,
                selectedTime);
        }

        return new PartialSnapshot(
            1,
            beatmap.HitObjects[0].GetEndTime());
    }

    private static IReadOnlyDictionary<string, double>
        ExtractAttributes(DifficultyAttributes attributes)
    {
        var result = new Dictionary<string, double>();

        PropertyInfo[] properties =
            readablePropertiesCache.GetOrAdd(
                attributes.GetType(),
                static type => type.GetProperties(
                    BindingFlags.Public |
                    BindingFlags.Instance));

        foreach (PropertyInfo property in properties)
        {
            if (
                property.GetIndexParameters().Length != 0 ||
                property.GetGetMethod(nonPublic: false) is null)
            {
                continue;
            }

            object? value = property.GetValue(attributes);
            string name = LowerFirst(property.Name);

            switch (value)
            {
                case double doubleValue:
                    result[name] = doubleValue;
                    break;

                case float floatValue:
                    result[name] = floatValue;
                    break;

                case int intValue:
                    result[name] = intValue;
                    break;

                case uint uintValue:
                    result[name] = uintValue;
                    break;

                case long longValue:
                    result[name] = longValue;
                    break;
            }
        }

        return result;
    }

    private static DifficultyAttributes CreateDifficultyAttributes(
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
                    "Invalid ruleset ID."))
        };

        attributes.Mods = mods;

        IReadOnlyDictionary<string, PropertyInfo> properties =
            writablePropertiesCache.GetOrAdd(
                attributes.GetType(),
                static type => type
                    .GetProperties(
                        BindingFlags.Public |
                        BindingFlags.Instance)
                    .Where(property => property.CanWrite)
                    .ToDictionary(
                        property => property.Name,
                        StringComparer.OrdinalIgnoreCase));

        foreach (
            KeyValuePair<string, double> pair in values)
        {
            if (!properties.TryGetValue(pair.Key, out PropertyInfo? property))
            {
                continue;
            }

            Type targetType =
                Nullable.GetUnderlyingType(
                    property.PropertyType) ??
                property.PropertyType;

            object converted = Convert.ChangeType(
                pair.Value,
                targetType,
                CultureInfo.InvariantCulture);

            property.SetValue(attributes, converted);
        }

        return attributes;
    }

    private static string BuildModsKey(
        IEnumerable<ModMessage> mods,
        double? customClockRate)
    {
        string modsKey = string.Join(
            ",",
            mods
                .OrderBy(
                    mod => mod.Acronym,
                    StringComparer.Ordinal)
                .Select(mod =>
                {
                    string settings = string.Join(
                        ";",
                        mod.Settings
                            .OrderBy(
                                pair => pair.Key,
                                StringComparer.Ordinal)
                            .Select(pair =>
                                $"{pair.Key}={pair.Value}"));

                    return $"{mod.Acronym}[{settings}]";
                }));

        string rate = customClockRate?.ToString(
            "R",
            CultureInfo.InvariantCulture) ?? "default";

        return $"{modsKey}@{rate}";
    }

    private static string LowerFirst(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }

        return char.ToLowerInvariant(value[0]) +
               value[1..];
    }

    private readonly record struct ProgressEvent(
        double OrderTime,
        double CompletionTime,
        int Sequence);

    private readonly record struct PartialSnapshot(
        int TopLevelObjectCount,
        double Time);
}
