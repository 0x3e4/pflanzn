import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config.ts?raw";
import { OFFLINE_CACHES } from "../services/offlineCache";

describe("offline caches", () => {
    it("logout clears every runtime cache the service worker fills", () => {
        // A cache added to vite.config.ts but not here would survive sign-out.
        const configured = [...viteConfig.matchAll(/cacheName:\s*'([^']+)'/g)].map((m) => m[1]).sort();
        expect(configured.length).toBeGreaterThan(0);
        expect([...OFFLINE_CACHES].sort()).toEqual(configured);
    });
});
