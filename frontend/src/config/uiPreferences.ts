export interface UiPreferences {
    defaultWidescreen: boolean;
}

const STORAGE_KEY = "pflanzn_ui_preferences";

const DEFAULT_UI_PREFERENCES: UiPreferences = {
    defaultWidescreen: false,
};

export const getUiPreferences = (): UiPreferences => {
    if (typeof window === "undefined") {
        return DEFAULT_UI_PREFERENCES;
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return DEFAULT_UI_PREFERENCES;
        }

        const parsed = JSON.parse(raw) as Partial<UiPreferences>;
        return {
            defaultWidescreen: Boolean(parsed.defaultWidescreen),
        };
    } catch {
        return DEFAULT_UI_PREFERENCES;
    }
};

export const saveUiPreferences = (preferences: UiPreferences): void => {
    if (typeof window === "undefined") {
        return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
};

export const updateUiPreferences = (updates: Partial<UiPreferences>): UiPreferences => {
    const next = {
        ...getUiPreferences(),
        ...updates,
    };
    saveUiPreferences(next);
    return next;
};
