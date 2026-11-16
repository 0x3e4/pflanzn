import apiClient from "./apiClient";

export interface NotificationStatus {
    configured: boolean;
    server: string | null;
    mode: "key" | "urls" | null;
    key: string | null;
    tag: string | null;
    // The schemes of APPRISE_URLS ("ntfy", "tgram"), never the URLs: they carry tokens.
    services: string[];
    settings: {
        notify_reminders: boolean;
        notify_watering: boolean;
        notify_watering_time: string;
    };
    plants_due_now: number;
}

// Where notifications go and what is sent (Admin only)
export const fetchNotificationStatus = async (): Promise<NotificationStatus> => {
    const response = await apiClient.get<NotificationStatus>("/notifications/status");
    return response.data;
};

// Sends a test message, or the watering digest as it would look now (Admin only)
export const sendTestNotification = async (): Promise<void> => {
    await apiClient.post("/notifications/test");
};

export interface IdentificationQuota {
    enabled: boolean;
    // What Pl@ntNet said is left today; null before the first identification of the day.
    remaining: number | null;
    limit: number;
    updated_at: string | null;
}

export const fetchIdentificationQuota = async (): Promise<IdentificationQuota> => {
    const response = await apiClient.get<IdentificationQuota>("/identification/quota");
    return response.data;
};
