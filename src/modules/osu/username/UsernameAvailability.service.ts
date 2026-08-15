import { Import, Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { UsernameAvailabilityDto } from "@domain/osu/UsernameAvailability.dto";
import {
    EUsernameAvailabilityStatus,
    EUsernameProtectionReason,
    EUsernameValidationIssue,
} from "@domain/osu/enums/UsernameAvailability.enum";
import { OsuService } from "../Osu.service";
import { EApplicationError, Exception } from "@domain/core/Exception";

export class UsernameAvailabilityService extends AbstractService {
    @Import() declare private readonly osuService: OsuService;

    private readonly inactiveDays = 180;
    private readonly modes = [GameMode.Standard, GameMode.Taiko, GameMode.Catch, GameMode.Mania];

    @Trace()
    public async evaluate(username: string): Promise<UsernameAvailabilityDto> {
        const validationIssues = this.validateUsername(username);

        if (validationIssues.length > 0) {
            return {
                username,
                status: EUsernameAvailabilityStatus.Invalid,
                validationIssues,
                protectionReasons: [],
            };
        }

        const users = await this.fetchUsers(username);

        if (!users) {
            return {
                username,
                status: EUsernameAvailabilityStatus.Available,
                validationIssues: [],
                protectionReasons: [],
            };
        }

        const user = users[0]!;
        const isFormerUsername = user.username.toLowerCase() !== username.toLowerCase();

        const protectionReasons = this.protectionReasons(users);

        if (protectionReasons.length > 0) {
            return {
                username,
                status: EUsernameAvailabilityStatus.Protected,
                validationIssues: [],
                protectionReasons,
                user,
                formerUsername: isFormerUsername,
            };
        }

        if (isFormerUsername) {
            return {
                username,
                status: EUsernameAvailabilityStatus.Unknown,
                validationIssues: [],
                protectionReasons: [],
                user,
                formerUsername: true,
                availableBy: new Date(Date.now() + this.inactiveDays * 24 * 60 * 60 * 1000),
            };
        }

        const totalPlaycount = this.totalPlaycount(users);
        if (!user.lastVisit) {
            return {
                username,
                status: EUsernameAvailabilityStatus.Unknown,
                validationIssues: [],
                protectionReasons: [],
                user,
                availableIfInactiveFromNow: this.availableAt(new Date(), totalPlaycount),
            };
        }

        const availableAt = this.availableAt(user.lastVisit, totalPlaycount);
        if (availableAt.getTime() <= Date.now()) {
            return {
                username,
                status: EUsernameAvailabilityStatus.Available,
                validationIssues: [],
                protectionReasons: [],
                availableAt,
                user,
            };
        }

        return {
            username,
            status: EUsernameAvailabilityStatus.AvailableLater,
            validationIssues: [],
            protectionReasons: [],
            availableAt,
            user,
        };
    }

    private validateUsername(username: string): Array<EUsernameValidationIssue> {
        const issues: Array<EUsernameValidationIssue> = [];

        if (username !== username.trim()) {
            issues.push(EUsernameValidationIssue.LeadingOrTrailingSpaces);
        }

        if (username.length < 3) {
            issues.push(EUsernameValidationIssue.TooShort);
        }

        if (username.length > 15) {
            issues.push(EUsernameValidationIssue.TooLong);
        }

        if (!/^[A-Za-z0-9_[\] -]+$/.test(username)) {
            issues.push(EUsernameValidationIssue.InvalidCharacters);
        }

        if (username.includes("  ")) {
            issues.push(EUsernameValidationIssue.ConsecutiveSpaces);
        }

        if (username.includes("_") && username.includes(" ")) {
            issues.push(EUsernameValidationIssue.MixedSpacesAndUnderscores);
        }

        return issues;
    }

    private async fetchUsers(username: string): Promise<Array<PopulatedUser> | null> {
        let standard: PopulatedUser;

        try {
            standard = await this.osuService.user(username, GameMode.Standard, AdapterProvider.Bancho);
        } catch (error) {
            if (error instanceof Exception && error.code === EApplicationError.NOT_FOUND) return null;
            throw error;
        }

        const remaining = await Promise.all(
            this.modes
                .filter((mode) => mode !== GameMode.Standard)
                .map((mode) => this.osuService.user(standard.id, mode, AdapterProvider.Bancho)),
        );

        return [standard, ...remaining];
    }

    private protectionReasons(users: ReadonlyArray<PopulatedUser>): Array<EUsernameProtectionReason> {
        const reasons: Array<EUsernameProtectionReason> = [];
        const user = users[0]!;

        if (users.some((profile) => profile.highestRank?.rank !== undefined && profile.highestRank.rank <= 100)) {
            reasons.push(EUsernameProtectionReason.Top100);
        }

        if ((user.badges?.length ?? 0) > 0) {
            reasons.push(EUsernameProtectionReason.Badges);
        }

        if (
            (user.beatmapsetRankedCount ?? 0) > 0 ||
            (user.beatmapsetLovedCount ?? 0) > 0 ||
            (user.beatmapsetGuestCount ?? 0) > 0
        ) {
            reasons.push(EUsernameProtectionReason.Beatmaps);
        }

        return reasons;
    }

    private totalPlaycount(users: ReadonlyArray<PopulatedUser>): number {
        return users.reduce((total, user) => {
            return total + user.statistics.playcount;
        }, 0);
    }

    private availableAt(lastVisit: Date, playcount: number): Date {
        const days = Math.trunc(this.inactiveDays + 1580 * (1 - Math.exp(-playcount / 5900)) + (playcount * 8) / 5900);
        return new Date(lastVisit.getTime() + days * 24 * 60 * 60 * 1000);
    }
}
