import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";
import { EOtrRuleset } from "@domain/otr/enums/Otr.enum";
import { OtrPlayerTournamentDto } from "../OtrPlayer.dto";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { ModUtils } from "@generated/adapter/mods";

export class OtrProfileFormatter {
    public static link(playerID: number, ruleset: EOtrRuleset): string {
        return `https://otr.stagec.net/players/${playerID}?ruleset=${ruleset}`;
    }

    public static tier(tier: string, subTier: number | null): string {
        const formatted = tier
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .trim()
            .replace(/\s+/g, " ")
            .replace(/^./, (char) => char.toUpperCase());

        const roman: Record<number, string> = { 1: "I", 2: "II", 3: "III" };
        return subTier ? `${formatted} ${roman[subTier] ?? subTier}` : formatted;
    }

    public static record(wins: number, losses: number, winRate: boolean = false): string {
        const total = wins + losses;
        const record = `${DiscordFormatter.number(wins)}-${DiscordFormatter.number(losses)}`;

        if (!winRate || !total) return record;

        return `${record} (${DiscordFormatter.fixed((wins / total) * 100)}%)`;
    }

    public static rating(rating: number): string {
        return DiscordFormatter.fixed(rating).toString();
    }

    public static tournaments(tournaments: ReadonlyArray<OtrPlayerTournamentDto>): string {
        if (!tournaments.length) return "*None*";

        const entries = tournaments.slice(0, 10).map((tournament) => ({
            tournament,
            name: TextFormatter.truncate(tournament.name, 32),
            record: `${tournament.matchesWon}-${tournament.matchesLost}`,
        }));

        const maxNameLength = Math.max(...entries.map((entry) => entry.name.length));
        const maxRecordLength = Math.max(...entries.map((entry) => entry.record.length));

        return entries
            .map(({ tournament, name, record }) => {
                const date = tournament.startTime ?? tournament.created;
                const linkedName = DiscordFormatter.link(
                    name.padEnd(maxNameLength, " "),
                    tournament.forumUrl,
                    null,
                    true,
                );

                const formattedRecord = `\`${record.padStart(maxRecordLength, " ")}\``;
                const timestamp = DateFormatter.discord(date, "d");

                return `${linkedName} ${formattedRecord} ${timestamp}`;
            })
            .join("\n");
    }

    public static mods(bits: number): string {
        const mods = ModUtils.fromBits(bits).filter((mod) => mod.acronym !== "NF");
        if (!mods.length) return "NM";
        return mods.map((mod) => mod.acronym).join("");
    }
}
