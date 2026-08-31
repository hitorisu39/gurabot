import { ModType } from "@generated/adapter/mods";

export const scorepostDimensions = {
    width: 1920,
    height: 1080,
} as const;

export const stableScorepostLayout = {
    darkLayerX: 0,
    darkLayerY: 135,

    topX: 0,
    topY: 0,

    overlayX: 0,
    overlayY: 37,

    titleX: 9,
    titleY: 7,

    mapperX: 10,
    mapperY: 50,

    playedByX: 10,
    playedByY: 81,

    dateSpacingX: 6,
    dateY: 87,

    scoreX: 232,
    scoreY: 178,

    count300X: 194,
    count300Y: 341,

    count100X: 194,
    count100Y: 477,

    count50X: 194,
    count50Y: 611,

    countGekiX: 639,
    countGekiY: 341,

    countKatuX: 639,
    countKatuY: 477,

    countMissX: 639,
    countMissY: 611,

    comboX: 48,
    comboY: 759,

    accuracyX: 444,
    accuracyY: 759,

    gradeX: 1391,
    gradeY: 135,
    gradeWidth: 520,
    gradeHeight: 629,

    modStartX: 1767,
    modY: 522,
    modSize: 125,
    modOverlap: 44,

    perfectX: 162,
    perfectY: 832,
    perfectWidth: 846,
    perfectHeight: 267,

    cursorX: 752,
    cursorY: 860,

    hitMeterX: 785,
    hitMeterY: 894,
    hitMeterHeight: 62,

    hitStatisticsX: 788,
    hitStatisticsY: 897,
} as const;

export const stableScorepostModAssets: Readonly<Record<string, string>> = {
    AT: "selection-mod-autoplay",
    CN: "selection-mod-cinema",
    DT: "selection-mod-doubletime",
    EZ: "selection-mod-easy",
    FL: "selection-mod-flashlight",
    HT: "selection-mod-halftime",
    HR: "selection-mod-hardrock",
    HD: "selection-mod-hidden",
    NC: "selection-mod-nightcore",
    NF: "selection-mod-nofail",
    PF: "selection-mod-perfect",
    RX: "selection-mod-relax",
    AP: "selection-mod-relax2",
    SO: "selection-mod-spunout",
    SD: "selection-mod-suddendeath",
};

export const lazerScorepostLayout = {
    baseCenterX: 957,
    baseTop: 0,

    avatarX: 957,
    avatarY: 95,
    avatarWidth: 116,
    avatarHeight: 116,
    avatarRadius: 24,

    usernameX: 957,
    usernameY: 166,

    statisticsCoverX: 957,
    statisticsCoverY: 615,
    statisticsCoverWidth: 520,
    statisticsCoverHeight: 863,
    statisticsCoverRadius: 24,

    statsBaseX: 957,
    statsBaseY: 885.5,

    titleX: 958,
    titleY: 214,

    artistX: 958,
    artistY: 239,

    wheelX: 939.5,
    wheelY: 458,
    wheelWidth: 397,
    wheelHeight: 362,

    totalScoreX: 955,
    totalScoreY: 689,

    starRatingX: 936,
    starRatingY: 747,
    starRatingWidth: 87,
    starRatingHeight: 27,

    starIconX: 908,
    starIconY: 747,
    starIconSize: 13,

    starRatingTextX: 950,
    starRatingTextY: 747,

    modeX: 1001,
    modeY: 747,
    modeSize: 28,

    difficultyX: 958,
    difficultyY: 775,

    mapperX: 958,
    mapperY: 796,

    wrappedModsY: 775,
    wrappedDifficultyY: 795,
    wrappedMapperY: 814,

    accuracyX: 794,
    accuracyY: 866,

    comboX: 904,
    comboY: 866,

    maximumComboX: 954,
    maximumComboY: 871,

    perfectX: 1015,
    perfectY: 864,

    ppX: 1124,
    ppY: 866,

    greatX: 772,
    greatY: 919,

    okX: 897,
    okY: 919,

    mehX: 1020,
    mehY: 919,

    missX: 1142,
    missY: 919,

    sliderTickX: 819,
    sliderTickY: 974,

    maximumSliderTickX: 855,
    maximumSliderTickY: 979,

    sliderEndX: 1065,
    sliderEndY: 974,

    maximumSliderEndX: 1103,
    maximumSliderEndY: 979,

    playedOnX: 953,
    playedOnY: 1022,
} as const;

export interface IScorepostModStyle {
    asset: string;
    textColour: string;
}

export interface IScorepostColourStop {
    value: number;
    colour: string;
}

export const lazerScorepostConfig = {
    baseCropTop: 37,
    statisticsValueOffsetY: -9,
    backgroundBlur: 3,
    skeleton: {
        top: 248,
        width: 360,
        height: 760,
        gap: 24,
        maximumPerSide: 2,
    },
    fonts: {
        torusLight: "ScorepostTorusLight",
        torusRegular: "ScorepostTorusRegular",
        torusSemiBold: "ScorepostTorusSemiBold",
        rubikBold: "ScorepostRubikBold",
        fallback: "ScorepostFallback",
    },
    starDifficultySpectrum: [
        {
            value: 0.1,
            colour: "#aaaaaa",
        },
        {
            value: 0.1,
            colour: "#4290fb",
        },
        {
            value: 1.25,
            colour: "#4fc0ff",
        },
        {
            value: 2,
            colour: "#4fffd5",
        },
        {
            value: 2.5,
            colour: "#7cff4f",
        },
        {
            value: 3.3,
            colour: "#f6f05c",
        },
        {
            value: 4.2,
            colour: "#ff8068",
        },
        {
            value: 4.9,
            colour: "#ff4e6f",
        },
        {
            value: 5.8,
            colour: "#c645b8",
        },
        {
            value: 6.7,
            colour: "#6563de",
        },
        {
            value: 7.7,
            colour: "#18158e",
        },
        {
            value: 9,
            colour: "#000000",
        },
        {
            value: 10,
            colour: "#000000",
        },
    ] satisfies ReadonlyArray<IScorepostColourStop>,
    starDifficultyTextSpectrum: [
        {
            value: 9,
            colour: "#f6f05c",
        },
        {
            value: 9.9,
            colour: "#ff8068",
        },
        {
            value: 10.6,
            colour: "#ff4e6f",
        },
        {
            value: 11.5,
            colour: "#c645b8",
        },
        {
            value: 12.4,
            colour: "#6563de",
        },
    ] satisfies ReadonlyArray<IScorepostColourStop>,
} as const;

export const lazerScorepostModStyles: Readonly<Record<ModType, IScorepostModStyle>> = {
    DifficultyIncrease: {
        asset: "mod-di.png",
        textColour: "#6B2E2E",
    },
    DifficultyReduction: {
        asset: "mod-dr.png",
        textColour: "#4C6B2E",
    },
    Automation: {
        asset: "mod-au.png",
        textColour: "#2E576B",
    },
    Conversion: {
        asset: "mod-cv.png",
        textColour: "#3D2E6B",
    },
    Fun: {
        asset: "mod-fu.png",
        textColour: "#6B2E49",
    },
    System: {
        asset: "mod-sy.png",
        textColour: "#6B5C2E",
    },
    Unknown: {
        asset: "mod-sy.png",
        textColour: "#6B5C2E",
    },
};
