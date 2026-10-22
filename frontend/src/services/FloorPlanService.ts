import apiClient from "./apiClient";
import { AppSettings, FloorPlan, FloorPlanPlacement, FloorPlanUpdateInput } from "../types/FloorPlan";

const API_BASE = "/floor-plans";

export const fetchFloorPlans = async (): Promise<FloorPlan[]> => {
    const response = await apiClient.get<FloorPlan[]>(API_BASE);
    return response.data;
};

export const createFloorPlan = async (name: string, address: string, file: File): Promise<FloorPlan> => {
    const formData = new FormData();
    formData.append("name", name);
    if (address) formData.append("address", address);
    formData.append("file", file);
    const response = await apiClient.post<FloorPlan>(API_BASE, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
};

export const updateFloorPlan = async (planId: number, input: FloorPlanUpdateInput): Promise<FloorPlan> => {
    const response = await apiClient.put<FloorPlan>(`${API_BASE}/${planId}`, input);
    return response.data;
};

export const replaceFloorPlanImage = async (planId: number, file: File): Promise<FloorPlan> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.put<FloorPlan>(`${API_BASE}/${planId}/image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
};

export const deleteFloorPlan = async (planId: number): Promise<void> => {
    await apiClient.delete(`${API_BASE}/${planId}`);
};

export const placePlant = async (
    planId: number,
    plantId: number,
    x: number,
    y: number,
): Promise<FloorPlanPlacement> => {
    const response = await apiClient.put<FloorPlanPlacement>(`${API_BASE}/${planId}/placements/${plantId}`, { x, y });
    return response.data;
};

export const unplacePlant = async (plantId: number): Promise<void> => {
    await apiClient.delete(`${API_BASE}/placements/${plantId}`);
};

// Instance-wide settings (admin-only; open in AUTH_MODE=no).
export const updateAppSettings = async (input: Partial<AppSettings>): Promise<AppSettings> => {
    const response = await apiClient.put<AppSettings>("/settings", input);
    return response.data;
};
