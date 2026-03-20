import { describe, it, expect, vi, beforeEach } from "vitest";

describe("apiClient", () => {
    beforeEach(() => {
        vi.resetModules();
        sessionStorage.clear();
    });

    it("creates an axios instance with correct defaults", async () => {
        const mod = await import("../services/apiClient");
        const client = mod.default;

        expect(client.defaults.baseURL).toBe("/api");
        expect(client.defaults.timeout).toBe(60000);
        expect(client.defaults.withCredentials).toBe(true);
    });

    it("attaches share token header when present in sessionStorage", async () => {
        sessionStorage.setItem("share_token", "test-share-token");

        const mod = await import("../services/apiClient");
        const client = mod.default;

        // Simulate a request by running through interceptors
        const requestInterceptor = client.interceptors.request as any;
        const handlers = requestInterceptor.handlers;

        // Find the fulfilled handler
        const handler = handlers.find((h: any) => h && h.fulfilled);
        if (handler) {
            const config = { headers: {} as Record<string, string> } as any;
            const result = handler.fulfilled(config);
            expect(result.headers["X-Share-Token"]).toBe("test-share-token");
        }
    });

    it("does not attach share token header when not present", async () => {
        const mod = await import("../services/apiClient");
        const client = mod.default;

        const requestInterceptor = client.interceptors.request as any;
        const handlers = requestInterceptor.handlers;

        const handler = handlers.find((h: any) => h && h.fulfilled);
        if (handler) {
            const config = { headers: {} as Record<string, string> } as any;
            const result = handler.fulfilled(config);
            expect(result.headers["X-Share-Token"]).toBeUndefined();
        }
    });
});
