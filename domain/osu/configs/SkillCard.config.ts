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
        skillName: "#ffffffb4",
        skillValue: "#ffffffb4",
    },

    [ESkillRank.Common]: {
        username: "#ffffff",
        skillName: "#ffffffb4",
        skillValue: "#ffffffb4",
    },

    [ESkillRank.Average]: {
        username: "#ffffff",
        skillName: "#ffffffb4",
        skillValue: "#ffffffb4",
    },

    [ESkillRank.Expert]: {
        username: "#ffffff",
        skillName: "#ffffffb4",
        skillValue: "#ffffffb4",
    },

    [ESkillRank.Elite]: {
        username: "#ffffff",
        skillName: "#ffffffb4",
        skillValue: "#ffffffb4",
    },

    [ESkillRank.Master]: {
        username: "#ffffff",
        skillName: "#ffffffb4",
        skillValue: "#ffffffb4",
    },

    [ESkillRank.Legend]: {
        username: "#ffffff",
        skillName: "#ffffffb4",
        skillValue: "#ffffffb4",
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
