import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/alegreya";
import "./global.css";
import App from "./App.tsx";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { loadConfig } from "./services/config";
import { initDocumentPreferences } from "./config/uiPreferences";

// Apply theme, density and motion before render to avoid a flash.
initDocumentPreferences();

const rootStyle = getComputedStyle(document.documentElement);
const skeletonBase = rootStyle.getPropertyValue("--skeleton-base").trim() || undefined;
const skeletonHighlight = rootStyle.getPropertyValue("--skeleton-highlight").trim() || undefined;

function render() {
    createRoot(document.getElementById("root")!).render(
        <SkeletonTheme baseColor={skeletonBase} highlightColor={skeletonHighlight} duration={1.2}>
            <App />
        </SkeletonTheme>,
    );
}

loadConfig()
    .catch((err) => {
        console.error("Failed to load runtime config; falling back to defaults.", err);
    })
    .finally(render);
