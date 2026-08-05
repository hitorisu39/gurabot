using System.Collections.Concurrent;
using System.Globalization;
using System.Reflection;
using System.Runtime.ExceptionServices;
using Calculator.Protos;
using Grpc.Core;
using osu.Game.Beatmaps;
using osu.Game.Rulesets;
using osu.Game.Rulesets.Catch.Beatmaps;
using osu.Game.Rulesets.Catch.Objects;
using osu.Game.Rulesets.Difficulty;
using osu.Game.Rulesets.Mania.Difficulty;
using osu.Game.Rulesets.Mania.Objects;
using osu.Game.Rulesets.Mods;
using osu.Game.Rulesets.Objects;
using osu.Game.Rulesets.Osu.Difficulty;
using osu.Game.Rulesets.Taiko.Difficulty;
using osu.Game.Rulesets.Catch.Difficulty;

using ManiaNote =
    osu.Game.Rulesets.Mania.Objects.Note;

using TaikoHit =
    osu.Game.Rulesets.Taiko.Objects.Hit;

namespace Calculator.Services;

public sealed record PartialDifficultyResult(
    DifficultyAttributes Attributes,
    IBeatmap PlayableBeatmap,
    uint PlayedEvents,
    double ProgressTime,
    double SnapshotTime
);

public sealed class PartialDifficultyService
{
    private static readonly ConcurrentDictionary<
        Type,
        PropertyInfo[]
    > objectPropertiesCache = new();

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
        DifficultyCalculator calculator =
            ruleset.CreateDifficultyCalculator(
                source.WorkingBeatmap
            );

        PreparedDifficultyCalculator prepared =
            PrepareCalculator(
                calculator,
                mods,
                cancellationToken
            );

        double progressTime = ResolveProgressTime(
            rulesetId,
            prepared.PlayableBeatmap,
            playedEvents
        );

        PartialSnapshot snapshot = ResolveSnapshot(
            prepared.PlayableBeatmap,
            progressTime
        );

        var key = new PartialDifficultyCacheKey(
            source.Identity,
            rulesetId,
            BuildModsKey(modMessages, customClockRate),
            playedEvents,
            calculator.Version
        );

        IReadOnlyDictionary<string, double> values =
            cache.GetOrCreate(
                key,
                () =>
                {
                    List<TimedDifficultyAttributes> timeline =
                        calculator.CalculateTimed(
                            mods,
                            cancellationToken
                        );

                    int snapshotIndex =
                        snapshot.TopLevelObjectCount - 1;

                    if (
                        snapshotIndex < 0 ||
                        snapshotIndex >= timeline.Count
                    )
                    {
                        throw new RpcException(
                            new Status(
                                StatusCode.InvalidArgument,
                                $"Unable to select partial difficulty " +
                                $"snapshot {snapshot.TopLevelObjectCount}; " +
                                $"the calculated timeline contains " +
                                $"{timeline.Count} snapshots."
                            )
                        );
                    }

                    DifficultyAttributes attributes =
                        timeline[snapshotIndex].Attributes;

                    return ExtractAttributes(attributes);
                }
            );

        DifficultyAttributes attributes =
            CreateDifficultyAttributes(
                rulesetId,
                prepared.PlayableMods,
                values
            );

        logger.LogDebug(
            "Calculated partial difficulty: ruleset={Ruleset}, " +
            "events={Events}, progress={ProgressTime}, " +
            "snapshot={SnapshotTime}, objects={Objects}",
            rulesetId,
            playedEvents,
            progressTime,
            snapshot.Time,
            snapshot.TopLevelObjectCount
        );

