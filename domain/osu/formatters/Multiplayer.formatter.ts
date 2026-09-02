import { EMatchCostTargetType } from "../enums/MatchCost.enum";

export class MultiplayerFormatter {
    public static link(type: EMatchCostTargetType, id: number): string {
        switch (type) {
            case EMatchCostTargetType.Room:
                return `https://osu.ppy.sh/multiplayer/rooms/${id}`;
            default:
            case EMatchCostTargetType.Match:
                return `https://osu.ppy.sh/community/matches/${id}`;
        }
    }
}
