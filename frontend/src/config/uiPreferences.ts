import apiClient from "../services/apiClient";

export interface UiPreferences {
    defaultWidescreen: boolean;
}

const STORAGE_KEY = "pflanzn_ui_preferences";

const DEFAULT_UI_PREFERENCES: UiPreferences = {
    defaultWidescreen: false,
};

const normalize = (raw: Partial<UiPreferences> | null | undefined): UiPreferences => ({
    defaultWidescreen: Boolean(raw?.defaultWidescreen),
});

export const getUiPreferences = (): UiPreferences => {
    if (typeof window === "undefined") {
        return DEFAULT_UI_PREFERENCES;
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return DEFAULT_UI_PREFERENCES;
        }

        return normalize(JSON.parse(raw) as Partial<UiPreferences>);
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

// Backend sync — when authenticated, the server is the source of truth and
// localStorage acts as a synchronous read-cache for pages that mount before
// the network call completes.

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
 * Pulls the user's preferences from the backend and writes them into
 * localStorage so the synchronous `getUiPreferences()` reads pick them up on
 * subsequent renders (Plants/Locations rely on the cached value).
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
