import { describe, expect, it } from "vitest";
import {
    calendarTypeFor,
    effectiveLocale,
    getUiPreferences,
    UiPreferences,
    updateUiPreferences,
} from "../config/uiPreferences";
import { mainPhotoSource, previewSource } from "../services/imageSources";

const prefs = (changes: Partial<UiPreferences>): UiPreferences => ({ ...getUiPreferences(), ...changes });

describe("effectiveLocale", () => {
    it("uses the server locale unless another is chosen", () => {
        expect(effectiveLocale("de-AT", prefs({ dateLocale: "", hourCycle: "auto" }))).toBe("de-AT");
        expect(effectiveLocale("de-AT", prefs({ dateLocale: "en-GB", hourCycle: "auto" }))).toBe("en-GB");
    });

    it("adds the clock as a Unicode extension that Intl honours", () => {
        const locale = effectiveLocale("en-US", prefs({ dateLocale: "", hourCycle: "h23" }));
        expect(locale).toBe("en-US-u-hc-h23");
        const time = new Date(Date.UTC(2026, 0, 1, 15, 5)).toLocaleTimeString(locale, {
            timeZone: "UTC",
            hour: "numeric",
            minute: "2-digit",
        });
        expect(time).toBe("15:05");
    });

    it("falls back to the server locale when the result is not valid", () => {
        expect(effectiveLocale("de-AT", prefs({ dateLocale: "xx-!!" }))).toBe("de-AT");
    });
});

describe("ui preferences", () => {
    it("normalises junk back to defaults and never leaves the feed empty", () => {
        const next = updateUiPreferences({
            theme: "neon" as never,
            density: "tiny" as never,
            homeHidden: ["recent", "bogus"] as never,
            activityTypes: [],
            dateLocale: "<script>",
        });
        expect(next.theme).toBe("system");
        expect(next.density).toBe("comfortable");
        expect(next.homeHidden).toEqual(["recent"]);
        expect(next.activityTypes.length).toBe(6);
        expect(next.dateLocale).toBe("");
        expect(JSON.parse(localStorage.getItem("pflanzn_ui_preferences")!).homeHidden).toEqual(["recent"]);
    });

    it("applies theme, density and reduced motion to the document", () => {
        updateUiPreferences({ theme: "light", density: "compact", reduceMotion: true });
        const root = document.documentElement;
        expect(root.getAttribute("data-theme")).toBe("light");
        expect(root.getAttribute("data-density")).toBe("compact");
        expect(root.hasAttribute("data-reduce-motion")).toBe(true);
        updateUiPreferences({ reduceMotion: false });
        expect(root.hasAttribute("data-reduce-motion")).toBe(false);
    });

    it("maps the first day of the week to react-calendar's calendar type", () => {
        expect(calendarTypeFor("monday")).toBe("iso8601");
        expect(calendarTypeFor("sunday")).toBe("gregory");
        expect(calendarTypeFor("auto")).toBeUndefined();
    });
});

describe("image sources", () => {
    it("lets the browser choose by density only in automatic mode", () => {
        expect(previewSource("a/b", "saver")).toEqual({ src: "/api/uploads/a/b?size=thumb" });
        expect(previewSource("a/b", "high")).toEqual({ src: "/api/uploads/a/b?size=medium" });
        const auto = previewSource("a/b", "auto", 280);
        expect(auto.src).toBe("/api/uploads/a/b?size=thumb");
        expect(auto.srcSet).toContain("?size=medium 800w");
        expect(auto.sizes).toBe("280px");
    });

    it("shows the full size as the main photo in high quality", () => {
        expect(mainPhotoSource("a/b", "high").src).toBe("/api/uploads/a/b?size=original");
        expect(mainPhotoSource("a/b", "saver").srcSet).toBeUndefined();
    });
});
