import apiClient from "./apiClient";

const API_BASE = "/statistics";

export interface StatisticsSummary {
    totalPlants: number;
    archivedPlants: number;
    topSpecies: { name: string | null; count: number }[];
    totalWaterings: number;
    totalFertilizings: number;
    totalImages: number;
    identificationsCount: number;
    lastWateredPlant: { id: number; name: string } | null;
}

export interface ActivityDay {
    date: string;
    waterings: number;
    fertilizings: number;
    photos: number;
}

export interface ActivityWeek {
    start: string;
    manual: number;
    rain: number;
}

export interface RecentCount {
    last30: number;
    previous30: number;
}

export interface CaredPlant {
    id: number;
    name: string;
    total: number;
    waterings: number;
    fertilizings: number;
    photos: number;
    notes: number;
}

export interface StatisticsActivity {
    timezone: string;
    today: string;
    days: ActivityDay[];
    weeks: ActivityWeek[];
    recent: { waterings: RecentCount; fertilizings: RecentCount; photos: RecentCount };
    mostCared: CaredPlant[];
    mostCaredDays: number;
}

// Fetch plant statistics
export const fetchStatistics = async (): Promise<StatisticsSummary> => {
    const response = await apiClient.get(`${API_BASE}/`);
    return response.data;
};

// A year of care by day, twelve weeks of waterings, the last 30 days and the most cared-for plants.
export const fetchActivity = async (): Promise<StatisticsActivity> => {
    const response = await apiClient.get(`${API_BASE}/activity`);
    return response.data;
};
