import { ActivityFilter } from "./PlantService";
import { getUiPreferences } from "../config/uiPreferences";

export const ACTIVITY_FILTERS: { id: ActivityFilter; label: string }[] = [
    { id: "watering", label: "Watering" },
    { id: "rain", label: "Rain" },
    { id: "fertilizing", label: "Fertilizing" },
    { id: "image_upload", label: "Photos" },
    { id: "note", label: "Notes" },
    { id: "care_advice", label: "Care advice" },
];

export const ALL_ACTIVITY_TYPES: ActivityFilter[] = ACTIVITY_FILTERS.map((f) => f.id);

const STORAGE_KEY = "pflanzn.activityFeedTypes";

/** The feed types this browser last showed (the account default from Manage → Customize
 *  the first time, which is all of them unless changed). */
export function readFeedTypes(): ActivityFilter[] {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (Array.isArray(stored)) {
            const known = stored.filter((t): t is ActivityFilter => ALL_ACTIVITY_TYPES.includes(t));
            if (known.length) return known;
        }
    } catch {
        /* unreadable or blocked storage: show everything */
    }
    return [...getUiPreferences().activityTypes];
}

export function storeFeedTypes(types: ActivityFilter[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
    } catch {
        /* private window: the choice lasts until the page is left */
    }
}

/** The `types` query parameter: undefined when everything is shown. */
export function feedTypesParam(types: ActivityFilter[]): string | undefined {
    return ALL_ACTIVITY_TYPES.every((t) => types.includes(t)) ? undefined : types.join(",");
}

/** Toggles one type, never leaving none. */
export function toggleFeedType(types: ActivityFilter[], type: ActivityFilter): ActivityFilter[] {
    if (types.includes(type)) {
        return types.length === 1 ? types : types.filter((t) => t !== type);
    }
    return ALL_ACTIVITY_TYPES.filter((t) => t === type || types.includes(t));
}
