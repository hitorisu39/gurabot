import { GameMode } from "@generated/adapter/types";
import { ESkillRank } from "../enums/Skill.enum";

interface ISkillCardTheme {
    username: string;
    skillName: string;
    skillValue: string;
}

export const skillCardThemes: Record<ESkillRank, ISkillCardTheme> = {
    [ESkillRank.Weak]: {
        username: "#ffffff",
        skillName: "#9cdb90",
        skillValue: "#9aa794",
    },

    [ESkillRank.Common]: {
        username: "#ffffff",
        skillName: "#d1db90",
        skillValue: "#a7a194",
    },

    [ESkillRank.Average]: {
        username: "#c9ebff",
        skillName: "#90c5db",
        skillValue: "#94a2a7",
    },

    [ESkillRank.Expert]: {
        username: "#dac9ff",
        skillName: "#9590db",
        skillValue: "#9594a7",
    },

    [ESkillRank.Elite]: {
        username: "#ffffff",
        skillName: "#e2a2ff",
        skillValue: "#a294a7",
    },

    [ESkillRank.Master]: {
        username: "#e1cdad",
        skillName: "#dbc390",
        skillValue: "#a7a194",
    },

    [ESkillRank.Legend]: {
        username: "#ffffff",
        skillName: "#db9090",
        skillValue: "#a79494",
    },
};

export const skillCardModeAssets: Record<GameMode, string> = {
    [GameMode.Standard]: "standard.png",
    [GameMode.Taiko]: "taiko.png",
    [GameMode.Catch]: "catch.png",
    [GameMode.Mania]: "mania.png",
};

export const skillCardLayout = {
    width: 400,
    height: 800,

    modeIconX: 11,
    modeIconY: 8,
    modeIconSize: 30,

    serverCenterX: 200,
    serverY: 27,

    avatarX: 72,
    avatarY: 69,
    avatarSize: 256,

    usernameCenterX: 200,
    usernameCenterY: 365,

    profileRankOffsetY: 18,

    skillLabelX: 92,
    skillValueX: 300,

    skillAreaTop: 438,
    skillAreaHeight: 200,
    skillRowHeight: 50,

    emptyBarX: 88,
    filledBarX: 78,

    emptyBarOffsetY: 25,
    filledBarOffsetY: 17,
};

export const skillCardMaximumStars: Record<GameMode, number> = {
    [GameMode.Standard]: 12,
    [GameMode.Taiko]: 12,
    [GameMode.Catch]: 12,
    [GameMode.Mania]: 12,
};
