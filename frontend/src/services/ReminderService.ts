import apiClient from "./apiClient";

export interface UpcomingReminder {
    id: number;
    plant_id: number;
    plant: string | null;
    text: string;
    remind_at: string; // UTC ISO
    sent: boolean;
}

// Reminders of active plants from the start of today until `days` ahead, soonest first.
export const fetchUpcomingReminders = async (days = 14): Promise<UpcomingReminder[]> => {
    const response = await apiClient.get<{ days: number; reminders: UpcomingReminder[] }>("/reminders", {
        params: { days },
    });
    return response.data.reminders;
};
