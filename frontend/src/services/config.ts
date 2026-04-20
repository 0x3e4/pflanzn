export interface AppConfig {
    tz: string;
    locale: string;
    authMode: string;
    showProtectedView: boolean;
    enableLocations: boolean;
    llmProvider: string;
    domain: string;
    oidcName: string;
    adminUser: string | null;
}

declare global {
    interface Window {
        __APP_CONFIG__?: AppConfig;
    }
}

const DEFAULT_CONFIG: AppConfig = {
    tz: "UTC",
    locale: "en-US",
    authMode: "no",
    showProtectedView: true,
    enableLocations: false,
    llmProvider: "",
    domain: "",
    oidcName: "",
    adminUser: null,
};

export async function loadConfig(): Promise<AppConfig> {
    const response = await fetch("/api/config");
    if (!response.ok) {
        throw new Error(`Config load failed: ${response.status}`);
    }
    const data = await response.json();
    const config: AppConfig = {
        tz: data.tz || DEFAULT_CONFIG.tz,
        locale: data.locale || DEFAULT_CONFIG.locale,
        authMode: (data.auth_mode || DEFAULT_CONFIG.authMode).toLowerCase(),
        showProtectedView: !!data.show_protected_view,
        enableLocations: !!data.enable_locations,
        llmProvider: data.llm_provider || "",
        domain: data.domain || "",
        oidcName: data.oidc_name || "",
        adminUser: data.admin_user || null,
    };
    window.__APP_CONFIG__ = config;
    return config;
}

export function getConfig(): AppConfig {
    return window.__APP_CONFIG__ ?? DEFAULT_CONFIG;
}
