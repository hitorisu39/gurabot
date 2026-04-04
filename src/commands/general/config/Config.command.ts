import { Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";

@Command({
    name: "config",
    description: "The root command for config subcommands",
    defer: false,
})
export class ConfigCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
