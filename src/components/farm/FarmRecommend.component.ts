import { Button, Import, SelectMenu as SelectMenuComponent } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { FarmRecommendService } from "@/modules/farm/FarmRecommend.service";
import { FarmRecommendViewService } from "@/modules/farm/FarmRecommendView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { FarmRecommendViewDto } from "@domain/farm/views/FarmRecommend.view";

abstract class AbstractFarmRecommendComponent extends AbstractSessionComponent<
    "osu_farm_recommend_view",
    FarmRecommendViewDto
> {
    @Import() declare protected readonly farmRecommendService: FarmRecommendService;
    @Import() declare protected readonly farmRecommendViewService: FarmRecommendViewService;

    protected readonly sessionKey = "osu_farm_recommend_view";
    protected readonly dto = FarmRecommendViewDto;

    protected sessionID(ctx: ComponentContext): string {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        return sessionID;
    }

    protected async persistAndUpdate(
        ctx: ComponentContext,
        sessionID: string,
        data: FarmRecommendViewDto,
    ): Promise<void> {
        await this.session.update(
            this.sessionKey,
            sessionID,
            {
                timestamp: data.timestamp,
                recommendations: data.recommendations,
            },
            this.farmRecommendViewService.getTtl(),
        );

        await ctx.update(this.farmRecommendViewService.build(sessionID, data));
    }
}

@SelectMenuComponent(/^farm_recommend_replace:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class FarmRecommendReplaceComponent extends AbstractFarmRecommendComponent {
    public async execute(ctx: ComponentContext): Promise<void> {
        const sessionID = this.sessionID(ctx);

        const data = await this.getData(ctx, sessionID);
        const indices = ctx.values.map(Number).filter(Number.isInteger);
        if (!indices.length) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Select at least one recommendation to replace.");
        }

        await ctx.deferUpdate();

        data.recommendations = await this.farmRecommendService.replace(data.query, data.recommendations, indices);
        data.timestamp = Date.now();

        await this.persistAndUpdate(ctx, sessionID, data);
    }
}

@Button(/^farm_recommend_reroll:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class FarmRecommendRerollComponent extends AbstractFarmRecommendComponent {
    public async execute(ctx: ComponentContext): Promise<void> {
        const sessionID = this.sessionID(ctx);
        const data = await this.getData(ctx, sessionID);

        await ctx.deferUpdate();

        data.recommendations = await this.farmRecommendService.reroll(data.query, 10);
        data.timestamp = Date.now();
        await this.persistAndUpdate(ctx, sessionID, data);
    }
}
