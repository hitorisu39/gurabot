namespace Calculator.Services;

public sealed class CalculatorRuntimeOptions
{
    public int MaxConcurrentCalculations { get; set; } =
        Math.Clamp(Environment.ProcessorCount, 1, 4);

    public int PartialDifficultyCacheSize { get; set; } = 512;

    public int PartialDifficultySlidingMinutes { get; set; } = 10;

    public int PartialDifficultyAbsoluteMinutes { get; set; } = 60;
}