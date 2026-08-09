import { Category, Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.General)
@Command({
    name: "config",
    description: "The root command for config subcommands",
    defer: false,
    slashOnly: true,
})
export class ConfigCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
