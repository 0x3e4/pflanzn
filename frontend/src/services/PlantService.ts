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
export const uploadPlantImage = async (plantId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
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

// Water plant
export const waterPlant = async (plantId: number, data: { watered_at?: string; notes?: string }) => {
    const response = await apiClient.post(`${API_BASE}/${plantId}/watering`, data);
    return response.data;
};

// Delete watering
export const deleteWatering = async (plantId: number, wateringId: number) => {
    await apiClient.delete(`${API_BASE}/${plantId}/watering/${wateringId}`);
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

// Archive plant
export const archivePlant = async (plantId: number, archive: boolean = true, reason: string) => {
    const response = await apiClient.post(`${API_BASE}/${plantId}/archive`, 
        { reason, archive },
        {
            headers: { "Content-Type": "application/json" }
        }
    );
    return response.data;
}

// Get plant identifications
export const fetchIdentifications = async (
  params: { user_id?: number; session_id?: string; is_primary?: number } = {}
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