import React, { createContext, useContext, useState, useEffect } from "react";
import apiClient from "../services/apiClient";
import { toast } from "react-toastify";

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

    useEffect(() => {
        const hasAuth = document.cookie.includes("access_token");
    
        if (authMode === "no" || !hasAuth) {
            setLoading(false);
            setUser(null);
            setIsLoggedIn(false);
            return;
        }
    
        fetchProfile().finally(() => setLoading(false));
    }, [authMode]);
    
    const login = async (username: string, password: string) => {
        if (authMode === "local") {
            try {
                await apiClient.post("/auth/login", { username, password });
                fetchProfile();
            } catch (error) {
                toast.error("Invalid credentials or login failed.");
                throw error;
            }
        } else if (authMode === "oidc") {
            window.location.href = "/auth/oidc-login";
        }
    };

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<User>("/users/profile");
            setUser(response.data);
            setIsLoggedIn(true);
        } catch (error) {
            setUser(null);
            setIsLoggedIn(false);

            if (authMode === "oidc") {
                window.location.href = "/auth/oidc-login";
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

    return (
        <AuthContext.Provider value={{ user, login, logout, fetchProfile, isLoggedIn, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
