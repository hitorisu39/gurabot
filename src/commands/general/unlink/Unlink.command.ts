import { Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";

@Command({
    name: "unlink",
    description: "The root command for unlink subcommands",
    defer: false,
})
export class UnlinkCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
