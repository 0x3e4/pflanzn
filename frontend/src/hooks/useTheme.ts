import { useCallback } from "react";
import { resolveTheme } from "../config/uiPreferences";
import { useSaveUiPreferences, useUiPreferences } from "./useUiPreferences";

/**
 * The theme on screen. The setting itself (light, dark or follow the system) is an
 * account preference, applied to <html data-theme> by uiPreferences.ts; the navbar
 * toggle switches to the opposite of what is shown and saves that choice.
 */
export function useTheme() {
    const { theme: preference } = useUiPreferences();
    const save = useSaveUiPreferences();
    const theme = resolveTheme(preference);

    const toggleTheme = useCallback(() => {
        void save({ theme: theme === "dark" ? "light" : "dark" });
    }, [save, theme]);

    return { theme, toggleTheme };
}
