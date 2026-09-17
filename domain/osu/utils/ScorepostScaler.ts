import { scorepostLogicalDimensions, ScorepostResolution } from "@domain/osu/configs/Scorepost.config";

export class ScorepostScaler {
    public readonly factor: number;
    public readonly width: number;
    public readonly height: number;

    public constructor(public readonly resolution: ScorepostResolution) {
        this.factor = resolution / scorepostLogicalDimensions.height;
        this.width = Math.round(scorepostLogicalDimensions.width * this.factor);
        this.height = resolution;
    }

    /**
     * Scales a logical value without rounding. Useful for blur/shadow values.
     */
    public value(value: number): number {
        return value * this.factor;
    }

    /**
     * Scales a logical value into an integer output pixel.
     */
    public pixel(value: number): number {
        return Math.round(this.value(value));
    }

    /**
     * Returns the output-pixel top/left coordinate for an already-scaled asset
     * whose centre is expressed in logical coordinates.
     */
    public centered(center: number, outputSize: number): number {
        return Math.round(this.value(center) - outputSize / 2);
    }

    public get isIdentity(): boolean {
        return this.factor === 1;
    }
}
