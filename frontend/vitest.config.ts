import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        // Node 25+ has its own global localStorage (without a backing file it is unusable),
        // and it hides jsdom's. Off in the test workers, so tests get jsdom's storage on any Node.
        execArgv: ["--no-experimental-webstorage"],
    },
});
