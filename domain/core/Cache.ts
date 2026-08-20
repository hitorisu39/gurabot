import { AuthOsuStateDto } from "@domain/auth/Auth.dto";
import { CommandsViewDto } from "@domain/general/views/Commands.view";
import { GuildDto } from "@domain/guild/Guild.dto";
import { OrdrConfigViewDto } from "@domain/ordr/views/OrdrConfig.view";
import { OrdrRenderViewDto } from "@domain/ordr/views/OrdrRender.view";
import { OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";
import { OsekaiRankingPageDto } from "@domain/osekai/OsekaiRanking.dto";
import { OsekaiRankingViewDto } from "@domain/osekai/views/OsekaiRanking.view";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { LeaderboardViewDto } from "@domain/osu/views/Leaderboard.view";
import { MapViewDto } from "@domain/osu/views/Map.view";
import { MedalListViewDto } from "@domain/osu/views/MedalList.view";
import { MedalMissingViewDto } from "@domain/osu/views/MedalMissing.view";
import { MedalRecentViewDto } from "@domain/osu/views/MedalRecent.view";
import { NoChokeViewDto } from "@domain/osu/views/NoChoke.view";
import { ProfileViewDto } from "@domain/osu/views/Profile.view";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { SimulateViewDto } from "@domain/osu/views/Simulate.view";
import { OsuTrackLadderSimulationConfigDto, OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";

export interface ICacheSchema {
    // Discord
    guild: GuildDto;
    guild_prefix: string;

    // Sessions
    osu_profile_view: ProfileViewDto;
    osu_scores_view: ScoresViewDto;
    osu_map_view: MapViewDto;
    osu_simulate_view: SimulateViewDto;
    osu_leaderboard_view: LeaderboardViewDto;
    osu_nochoke_view: NoChokeViewDto;
    osu_medal_recent_view: MedalRecentViewDto;
    osu_medal_missing_view: MedalMissingViewDto;
    osu_medal_list_view: MedalListViewDto;

    osekai_ranking_view: OsekaiRankingViewDto;

    ordr_config_view: OrdrConfigViewDto;
    ordr_render_view: OrdrRenderViewDto;

    general_commands_view: CommandsViewDto;

    // Osu
    osu_user_profile: PopulatedUser;

    // osu!track
    osutrack_stats_history: Array<OsuTrackStatsHistoryDto>;
    osutrack_ladder_simulation_config: OsuTrackLadderSimulationConfigDto;

    // Osekai
    osekai_medals: Array<OsekaiMedalDto>;
    osekai_ranking: OsekaiRankingPageDto;

    // Auth
    auth_osu_state: AuthOsuStateDto;
}
