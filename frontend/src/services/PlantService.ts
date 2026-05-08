import apiClient from "./apiClient";
import { Plant } from "../types/Plant";
import { PlantIdentification } from "../types/Identification";

const API_BASE = "/plants";

// Fetch all plants
export const fetchPlants = async (): Promise<Plant[]> => {
    const response = await apiClient.get<Plant[]>(`${API_BASE}/`);
    return response.data;
};

// Create plant
export const createPlant = async (name: string, species: string, locationId?: number) => {
    const body = { name, species, location_id: locationId };
    const response = await apiClient.post(`${API_BASE}/`, body);
    return response.data;
};

// Upload image
export const uploadPlantImage = async (plantId: number, file: File, uploadedAt?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (uploadedAt) {
        formData.append("uploaded_at", uploadedAt);
    }
    const response = await apiClient.post(`${API_BASE}/${plantId}/upload_image`, formData);
    return response.data;
};

// Identify species
export const identifyPlant = async (plantId: number) => {
    const response = await apiClient.post(`${API_BASE}/${plantId}/identify`);
    return response.data;
};

// Identify from uploaded image
export const identifyPlantFromImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post(`${API_BASE}/identify`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data;
};

// Update plant
export const updatePlant = async (plantId: number, data: Partial<Plant>) => {
    const response = await apiClient.put(`${API_BASE}/${plantId}`, data);
    return response.data;
};

// Fetch single plant
export const fetchSinglePlant = async (plantId: number): Promise<Plant> => {
    const response = await apiClient.get(`${API_BASE}/${plantId}`);
    return response.data;
};

// Delete plant
export const deletePlant = async (plantId: number) => {
    await apiClient.delete(`${API_BASE}/${plantId}`);
};

// Delete image
export const deletePlantImage = async (plantId: number, imageId: number) => {
    const response = await apiClient.delete(`${API_BASE}/${plantId}/images/${imageId}`);
    return response.data;
};

// Generate description
export const generatePlantDescription = async (plantId: number): Promise<{ description: string }> => {
    const response = await apiClient.post(`${API_BASE}/${plantId}/generate_description`);
    return response.data;
};

// Care Helper
export const generateCareAdvice = async (
    plantId: number,
    userMessage?: string,
): Promise<{
    id: number;
    advice_text: string;
    generated_at: string;
}> => {
    const formData = new FormData();
    if (userMessage) {
        formData.append("user_message", userMessage);
    }
    const response = await apiClient.post(`${API_BASE}/${plantId}/care_advice`, formData);
    return response.data;
};

// Get care advice history
export const fetchCareAdvice = async (
    plantId: number,
    params: { limit?: number; offset?: number } = {},
): Promise<
    Array<{
        id: number;
        advice_text: string;
        generated_at: string;
    }>
> => {
    const response = await apiClient.get(`${API_BASE}/${plantId}/care_advice`, { params });
    return response.data;
};

// Delete care advice
export const deleteCareAdvice = async (plantId: number, adviceId: number) => {
    await apiClient.delete(`${API_BASE}/${plantId}/care_advice/${adviceId}`);
};

// Water plant
export const waterPlant = async (plantId: number, data: { watered_at?: string; notes?: string }) => {
    const response = await apiClient.post(`${API_BASE}/${plantId}/watering`, data);
    return response.data;
};

// Delete watering
export const deleteWatering = async (plantId: number, wateringId: number) => {
    await apiClient.delete(`${API_BASE}/${plantId}/watering/${wateringId}`);
};

// Fertilize plant
export const fertilizePlant = async (plantId: number, data: { fertilized_at?: string }) => {
    const response = await apiClient.post(`${API_BASE}/${plantId}/fertilizing`, data);
    return response.data;
};

// Delete fertilizing
export const deleteFertilizing = async (plantId: number, fertilizingId: number) => {
    await apiClient.delete(`${API_BASE}/${plantId}/fertilizing/${fertilizingId}`);
};

// Assign a tag to a plant
export const assignTagToPlant = async (plantId: number, tagName: string) => {
    const response = await apiClient.post(`${API_BASE}/${plantId}/assign`, [tagName]);
    return response.data;
};

