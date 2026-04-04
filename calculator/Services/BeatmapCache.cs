using Microsoft.Extensions.Caching.Memory;
using osu.Game.Beatmaps;

namespace Calculator.Services;

public class BeatmapCache
{
    private readonly IMemoryCache _cache;

    public BeatmapCache(IMemoryCache cache)
    {
        _cache = cache;
    }

    public IWorkingBeatmap GetBeatmap(string path)
    {
        return _cache.GetOrCreate(path, entry =>
        {
            entry.SlidingExpiration = TimeSpan.FromMinutes(30);
            entry.Size = 1; 
            return new FlatWorkingBeatmap(path);
        })!;
    }
}