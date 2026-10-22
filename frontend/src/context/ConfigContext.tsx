import React, { createContext, useCallback, useContext, useState } from "react";
import { AppConfig, getConfig } from "../services/config";

const ConfigContext = createContext<AppConfig>(getConfig());
const ConfigUpdateContext = createContext<(changes: Partial<AppConfig>) => void>(() => {});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<AppConfig>(getConfig);

    // For runtime settings changed in the UI (e.g. floor plans), so the app updates
    // without a reload. Also mirrored to window.__APP_CONFIG__ for non-React readers.
    const updateConfig = useCallback((changes: Partial<AppConfig>) => {
        setConfig((current) => {
            const next = { ...current, ...changes };
            window.__APP_CONFIG__ = next;
            return next;
        });
    }, []);

    return (
        <ConfigUpdateContext.Provider value={updateConfig}>
            <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
        </ConfigUpdateContext.Provider>
    );
};

export const useConfig = (): AppConfig => useContext(ConfigContext);

export const useUpdateConfig = () => useContext(ConfigUpdateContext);
