import { Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";

@Command({
    name: "otr",
    description: "osu! Tournament Rating commands.",
    defer: false,
    slashOnly: true,
})
export class OtrRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
