export interface LlmProviderInfo {
    id: string;
    label: string;
    model: string;
}

export interface AppConfig {
    tz: string;
    locale: string;
    authMode: string;
    showProtectedView: boolean;
    enableLocations: boolean;
    llmProvider: string;
    // Every configured provider, the default first. With several, AI buttons ask which one.
    llmProviders: LlmProviderInfo[];
    aiEnabled: boolean;
    identificationEnabled: boolean;
    mcpEnabled: boolean;
    mcpAuth: "builtin" | "external" | "none";
    mcpLogin: string;
    floorPlansEnabled: boolean;
    domain: string;
    oidcName: string;
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
    llmProviders: [],
    aiEnabled: true,
    identificationEnabled: true,
    mcpEnabled: false,
    mcpAuth: "builtin",
    mcpLogin: "app",
    floorPlansEnabled: false,
    domain: "",
    oidcName: "",
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
        // Older backends only name the default.
        llmProviders: Array.isArray(data.llm_providers)
            ? data.llm_providers
            : data.llm_provider
              ? [{ id: data.llm_provider, label: data.llm_provider, model: "" }]
              : [],
        // Older backends don't send these; keep their behaviour (AI + identification on, MCP off).
        aiEnabled: data.ai_enabled ?? true,
        identificationEnabled: data.identification_enabled ?? true,
        mcpEnabled: !!data.mcp_enabled,
        mcpAuth: data.mcp_auth || "builtin",
        mcpLogin: data.mcp_login || "app",
        floorPlansEnabled: !!data.floor_plans_enabled,
        domain: data.domain || "",
        oidcName: data.oidc_name || "",
    };
    window.__APP_CONFIG__ = config;
    return config;
}

export function getConfig(): AppConfig {
    return window.__APP_CONFIG__ ?? DEFAULT_CONFIG;
}
