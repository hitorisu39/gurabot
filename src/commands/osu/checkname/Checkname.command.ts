import {
    Aliases,
    Category,
    Command,
    Examples,
    Help,
    Import,
    Inject,
    IsString,
    Option,
    Required,
} from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { UsernameAvailabilityViewService } from "@/modules/osu/username/UsernameAvailabilityView.service";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { UsernameAvailabilityService } from "@/modules/osu/username/UsernameAvailability.service";

@Help(`
    Checks whether an osu! username appears to be available.
`)
@Examples("checkname mrekk")
@Category(ECommandCategory.Osu)
@Command({
    name: "checkname",
    description: "Checks whether an osu! username is available.",
    aliases: ["namecheck", "claimname", "nameclaim", "nc"],
})
export class CheckNameCommand extends AbstractCommand {
    @Import() declare private readonly usernameAvailabilityService: UsernameAvailabilityService;
    @Import() declare private readonly usernameAvailabilityViewService: UsernameAvailabilityViewService;

    @Option("name", "Username to check")
    @IsString()
    @Inject()
    @Aliases("username")
    @Required()
    declare private readonly name: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const result = await this.usernameAvailabilityService.evaluate(this.name.unwrap());
        await ctx.respond(this.usernameAvailabilityViewService.build(result));
    }
}
