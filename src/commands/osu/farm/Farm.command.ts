import { Category, Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.Osu)
@Command({
    name: "farm",
    description: "The root command for farm-map subcommands.",
    defer: false,
    slashOnly: true,
})
export class FarmRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
