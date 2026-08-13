import { Aliases, Examples, Import, InjectMatch, IsString, Option } from "@/core/decorators";
import { Score } from "@generated/adapter/types";
import { GraphTopHoursService } from "@/modules/osu/graph/GraphTopHours.service";
import { AbstractGraphTopCommand, IGraphTopResult } from "./AbstractGraphTopCommand";
import { isTimezoneOffset } from "@domain/utils";
import { CommandOption } from "@domain/core/Command";

@Examples("gth", "gth +3", "gth -05:00", "gth +3 username")
export abstract class AbstractGraphTopHoursCommand extends AbstractGraphTopCommand {
    @Import() declare private readonly graphTopHoursService: GraphTopHoursService;

    @Option("timezone", "UTC offset used for play times, e.g. +3 or -05:30. Defaults to UTC+0.")
    @IsString(1, 9)
    @Aliases("tz")
    @InjectMatch(isTimezoneOffset)
    declare private readonly timezone: CommandOption<string>;

    protected async generateGraph(scores: ReadonlyArray<Score>): Promise<IGraphTopResult> {
        const timezone = this.normalizeTimezone(this.timezone);

        return {
            image: await this.graphTopHoursService.generate(scores, timezone),
            filename: "top-hours",
            title: `Top play hours · ${timezone}`,
        };
    }

    private normalizeTimezone(timezone: CommandOption<string>): string {
        const value = timezone.unwrapUnchecked();

        if (!value || /^(?:UTC|Z)$/i.test(value)) {
            return "UTC+0";
        }

        if (/^UTC/i.test(value)) {
            return value.toUpperCase();
        }

        return `UTC${value}`;
    }
}
