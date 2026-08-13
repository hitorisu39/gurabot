import { Category, Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.Osu)
@Command({
    name: "graph",
    description: "The root command for graph subcommands",
    defer: false,
    slashOnly: true,
})
export class GraphRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
