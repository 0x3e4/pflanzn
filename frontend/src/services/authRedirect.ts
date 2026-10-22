/** A same-origin path that is safe to send the user to after login, or null. */
export const safeNextPath = (path: string | null | undefined): string | null => {
    if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
        return null;
    }
    return path;
};

/** OIDC login URL that returns to `next` (e.g. the MCP consent page) after the IdP round trip. */
export const oidcLoginUrl = (next?: string | null): string => {
    const safe = safeNextPath(next);
    return safe ? `/api/auth/oidc-login?next=${encodeURIComponent(safe)}` : "/api/auth/oidc-login";
};

export const currentPath = (): string => `${window.location.pathname}${window.location.search}`;
