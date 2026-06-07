import apiClient from "./apiClient";
import { AuditLogPage, AuditQuery } from "../types/AuditLog";

const API_BASE = "/audit";

// Fetch a paginated, filtered page of audit log entries (Admin only)
export const fetchAuditLogs = async (params: AuditQuery = {}): Promise<AuditLogPage> => {
    try {
        const response = await apiClient.get<AuditLogPage>(`${API_BASE}/`, { params });
        return response.data;
    } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        throw error;
    }
};
