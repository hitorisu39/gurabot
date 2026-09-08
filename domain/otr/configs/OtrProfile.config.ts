import { EOtrFormPeriod } from "../views/OtrProfile.view";

export const otrFormPeriodLabel: Record<EOtrFormPeriod, string> = {
    [EOtrFormPeriod.Days30]: "30 days",
    [EOtrFormPeriod.Days90]: "90 days",
    [EOtrFormPeriod.Months6]: "6 months",
    [EOtrFormPeriod.Year1]: "1 year",
    [EOtrFormPeriod.All]: "All time",
};

export function otrFormDateMin(period: EOtrFormPeriod, now: Date = new Date()): Date | undefined {
    const date = new Date(now);

    switch (period) {
        case EOtrFormPeriod.Days30:
            date.setUTCDate(date.getUTCDate() - 30);
            break;
        case EOtrFormPeriod.Days90:
            date.setUTCDate(date.getUTCDate() - 90);
            break;
        case EOtrFormPeriod.Months6:
            date.setUTCMonth(date.getUTCMonth() - 6);
            break;
        case EOtrFormPeriod.Year1:
            date.setUTCFullYear(date.getUTCFullYear() - 1);
            break;
        case EOtrFormPeriod.All:
            return undefined;
    }

    return date;
}
