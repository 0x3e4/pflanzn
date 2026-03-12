import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { validateShareToken } from "../services/ShareService";

type ShareContextType = {
    isShareAccess: boolean;
    shareLoading: boolean;
};

const ShareContext = createContext<ShareContextType>({ isShareAccess: false, shareLoading: false });

// Detect share token synchronously so loading state is correct from the start
const getInitialShareToken = (): string | null => {
    const paramToken = new URLSearchParams(window.location.search).get("share");
    if (paramToken) return paramToken;
    return sessionStorage.getItem("share_token");
};

export const ShareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const initialToken = getInitialShareToken();
    const [isShareAccess, setIsShareAccess] = useState(false);
    const [shareLoading, setShareLoading] = useState(!!initialToken);

    useEffect(() => {
        if (!initialToken) return;

        validateShareToken(initialToken)
            .then(() => {
                setIsShareAccess(true);
                sessionStorage.setItem("share_token", initialToken);
            })
            .catch(() => {
                sessionStorage.removeItem("share_token");
            })
            .finally(() => setShareLoading(false));
    }, []);

    const value = useMemo(() => ({ isShareAccess, shareLoading }), [isShareAccess, shareLoading]);

    return <ShareContext.Provider value={value}>{children}</ShareContext.Provider>;
};

export const useShare = () => useContext(ShareContext);
