import { SpotType } from "../types/Location";

// Per-device view state for the list pages. Unlike uiPreferences.ts this is
// localStorage-only (no backend sync) — it remembers filter/sort selections so
// they survive page navigation, which is a per-device concern, not an account
// setting.

export type PlantsSortOption =
    | "lastWateredDesc"
    | "lastWateredAsc"
    | "idDesc"
    | "idAsc"
    | "lastImageUploadedDesc"
    | "lastImageUploadedAsc"
    | "nextWateringAsc"
    | "nextWateringDesc";

export type PlantsFilterMode = "species" | "name";

export type ListViewMode = "grid" | "list";

// The Plants page additionally offers the floor-plan view.
export type PlantsViewMode = ListViewMode | "plan";

export type LocationSortOption = "updatedDesc" | "updatedAsc" | "createdDesc" | "createdAsc" | "nameAsc" | "nameDesc";

export interface PlantsViewPreferences {
    // null = #all, -1 = #archive, -2 = #untagged, > 0 = custom tag id
    selectedTagId: number | null;
    sortBy: PlantsSortOption;
    filterMode: PlantsFilterMode;
    selectedFilterValue: string | null;
    // Combines (AND) with selectedTagId, e.g. #office + #needs_water.
    needsWaterOnly: boolean;
    viewMode: PlantsViewMode;
    // Last floor plan shown in the plan view (validated against the loaded plans).
    selectedFloorPlanId: number | null;
}

export interface LocationsViewPreferences {
    selectedSpotType: SpotType | "all";
    sortBy: LocationSortOption;
    viewMode: ListViewMode;
}

export interface ViewPreferences {
    plants: PlantsViewPreferences;
    locations: LocationsViewPreferences;
}

const STORAGE_KEY = "pflanzn_view_preferences";

const PLANTS_SORT_OPTIONS: PlantsSortOption[] = [
    "lastWateredDesc",
    "lastWateredAsc",
    "idDesc",
    "idAsc",
    "lastImageUploadedDesc",
    "lastImageUploadedAsc",
    "nextWateringAsc",
    "nextWateringDesc",
];

const LOCATION_SORT_OPTIONS: LocationSortOption[] = [
    "updatedDesc",
    "updatedAsc",
    "createdDesc",
    "createdAsc",
    "nameAsc",
    "nameDesc",
];

const SPOT_TYPES: (SpotType | "all")[] = ["all", "field", "public_spot", "forest", "meadow", "other"];

const DEFAULT_VIEW_PREFERENCES: ViewPreferences = {
    plants: {
        selectedTagId: null,
        sortBy: "idDesc",
        filterMode: "species",
        selectedFilterValue: null,
        needsWaterOnly: false,
        viewMode: "grid",
        selectedFloorPlanId: null,
    },
    locations: {
        selectedSpotType: "all",
        sortBy: "updatedDesc",
        viewMode: "grid",
    },
};

const normalizeViewMode = (raw: unknown, fallback: ListViewMode): ListViewMode =>
    raw === "grid" || raw === "list" ? raw : fallback;

const normalizePlants = (raw: Partial<PlantsViewPreferences> | null | undefined): PlantsViewPreferences => {
    const d = DEFAULT_VIEW_PREFERENCES.plants;

    // Accept null and any integer (incl. the -1/-2 specials and positive ids).
    // Validity of a positive custom-tag id is checked in the page once tags load.
    let selectedTagId: number | null = d.selectedTagId;
    if (raw?.selectedTagId === null) {
        selectedTagId = null;
    } else if (typeof raw?.selectedTagId === "number" && Number.isInteger(raw.selectedTagId)) {
        selectedTagId = raw.selectedTagId;
    }

    return {
        selectedTagId,
        sortBy: PLANTS_SORT_OPTIONS.includes(raw?.sortBy as PlantsSortOption)
            ? (raw!.sortBy as PlantsSortOption)
            : d.sortBy,
        filterMode: raw?.filterMode === "name" || raw?.filterMode === "species" ? raw.filterMode : d.filterMode,
        selectedFilterValue: typeof raw?.selectedFilterValue === "string" ? raw.selectedFilterValue : null,
        needsWaterOnly: raw?.needsWaterOnly === true,
        viewMode: raw?.viewMode === "plan" ? "plan" : normalizeViewMode(raw?.viewMode, "grid"),
        selectedFloorPlanId:
            typeof raw?.selectedFloorPlanId === "number" && Number.isInteger(raw.selectedFloorPlanId)
                ? raw.selectedFloorPlanId
                : null,
    };
};

const normalizeLocations = (raw: Partial<LocationsViewPreferences> | null | undefined): LocationsViewPreferences => {
    const d = DEFAULT_VIEW_PREFERENCES.locations;
    return {
        selectedSpotType: SPOT_TYPES.includes(raw?.selectedSpotType as SpotType | "all")
            ? (raw!.selectedSpotType as SpotType | "all")
            : d.selectedSpotType,
        sortBy: LOCATION_SORT_OPTIONS.includes(raw?.sortBy as LocationSortOption)
            ? (raw!.sortBy as LocationSortOption)
            : d.sortBy,
        viewMode: normalizeViewMode(raw?.viewMode, d.viewMode),
    };
};

const normalize = (raw: Partial<ViewPreferences> | null | undefined): ViewPreferences => ({
    plants: normalizePlants(raw?.plants),
    locations: normalizeLocations(raw?.locations),
});

export const getViewPreferences = (): ViewPreferences => {
    if (typeof window === "undefined") {
        return DEFAULT_VIEW_PREFERENCES;
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return DEFAULT_VIEW_PREFERENCES;
        }

        return normalize(JSON.parse(raw) as Partial<ViewPreferences>);
    } catch {
        return DEFAULT_VIEW_PREFERENCES;
    }
};

export const saveViewPreferences = (preferences: ViewPreferences): void => {
    if (typeof window === "undefined") {
        return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
};

export const updatePlantsViewPreferences = (updates: Partial<PlantsViewPreferences>): ViewPreferences => {
    const current = getViewPreferences();
    const next: ViewPreferences = {
        ...current,
        plants: { ...current.plants, ...updates },
    };
    saveViewPreferences(next);
    return next;
};

export const updateLocationsViewPreferences = (updates: Partial<LocationsViewPreferences>): ViewPreferences => {
    const current = getViewPreferences();
    const next: ViewPreferences = {
        ...current,
        locations: { ...current.locations, ...updates },
    };
    saveViewPreferences(next);
    return next;
};
