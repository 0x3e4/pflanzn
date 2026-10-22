export interface OAuthRequestInfo {
    client_name: string;
    redirect_host: string;
    scopes: string[];
    login: string;
    login_name: string | null;
    username: string | null;
}

export interface OAuthGrant {
    id: number;
    client_name: string;
    username: string | null;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
}

export const MCP_SCOPE_WRITE = "pflanzn:write";
