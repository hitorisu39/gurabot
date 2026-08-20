import { Autocomplete, Import, IsEnum, IsString, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AutocompleteContext } from "@/core/discord/context/AutocompleteContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { MedalMissingViewService } from "@/modules/osu/medal/MedalMissingView.service";
import { MedalMissingViewDto } from "@domain/osu/views/MedalMissing.view";
import { OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";
import { CommandOption } from "@domain/core/Command";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { MedalFormatter } from "@domain/osu/formatters/Medal.formatter";
import { EMedalCollectionSort } from "@domain/osu/enums/Medal.enum";
import { OsekaiService } from "@/modules/osekai/Osekai.service";

export abstract class AbstractMedalMissingCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osekaiService: OsekaiService;
    @Import() declare private readonly medalMissingViewService: MedalMissingViewService;

    @Option("sort", "Specify how missing medals should be sorted")
    @IsEnum(EMedalCollectionSort)
    declare private readonly sort: CommandOption<EMedalCollectionSort>;

    @Option("group", "Only show medals from a specific group")
    @IsString(1, 100)
    @Autocomplete()
    declare private readonly group: CommandOption<string>;

    protected forcedServer = AdapterProvider.Bancho;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);

        const [profile, osekaiMedals] = await Promise.all([
            this.osuService.user(target.query, target.mode, target.server),
            this.osekaiService.medals(),
        ]);

        const sort = this.sort.unwrapOr(EMedalCollectionSort.Osekai);
        const group = this.group.some() ? this.group.unwrap().trim() : null;
        const mode = this.mode.some() ? this.mode.unwrap() : null;

        const relevantMedals = osekaiMedals.filter((medal) => this.matchesFilters(medal, group, mode));
        const totalMedals = relevantMedals.length;
        const achievedIDs = new Set((profile.achievements ?? []).map((achievement) => achievement.achievementID));

        let missing = relevantMedals.filter((medal) => !achievedIDs.has(medal.id));
        missing = this.sortMedals(missing, sort, relevantMedals);

        const data: MedalMissingViewDto = {
            authorID: ctx.author.id,
            profile,
            medals: missing,
            totalMedals,
            page: 1,
            sort,
            group,
            mode,
        };

        await this.respondWithSession(ctx, "osu_medal_missing_view", data, this.medalMissingViewService);
    }

    public async autocomplete(ctx: AutocompleteContext): Promise<void> {
        const focused = ctx.getFocused();

        if (focused.name !== "group") {
            return await ctx.respond([]);
        }

        const medals = await this.osekaiService.medals();
        const query = String(focused.value).trim().toLowerCase();

        const groups = Array.from(
            new Set(medals.map((medal) => medal.grouping).filter((group): group is string => Boolean(group))),
        )
            .filter((group) => !query || group.toLowerCase().includes(query))
            .sort((a, b) => {
                const aStarts = a.toLowerCase().startsWith(query);
                const bStarts = b.toLowerCase().startsWith(query);

                if (aStarts !== bStarts) {
                    return aStarts ? -1 : 1;
                }

                return a.localeCompare(b);
            })
            .slice(0, 25);

        await ctx.respond(
            groups.map((group) => ({
                name: group,
                value: group,
            })),
        );
    }

    private matchesFilters(medal: OsekaiMedalDto, group: string | null, mode: GameMode | null): boolean {
        if (group && medal.grouping.toLowerCase() !== group.toLowerCase()) {
            return false;
        }

        if (mode !== null) {
            const medalMode = MedalFormatter.gamemode(medal.gamemode);
            if (medalMode !== null && medalMode !== mode) {
                return false;
            }
        }

        return true;
    }

    private sortMedals(
        medals: ReadonlyArray<OsekaiMedalDto>,
        sort: EMedalCollectionSort,
        allRelevantMedals: ReadonlyArray<OsekaiMedalDto>,
    ): Array<OsekaiMedalDto> {
        const groupOrder = new Map<string, number>();

        for (const medal of allRelevantMedals) {
            const group = medal.grouping || "Other";
            const current = groupOrder.get(group);

            if (current === undefined || medal.ordering < current) {
                groupOrder.set(group, medal.ordering);
            }
        }

        return [...medals].sort((a, b) => {
            const aGroup = a.grouping || "Other";
            const bGroup = b.grouping || "Other";

            if (aGroup !== bGroup) {
                const groupDiff = (groupOrder.get(aGroup) ?? Infinity) - (groupOrder.get(bGroup) ?? Infinity);

                if (groupDiff !== 0) {
                    return groupDiff;
                }

                return aGroup.localeCompare(bGroup);
            }

            switch (sort) {
                case EMedalCollectionSort.Alphabetical:
                    return a.name.localeCompare(b.name) || a.ordering - b.ordering;
                case EMedalCollectionSort.MedalID:
                    return a.id - b.id || a.ordering - b.ordering;
                case EMedalCollectionSort.Rarity:
                    return (a.frequency ?? Infinity) - (b.frequency ?? Infinity) || a.ordering - b.ordering;
                case EMedalCollectionSort.Osekai:
                default:
                    return a.ordering - b.ordering;
            }
        });
    }
}
