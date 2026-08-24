import { Category, Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.Osu)
@Command({
    name: "snipe",
    description: "osu! national #1 and sniping statistics.",
    defer: false,
    slashOnly: true,
})
export class SnipeRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
