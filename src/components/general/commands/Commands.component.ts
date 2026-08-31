import { Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { CommandsViewService } from "@/modules/general/commands/CommandsView.service";
import { ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { CommandsViewDto } from "@domain/general/views/Commands.view";

@SelectMenu(/^commands_category:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class CommandsComponent extends AbstractSessionComponent<"general_commands_view", CommandsViewDto> {
    @Import() declare private readonly commandsViewService: CommandsViewService;

    protected readonly sessionKey = "general_commands_view";
    protected readonly dto = CommandsViewDto;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);

        const category = ctx.values[0] as ECommandCategory | undefined;
        if (!category || !Object.values(ECommandCategory).includes(category)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        if (category === data.category) {
            await ctx.deferUpdate();
            return;
        }

        data.category = category;
        await ctx.deferUpdate();

        await this.session.update(this.sessionKey, sessionID, data, this.commandsViewService.getTtl());
        await ctx.update(this.commandsViewService.build(sessionID, data));
    }
}
