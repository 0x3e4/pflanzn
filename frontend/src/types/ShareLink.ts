export interface ShareLink {
    id: number;
    token: string;
    alias: string;
    expires_at: string | null;
    created_at: string;
}

export interface ShareLinkCreateInput {
    alias: string;
    expires_in_hours: number | null;
}
