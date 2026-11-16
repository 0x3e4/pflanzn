import React, { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { AppConfig, getConfig } from "../services/config";
import { effectiveLocale, getUiPreferences, subscribeUiPreferences } from "../config/uiPreferences";

const ConfigContext = createContext<AppConfig>(getConfig());
const ConfigUpdateContext = createContext<(changes: Partial<AppConfig>) => void>(() => {});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<AppConfig>(getConfig);
    const preferences = useSyncExternalStore(subscribeUiPreferences, getUiPreferences, getUiPreferences);

    // For runtime settings changed in the UI (e.g. floor plans), so the app updates
    // without a reload. Also mirrored to window.__APP_CONFIG__ for non-React readers.
    const updateConfig = useCallback((changes: Partial<AppConfig>) => {
        setConfig((current) => {
            const next = { ...current, ...changes };
            window.__APP_CONFIG__ = next;
            return next;
        });
    }, []);

    // `locale` is what every date and time is formatted with: the server's LOCALE unless
    // the person chose another language or clock under Manage → Customize.
    const value = useMemo(
        () => ({ ...config, serverLocale: config.locale, locale: effectiveLocale(config.locale, preferences) }),
        [config, preferences],
    );

    return (
        <ConfigUpdateContext.Provider value={updateConfig}>
            <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
        </ConfigUpdateContext.Provider>
    );
};

export const useConfig = (): AppConfig & { serverLocale?: string } => useContext(ConfigContext);

export const useUpdateConfig = () => useContext(ConfigUpdateContext);
