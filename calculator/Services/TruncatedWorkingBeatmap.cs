using osu.Framework.Audio.Track;
using osu.Framework.Graphics.Textures;
using osu.Game.Beatmaps;
using osu.Game.Skinning;

namespace Calculator.Services;

public class TruncatedWorkingBeatmap : WorkingBeatmap
{
    private readonly IBeatmap _beatmap;

    public TruncatedWorkingBeatmap(IBeatmap sourceBeatmap, int passedObjects) 
        : base((BeatmapInfo)sourceBeatmap.BeatmapInfo, null)
    {
        _beatmap = sourceBeatmap.Clone();
        if (_beatmap is Beatmap concreteBeatmap)
        {
            concreteBeatmap.HitObjects = concreteBeatmap.HitObjects.Take(passedObjects).ToList();
        }
    }

    protected override IBeatmap GetBeatmap() => _beatmap;

    public override Texture GetBackground() => null!;
    protected override Track GetBeatmapTrack() => null!;
    protected override ISkin GetSkin() => null!;
    public override Stream GetStream(string storagePath) => null!;
}