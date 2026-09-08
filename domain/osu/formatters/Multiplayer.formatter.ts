import { EMultiplayerTargetType } from "../enums/Multiplayer.enum";

export class MultiplayerFormatter {
    public static link(type: EMultiplayerTargetType, id: number): string {
        switch (type) {
            case EMultiplayerTargetType.Room:
                return `https://osu.ppy.sh/multiplayer/rooms/${id}`;
            default:
            case EMultiplayerTargetType.Match:
                return `https://osu.ppy.sh/community/matches/${id}`;
        }
    }
}