        return new PartialDifficultyResult(
            attributes,
            prepared.PlayableBeatmap,
            playedEvents,
            progressTime,
            snapshot.Time
        );
    }

    private static PreparedDifficultyCalculator PrepareCalculator(
        DifficultyCalculator calculator,
        Mod[] mods,
        CancellationToken cancellationToken)
    {
        MethodInfo preProcess =
            FindInstanceMethod(
                calculator.GetType(),
                "preProcess",
                typeof(IEnumerable<Mod>),
                typeof(CancellationToken)
            ) ?? throw new MissingMethodException(
                calculator.GetType().FullName,
                "preProcess(IEnumerable<Mod>, CancellationToken)"
            );

        Invoke(
            preProcess,
            calculator,
            mods,
            cancellationToken
        );

        PropertyInfo beatmapProperty =
            FindInstanceProperty(
                calculator.GetType(),
                "Beatmap"
            ) ?? throw new MissingMemberException(
                calculator.GetType().FullName,
                "Beatmap"
            );

        FieldInfo playableModsField =
            FindInstanceField(
                calculator.GetType(),
                "playableMods"
            ) ?? throw new MissingFieldException(
                calculator.GetType().FullName,
                "playableMods"
            );

        var playableBeatmap =
            beatmapProperty.GetValue(calculator) as IBeatmap
            ?? throw new InvalidOperationException(
                "Difficulty calculator did not produce " +
                "a playable beatmap."
            );

        var playableMods =
            playableModsField.GetValue(calculator) as Mod[]
            ?? throw new InvalidOperationException(
                "Difficulty calculator did not produce " +
                "a playable mod array."
            );

        return new PreparedDifficultyCalculator(
            playableBeatmap,
            playableMods
        );
    }

    private static double ResolveProgressTime(
        uint rulesetId,
        IBeatmap beatmap,
        uint playedEvents)
    {
        ProgressEvent[] events = GetProgressEvents(
                rulesetId,
                beatmap
            )
            .Select((progressEvent, index) => new
            {
                Event = progressEvent,
                Index = index,
            })
            .OrderBy(entry => entry.Event.OrderTime)
            .ThenBy(entry => entry.Index)
            .Select(entry => entry.Event)
            .ToArray();

        if (playedEvents == 0)
        {
            return double.NegativeInfinity;
        }

        if (playedEvents > events.Length)
        {
            throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    $"Score contains {playedEvents} played " +
                    $"events, but the converted beatmap contains " +
                    $"only {events.Length} events."
                )
            );
        }

        return events[checked((int)playedEvents - 1)]
            .CompletionTime;
    }

    private static IEnumerable<ProgressEvent> GetProgressEvents(
        uint rulesetId,
        IBeatmap beatmap)
    {
        switch (rulesetId)
        {
            case 0:
                foreach (HitObject hitObject in beatmap.HitObjects)
                {
                    yield return new ProgressEvent(
                        hitObject.StartTime,
                        hitObject.GetEndTime()
                    );
                }

                yield break;

            case 1:
                foreach (
                    TaikoHit hit in
                    beatmap.HitObjects.OfType<TaikoHit>()
                )
                {
                    yield return new ProgressEvent(
                        hit.StartTime,
                        hit.GetEndTime()
                    );
                }

                yield break;

            case 2:
                foreach (
                    PalpableCatchHitObject hitObject in
                    CatchBeatmap.GetPalpableObjects(
                        beatmap.HitObjects
                    )
                )
                {
                    if (hitObject is Banana)
                    {
                        continue;
                    }

                    yield return new ProgressEvent(
                        hitObject.StartTime,
                        hitObject.GetEndTime()
                    );
                }

                yield break;

            case 3:
                foreach (HitObject hitObject in beatmap.HitObjects)
                {
                    switch (hitObject)
                    {
                        case HoldNote hold:
                            yield return new ProgressEvent(
                                hold.Head.StartTime,
                                hold.Head.GetEndTime()
                            );

                            yield return new ProgressEvent(
                                hold.Tail.StartTime,
                                hold.Tail.GetEndTime()
                            );

                            break;

                        case ManiaNote note:
                            yield return new ProgressEvent(
                                note.StartTime,
                                note.GetEndTime()
                            );

                            break;
                    }
                }

                yield break;

            default:
                throw new RpcException(
                    new Status(
                        StatusCode.InvalidArgument,
                        "Invalid ruleset ID."
                    )
                );
        }
    }

    private static PartialSnapshot ResolveSnapshot(
        IBeatmap beatmap,
        double progressTime)
    {
        if (beatmap.HitObjects.Count == 0)
        {
            return new PartialSnapshot(
                0,
                double.NegativeInfinity
            );
        }

        PartialSnapshot? selected = null;

        for (int index = 0; index < beatmap.HitObjects.Count; index++)
        {
            HitObject hitObject = beatmap.HitObjects[index];
            double endTime = hitObject.GetEndTime();

            if (endTime <= progressTime)
            {
                selected = new PartialSnapshot(
                    index + 1,
                    endTime
                );
            }
        }

        if (selected.HasValue)
        {
            return selected.Value;
        }

        return new PartialSnapshot(
            1,
            beatmap.HitObjects[0].GetEndTime()
        );
    }

    private static Dictionary<string, double> ExtractAttributes(
        DifficultyAttributes attributes)
    {
        var result = new Dictionary<string, double>();

        PropertyInfo[] properties =
            objectPropertiesCache.GetOrAdd(
                attributes.GetType(),
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
                value = property.GetValue(attributes);
            }
            catch (Exception exception)
            {
                throw new InvalidOperationException(
                    $"Failed to read property " +
                    $"{attributes.GetType().FullName}.{property.Name}.",
                    exception
                );
            }

            switch (value)
            {
                case double doubleValue:
                    result[LowerFirst(property.Name)] =
                        doubleValue;
                    break;

                case int intValue:
                    result[LowerFirst(property.Name)] =
                        intValue;
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
                    "Invalid ruleset ID."
                )
            ),
        };

        attributes.Mods = mods;

        PropertyInfo[] properties =
            objectPropertiesCache.GetOrAdd(
                attributes.GetType(),
                type => type.GetProperties(
                    BindingFlags.Public |
                    BindingFlags.Instance |
                    BindingFlags.IgnoreCase
                )
            );

        foreach (
            KeyValuePair<string, double> pair in values
        )
        {
            PropertyInfo? property =
                properties.FirstOrDefault(candidate =>
                    string.Equals(
                        candidate.Name,
                        pair.Key,
                        StringComparison.OrdinalIgnoreCase
                    )
                );

            if (property is not { CanWrite: true })
            {
                continue;
            }

            Type targetType =
                Nullable.GetUnderlyingType(
                    property.PropertyType
                ) ?? property.PropertyType;

            object converted = Convert.ChangeType(
                pair.Value,
                targetType,
                CultureInfo.InvariantCulture
            );

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
                .OrderBy(mod => mod.Acronym)
                .Select(mod =>
                {
                    string settings = string.Join(
                        ";",
                        mod.Settings
                            .OrderBy(pair => pair.Key)
                            .Select(pair =>
                                $"{pair.Key}={pair.Value}"
                            )
                    );

                    return $"{mod.Acronym}[{settings}]";
                })
        );

        string rate = customClockRate?.ToString(
            "R",
            CultureInfo.InvariantCulture
        ) ?? "default";

        return $"{modsKey}@{rate}";
    }

    private static MethodInfo? FindInstanceMethod(
        Type type,
        string methodName,
        params Type[] parameterTypes)
    {
        for (
            Type? current = type;
            current != null;
            current = current.BaseType
        )
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
            {
                return method;
            }
        }

        return null;
    }

    private static PropertyInfo? FindInstanceProperty(
        Type type,
        string propertyName)
    {
        for (
            Type? current = type;
            current != null;
            current = current.BaseType
        )
        {
            PropertyInfo? property = current.GetProperty(
                propertyName,
                BindingFlags.Instance |
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.DeclaredOnly
            );

            if (property != null)
            {
                return property;
            }
        }

        return null;
    }

    private static FieldInfo? FindInstanceField(
        Type type,
        string fieldName)
    {
        for (
            Type? current = type;
            current != null;
            current = current.BaseType
        )
        {
            FieldInfo? field = current.GetField(
                fieldName,
                BindingFlags.Instance |
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.DeclaredOnly
            );

            if (field != null)
            {
                return field;
            }
        }

        return null;
    }

    private static object? Invoke(
        MethodInfo method,
        object target,
        params object?[] arguments)
    {
        try
        {
            return method.Invoke(target, arguments);
        }
        catch (
            TargetInvocationException exception
        ) when (exception.InnerException != null)
        {
            ExceptionDispatchInfo
                .Capture(exception.InnerException)
                .Throw();

            throw;
        }
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
        double CompletionTime
    );

    private readonly record struct PartialSnapshot(
        int TopLevelObjectCount,
        double Time
    );

    private sealed record PreparedDifficultyCalculator(
        IBeatmap PlayableBeatmap,
        Mod[] PlayableMods
    );
}