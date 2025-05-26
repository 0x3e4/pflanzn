import apiClient from "./apiClient";

const API_BASE = "/statistics";

// Fetch plant statistics
export const fetchStatistics = async () => {
    const response = await apiClient.get(`${API_BASE}/`);
    return response.data;
};