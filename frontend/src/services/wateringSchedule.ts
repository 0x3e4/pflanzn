import { DateTime } from "luxon";
import { Plant } from "../types/Plant";

export interface WateringStatus {
    intervalDays: number;
    // Calendar days until the next watering is due in the configured timezone.
    // 0 = due today, negative = overdue by that many days.
    daysUntilDue: number;
    needsWater: boolean;
}

// Mirrors `_watering_due` in backend/app/services/mcp_tools.py: plants without an
// interval are never due, a plant with an interval that was never watered is due today.
export const getWateringStatus = (
    plant: Pick<Plant, "watering_interval_days" | "last_watered">,
    timezone: string,
    nowMillis: number = Date.now(),
): WateringStatus | null => {
    const intervalDays = plant.watering_interval_days;
    if (!intervalDays) return null;

    if (!plant.last_watered) {
        return { intervalDays, daysUntilDue: 0, needsWater: true };
    }

    const wateredOn = DateTime.fromISO(String(plant.last_watered), { zone: timezone }).startOf("day");
    if (!wateredOn.isValid) {
        return { intervalDays, daysUntilDue: 0, needsWater: true };
    }
    const today = DateTime.fromMillis(nowMillis, { zone: timezone }).startOf("day");
    const daysSince = Math.round(today.diff(wateredOn, "days").days);
    const daysUntilDue = intervalDays - daysSince;
    return { intervalDays, daysUntilDue, needsWater: daysUntilDue <= 0 };
};

export const formatWateringDue = (status: WateringStatus): string => {
    if (status.daysUntilDue < 0) {
        const days = -status.daysUntilDue;
        return `Overdue ${days} day${days === 1 ? "" : "s"}`;
    }
    if (status.daysUntilDue === 0) return "Water today";
    if (status.daysUntilDue === 1) return "Due tomorrow";
    return `Due in ${status.daysUntilDue} days`;
};

export const wateringBadgeVariant = (status: WateringStatus): "due" | "soon" | "ok" =>
    status.needsWater ? "due" : status.daysUntilDue === 1 ? "soon" : "ok";

export const formatLastWateredShort = (lastWatered: Plant["last_watered"] | null, timezone: string): string => {
    if (!lastWatered) return "Never watered";
    const watered = DateTime.fromISO(String(lastWatered), { zone: timezone });
    if (!watered.isValid) return "Never watered";
    return watered.toRelativeCalendar({ unit: "days" }) ?? watered.toRelative() ?? "";
};
