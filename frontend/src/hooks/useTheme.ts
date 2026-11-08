import { useState, useEffect, useCallback } from "react";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
    const stored = localStorage.getItem("pflanzn-theme") as Theme | null;
    if (stored === "dark" || stored === "light") return stored;

    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    return "dark";
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("pflanzn-theme", theme);

        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            // The browser and installed-app chrome take the page ground, so the bar blends into the navbar.
            const ground = getComputedStyle(document.documentElement).getPropertyValue("--background-color").trim();
            if (ground) metaThemeColor.setAttribute("content", ground);
        }
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
    }, []);

    return { theme, toggleTheme };
}
