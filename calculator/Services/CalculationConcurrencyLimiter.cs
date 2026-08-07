using Microsoft.Extensions.Options;

namespace Calculator.Services;

public sealed class CalculationConcurrencyLimiter : IDisposable
{
    private readonly SemaphoreSlim semaphore;

    public int MaxConcurrency { get; }

    public CalculationConcurrencyLimiter(IOptions<CalculatorRuntimeOptions> options)
    {
        MaxConcurrency = Math.Max(1, options.Value.MaxConcurrentCalculations);
        semaphore = new SemaphoreSlim(MaxConcurrency, MaxConcurrency);
    }

    public async Task<T> RunAsync<T>(Func<T> operation, CancellationToken cancellationToken)
    {
        await semaphore.WaitAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            return operation();
        }
        finally
        {
            semaphore.Release();
        }
    }

    public void Dispose()
    {
        semaphore.Dispose();
    }
}
