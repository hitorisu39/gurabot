import { AuthOsuStateDto } from "@domain/auth/Auth.dto";
import { GuildDto } from "@domain/guild/Guild.dto";
import { OrdrConfigViewDto } from "@domain/ordr/views/OrdrConfig.view";
import { OrdrRenderViewDto } from "@domain/ordr/views/OrdrRender.view";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { LeaderboardViewDto } from "@domain/osu/views/Leaderboard.view";
import { MapViewDto } from "@domain/osu/views/Map.view";
import { NoChokeViewDto } from "@domain/osu/views/NoChoke.view";
import { ProfileViewDto } from "@domain/osu/views/Profile.view";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { SimulateViewDto } from "@domain/osu/views/Simulate.view";

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

    ordr_config_view: OrdrConfigViewDto;
    ordr_render_view: OrdrRenderViewDto;

    // Osu
    osu_user_profile: PopulatedUser;

    // Auth
    auth_osu_state: AuthOsuStateDto;
}
