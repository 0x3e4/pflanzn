import apiClient from "../services/apiClient";
import type { ActivityFilter } from "../services/PlantService";
import type { ListViewMode, LocationSortOption, PlantsSortOption } from "./viewPreferences";

// Account-wide UI settings (Manage → Customize). When signed in, the server is the
// source of truth (GET/PUT /users/me/preferences, merged per key); localStorage is a
// synchronous read-cache so pages and the pre-render theme code can read them at once.
// Per-device view state (current filter, sort, view) lives in viewPreferences.ts; the
// defaults here only say what a device starts with.

export type ThemePreference = "system" | "light" | "dark";
export type StartPage = "home" | "plants" | "locations";
export type Density = "comfortable" | "compact";
export type HourCycle = "auto" | "h23" | "h12";
export type WeekStart = "auto" | "monday" | "sunday";
export type ImageQuality = "auto" | "saver" | "high";
export type HomeSection = "comingUp" | "reminders" | "figures" | "recent" | "lately" | "rhythm" | "areas";

export interface UiPreferences {
    defaultWidescreen: boolean;
    theme: ThemePreference;
    density: Density;
    reduceMotion: boolean;
    startPage: StartPage;
    plantsView: ListViewMode;
    plantsSort: PlantsSortOption;
    locationsView: ListViewMode;
    locationsSort: LocationSortOption;
    homeHidden: HomeSection[];
    activityTypes: ActivityFilter[];
    // "" = the server's LOCALE.
    dateLocale: string;
    hourCycle: HourCycle;
    weekStart: WeekStart;
    imageQuality: ImageQuality;
    // "" = ask each time (only matters with more than one provider).
    llmProvider: string;
}

export const HOME_SECTIONS: { id: HomeSection; label: string }[] = [
    { id: "comingUp", label: "Coming up" },
    { id: "reminders", label: "Reminders" },
    { id: "figures", label: "Figures (plants, species, waterings …)" },
    { id: "recent", label: "Recently photographed" },
    { id: "lately", label: "Lately" },
    { id: "rhythm", label: "Care rhythm" },
    { id: "areas", label: "Areas" },
];

const ALL_ACTIVITY: ActivityFilter[] = ["watering", "rain", "fertilizing", "image_upload", "note", "care_advice"];
const PLANTS_SORTS: PlantsSortOption[] = [
    "idDesc",
    "idAsc",
    "lastWateredDesc",
    "lastWateredAsc",
    "nextWateringAsc",
    "nextWateringDesc",
    "lastImageUploadedDesc",
    "lastImageUploadedAsc",
];
const LOCATION_SORTS: LocationSortOption[] = [
    "updatedDesc",
    "updatedAsc",
    "createdDesc",
    "createdAsc",
    "nameAsc",
    "nameDesc",
];
const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

const STORAGE_KEY = "pflanzn_ui_preferences";
// Before the theme became an account setting it was kept here (light/dark only).
const LEGACY_THEME_KEY = "pflanzn-theme";

const DEFAULT_UI_PREFERENCES: UiPreferences = {
    defaultWidescreen: false,
    theme: "system",
    density: "comfortable",
    reduceMotion: false,
    startPage: "home",
    plantsView: "grid",
    plantsSort: "idDesc",
    locationsView: "grid",
    locationsSort: "updatedDesc",
    homeHidden: [],
    activityTypes: ALL_ACTIVITY,
    dateLocale: "",
    hourCycle: "auto",
    weekStart: "auto",
    imageQuality: "auto",
    llmProvider: "",
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;

const legacyTheme = (): ThemePreference => {
    try {
        const stored = localStorage.getItem(LEGACY_THEME_KEY);
        return stored === "light" || stored === "dark" ? stored : "system";
    } catch {
        return "system";
    }
};

const normalize = (raw: Partial<UiPreferences> | null | undefined): UiPreferences => {
    const d = DEFAULT_UI_PREFERENCES;
    const homeHidden = Array.isArray(raw?.homeHidden)
        ? HOME_SECTIONS.map((s) => s.id).filter((id) => raw!.homeHidden!.includes(id))
        : d.homeHidden;
    const activity = Array.isArray(raw?.activityTypes)
        ? ALL_ACTIVITY.filter((t) => raw!.activityTypes!.includes(t))
        : d.activityTypes;
    return {
        defaultWidescreen: Boolean(raw?.defaultWidescreen),
        theme: raw?.theme === undefined ? legacyTheme() : oneOf(raw.theme, ["system", "light", "dark"], d.theme),
        density: oneOf(raw?.density, ["comfortable", "compact"], d.density),
        reduceMotion: raw?.reduceMotion === true,
        startPage: oneOf(raw?.startPage, ["home", "plants", "locations"], d.startPage),
        plantsView: oneOf(raw?.plantsView, ["grid", "list"], d.plantsView),
        plantsSort: oneOf(raw?.plantsSort, PLANTS_SORTS, d.plantsSort),
        locationsView: oneOf(raw?.locationsView, ["grid", "list"], d.locationsView),
        locationsSort: oneOf(raw?.locationsSort, LOCATION_SORTS, d.locationsSort),
        homeHidden,
        // Never none: an empty feed filter would hide the whole feed.
        activityTypes: activity.length ? activity : d.activityTypes,
        dateLocale: typeof raw?.dateLocale === "string" && LOCALE_PATTERN.test(raw.dateLocale) ? raw.dateLocale : "",
        hourCycle: oneOf(raw?.hourCycle, ["auto", "h23", "h12"], d.hourCycle),
        weekStart: oneOf(raw?.weekStart, ["auto", "monday", "sunday"], d.weekStart),
        imageQuality: oneOf(raw?.imageQuality, ["auto", "saver", "high"], d.imageQuality),
        llmProvider: typeof raw?.llmProvider === "string" ? raw.llmProvider : "",
    };
};

// --- Local cache + change notifications -------------------------------------------

let cached: UiPreferences | null = null;
const listeners = new Set<() => void>();

const readStored = (): UiPreferences => {
    if (typeof window === "undefined") return DEFAULT_UI_PREFERENCES;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return normalize(raw ? (JSON.parse(raw) as Partial<UiPreferences>) : null);
    } catch {
        return normalize(null);
    }
};

