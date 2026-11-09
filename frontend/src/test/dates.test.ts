import { DateTime, Settings } from "luxon";
import { afterEach, describe, expect, it } from "vitest";
import { relativeDay } from "../services/dates";

// Regression: relative days followed the browser's language, so a German browser showed
// "Calathea, heute" and "Watered gestern" in the English interface.
describe("relativeDay", () => {
    const original = Settings.defaultLocale;
    afterEach(() => {
        Settings.defaultLocale = original;
    });

    it("stays English whatever the browser or configured locale", () => {
        Settings.defaultLocale = "de-AT";
        const now = DateTime.now().setLocale("de-AT");
        expect(relativeDay(now)).toBe("today");
        expect(relativeDay(now.minus({ days: 1 }))).toBe("yesterday");
        expect(relativeDay(now.minus({ days: 3 }))).toBe("3 days ago");
    });
});