// Remove a tag from a plant
export const removeTagFromPlant = async (plantId: number, tagId: number) => {
    const response = await apiClient.delete(`${API_BASE}/${plantId}/remove/${tagId}`);
    return response.data;
};

// Set tags for a plant (bulk assign/unassign)
export const setPlantTags = async (plantId: number, tagIds: number[]): Promise<Plant> => {
    const response = await apiClient.put(`${API_BASE}/${plantId}/tags`, { tag_ids: tagIds });
    return response.data;
};

// Archive plant
export const archivePlant = async (plantId: number, archive: boolean = true, reason: string) => {
    const response = await apiClient.post(
        `${API_BASE}/${plantId}/archive`,
        { reason, archive },
        {
            headers: { "Content-Type": "application/json" },
        },
    );
    return response.data;
};

// Get plant identifications
export const fetchIdentifications = async (
    params: { user_id?: number; session_id?: string; is_primary?: number } = {},
): Promise<PlantIdentification[]> => {
    const stringParams = {
        ...params,
        ...(params.is_primary !== undefined && {
            is_primary: 1,
        }),
    };

    const response = await apiClient.get(`${API_BASE}/identifications`, {
        params: stringParams,
    });

    return response.data;
};

export const deleteIdentification = async (
    identificationId: number,
): Promise<{ message: string; deleted_count: number }> => {
    const response = await apiClient.delete<{ message: string; deleted_count: number }>(
        `${API_BASE}/identifications/${identificationId}`,
    );
    return response.data;
};

// Waterings — flat list & bulk delete (Manage > Waterings)
export interface WateringListItem {
    id: number;
    plant_id: number;
    plant_name: string;
    watered_at: string;
    rainfall_mm: number | null;
    user_id: number | null;
    weather_config_name: string | null;
    tags: string[];
}

export interface WateringListPaginated {
    items: WateringListItem[];
    total: number;
    limit: number;
    offset: number;
}

export const fetchAllWaterings = async (limit = 25, offset = 0): Promise<WateringListPaginated> => {
    const response = await apiClient.get<WateringListPaginated>(`${API_BASE}/waterings/all`, {
        params: { limit, offset },
    });
    return response.data;
};

export const bulkDeleteWaterings = async (ids: number[]): Promise<{ deleted: number }> => {
    const response = await apiClient.post<{ deleted: number }>(`${API_BASE}/waterings/bulk-delete`, { ids });
    return response.data;
};

// Plant Notes CRUD
export const createPlantNote = async (
    plantId: number,
    noteText: string,
): Promise<{
    id: number;
    note_text: string;
    created_at: string;
}> => {
    const response = await apiClient.post(`${API_BASE}/${plantId}/notes`, { note_text: noteText });
    return response.data;
};

export const fetchPlantNotes = async (
    plantId: number,
    params: { limit?: number; offset?: number } = {},
): Promise<
    Array<{
        id: number;
        note_text: string;
        created_at: string;
    }>
> => {
    const response = await apiClient.get(`${API_BASE}/${plantId}/notes`, { params });
    return response.data;
};

export const updatePlantNote = async (
    plantId: number,
    noteId: number,
    noteText: string,
): Promise<{
    id: number;
    note_text: string;
    created_at: string;
}> => {
    const response = await apiClient.put(`${API_BASE}/${plantId}/notes/${noteId}`, { note_text: noteText });
    return response.data;
};

export const deletePlantNote = async (plantId: number, noteId: number) => {
    await apiClient.delete(`${API_BASE}/${plantId}/notes/${noteId}`);
};

// Activities for calendar/activity log
export const fetchPlantActivities = async (
    plantId: number,
    params: {
        limit?: number;
        offset?: number;
    } = {},
): Promise<
    Array<{
        id: string;
        plant_id: number;
        plant_name: string;
        activity_type: "watering" | "fertilizing" | "care_advice" | "image_upload" | "note";
        activity_data: any;
        timestamp: string;
    }>
> => {
    const response = await apiClient.get(`${API_BASE}/${plantId}/activities`, { params });
    return response.data;
};
