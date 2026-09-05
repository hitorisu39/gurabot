import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractMapperTopCommand } from "./AbstractMapperTopCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "mapper",
    name: "top",
    description: "Shows top plays on maps by a specific mapper.",
    aliases: ["mapper"],
})
export class MapperTopSubcommand extends AbstractMapperTopCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikomappertop",
    description: "Shows top taiko plays on maps by a specific mapper.",
    aliases: ["mappertoptaiko", "taikomapper"],
    prefixOnly: true,
})
export class TaikoMapperTopCommand extends AbstractMapperTopCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchmappertop",
    description: "Shows top catch plays on maps by a specific mapper.",
    aliases: ["mappertopcatch", "catchmapper"],
    prefixOnly: true,
})
export class CatchMapperTopCommand extends AbstractMapperTopCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniamappertop",
    description: "Shows top mania plays on maps by a specific mapper.",
    aliases: ["mappertopmania", "maniamapper"],
    prefixOnly: true,
})
export class ManiaMapperTopCommand extends AbstractMapperTopCommand {
    protected forcedMode = GameMode.Mania;
}
