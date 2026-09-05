import { Category, Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.Osu)
@Command({
    name: "mapper",
    description: "Shows scores played on maps by a specific mapper.",
    defer: false,
})
export class MapperCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
