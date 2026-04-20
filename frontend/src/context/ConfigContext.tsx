import React, { createContext, useContext } from "react";
import { AppConfig, getConfig } from "../services/config";

const ConfigContext = createContext<AppConfig>(getConfig());

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <ConfigContext.Provider value={getConfig()}>{children}</ConfigContext.Provider>;
};

export const useConfig = (): AppConfig => useContext(ConfigContext);
