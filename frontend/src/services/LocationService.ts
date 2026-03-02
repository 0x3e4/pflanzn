import apiClient from "./apiClient";
import {
  Location,
  LocationCreateInput,
  LocationUpdateInput,
  LocationImage,
} from "../types/Location";

const API_BASE = "/locations";

export const fetchLocations = async (): Promise<Location[]> => {
  const response = await apiClient.get<Location[]>(`${API_BASE}/`);
  return response.data;
};

export const createLocation = async (payload: LocationCreateInput): Promise<Location> => {
  const response = await apiClient.post<Location>(`${API_BASE}/`, payload);
  return response.data;
};

export const updateLocation = async (locationId: number, payload: LocationUpdateInput): Promise<Location> => {
  const response = await apiClient.put<Location>(`${API_BASE}/${locationId}`, payload);
  return response.data;
};

export const deleteLocation = async (locationId: number): Promise<void> => {
  await apiClient.delete(`${API_BASE}/${locationId}`);
};

export const uploadLocationImage = async (locationId: number, file: File): Promise<{
  message: string;
  image_path: string;
  exif_latitude: number | null;
  exif_longitude: number | null;
}> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post(`${API_BASE}/${locationId}/upload_image`, formData);
  return response.data;
};

export const fetchLocationImages = async (locationId: number): Promise<LocationImage[]> => {
  const response = await apiClient.get<LocationImage[]>(`${API_BASE}/${locationId}/images`);
  return response.data;
};

export const identifyLocationFromImage = async (file: File): Promise<{
  identified_species: Array<{
    scientific_name: string;
    common_name: string;
    score: string;
    images: string[];
  }>;
  message?: string;
}> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post(`${API_BASE}/identify`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};
