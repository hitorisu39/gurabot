import { Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";

@Command({
    name: "link",
    description: "The root command for link subcommands",
    defer: false,
    slashOnly: true,
})
export class LinkCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
