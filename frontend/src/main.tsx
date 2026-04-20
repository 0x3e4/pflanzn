import { createRoot } from "react-dom/client";
import "./global.css";
import App from "./App.tsx";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { loadConfig } from "./services/config";

// Apply theme before render to avoid flash
const savedTheme =
    localStorage.getItem("pflanzn-theme") ||
    (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
document.documentElement.setAttribute("data-theme", savedTheme);

const skeletonBase = savedTheme === "light" ? "#e0e0e0" : "#46484f";
const skeletonHighlight = savedTheme === "light" ? "#f0f0f0" : "#5d616a";

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
