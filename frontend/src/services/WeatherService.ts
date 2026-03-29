import apiClient from "./apiClient";

const API_BASE = "/weather";

export interface WeatherConfig {
    id: number;
    city_name: string | null;
    latitude: number;
    longitude: number;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface WeatherCurrent {
    condition: string;
    description: string;
    temperature: number | null;
    humidity: number | null;
    rainfall_mm: number;
    city_name: string | null;
}

export interface WeatherLog {
    id: number;
    checked_at: string;
    weather_condition: string | null;
    rainfall_mm: number;
    temperature: number | null;
    auto_watered_count: number;
}

export const fetchWeatherConfigs = async (): Promise<WeatherConfig[]> => {
    const response = await apiClient.get(`${API_BASE}/configs`);
    return response.data;
};

export const saveWeatherConfig = async (data: {
    city_name?: string | null;
    latitude: number;
    longitude: number;
    enabled?: boolean;
}): Promise<WeatherConfig> => {
    const response = await apiClient.post(`${API_BASE}/config`, data);
    return response.data;
};

export const updateWeatherConfig = async (
    configId: number,
    data: { city_name?: string | null; latitude?: number; longitude?: number; enabled?: boolean },
): Promise<WeatherConfig> => {
    const response = await apiClient.put(`${API_BASE}/config/${configId}`, data);
    return response.data;
};

export const deleteWeatherConfig = async (configId: number): Promise<void> => {
    await apiClient.delete(`${API_BASE}/config/${configId}`);
};

export const fetchCurrentWeather = async (configId?: number): Promise<WeatherCurrent> => {
    const response = await apiClient.get(`${API_BASE}/current`, {
        params: configId ? { config_id: configId } : undefined,
    });
    return response.data;
};

export const fetchWeatherLogs = async (limit = 20): Promise<WeatherLog[]> => {
    const response = await apiClient.get(`${API_BASE}/logs`, { params: { limit } });
    return response.data;
};

export const triggerWeatherCheck = async (): Promise<{ message: string }> => {
    const response = await apiClient.post(`${API_BASE}/check`);
    return response.data;
};
