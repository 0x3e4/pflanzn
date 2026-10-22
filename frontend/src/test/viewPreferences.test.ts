import { beforeEach, describe, expect, it } from "vitest";
import { getViewPreferences } from "../config/viewPreferences";

const store = (value: unknown) => localStorage.setItem("pflanzn_view_preferences", JSON.stringify(value));

describe("plants view preferences", () => {
    beforeEach(() => localStorage.clear());

    it("keeps the floor-plan view and plan id", () => {
        store({ plants: { viewMode: "plan", selectedFloorPlanId: 3 } });
        const prefs = getViewPreferences().plants;
        expect(prefs.viewMode).toBe("plan");
        expect(prefs.selectedFloorPlanId).toBe(3);
    });

    it("normalises junk back to defaults", () => {
        store({ plants: { viewMode: "map", selectedFloorPlanId: "3" }, locations: { viewMode: "plan" } });
        const prefs = getViewPreferences();
        expect(prefs.plants.viewMode).toBe("grid");
        expect(prefs.plants.selectedFloorPlanId).toBeNull();
        expect(prefs.locations.viewMode).toBe("grid");
    });
});
