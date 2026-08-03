import { GameMode } from "@generated/adapter/types";
import { ESkillRank, ESkillType } from "../enums/Skill.enum";

export interface ISkillRankThreshold {
    rank: ESkillRank;
    threshold: number;
}

export const skillRankThresholds: Array<ISkillRankThreshold> = [
    { threshold: 0, rank: ESkillRank.Weak },
    { threshold: 3, rank: ESkillRank.Common },
    { threshold: 4.5, rank: ESkillRank.Average },
    { threshold: 5.5, rank: ESkillRank.Expert },
    { threshold: 6.5, rank: ESkillRank.Elite },
    { threshold: 8, rank: ESkillRank.Master },
    { threshold: 9.5, rank: ESkillRank.Legend },
];

export const skillRankWeights: Record<GameMode, Partial<Record<ESkillType, number>>> = {
    [GameMode.Standard]: {
        [ESkillType.Aim]: 0.15,
        [ESkillType.Speed]: 0.2,
        [ESkillType.Accuracy]: 0.5,
        [ESkillType.Stamina]: 0.2,
    },

    [GameMode.Taiko]: {
        [ESkillType.Rhythm]: 0.25,
        [ESkillType.Colour]: 0.2,
        [ESkillType.Stamina]: 0.3,
        [ESkillType.Reading]: 0.25,
    },

    [GameMode.Catch]: {
        [ESkillType.Movement]: 0.45,
        [ESkillType.Accuracy]: 0.55,
    },

    [GameMode.Mania]: {
        [ESkillType.Strain]: 0.2,
        [ESkillType.Speed]: 0.25,
        [ESkillType.Accuracy]: 0.5,
    },
};
