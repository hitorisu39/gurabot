using Microsoft.Extensions.Caching.Memory;
using osu.Game.Beatmaps;

namespace Calculator.Services;

public sealed record CachedWorkingBeatmap(IWorkingBeatmap WorkingBeatmap, string Identity);

public class BeatmapCache
{
    private readonly IMemoryCache cache;

    public BeatmapCache(IMemoryCache cache)
    {
        this.cache = cache;
    }

    public CachedWorkingBeatmap GetBeatmap(string path)
    {
        var file = new FileInfo(path);
        file.Refresh();

        if (!file.Exists)
        {
            throw new FileNotFoundException("The requested beatmap file was not found.", path);
        }

        string fullPath = Path.GetFullPath(path);
        string identity = string.Join(":", fullPath, file.Length, file.LastWriteTimeUtc.Ticks);

        return cache.GetOrCreate(
            identity,
            entry =>
            {
                entry.SlidingExpiration = TimeSpan.FromMinutes(30);
                entry.Size = 1;

                return new CachedWorkingBeatmap(new FlatWorkingBeatmap(fullPath), identity);
            }
        )!;
    }
}
