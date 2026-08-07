namespace Calculator.Services;

internal static partial class CalculatorLog
{
    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Debug,
        Message = "Partial difficulty {CacheState}: ruleset={Ruleset}, events={Events}, snapshotObjects={SnapshotObjects}, "
            + "progress={ProgressTime}, snapshot={SnapshotTime}, prepareMs={PrepareMs:F2}, calculateMs={CalculateMs:F2}, "
            + "totalMs={TotalMs:F2}"
    )]
    public static partial void PartialDifficulty(
        ILogger logger,
        string cacheState,
        uint ruleset,
        uint events,
        int snapshotObjects,
        double progressTime,
        double snapshotTime,
        double prepareMs,
        double calculateMs,
        double totalMs
    );

    [LoggerMessage(
        EventId = 2,
        Level = LogLevel.Error,
        Message = "Performance calculation failed. Ruleset={RulesetId}, Beatmap={BeatmapPath}, ReferenceId={ReferenceId}"
    )]
    public static partial void PerformanceCalculationFailed(
        ILogger logger,
        Exception exception,
        uint rulesetId,
        string beatmapPath,
        ulong? referenceId
    );
}
