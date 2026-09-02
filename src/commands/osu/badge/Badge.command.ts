import { Command } from "@/core/decorators";

import { AbstractCommand } from "@/core/discord/AbstractCommand";

@Command({
    name: "badge",
    description: "The root command for badge subcommands.",
    defer: false,
    slashOnly: true,
})
export class BadgeRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
