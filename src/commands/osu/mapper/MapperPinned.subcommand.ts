import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractMapperPinnedCommand } from "./AbstractMapperPinnedCommand";

@Subcommand({
    root: "mapper",
    name: "pinned",
    description: "Shows pinned plays on maps by a specific mapper.",
    aliases: ["mapperp", "pmapper"],
})
export class MapperPinnedSubcommand extends AbstractMapperPinnedCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikomapperpinned",
    description: "Shows pinned taiko plays on maps by a specific mapper.",
    aliases: ["mapperpinnedtaiko", "taikomapperp", "taikopmapper"],
    prefixOnly: true,
})
export class TaikoMapperPinnedCommand extends AbstractMapperPinnedCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchmapperpinned",
    description: "Shows pinned catch plays on maps by a specific mapper.",
    aliases: ["mapperpinnedcatch", "catchmapperp", "catchpmapper"],
    prefixOnly: true,
})
export class CatchMapperPinnedCommand extends AbstractMapperPinnedCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniamapperpinned",
    description: "Shows pinned mania plays on maps by a specific mapper.",
    aliases: ["mapperpinnedmania", "maniamapperp", "maniapmapper"],
    prefixOnly: true,
})
export class ManiaMapperPinnedCommand extends AbstractMapperPinnedCommand {
    protected forcedMode = GameMode.Mania;
}
