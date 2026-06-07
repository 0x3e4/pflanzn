export interface AuditLog {
    id: number;
    created_at: string;
    user_id: number | null;
    username: string | null;
    action: string;
    entity_type: string | null;
    entity_id: number | null;
    method: string | null;
    path: string | null;
    status_code: number | null;
    ip_address: string | null;
    user_agent: string | null;
    details: Record<string, unknown> | null;
}

export interface AuditLogPage {
    items: AuditLog[];
    total: number;
    page: number;
    per_page: number;
}

export interface AuditQuery {
    page?: number;
    per_page?: number;
    action?: string;
    entity_type?: string;
    username?: string;
    user_id?: number;
    date_from?: string;
    date_to?: string;
    q?: string;
}
