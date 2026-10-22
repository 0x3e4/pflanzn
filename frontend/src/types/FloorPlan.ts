export interface FloorPlanPlacement {
    plant_id: number;
    // Fractions (0..1) of the plan image's width / height.
    x: number;
    y: number;
}

export interface FloorPlan {
    id: number;
    name: string;
    address: string | null;
    image_path: string;
    width: number;
    height: number;
    sort_order: number;
    placements: FloorPlanPlacement[];
}

export interface FloorPlanUpdateInput {
    name?: string;
    address?: string | null;
    sort_order?: number;
}

export interface AppSettings {
    floor_plans_enabled: boolean;
}
