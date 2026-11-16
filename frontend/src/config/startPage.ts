import { getUiPreferences } from "./uiPreferences";

/** Where "start" is: the page chosen under Manage → Customize (Locations only while enabled). */
export const startPagePath = (locationsEnabled: boolean): string => {
    const { startPage } = getUiPreferences();
    if (startPage === "plants") return "/plants";
    if (startPage === "locations" && locationsEnabled) return "/locations";
    return "/";
};

let startPageTaken = false;

/**
 * The start page applies when the app is opened at "/", once per page load: afterwards
 * the logo and the Home links lead home. Returns "/" from the second call on.
 */
export const takeStartPagePath = (locationsEnabled: boolean): string => {
    if (startPageTaken) return "/";
    startPageTaken = true;
    return startPagePath(locationsEnabled);
};
