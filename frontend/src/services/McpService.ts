import apiClient from "./apiClient";
import { OAuthGrant, OAuthRequestInfo } from "../types/Mcp";

const API_BASE = "/oauth";

export const fetchAuthorizationRequest = async (requestId: string): Promise<OAuthRequestInfo> => {
    const response = await apiClient.get<OAuthRequestInfo>(`${API_BASE}/requests/${encodeURIComponent(requestId)}`);
    return response.data;
};

export const approveAuthorizationRequest = async (requestId: string, allowWrite: boolean): Promise<string> => {
    const response = await apiClient.post<{ redirect_url: string }>(
        `${API_BASE}/requests/${encodeURIComponent(requestId)}/approve`,
        { allow_write: allowWrite },
    );
    return response.data.redirect_url;
};

export const denyAuthorizationRequest = async (requestId: string): Promise<string> => {
    const response = await apiClient.post<{ redirect_url: string }>(
        `${API_BASE}/requests/${encodeURIComponent(requestId)}/deny`,
    );
    return response.data.redirect_url;
};

export const fetchOAuthGrants = async (): Promise<OAuthGrant[]> => {
    const response = await apiClient.get<OAuthGrant[]>(`${API_BASE}/grants`);
    return response.data;
};

export const revokeOAuthGrant = async (grantId: number): Promise<void> => {
    await apiClient.delete(`${API_BASE}/grants/${grantId}`);
};

/** Whether the reverse proxy forwards the root-level OAuth discovery documents to the backend. */
export const checkOAuthDiscovery = async (): Promise<boolean> => {
    try {
        const response = await fetch("/.well-known/oauth-protected-resource/api/mcp", { cache: "no-store" });
        if (!response.ok) return false;
        const data = await response.json();
        return Array.isArray(data.authorization_servers);
    } catch {
        return false;
    }
};
