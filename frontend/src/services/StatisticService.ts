import apiClient from "./apiClient";

const API_BASE = "/statistics";

// Fetch plant statistics
export const fetchStatistics = async () => {
    const response = await apiClient.get(`${API_BASE}/`);
    return response.data;
};

export const fetchDailyWaterings = async (days: number = 7) => {
    const response = await apiClient.get(`${API_BASE}/daily-waterings?days=${days}`);
    return response.data;
};