import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import apiClient from "../services/apiClient";
import { useConfig } from "./ConfigContext";

type User = {
    id: number;
    username: string;
    email: string;
    role: string;
};

type AuthContextType = {
    user: User | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    fetchProfile: () => Promise<void>;
    isLoggedIn: boolean;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    const { authMode, showProtectedView } = useConfig();
    const isAuthDisabled = authMode === "no";

    useEffect(() => {
        (async () => {
            setLoading(true);
            if (authMode !== "no") {
                const token = await refreshToken(true);
                if (token) {
                    await fetchProfile();
                } else {
                    setUser(null);
                    setIsLoggedIn(false);

                    // Redirect to OIDC login if protected view is enabled
                    const hasShareToken =
                        new URLSearchParams(window.location.search).has("share") ||
                        !!sessionStorage.getItem("share_token");
                    if (authMode === "oidc" && showProtectedView && !hasShareToken) {
                        window.location.href = "/api/auth/oidc-login";
                    }
                }
            } else {
                setUser(null);
                setIsLoggedIn(false);
            }
            setLoading(false);
        })();
    }, [authMode]);

    const login = async (username: string, password: string) => {
        if (authMode === "local") {
            try {
                await apiClient.post("/auth/login", { username, password });
                await fetchProfile();
            } catch (error) {
                throw error;
            }
        } else if (authMode === "oidc") {
            window.location.href = "/auth/oidc-login";
        }
    };

    const refreshToken = async (force = false) => {
        if (!force && !isLoggedIn) return null;
        try {
            const response = await apiClient.post("/auth/refresh");
            return response.data;
        } catch (e) {
            console.error("Refresh token failed:", e);
            return null;
        }
    };

    const fetchProfile = async () => {
        try {
            const response = await apiClient.get<User>("/users/profile");
            if (response.data) {
                if (!user || user.id !== response.data.id) {
                    setUser(response.data);
                    setIsLoggedIn(true);
                }
            } else {
                setUser(null);
                setIsLoggedIn(false);
            }
        } catch (error: any) {
            if (error.response?.status === 401) {
                console.warn("Profile fetch failed after interceptor retry.");
                setUser(null);
                setIsLoggedIn(false);

                // Don't redirect to OIDC if a share token is present
                const hasShareToken =
                    new URLSearchParams(window.location.search).has("share") || !!sessionStorage.getItem("share_token");

                if (authMode === "oidc" && showProtectedView && !hasShareToken) {
                    window.location.href = "/api/auth/oidc-login";
                }
            } else {
                console.error("Unexpected error fetching profile:", error);
            }
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await apiClient.post("/auth/logout");
        } catch (error) {
            console.error("Logout failed:", error);
        }
        setUser(null);
        setIsLoggedIn(false);
    };

    const authValue = useMemo(
        () => ({
            user,
            login,
            logout,
            fetchProfile,
            isLoggedIn: isAuthDisabled || isLoggedIn,
            loading,
        }),
        [user, isLoggedIn, loading, isAuthDisabled],
    );

    return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        return {
            user: null,
            isLoggedIn: false,
            loading: true,
            login: async () => {},
            logout: async () => {},
            fetchProfile: async () => {},
        };
    }
    return context;
};
