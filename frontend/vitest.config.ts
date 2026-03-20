import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        env: {
            VITE_AUTH_MODE: "local",
            VITE_SHOW_PROTECTED_VIEW: "true",
            VITE_ENABLE_LOCATIONS: "true",
        },
    },
});
