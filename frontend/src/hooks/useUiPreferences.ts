import { useCallback, useSyncExternalStore } from "react";
import { toast } from "react-toastify";
import {
    getUiPreferences,
    pushUserPreferences,
    subscribeUiPreferences,
    UiPreferences,
    updateUiPreferences,
} from "../config/uiPreferences";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { useShare } from "../context/ShareContext";

/** The current UI preferences; re-renders when any of them changes. */
export function useUiPreferences(): UiPreferences {
    return useSyncExternalStore(subscribeUiPreferences, getUiPreferences, getUiPreferences);
}

/**
 * Saves preferences: at once in this browser and, when signed in, to the account
 * (so other devices get them on their next sign-in or reload).
 */
export function useSaveUiPreferences() {
    const { authMode } = useConfig();
    const { isLoggedIn } = useAuth();
    const { isShareAccess } = useShare();
    const syncToAccount = authMode !== "no" && isLoggedIn && !isShareAccess;

    return useCallback(
        async (updates: Partial<UiPreferences>) => {
            updateUiPreferences(updates);
            if (!syncToAccount) return;
            try {
                await pushUserPreferences(updates);
            } catch {
                toast.error("Saved in this browser, but failed to sync to your account.", {
                    toastId: "preferences-sync-failed",
                });
            }
        },
        [syncToAccount],
    );
}
