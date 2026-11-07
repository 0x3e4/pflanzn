import apiClient from "./apiClient";
import { withBusy } from "./busyOverlay";
import { Location, LocationCreateInput, LocationUpdateInput, LocationImage } from "../types/Location";

const API_BASE = "/locations";

export const fetchLocations = async (): Promise<Location[]> => {
    const response = await apiClient.get<Location[]>(`${API_BASE}/`);
    return response.data;
};

export const fetchSingleLocation = async (locationId: number): Promise<Location> => {
    const response = await apiClient.get<Location>(`${API_BASE}/${locationId}`);
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

export const uploadLocationImage = async (
    locationId: number,
    file: File,
): Promise<{
    message: string;
    image_path: string;
    exif_latitude: number | null;
    exif_longitude: number | null;
}> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await withBusy(
        { title: "Uploading photo", message: "Saving the photo and making its smaller sizes." },
        () => apiClient.post(`${API_BASE}/${locationId}/upload_image`, formData),
    );
    return response.data;
};

export const fetchLocationImages = async (locationId: number): Promise<LocationImage[]> => {
    const response = await apiClient.get<LocationImage[]>(`${API_BASE}/${locationId}/images`);
    return response.data;
};

export const deleteLocationImage = async (locationId: number, imageId: number): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`${API_BASE}/${locationId}/images/${imageId}`);
    return response.data;
};

export const identifyLocationFromImage = async (
    file: File,
): Promise<{
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
    const response = await withBusy(
        { title: "Identifying crop", message: "Sending the photo to Pl@ntNet." },
        () =>
            apiClient.post(`${API_BASE}/identify`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            }),
    );
    return response.data;
};

export const generateLocationDescription = async (locationId: number): Promise<{ description: string }> => {
    // Models that think before answering can take a while.
    const response = await apiClient.post<{ description: string }>(`${API_BASE}/${locationId}/generate_description`, undefined, {
        timeout: 180000,
    });
    return response.data;
};

// Tags, notes and harvest times. Every write answers with the whole location.
export const fetchLocationTagNames = async (): Promise<string[]> => {
    const response = await apiClient.get<string[]>(`${API_BASE}/tags`);
    return response.data;
};

export const setLocationTags = async (locationId: number, tags: string[]): Promise<Location> => {
    const response = await apiClient.put<Location>(`${API_BASE}/${locationId}/tags`, { tags });
    return response.data;
};

export const deleteLocationTagEverywhere = async (tagName: string): Promise<{ deleted: number }> => {
    const response = await apiClient.delete<{ deleted: number }>(`${API_BASE}/tags/${encodeURIComponent(tagName)}`);
    return response.data;
};

export const addLocationNote = async (locationId: number, noteText: string): Promise<Location> => {
    const response = await apiClient.post<Location>(`${API_BASE}/${locationId}/notes`, { note_text: noteText });
    return response.data;
};

export const deleteLocationNote = async (locationId: number, noteId: number): Promise<Location> => {
    const response = await apiClient.delete<Location>(`${API_BASE}/${locationId}/notes/${noteId}`);
    return response.data;
};

export const addLocationSeasonEvent = async (
    locationId: number,
    occurredAt: string,
    title = "Harvest time",
): Promise<Location> => {
    const response = await apiClient.post<Location>(`${API_BASE}/${locationId}/season_events`, {
        title,
        occurred_at: occurredAt,
    });
    return response.data;
};

export const deleteLocationSeasonEvent = async (locationId: number, eventId: number): Promise<Location> => {
    const response = await apiClient.delete<Location>(`${API_BASE}/${locationId}/season_events/${eventId}`);
    return response.data;
};

export interface LocalLocationData {
    tags: string[];
    notes: { text: string; created_at?: string }[];
    season_events: { title: string; occurred_at: string; created_at?: string }[];
}

export const importLocalLocationData = async (locationId: number, data: LocalLocationData): Promise<Location> => {
    const response = await apiClient.post<Location>(`${API_BASE}/${locationId}/import_local`, data);
    return response.data;
};