/** The current preferences. Stable between changes (safe for useSyncExternalStore). */
export const getUiPreferences = (): UiPreferences => {
    if (!cached) cached = readStored();
    return cached;
};

export const saveUiPreferences = (preferences: UiPreferences): void => {
    cached = preferences;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
        /* private window: the setting lasts until the page is left */
    }
    applyDocumentPreferences(preferences);
    listeners.forEach((listener) => listener());
};

export const updateUiPreferences = (updates: Partial<UiPreferences>): UiPreferences => {
    const next = normalize({ ...getUiPreferences(), ...updates });
    saveUiPreferences(next);
    return next;
};

export const subscribeUiPreferences = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

// --- Applying what affects the whole document --------------------------------------

const prefersLight = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches;

export const resolveTheme = (theme: ThemePreference): "light" | "dark" =>
    theme === "system" ? (prefersLight() ? "light" : "dark") : theme;

/** Theme, density and motion as attributes on <html>, which the stylesheets key off. */
export const applyDocumentPreferences = (preferences: UiPreferences = getUiPreferences()): void => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", resolveTheme(preferences.theme));
    root.setAttribute("data-density", preferences.density);
    root.toggleAttribute("data-reduce-motion", preferences.reduceMotion);

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        // The browser and installed-app chrome take the page ground, so the bar blends into the navbar.
        const ground = getComputedStyle(root).getPropertyValue("--background-color").trim();
        if (ground) metaThemeColor.setAttribute("content", ground);
    }
};

/** Call once before the first render: applies the cached settings and follows the OS theme. */
export const initDocumentPreferences = (): void => {
    applyDocumentPreferences();
    window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", () => {
        if (getUiPreferences().theme === "system") {
            applyDocumentPreferences();
            listeners.forEach((listener) => listener());
        }
    });
    // A change in another tab of this app: take it over here too.
    window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY) return;
        cached = readStored();
        applyDocumentPreferences(cached);
        listeners.forEach((listener) => listener());
    });
};

// --- Date and time -----------------------------------------------------------------

/** The locale every date and time is formatted with: the chosen one (or the server's)
 *  plus the clock as a Unicode extension, e.g. "en-US-u-hc-h23" for a 24-hour clock. */
export const effectiveLocale = (serverLocale: string, preferences: UiPreferences): string => {
    const base = preferences.dateLocale || serverLocale || "en-US";
    const locale =
        preferences.hourCycle === "auto"
            ? base
            : `${base}${base.includes("-u-") ? "" : "-u"}-hc-${preferences.hourCycle}`;
    try {
        new Intl.DateTimeFormat(locale);
        return locale;
    } catch {
        return serverLocale || "en-US";
    }
};

/** react-calendar's calendarType for the chosen first day of the week (undefined = by locale). */
export const calendarTypeFor = (weekStart: WeekStart): "iso8601" | "gregory" | undefined =>
    weekStart === "monday" ? "iso8601" : weekStart === "sunday" ? "gregory" : undefined;

// --- Backend sync --------------------------------------------------------------------

interface PreferencesEnvelope {
    preferences: Partial<UiPreferences>;
}

export const fetchUserPreferences = async (): Promise<UiPreferences> => {
    const response = await apiClient.get<PreferencesEnvelope>("/users/me/preferences");
    return normalize(response.data?.preferences);
};

export const pushUserPreferences = async (updates: Partial<UiPreferences>): Promise<UiPreferences> => {
    const response = await apiClient.put<PreferencesEnvelope>("/users/me/preferences", { preferences: updates });
    return normalize(response.data?.preferences);
};

/**
 * Pulls the user's preferences from the backend into the local cache, so the
 * synchronous `getUiPreferences()` readers and the subscribed components pick them up.
 */
export const syncUiPreferencesFromBackend = async (): Promise<UiPreferences | null> => {
    try {
        const remote = await fetchUserPreferences();
        saveUiPreferences(remote);
        return remote;
    } catch {
        return null;
    }
};
