import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";

export class OtrMatchFormatter {
    public static link(id: number): string {
        return `https://otr.stagec.net/matches/${id}`;
    }

    public static ratio(delta: number): string {
        return `${DiscordFormatter.fixed(1 + delta, 2)}x opp avg`;
    }
}
