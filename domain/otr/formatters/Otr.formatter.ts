import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { ModUtils } from "@generated/adapter/mods";
import { EOtrVerificationStatus } from "../enums/Otr.enum";

export class OtrFormatter {
    public static modLabel(mods: number, freemod: boolean = false): string {
        if (freemod) return "FM";
        return ScoreFormatter.mods(
            ModUtils.parse(mods).filter((mod) => mod.acronym !== "NF"),
            false,
            true,
        );
    }

    public static verification(status: EOtrVerificationStatus): string {
        switch (status) {
            case EOtrVerificationStatus.Verified:
                return "Verified";
            case EOtrVerificationStatus.Rejected:
                return "Rejected";
            case EOtrVerificationStatus.PreVerified:
                return "Pre-verified";
            case EOtrVerificationStatus.PreRejected:
                return "Pre-rejected";
            default:
                return "Unverified";
        }
    }
}
