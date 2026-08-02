using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Calculator.Services;

public readonly record struct PartialDifficultyCacheKey(
    string BeatmapIdentity,
    uint RulesetId,
    string ModsKey,
    uint PassedObjects,
    int CalculatorVersion
);

public sealed class PartialDifficultyCache : IDisposable
{
    private readonly MemoryCache cache;

    private readonly ConcurrentDictionary<
        PartialDifficultyCacheKey,
        Lazy<IReadOnlyDictionary<string, double>>
    > inFlight = new();

    private readonly TimeSpan slidingExpiration;
    private readonly TimeSpan absoluteExpiration;

    public PartialDifficultyCache(
        IOptions<CalculatorRuntimeOptions> options)
    {
        CalculatorRuntimeOptions value = options.Value;

        cache = new MemoryCache(new MemoryCacheOptions
        {
            SizeLimit = Math.Max(
                1,
                value.PartialDifficultyCacheSize
            )
        });

        slidingExpiration = TimeSpan.FromMinutes(
            Math.Max(
                1,
                value.PartialDifficultySlidingMinutes
            )
        );

        absoluteExpiration = TimeSpan.FromMinutes(
            Math.Max(
                value.PartialDifficultySlidingMinutes,
                value.PartialDifficultyAbsoluteMinutes
            )
        );
    }

    public IReadOnlyDictionary<string, double> GetOrCreate(
        PartialDifficultyCacheKey key,
        Func<IReadOnlyDictionary<string, double>> factory)
    {
        if (
            cache.TryGetValue(
                key,
                out IReadOnlyDictionary<string, double>? cached
            )
        )
        {
            return cached!;
        }

        Lazy<IReadOnlyDictionary<string, double>> lazy =
            inFlight.GetOrAdd(
                key,
                _ => new Lazy<IReadOnlyDictionary<string, double>>(
                    factory,
                    LazyThreadSafetyMode.ExecutionAndPublication
                )
            );

        try
        {
            IReadOnlyDictionary<string, double> attributes =
                lazy.Value;

            cache.Set(
                key,
                attributes,
                new MemoryCacheEntryOptions
                {
                    Size = 1,
                    SlidingExpiration = slidingExpiration,
                    AbsoluteExpirationRelativeToNow =
                        absoluteExpiration
                }
            );

            return attributes;
        }
        finally
        {
            inFlight.TryRemove(key, out _);
        }
    }

    public void Dispose()
    {
        cache.Dispose();
    }
}