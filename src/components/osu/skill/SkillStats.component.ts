import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { Button, Import, Modal, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SkillStatsViewService } from "@/modules/osu/skills/SkillStatsView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ESkillStatsView, SkillStatsViewDto, TSkillStatsView } from "@domain/osu/views/SkillStats.view";

@SelectMenu(/^osu_skill_stats_select:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SkillStatsSelectComponent extends AbstractSessionComponent<"osu_skill_stats_view", SkillStatsViewDto> {
    @Import() declare private readonly skillStatsViewService: SkillStatsViewService;

    protected readonly sessionKey = "osu_skill_stats_view";
    protected readonly dto = SkillStatsViewDto;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const view = ctx.values[0] as TSkillStatsView | undefined;

        if (
            !view ||
            (view !== ESkillStatsView.Overview && !data.categories.some((category) => category.type === view))
        ) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        if (view === data.view) {
            await ctx.deferUpdate();
            return;
        }

        data.view = view;
        data.page = 1;

        await ctx.deferUpdate();
        await this.session.update(this.sessionKey, sessionID, data, this.skillStatsViewService.getTtl());
        await ctx.update(this.skillStatsViewService.build(sessionID, data));
    }
}

@Button(/^osu_skill_stats_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SkillStatsPaginationComponent extends AbstractPaginationButton<"osu_skill_stats_view", SkillStatsViewDto> {
    @Import() declare private readonly skillStatsViewService: SkillStatsViewService;

    protected readonly paginationID = "osu_skill_stats";
    protected readonly sessionKey = "osu_skill_stats_view";
    protected readonly dto = SkillStatsViewDto;

    protected get viewService(): SkillStatsViewService {
        return this.skillStatsViewService;
    }

    protected getCurrentPage(data: SkillStatsViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: SkillStatsViewDto): number {
        return this.viewService.getTotalPages(data);
    }

    protected setCurrentPage(data: SkillStatsViewDto, page: number): void {
        data.page = page;
    }
}

@Modal(/^osu_skill_stats_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SkillStatsPaginationModal extends AbstractPaginationModal<"osu_skill_stats_view", SkillStatsViewDto> {
    @Import() declare private readonly skillStatsViewService: SkillStatsViewService;

    protected readonly sessionKey = "osu_skill_stats_view";
    protected readonly dto = SkillStatsViewDto;

    protected get viewService(): SkillStatsViewService {
        return this.skillStatsViewService;
    }

    protected getCurrentPage(data: SkillStatsViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: SkillStatsViewDto): number {
        return this.viewService.getTotalPages(data);
    }

    protected setCurrentPage(data: SkillStatsViewDto, page: number): void {
        data.page = page;
    }
}
