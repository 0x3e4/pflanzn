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

export interface RecentEvent {
    type: "watering" | "fertilizing" | "photo" | "note" | "care_advice";
    /** Local time (the configured TZ), ISO with offset. */
    at: string;
    plants: { id: number; name: string }[];
    /** Who did it; only for members, never for share-link or public readers. */
    by: string | null;
    rain: boolean;
    /** Note text, shortened. */
    detail: string | null;
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

// What happened lately across the collection (the home page feed), newest first.
export const fetchRecent = async (): Promise<{ days: number; events: RecentEvent[] }> => {
    const response = await apiClient.get(`${API_BASE}/recent`);
    return response.data;
};
