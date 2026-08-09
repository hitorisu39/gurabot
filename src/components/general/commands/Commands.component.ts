import { Import, SelectMenu } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SessionService } from "@/modules/cache/Session.service";
import { CommandsViewService } from "@/modules/general/commands/CommandsView.service";
import { ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { CommandsViewDto } from "@domain/general/views/Commands.view";
import { plainToInstance } from "class-transformer";

@SelectMenu(/^commands_category:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class CommandsComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly commandsViewService: CommandsViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("general_commands_view", sessionID);

        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(CommandsViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const category = ctx.values[0] as ECommandCategory | undefined;
        if (!category || !Object.values(ECommandCategory).includes(category)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        data.category = category;

        await ctx.deferUpdate();
        await this.sessionService.update("general_commands_view", sessionID, data, this.commandsViewService.getTtl());
        await ctx.update(this.commandsViewService.build(sessionID, data));
    }
}
