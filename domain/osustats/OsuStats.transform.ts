import { ModUtils, ParsedMod } from "@generated/adapter/mods";
import { ScoreStatistics } from "@generated/adapter/types";
import { plainToInstance } from "class-transformer";

export function osuStatsMods(value: unknown): Array<ParsedMod> {
    if (Array.isArray(value)) {
        return ModUtils.parse(value);
    }

    if (typeof value !== "string" || !value || value === "None") {
        return [];
    }

    let mods = ModUtils.parse(
        value
            .split(",")
            .map((mod) => mod.trim())
            .filter(Boolean),
    );

    if (ModUtils.has(mods, "NC")) {
        mods = mods.filter((mod) => mod.acronym !== "DT");
    }

    if (ModUtils.has(mods, "PF")) {
        mods = mods.filter((mod) => mod.acronym !== "SD");
    }

    return mods;
}

export function osuStatsDate(value: unknown): Date {
    if (value instanceof Date) {
        return value;
    }

    const raw = String(value ?? "");
    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
    const withTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
    return new Date(withTimezone);
}

export function osuStatsStatistics(value: unknown, obj: Record<string, unknown>): ScoreStatistics {
    if (value && typeof value === "object") {
        return plainToInstance(ScoreStatistics, value);
    }

    return plainToInstance(ScoreStatistics, {
        ignoreMiss: 0,
        ignoreHit: 0,
        miss: Number(obj.countMiss ?? 0),
        meh: Number(obj.count50 ?? 0),
        ok: Number(obj.count100 ?? 0),
        good: Number(obj.countKatu ?? 0),
        great: Number(obj.count300 ?? 0),
        perfect: Number(obj.countGeki ?? 0),
        smallTickMiss: 0,
        smallTickHit: 0,
        largeTickMiss: 0,
        largeTickHit: 0,
        smallBonus: 0,
        largeBonus: 0,
        legacyComboIncrease: 0,
    });
}
