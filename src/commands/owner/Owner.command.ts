import { Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";

@Command({
    name: "owner",
    description: "Commands designated for the bot developer.",
    defer: false,
})
export class OwnerCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}