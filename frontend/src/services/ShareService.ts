import apiClient from "./apiClient";
import { ShareLink, ShareLinkCreateInput } from "../types/ShareLink";

const API_BASE = "/share";

export const fetchShareLinks = async (): Promise<ShareLink[]> => {
    const response = await apiClient.get<ShareLink[]>(`${API_BASE}/`);
    return response.data;
};

export const createShareLink = async (payload: ShareLinkCreateInput): Promise<ShareLink> => {
    const response = await apiClient.post<ShareLink>(`${API_BASE}/`, payload);
    return response.data;
};

export const deleteShareLink = async (linkId: number): Promise<void> => {
    await apiClient.delete(`${API_BASE}/${linkId}`);
};

export const validateShareToken = async (token: string): Promise<{ valid: boolean; alias: string }> => {
    const response = await apiClient.get<{ valid: boolean; alias: string }>(`${API_BASE}/validate/${token}`);
    return response.data;
};
