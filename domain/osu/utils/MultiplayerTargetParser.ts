import { MatchCostTargetDto } from "@domain/osu/MatchCost.dto";
import { EMatchCostTargetType } from "../enums/MatchCost.enum";

export class MultiplayerTargetParser {
    private static readonly stableRegex = /^https?:\/\/osu\.ppy\.sh\/(?:community\/matches|mp)\/(\d+)\/?$/i;
    private static readonly roomRegex = /^https?:\/\/osu\.ppy\.sh\/multiplayer\/rooms\/(\d+)\/?$/i;

    public static test(value: string): boolean {
        return this.parse(value) !== null;
    }

    public static parse(value: string): MatchCostTargetDto | null {
        const trimmed = value.trim();

        const stable = trimmed.match(this.stableRegex);
        if (stable?.[1]) {
            return {
                type: EMatchCostTargetType.Match,
                id: Number(stable[1]),
            };
        }

        const room = trimmed.match(this.roomRegex);
        if (room?.[1]) {
            return {
                type: EMatchCostTargetType.Room,
                id: Number(room[1]),
            };
        }

        return null;
    }
}
