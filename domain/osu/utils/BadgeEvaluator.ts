import { Badge, GameMode } from "@generated/adapter/types";
import { EBadgeType } from "../enums/Badge.enum";

export interface IBadgeEvaluation {
    type: EBadgeType;
    mode: GameMode | null;
}

export class BadgeEvaluator {
    private static readonly tournamentTerms: ReadonlyArray<string> = [
        "tournament",
        "world cup",
        "champion",
        "winner",
        "1st place",
        "first place",
        "2nd place",
        "second place",
        "3rd place",
        "third place",
        "runner-up",
        "runner up",
        "finalist",
        "winning",
    ];

    private static readonly nonTournamentTerms: ReadonlyArray<string> = [
        "mapping contest",
        "beatmap contest",
        "art contest",
        "fanart",
        "spotlight",
        "playlist",
        "contributor",
        "contribution",
        "mapper",
        "mapping",
        "nomination",
        "assessment",
        "moderation",
        "commentary",
        "commitment",
    ];

    /**
     * Order of operations is important here.
     */
    public static evaluate(badge: Badge): IBadgeEvaluation {
        const description = this.normalize(badge.description);

        if (this.matchesAny(description, this.nonTournamentTerms)) {
            return {
                type: EBadgeType.NonTournament,
                mode: null,
            };
        }

        const mode = this.mode(description);
        if (this.isTournamentUrl(badge.url) || this.matchesAny(description, this.tournamentTerms)) {
            return {
                type: EBadgeType.Tournament,
                mode,
            };
        }

        return {
            type: EBadgeType.Unknown,
            mode,
        };
    }

    public static tournament(badges: ReadonlyArray<Badge>, mode?: GameMode): Array<Badge> {
        return badges.filter((badge) => {
            const evaluation = this.evaluate(badge);
            if (evaluation.type !== EBadgeType.Tournament) {
                return false;
            }

            if (mode === undefined) {
                return true;
            }

            return evaluation.mode === null || evaluation.mode === mode;
        });
    }

    public static countTournament(badges: ReadonlyArray<Badge>, mode?: GameMode): number {
        return this.tournament(badges, mode).length;
    }

    private static mode(description: string): GameMode | null {
        if (description.includes("osu!mania") || description.includes("osu mania") || /\bmania\b/.test(description)) {
            return GameMode.Mania;
        }

        if (description.includes("osu!taiko") || description.includes("osu taiko") || /\btaiko\b/.test(description)) {
            return GameMode.Taiko;
        }

        if (
            description.includes("osu!catch") ||
            description.includes("osu catch") ||
            description.includes("catch the beat") ||
            /\bctb\b/.test(description)
        ) {
            return GameMode.Catch;
        }

        if (
            description.includes("osu!standard") ||
            description.includes("osu! standard") ||
            description.includes("osu standard")
        ) {
            return GameMode.Standard;
        }

        return null;
    }

    private static isTournamentUrl(url?: string | null): boolean {
        if (!url) return false;

        try {
            const parsed = new URL(url);
            if (parsed.hostname !== "osu.ppy.sh") {
                return false;
            }

            return parsed.pathname.toLowerCase().includes("/tournaments/");
        } catch {
            return false;
        }
    }

    private static matchesAny(value: string, terms: ReadonlyArray<string>): boolean {
        return terms.some((term) => value.includes(term));
    }

    private static normalize(value: string): string {
        return value.toLowerCase().replace(/\s+/g, " ").trim();
    }
}
