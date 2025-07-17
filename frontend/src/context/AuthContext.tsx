import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import apiClient from "../services/apiClient";

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

    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const isAuthDisabled = authMode === "no";

    useEffect(() => {
        const checkAuth = async () => {
            setLoading(true);
    
            if (authMode === "no") {
                setLoading(false);
                setUser(null);
                setIsLoggedIn(false);
                return;
            }
    
            try {
                await refreshToken();
                await fetchProfile();
            } catch (error) {
                console.error("Error fetching profile:", error);
                setUser(null);
                setIsLoggedIn(false);
            }
            setLoading(false);
        };
    
        checkAuth();
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

    const refreshToken = async () => {
        if (isLoggedIn) {
            try {
                const response = await apiClient.post("/auth/refresh");
                return response.data;
            } catch (error) {
                console.error("Refresh token failed:", error);
                return null;
            }
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
                console.warn("Access token expired or invalid. Trying refresh...");
                const refreshed = await refreshToken();

                if (refreshed) {
                    try {
                        // Retry fetching profile after refresh
                        const retryResponse = await apiClient.get<User>("/users/profile");
                        if (retryResponse.data) {
                            setUser(retryResponse.data);
                            setIsLoggedIn(true);
                            return;
                        }
                    } catch (retryError) {
                        console.error("Retry fetchProfile failed:", retryError);
                    }
                }

                // If refresh or retry failed
                setUser(null);
                setIsLoggedIn(false);

                if (authMode === "oidc") {
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

    const authValue = useMemo(() => ({
        user,
        login,
        logout,
        fetchProfile,
        isLoggedIn: isAuthDisabled || isLoggedIn,
        loading
    }), [user, isLoggedIn, loading, isAuthDisabled]);

    return (
        <AuthContext.Provider value={authValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        return { user: null, isLoggedIn: false, loading: true, login: async () => {}, logout: async () => {}, fetchProfile: async () => {} };
    }
    return context;
};