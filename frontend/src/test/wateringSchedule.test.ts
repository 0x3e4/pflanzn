import { describe, expect, it } from "vitest";
import { formatWateringDue, getWateringStatus, wateringBadgeVariant } from "../services/wateringSchedule";
import { getViewPreferences } from "../config/viewPreferences";

const TZ = "Europe/Vienna";
// 2026-05-04 09:00 in Vienna
const NOW = Date.UTC(2026, 4, 4, 7, 0);

const plant = (watering_interval_days: number | null, last_watered: string | null) =>
    ({ watering_interval_days, last_watered }) as unknown as Parameters<typeof getWateringStatus>[0];

describe("getWateringStatus", () => {
    it("returns null without an interval", () => {
        expect(getWateringStatus(plant(null, "2026-05-01T10:00:00+02:00"), TZ, NOW)).toBeNull();
    });

    it("treats a never-watered plant as due today", () => {
        expect(getWateringStatus(plant(3, null), TZ, NOW)).toEqual({
            intervalDays: 3,
            daysUntilDue: 0,
            needsWater: true,
        });
    });

    it("counts calendar days in the configured timezone", () => {
        // Watered late on May 1st local time — still counts as May 1st.
        expect(getWateringStatus(plant(3, "2026-05-01T23:30:00+02:00"), TZ, NOW)?.daysUntilDue).toBe(0);
        expect(getWateringStatus(plant(5, "2026-05-01T08:00:00+02:00"), TZ, NOW)).toMatchObject({
            daysUntilDue: 2,
            needsWater: false,
        });
        expect(getWateringStatus(plant(1, "2026-05-01T08:00:00+02:00"), TZ, NOW)).toMatchObject({
            daysUntilDue: -2,
            needsWater: true,
        });
    });

    it("accepts offset-less local timestamps from optimistic updates", () => {
        expect(getWateringStatus(plant(2, "2026-05-04T08:55:00.000"), TZ, NOW)?.daysUntilDue).toBe(2);
    });
});

describe("formatWateringDue", () => {
    it("labels overdue, today, tomorrow and later", () => {
        const s = (daysUntilDue: number) => ({ intervalDays: 3, daysUntilDue, needsWater: daysUntilDue <= 0 });
        expect(formatWateringDue(s(-1))).toBe("Overdue 1 day");
        expect(formatWateringDue(s(-3))).toBe("Overdue 3 days");
        expect(formatWateringDue(s(0))).toBe("Water today");
        expect(formatWateringDue(s(1))).toBe("Due tomorrow");
        expect(formatWateringDue(s(4))).toBe("Due in 4 days");
        expect(wateringBadgeVariant(s(0))).toBe("due");
        expect(wateringBadgeVariant(s(1))).toBe("soon");
        expect(wateringBadgeVariant(s(4))).toBe("ok");
    });
});

describe("view preferences", () => {
    it("defaults to grid view and normalizes unknown values", () => {
        localStorage.setItem(
            "pflanzn_view_preferences",
            JSON.stringify({ plants: { viewMode: "tiles", needsWaterOnly: "yes" }, locations: { viewMode: "list" } }),
        );
        const prefs = getViewPreferences();
        expect(prefs.plants.viewMode).toBe("grid");
        expect(prefs.plants.needsWaterOnly).toBe(false);
        expect(prefs.locations.viewMode).toBe("list");
        localStorage.removeItem("pflanzn_view_preferences");
    });
});
