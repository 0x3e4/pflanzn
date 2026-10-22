import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FloorPlansPanel from "../components/FloorPlansPanel";
import { ConfigProvider } from "../context/ConfigContext";

const mockUpdateSettings = vi.fn();
const mockFetchPlans = vi.fn();

vi.mock("../services/FloorPlanService", () => ({
    updateAppSettings: (...args: unknown[]) => mockUpdateSettings(...args),
    fetchFloorPlans: () => mockFetchPlans(),
    createFloorPlan: vi.fn(),
    deleteFloorPlan: vi.fn(),
    replaceFloorPlanImage: vi.fn(),
    updateFloorPlan: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));

describe("FloorPlansPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.__APP_CONFIG__ = undefined;
        mockFetchPlans.mockResolvedValue([]);
    });

    it("enables floor plans in place, without reloading the page", async () => {
        mockUpdateSettings.mockResolvedValue({ floor_plans_enabled: true });
        const reload = vi.fn();
        Object.defineProperty(window, "location", { value: { ...window.location, reload }, writable: true });

        render(
            <ConfigProvider>
                <FloorPlansPanel />
            </ConfigProvider>,
        );
        expect(screen.queryByRole("button", { name: "Add floor plan" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("checkbox", { name: /Enable floor plans/ }));

        expect(await screen.findByRole("button", { name: "Add floor plan" })).toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: /Enable floor plans/ })).toBeChecked();
        expect(mockUpdateSettings).toHaveBeenCalledWith({ floor_plans_enabled: true });
        await waitFor(() => expect(mockFetchPlans).toHaveBeenCalled());
        expect(reload).not.toHaveBeenCalled();
        expect(window.__APP_CONFIG__?.floorPlansEnabled).toBe(true);
    });
});
