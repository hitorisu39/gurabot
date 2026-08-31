import { Button, Import, Modal } from "@/core/decorators";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { Score } from "@generated/adapter/types";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { OrdrRenderResolverService } from "@/modules/ordr/OrdrRenderResolver.service";
import { OrdrRenderViewService } from "@/modules/ordr/OrdrRenderView.service";
import { ScorepostService } from "@/modules/osu/scorepost/Scorepost.service";
import { ScorepostViewService } from "@/modules/osu/scorepost/ScorepostView.service";
import { isTimezoneOffset, normalizeTimezone, parseTimezoneOffset } from "@domain/utils/dateTimeUtils";
import { isValidNumber } from "@domain/utils/utils";

abstract class AbstractScoresActionComponent extends AbstractSessionComponent<"osu_scores_view", ScoresViewDto> {
    protected readonly sessionKey = "osu_scores_view";
    protected readonly dto = ScoresViewDto;

    protected getActionScore(data: ScoresViewDto): Score {
        const score = data.scores[0];

        if (
            data.scores.length !== 1 ||
            !score ||
            !ScoreUtils.allowsScoreActions(score, data.profile.mode, data.profile.provider)
        ) {
            throw new Exception(EApplicationError.INPUT_ERROR, "This score does not support this action.");
        }

        return score;
    }
}

@Button(/^osu_score_action:(?<action>render|scorepost):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class ScoresActionsComponent extends AbstractScoresActionComponent {
    @Import() declare private readonly ordrRenderResolverService: OrdrRenderResolverService;
    @Import() declare private readonly ordrRenderViewService: OrdrRenderViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;

        if (!action || !sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const score = this.getActionScore(data);

        switch (action) {
            case "render":
                await this.render(ctx, score);
                return;
            case "scorepost":
                await this.showScorepostModal(ctx, sessionID);
                return;
        }
    }

    private async render(ctx: ComponentContext, score: Score): Promise<void> {
        await ctx.deferReply();
        const data = await this.ordrRenderResolverService.score(ctx.author.id, score.id.toString());
        await this.respondWithSession(ctx, "ordr_render_view", data, this.ordrRenderViewService);
    }

    private async showScorepostModal(ctx: ComponentContext, sessionID: string): Promise<void> {
        const modal = new ModalBuilder().setCustomId(`osu_scorepost_modal:${sessionID}`).setTitle("Scorepost");

        const textInput = new TextInputBuilder()
            .setCustomId("text")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(100)
            .setPlaceholder("Text after the score info");

        const urInput = new TextInputBuilder()
            .setCustomId("ur")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(32)
            .setPlaceholder("e.g. 82.4");

        const timezoneInput = new TextInputBuilder()
            .setCustomId("timezone")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(9)
            .setPlaceholder("e.g. +3 or -05:30");

        modal
            .addLabelComponents(new LabelBuilder().setLabel("Text (Optional)").setTextInputComponent(textInput))
            .addLabelComponents(new LabelBuilder().setLabel("Unstable rate (Optional)").setTextInputComponent(urInput))
            .addLabelComponents(
                new LabelBuilder().setLabel("Timezone (Optional)").setTextInputComponent(timezoneInput),
            );

        await ctx.showModal(modal);
    }
}

@Modal(/^osu_scorepost_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class ScoresScorepostModal extends AbstractScoresActionComponent {
    @Import() declare private readonly scorepostService: ScorepostService;
    @Import() declare private readonly scorepostViewService: ScorepostViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const session = await this.getData(ctx, sessionID);
        const score = this.getActionScore(session);

        const text = ctx.getTextInput("text");
        const ur = this.parseUr(ctx.getTextInput("ur"));
        const timezoneOffset = this.parseTimezone(ctx.getTextInput("timezone"));

        await ctx.deferReply();

        const data = await this.scorepostService.resolve(score.id.toString(), ur, text, timezoneOffset);
        await ctx.reply(await this.scorepostViewService.build(data));
    }

    private parseUr(input: string | null): number | undefined {
        if (!input) {
            return undefined;
        }

        const value = Number(input);
        if (!isValidNumber(value) || value < 0) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Unstable rate must be a positive number.");
        }

        return value;
    }

    private parseTimezone(input: string | null): number {
        if (input && !isTimezoneOffset(input)) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                "Invalid timezone. Use a UTC offset such as +3 or -05:30.",
            );
        }

        const timezone = normalizeTimezone(input ?? undefined);
        return parseTimezoneOffset(timezone);
    }
}
