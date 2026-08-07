using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Calculator.Services;

public readonly record struct FullDifficultyCacheKey(
    string BeatmapIdentity,
    uint RulesetId,
    string ModsKey,
    int CalculatorVersion
);

public sealed class FullDifficultyCache : IDisposable
{
    private readonly MemoryCache cache;

    private readonly ConcurrentDictionary<FullDifficultyCacheKey, Lazy<DifficultyAttributeSnapshot>> inFlight = new();

    private readonly TimeSpan slidingExpiration;
    private readonly TimeSpan absoluteExpiration;

    public FullDifficultyCache(IOptions<CalculatorRuntimeOptions> options)
    {
        CalculatorRuntimeOptions value = options.Value;

        cache = new MemoryCache(new MemoryCacheOptions { SizeLimit = Math.Max(1, value.FullDifficultyCacheSize) });

        slidingExpiration = TimeSpan.FromMinutes(Math.Max(1, value.FullDifficultySlidingMinutes));

        absoluteExpiration = TimeSpan.FromMinutes(
            Math.Max(value.FullDifficultySlidingMinutes, value.FullDifficultyAbsoluteMinutes)
        );
    }

    internal DifficultyAttributeSnapshot GetOrCreate(
        FullDifficultyCacheKey key,
        Func<DifficultyAttributeSnapshot> factory
    )
    {
        if (cache.TryGetValue(key, out DifficultyAttributeSnapshot? cached))
        {
            return cached!;
        }

        Lazy<DifficultyAttributeSnapshot> lazy = inFlight.GetOrAdd(
            key,
            _ => new Lazy<DifficultyAttributeSnapshot>(
                () =>
                {
                    if (cache.TryGetValue(key, out DifficultyAttributeSnapshot? racedCached))
                    {
                        return racedCached!;
                    }

                    DifficultyAttributeSnapshot snapshot = factory();
                    Set(key, snapshot);
                    return snapshot;
                },
                LazyThreadSafetyMode.ExecutionAndPublication
            )
        );

        try
        {
            return lazy.Value;
        }
        finally
        {
            removeInFlight(key, lazy);
        }
    }

    internal void Set(FullDifficultyCacheKey key, DifficultyAttributeSnapshot snapshot)
    {
        cache.Set(
            key,
            snapshot,
            new MemoryCacheEntryOptions
            {
                Size = 1,
                SlidingExpiration = slidingExpiration,
                AbsoluteExpirationRelativeToNow = absoluteExpiration,
            }
        );
    }

    private void removeInFlight(FullDifficultyCacheKey key, Lazy<DifficultyAttributeSnapshot> lazy)
    {
        var collection = (ICollection<KeyValuePair<FullDifficultyCacheKey, Lazy<DifficultyAttributeSnapshot>>>)inFlight;

        collection.Remove(new KeyValuePair<FullDifficultyCacheKey, Lazy<DifficultyAttributeSnapshot>>(key, lazy));
    }

    public void Dispose()
    {
        cache.Dispose();
    }
}
