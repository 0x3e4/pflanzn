import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DateTime } from "luxon";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FloorPlanView from "../components/FloorPlanView";
import { FloorPlan } from "../types/FloorPlan";
import { Plant } from "../types/Plant";

const mockPlacePlant = vi.fn();
vi.mock("../services/FloorPlanService", () => ({
    placePlant: (...args: unknown[]) => mockPlacePlant(...args),
    unplacePlant: vi.fn(),
}));

const TZ = "UTC";
const daysAgo = (days: number) => DateTime.now().setZone(TZ).minus({ days }).toISO();

const plant = (id: number, name: string, extra: Partial<Plant> = {}): Plant =>
    ({ id, name, species: null, images: [], tags: [], is_archived: false, ...extra }) as unknown as Plant;

const thirsty = plant(1, "Fern", { watering_interval_days: 3, last_watered: daysAgo(5) });
const fine = plant(2, "Monstera", { watering_interval_days: 7, last_watered: daysAgo(1) });
const unscheduled = plant(3, "Cactus");
const unplaced = plant(4, "Basil");

const plan: FloorPlan = {
    id: 10,
    name: "EG",
    address: "Hauptstraße 1",
    image_path: "floorplans/abc",
    width: 800,
    height: 400,
    sort_order: 0,
    placements: [
        { plant_id: 1, x: 0.25, y: 0.5 },
        { plant_id: 2, x: 0.5, y: 0.5 },
        { plant_id: 3, x: 0.75, y: 0.5 },
    ],
};

const renderView = (props: Partial<React.ComponentProps<typeof FloorPlanView>> = {}) => {
    const onWater = vi.fn().mockResolvedValue(undefined);
    const onPlansChange = vi.fn();
    render(
        <MemoryRouter>
            <FloorPlanView
                plans={[plan]}
                plants={[thirsty, fine, unscheduled, unplaced]}
                allPlants={[thirsty, fine, unscheduled, unplaced]}
                timezone={TZ}
                canEdit
                canManage
                selectedPlanId={10}
                onSelectPlan={vi.fn()}
                onPlansChange={onPlansChange}
                onWater={onWater}
                {...props}
            />
        </MemoryRouter>,
    );
    return { onWater, onPlansChange };
};

describe("FloorPlanView", () => {
    beforeEach(() => vi.clearAllMocks());

    it("colours markers by watering status", () => {
        renderView();
        expect(screen.getByRole("button", { name: /^Fern:/ })).toHaveClass("plan-marker--due");
        expect(screen.getByRole("button", { name: /^Monstera:/ })).toHaveClass("plan-marker--ok");
        expect(screen.getByRole("button", { name: /^Cactus:/ })).toHaveClass("plan-marker--none");
        expect(screen.queryByRole("button", { name: /^Basil:/ })).not.toBeInTheDocument();
    });

    it("waters every due plant on the plan", () => {
        const { onWater } = renderView();
        fireEvent.click(screen.getByRole("button", { name: /Water 1 due/ }));
        expect(onWater).toHaveBeenCalledWith([1]);
    });

    it("hides markers the page filters exclude", () => {
        renderView({ plants: [thirsty] });
        expect(screen.queryByRole("button", { name: /^Monstera:/ })).not.toBeInTheDocument();
    });

    it("opens a bottom sheet with a water action", () => {
        const { onWater } = renderView();
        fireEvent.click(screen.getByRole("button", { name: /^Fern:/ }));
        const sheet = screen.getByRole("dialog", { name: "Fern" });
        expect(sheet).toHaveTextContent(/Overdue/);
        fireEvent.click(screen.getByRole("button", { name: /^Water$/ }));
        expect(onWater).toHaveBeenCalledWith([1]);
    });

    it("read-only viewers get no edit or water controls", () => {
        renderView({ canEdit: false });
        expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Water \d+ due/ })).not.toBeInTheDocument();
    });

    it("places an unplaced plant where the plan is tapped", () => {
        mockPlacePlant.mockResolvedValue({ plant_id: 4, x: 0.5, y: 0.5 });
        const { onPlansChange } = renderView();
        fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
        fireEvent.click(screen.getByRole("option", { name: /Basil/ }));

        const content = document.querySelector(".floor-plan-content") as HTMLElement;
        content.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
        fireEvent.click(content, { clientX: 50, clientY: 25 });

        expect(mockPlacePlant).toHaveBeenCalledWith(10, 4, 0.25, 0.25);
        const updated = onPlansChange.mock.calls[0][0] as FloorPlan[];
        expect(updated[0].placements).toContainEqual({ plant_id: 4, x: 0.25, y: 0.25 });
    });

    it("shows the empty state without plans", () => {
        renderView({ plans: [] });
        expect(screen.getByText("No floor plans yet.")).toBeInTheDocument();
    });
});
