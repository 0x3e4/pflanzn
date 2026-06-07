import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/apiClient", () => ({
    default: { get: vi.fn() },
}));

import apiClient from "../services/apiClient";
import { fetchAuditLogs } from "../services/AuditService";

describe("AuditService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls GET /audit/ with query params and returns the page", async () => {
        const page = { items: [], total: 0, page: 2, per_page: 50 };
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: page });

        const result = await fetchAuditLogs({ page: 2, action: "login" });

        expect(apiClient.get).toHaveBeenCalledWith("/audit/", { params: { page: 2, action: "login" } });
        expect(result).toEqual(page);
    });

    it("passes an empty params object when no filters are given", async () => {
        const page = { items: [], total: 0, page: 1, per_page: 50 };
        (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: page });

        await fetchAuditLogs();

        expect(apiClient.get).toHaveBeenCalledWith("/audit/", { params: {} });
    });
});
