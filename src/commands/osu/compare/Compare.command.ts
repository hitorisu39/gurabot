import { Category, Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.Osu)
@Command({
    name: "compare",
    description: "Compare osu! scores and player profiles.",
    defer: false,
    slashOnly: true,
})
export class CompareRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
