import type { ActivityDay } from "./StatisticService";

// The care calendar's shading, shared by Statistics and the home page: one square per day,
// --heat-0 for nothing logged and four steps from the quartiles of the days that had any
// care, so one busy rain day doesn't flatten a quiet collection into a single shade.

export const careTotal = (day: ActivityDay) => day.waterings + day.fertilizings + day.photos;

export function heatThresholds(days: ActivityDay[]): number[] {
    const values = days
        .map(careTotal)
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
    if (values.length === 0) return [1, 2, 3];
    const at = (q: number) => values[Math.min(values.length - 1, Math.floor(q * values.length))];
    return [at(0.25), at(0.5), at(0.75)];
}

export const heatLevel = (n: number, [q1, q2, q3]: number[]) =>
    n === 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4;
