export const graphStrainColors: Record<string, { border: string; bg: string }> = {
    // Standard
    Aim: { border: "#FC6C85", bg: "rgba(252,108,133,0.2)" },
    "Aim (Sliders)": { border: "#826cfc", bg: "rgba(130, 108, 252,0.2)" },
    AimNoSliders: { border: "#826cfc", bg: "rgba(130, 108, 252,0.2)" },
    Speed: { border: "#6cfcca", bg: "rgba(108, 252, 202,0.2)" },
    Flashlight: { border: "#fcad6c", bg: "rgba(252, 173, 108,0.2)" },
    Reading: { border: "#fcda6c", bg: "rgba(252, 226, 108, 0.2)" },
    // Taiko
    Colour: { border: "#fc6c6c", bg: "rgba(252, 108, 108, 0.2)" },
    Rhythm: { border: "#f06cfc", bg: "rgba(240, 108, 252, 0.2)" },
    Stamina: { border: "#6c6efc", bg: "rgba(108, 110, 252, 0.2)" },
    "Stamina (Single color)": { border: "#6cf2fc", bg: "rgba(108, 235, 252, 0.2)" },
    // Catch
    Movement: { border: "#76fc6c", bg: "rgba(118, 252, 108, 0.2)" },
    // Mania
    Strain: { border: "#f7fc6c", bg: "rgba(247, 252, 108, 0.2)" },
    Mania: { border: "#f7fc6c", bg: "rgba(247, 252, 108, 0.2)" },
} as const;

export const graphColors = {
    background: "#36393E",

    text: "rgb(225, 225, 225)",
    tickText: "rgb(229, 229, 229)",
    axisText: "rgb(223, 223, 223)",
    grid: "rgba(101, 101, 138, 0.20)",

    positive: "#FFD166",
    negative: "#FF8C69",
    secondary: "#62B6FF",
    accent: "#4FD1C5",

    break: {
        bg: "rgba(255, 255, 255, 0.055)",
        border: "rgba(255, 255, 255, 0.22)",
        legendBorder: "rgba(255, 255, 255, 0.45)",
        text: "rgba(255, 255, 255, 0.72)",
    },

    history: {
        border: "#FC6C85",
        bg: "rgba(252, 108, 133, 0.18)",
    },
    rank: {
        border: "#A78BFA",
        bg: "rgba(167, 139, 250, 0.16)",
    },
    replays: {
        border: "#4EA5FF",
        bg: "rgba(78, 165, 255, 0.16)",
    },
    achievements: {
        border: "#6FE7B7",
        bg: "rgba(111, 231, 183, 0.16)",
        highlight: "#C084FC",
    },
    top: {
        hours: {
            border: "#FB923C",
            bg: "rgba(251, 146, 60, 0.24)",
        },
        pp: {
            border: "#38BDF8",
            bg: "rgba(56, 189, 248, 0.24)",
        },
        curve: {
            border: "#F472B6",
            bg: "rgba(244, 114, 182, 0.16)",
        },
        age: {
            border: "#60A5FA",
            bg: "rgba(96, 165, 250, 0.24)",
        },
        rankedDate: {
            border: "#F59E0B",
            bg: "rgba(245, 158, 11, 0.22)",
        },
    },
    skills: {
        aim: "#FC6C85",
        speed: "#6CFCCA",
        accuracy: "#62B6FF",
        stamina: "#A78BFA",

        rhythm: "#F06CFC",
        colour: "#FC6C6C",
        reading: "#FCDA6C",

        movement: "#76FC6C",

        strain: "#F7FC6C",
    },
    osutrack: {
        pp: {
            border: "#C084FC",
            bg: "rgba(192, 132, 252, 0.16)",
        },
        rank: {
            border: "#A78BFA",
            bg: "rgba(167, 139, 250, 0.16)",
        },
        accuracy: {
            border: "#34D399",
            bg: "rgba(52, 211, 153, 0.16)",
        },
        playcount: {
            border: "#F59E0B",
            bg: "rgba(245, 158, 11, 0.16)",
        },
        scores: {
            ranked: "#60A5FA",
            total: "#F472B6",
        },
        hits: {
            count300: "#34D399",
            count100: "#FBBF24",
            count50: "#F87171",
        },
        grades: {
            ss: "#FFD166",
            s: "#C084FC",
            a: "#4FD1C5",
        },
    },
    ladder: {
        pp: {
            border: "#C084FC",
            bg: "rgba(192, 132, 252, 0.16)",
        },
        density: {
            border: "#38BDF8",
            bg: "rgba(56, 189, 248, 0.16)",
        },
        decay: {
            border: "#F59E0B",
            bg: "rgba(245, 158, 11, 0.16)",
        },
        marker: "#FFD166",
    },
} as const;

export const graphStrainTargetCount = 200;
export const graphFallbackColor = { border: "#ffffff", bg: "rgba(255, 255, 255, 0.2)" };
