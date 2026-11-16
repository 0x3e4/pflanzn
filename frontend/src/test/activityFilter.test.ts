import { describe, it, expect, beforeEach } from "vitest";
import {
    ALL_ACTIVITY_TYPES,
    feedTypesParam,
    readFeedTypes,
    storeFeedTypes,
    toggleFeedType,
} from "../services/activityFilter";

describe("activity feed filter", () => {
    beforeEach(() => localStorage.clear());

    it("sends no types when everything is shown", () => {
        expect(feedTypesParam([...ALL_ACTIVITY_TYPES])).toBeUndefined();
        expect(feedTypesParam(["note", "care_advice"])).toBe("note,care_advice");
    });

    it("toggles kinds in a stable order and never leaves none", () => {
        expect(toggleFeedType(["note"], "watering")).toEqual(["watering", "note"]);
        expect(toggleFeedType(["watering", "note"], "watering")).toEqual(["note"]);
        expect(toggleFeedType(["note"], "note")).toEqual(["note"]);
    });

    it("remembers the choice and ignores unknown or broken values", () => {
        expect(readFeedTypes()).toEqual(ALL_ACTIVITY_TYPES);
        storeFeedTypes(["note"]);
        expect(readFeedTypes()).toEqual(["note"]);
        localStorage.setItem("pflanzn.activityFeedTypes", JSON.stringify(["bogus"]));
        expect(readFeedTypes()).toEqual(ALL_ACTIVITY_TYPES);
        localStorage.setItem("pflanzn.activityFeedTypes", "{not json");
        expect(readFeedTypes()).toEqual(ALL_ACTIVITY_TYPES);
    });
});
