using osu.Framework.Audio.Track;
using osu.Framework.Graphics.Textures;
using osu.Game.Beatmaps;
using osu.Game.Skinning;

namespace Calculator.Services;

public class TruncatedWorkingBeatmap : WorkingBeatmap
{
    private readonly IBeatmap beatmap;

    public TruncatedWorkingBeatmap(IBeatmap sourceBeatmap, int passedObjects)
        : base((BeatmapInfo)sourceBeatmap.BeatmapInfo, null)
    {
        beatmap = sourceBeatmap.Clone();

        if (beatmap is not Beatmap concreteBeatmap)
        {
            throw new InvalidOperationException($"Cannot truncate beatmap type {beatmap.GetType().Name}.");
        }

        int objectCount = Math.Clamp(passedObjects, 0, concreteBeatmap.HitObjects.Count);
        concreteBeatmap.HitObjects = concreteBeatmap.HitObjects.Take(objectCount).ToList();
    }

    protected override IBeatmap GetBeatmap() => beatmap;

    public override Texture GetBackground() => null!;

    protected override Track GetBeatmapTrack() => null!;

    protected override ISkin GetSkin() => null!;

    public override Stream GetStream(string storagePath) => null!;
}
