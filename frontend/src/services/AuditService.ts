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

export interface AuditFacets {
    actions: string[];
    entity_types: string[];
}

// The actions and entity types that occur in the log, for the filter dropdowns (Admin only)
export const fetchAuditFacets = async (): Promise<AuditFacets> => {
    const response = await apiClient.get<AuditFacets>(`${API_BASE}/facets`);
    return response.data;
};
