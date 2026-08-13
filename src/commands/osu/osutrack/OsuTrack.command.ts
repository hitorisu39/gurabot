import { Category, Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.Osu)
@Command({
    name: "osutrack",
    description: "The root command for osu!track subcommands",
    defer: false,
    slashOnly: true,
})
export class OsuTrackRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
