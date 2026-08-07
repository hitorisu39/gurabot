using System.Diagnostics;
using Calculator.Protos;
using Grpc.Core;
using osu.Game.Beatmaps;
using osu.Game.Rulesets;
using osu.Game.Rulesets.Catch.Beatmaps;
using osu.Game.Rulesets.Catch.Objects;
using osu.Game.Rulesets.Difficulty;
using osu.Game.Rulesets.Mania.Objects;
using osu.Game.Rulesets.Mods;
using osu.Game.Rulesets.Objects;
using ManiaNote = osu.Game.Rulesets.Mania.Objects.Note;
using TaikoHit = osu.Game.Rulesets.Taiko.Objects.Hit;

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
    private readonly PartialDifficultyCache cache;
    private readonly ILogger<PartialDifficultyService> logger;

    public PartialDifficultyService(PartialDifficultyCache cache, ILogger<PartialDifficultyService> logger)
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
        CancellationToken cancellationToken
    )
    {
        long totalStarted = Stopwatch.GetTimestamp();

        cancellationToken.ThrowIfCancellationRequested();

        DifficultyCalculator calculator = ruleset.CreateDifficultyCalculator(source.WorkingBeatmap);

        SingleSnapshotDifficultyCalculator.PreparedDifficultyContext prepared =
            SingleSnapshotDifficultyCalculator.Prepare(calculator, mods, cancellationToken);

        IBeatmap playableBeatmap = prepared.PlayableBeatmap;
        Mod[] playableMods = prepared.PlayableMods;

        double preparationMilliseconds = Stopwatch.GetElapsedTime(totalStarted).TotalMilliseconds;

        double progressTime = ResolveProgressTime(rulesetId, playableBeatmap, playedEvents);
        PartialSnapshot snapshot = ResolveSnapshot(playableBeatmap, progressTime);

        if (snapshot.TopLevelObjectCount <= 0)
        {
            throw new RpcException(
                new Status(StatusCode.InvalidArgument, "The converted beatmap does not contain a calculable snapshot.")
            );
        }

        var key = new PartialDifficultyCacheKey(
            source.Identity,
            rulesetId,
            CalculationKeyBuilder.BuildModsKey(modMessages, customClockRate),
            snapshot.TopLevelObjectCount,
            calculator.Version
        );

        bool cacheMiss = false;
        double calculationMilliseconds = 0;

        DifficultyAttributeSnapshot attributeSnapshot = cache.GetOrCreate(
            key,
            () =>
            {
                cacheMiss = true;

                long calculationStarted = Stopwatch.GetTimestamp();

                DifficultyAttributes calculated = SingleSnapshotDifficultyCalculator.Calculate(
                    calculator,
                    playableBeatmap,
                    playableMods,
                    snapshot.TopLevelObjectCount,
                    cancellationToken
                );

                calculationMilliseconds = Stopwatch.GetElapsedTime(calculationStarted).TotalMilliseconds;

                return DifficultyAttributeSnapshot.Capture(calculated);
            }
        );

        DifficultyAttributes attributes = attributeSnapshot.Restore(rulesetId, playableMods);

        double totalMilliseconds = Stopwatch.GetElapsedTime(totalStarted).TotalMilliseconds;

        CalculatorLog.PartialDifficulty(
            logger,
            cacheMiss ? "cache-miss" : "cache-hit",
            rulesetId,
            playedEvents,
            snapshot.TopLevelObjectCount,
            progressTime,
            snapshot.Time,
            preparationMilliseconds,
            calculationMilliseconds,
            totalMilliseconds
        );

        return new PartialDifficultyResult(attributes, playableBeatmap, playedEvents, progressTime, snapshot.Time);
    }

    private static double ResolveProgressTime(uint rulesetId, IBeatmap beatmap, uint playedEvents)
    {
        if (playedEvents == 0)
            return double.NegativeInfinity;

        int initialCapacity = rulesetId == 3 ? checked(beatmap.HitObjects.Count * 2) : beatmap.HitObjects.Count;
        var events = new List<ProgressEvent>(initialCapacity);
        int sequence = 0;

        void add(double orderTime, double completionTime)
        {
            events.Add(new ProgressEvent(orderTime, completionTime, sequence++));
        }

        switch (rulesetId)
        {
            case 0:
                foreach (HitObject hitObject in beatmap.HitObjects)
                {
                    add(hitObject.StartTime, hitObject.GetEndTime());
                }
                break;

            case 1:
                foreach (HitObject hitObject in beatmap.HitObjects)
                {
                    if (hitObject is TaikoHit hit)
                        add(hit.StartTime, hit.GetEndTime());
                }
                break;

            case 2:
                foreach (PalpableCatchHitObject hitObject in CatchBeatmap.GetPalpableObjects(beatmap.HitObjects))
                {
                    if (hitObject is Banana)
                        continue;

                    add(hitObject.StartTime, hitObject.GetEndTime());
                }
                break;

            case 3:
                foreach (HitObject hitObject in beatmap.HitObjects)
                {
                    switch (hitObject)
                    {
                        case HoldNote hold:
                            add(hold.Head.StartTime, hold.Head.GetEndTime());
                            add(hold.Tail.StartTime, hold.Tail.GetEndTime());
                            break;

                        case ManiaNote note:
                            add(note.StartTime, note.GetEndTime());
                            break;
                    }
                }
                break;

            default:
                throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid ruleset ID."));
        }

        events.Sort(
            static (left, right) =>
            {
                int orderComparison = left.OrderTime.CompareTo(right.OrderTime);
                return orderComparison != 0 ? orderComparison : left.Sequence.CompareTo(right.Sequence);
            }
        );

        if (playedEvents > events.Count)
        {
            throw new RpcException(
                new Status(
                    StatusCode.InvalidArgument,
                    $"Score contains {playedEvents} played events, but the converted beatmap contains "
                        + $"only {events.Count} events."
                )
            );
        }

        return events[checked((int)playedEvents - 1)].CompletionTime;
    }

    private static PartialSnapshot ResolveSnapshot(IBeatmap beatmap, double progressTime)
    {
        if (beatmap.HitObjects.Count == 0)
            return new PartialSnapshot(0, double.NegativeInfinity);

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
            return new PartialSnapshot(selectedObjectCount, selectedTime);

        return new PartialSnapshot(1, beatmap.HitObjects[0].GetEndTime());
    }

    private readonly record struct ProgressEvent(double OrderTime, double CompletionTime, int Sequence);

    private readonly record struct PartialSnapshot(int TopLevelObjectCount, double Time);
}
