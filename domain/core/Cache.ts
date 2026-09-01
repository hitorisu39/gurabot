import { AuthOsuStateDto, AuthTwitchStateDto } from "@domain/auth/Auth.dto";
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
import { CompareProfileViewDto } from "@domain/osu/views/CompareProfile.view";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { SimulateViewDto } from "@domain/osu/views/Simulate.view";
import { TopIfViewDto } from "@domain/osu/views/TopIf.view";
import { OsuStatsBestScoresDto } from "@domain/osustats/OsuStatsBest.dto";
import { OsuStatsCountsDto } from "@domain/osustats/OsuStatsCounts.dto";
import { OsuStatsPlayersPageDto } from "@domain/osustats/OsuStatsPlayers.dto";
import { OsuStatsScoresPageDto } from "@domain/osustats/OsuStatsScores.dto";
import { OsuStatsBestViewDto } from "@domain/osustats/views/OsuStatsBest.view";
import { OsuStatsPlayersViewDto } from "@domain/osustats/views/OsuStatsPlayers.view";
import { OsuStatsScoresViewDto } from "@domain/osustats/views/OsuStatsScores.view";
import { OsuTrackLadderSimulationConfigDto, OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { CompareTopViewDto } from "@domain/osu/views/CompareTop.view";
import { MostPlayedViewDto } from "@domain/osu/views/MostPlayed.view";
import { SearchViewDto } from "@domain/osu/views/Search.view";
import { SnipeRankingDto } from "@domain/snipe/SnipeRanking.dto";
import { SnipePlayerDto } from "@domain/snipe/SnipePlayer.dto";
import { SnipeCountriesDto, SnipeCountryStatisticsDto } from "@domain/snipe/SnipeCountry.dto";
import { SnipeRankingViewDto } from "@domain/snipe/views/SnipeRanking.view";
import { SnipePlayerHistoryDto } from "@domain/snipe/SnipePlayerHistory.dto";
import { SnipeScoresDto } from "@domain/snipe/SnipeScore.dto";
import { SnipePlayerListViewDto } from "@domain/snipe/views/SnipePlayerList.view";
import { SnipePlayerChangesViewDto } from "@domain/snipe/views/SnipePlayerChanges.view";

export interface ICacheSchema {
    // discord
    guild: GuildDto;
    guild_prefix: string;

    // sessions
    osu_profile_view: ProfileViewDto;
    osu_profile_compare_view: CompareProfileViewDto;
    osu_scores_view: ScoresViewDto;
    osu_map_view: MapViewDto;
    osu_simulate_view: SimulateViewDto;
    osu_leaderboard_view: LeaderboardViewDto;
    osu_nochoke_view: NoChokeViewDto;
    osu_topif_view: TopIfViewDto;
    osu_medal_recent_view: MedalRecentViewDto;
    osu_medal_missing_view: MedalMissingViewDto;
    osu_medal_list_view: MedalListViewDto;
    osu_compare_top_view: CompareTopViewDto;
    osu_most_played_view: MostPlayedViewDto;
    osu_search_view: SearchViewDto;

    osekai_ranking_view: OsekaiRankingViewDto;

    osustats_players_view: OsuStatsPlayersViewDto;
    osustats_scores_view: OsuStatsScoresViewDto;
    osustats_best_view: OsuStatsBestViewDto;

    snipe_ranking_view: SnipeRankingViewDto;
    snipe_player_list_view: SnipePlayerListViewDto;
    snipe_player_changes_view: SnipePlayerChangesViewDto;

    ordr_config_view: OrdrConfigViewDto;
    ordr_render_view: OrdrRenderViewDto;

    general_commands_view: CommandsViewDto;

    // osu!
    osu_user_profile: PopulatedUser;
    osu_scorepost_background_miss: boolean;

    // osu!track
    osutrack_stats_history: Array<OsuTrackStatsHistoryDto>;
    osutrack_ladder_simulation_config: OsuTrackLadderSimulationConfigDto;

    // osu!snipe
    snipe_rankings: SnipeRankingDto;
    snipe_player: SnipePlayerDto;
    snipe_player_history: SnipePlayerHistoryDto;
    snipe_country_statistics: SnipeCountryStatisticsDto;
    snipe_countries: SnipeCountriesDto;
    snipe_player_scores: SnipeScoresDto;

    // osu!stats
    osu_stats_counts: OsuStatsCountsDto;
    osu_stats_players: OsuStatsPlayersPageDto;
    osu_stats_scores: OsuStatsScoresPageDto;
    osu_stats_best: OsuStatsBestScoresDto;

    // osekai
    osekai_medals: Array<OsekaiMedalDto>;
    osekai_ranking: OsekaiRankingPageDto;

    // auth
    auth_osu_state: AuthOsuStateDto;
    auth_twitch_state: AuthTwitchStateDto;
}
