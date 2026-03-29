import apiClient from "./apiClient";
import { Tag } from "../types/Tag";

const API_BASE = "/tags";

// Fetch all tags
export const fetchTags = async (): Promise<Tag[]> => {
    const response = await apiClient.get(`${API_BASE}/`);
    return response.data.tags;
};

export interface TagDetailed {
    id: number;
    name: string;
    plant_count: number;
    plant_names: string[];
}

// Fetch all tags with usage details
export const fetchTagsDetailed = async (): Promise<TagDetailed[]> => {
    const response = await apiClient.get(`${API_BASE}/detailed`);
    return response.data;
};

// Create tag
export const createTag = async (name: string) => {
    const body = { name };
    const response = await apiClient.post(`${API_BASE}/`, body);
    return response.data;
};

// Update tag
export const updateTag = async (tagId: number, data: Partial<Tag>) => {
    const response = await apiClient.put(`${API_BASE}/${tagId}`, data);
    return response.data;
};

// Delete tag
export const deleteTag = async (tagId: number) => {
    await apiClient.delete(`${API_BASE}/${tagId}`);
};
