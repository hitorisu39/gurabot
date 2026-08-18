import { Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";

@Command({
    name: "medal",
    description: "The root command for medal subcommands.",
    defer: false,
    slashOnly: true,
})
export class MedalRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
