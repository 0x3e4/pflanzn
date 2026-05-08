import apiClient from "./apiClient";

const API_BASE = "/weather";

export interface WeatherConfig {
    id: number;
    city_name: string | null;
    latitude: number;
    longitude: number;
    enabled: boolean;
    is_default: boolean;
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
    city_name: string | null;
    weather_condition: string | null;
    rainfall_mm: number;
    temperature: number | null;
    auto_watered_count: number;
}

export interface AutoWatering {
    id: number;
    plant_id: number;
    plant_name: string;
    watered_at: string;
    city_name: string | null;
    rainfall_mm: number | null;
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
    is_default?: boolean;
}): Promise<WeatherConfig> => {
    const response = await apiClient.post(`${API_BASE}/config`, data);
    return response.data;
};

export const updateWeatherConfig = async (
    configId: number,
    data: {
        city_name?: string | null;
        latitude?: number;
        longitude?: number;
        enabled?: boolean;
        is_default?: boolean;
    },
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

export interface WeatherLogPaginated {
    items: WeatherLog[];
    total: number;
    limit: number;
    offset: number;
}

export const fetchWeatherLogs = async (limit = 10, offset = 0): Promise<WeatherLogPaginated> => {
    const response = await apiClient.get(`${API_BASE}/logs`, { params: { limit, offset } });
    return response.data;
};

export interface AutoWateringPaginated {
    items: AutoWatering[];
    total: number;
    limit: number;
    offset: number;
}

export const fetchAutoWaterings = async (limit = 10, offset = 0): Promise<AutoWateringPaginated> => {
    const response = await apiClient.get(`${API_BASE}/waterings`, { params: { limit, offset } });
    return response.data;
};

export const triggerWeatherCheck = async (): Promise<{ message: string }> => {
    const response = await apiClient.post(`${API_BASE}/check`);
    return response.data;
};
