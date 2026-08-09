import { Category, Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.Osu)
@Command({
    name: "unlink",
    description: "The root command for unlink subcommands",
    defer: false,
    slashOnly: true,
})
export class UnlinkCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
