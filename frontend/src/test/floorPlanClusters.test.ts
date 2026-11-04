import { describe, expect, it } from "vitest";
import { clusterPoints } from "../services/floorPlanClusters";

describe("clusterPoints", () => {
    it("merges markers closer than the radius, around the most urgent one", () => {
        const groups = clusterPoints(
            [
                { id: 1, x: 100, y: 100, rank: 2 },
                { id: 2, x: 110, y: 100, rank: 0 },
                { id: 3, x: 300, y: 100, rank: 1 },
            ],
            30,
        );
        expect(groups).toEqual([[2, 1], [3]]);
    });

    it("measures from the group's leader, so chains don't merge into one blob", () => {
        const groups = clusterPoints(
            [
                { id: 1, x: 0, y: 0, rank: 0 },
                { id: 2, x: 25, y: 0, rank: 1 },
                { id: 3, x: 50, y: 0, rank: 1 },
            ],
            30,
        );
        expect(groups).toEqual([[1, 2], [3]]);
    });

    it("keeps separate markers separate", () => {
        expect(clusterPoints([{ id: 1, x: 0, y: 0, rank: 0 }, { id: 2, x: 100, y: 0, rank: 0 }], 30)).toEqual([[1], [2]]);
    });
});
