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
        fetchProfile();
    }, [authMode]);

    const login = async (username: string, password: string) => {
        if (authMode === "local") {
            try {
                await apiClient.post("/auth/login", { username, password });
                await fetchProfile(); // Automatically get profile after login
            } catch (error) {
                toast.error("Invalid credentials or login failed.");
                throw error;
            }
        } else if (authMode === "oidc") {
            window.location.href = "/auth/oidc-login"; // Redirect to OIDC provider
        }
    };

    const fetchProfile = async () => {
        setLoading(true);

        try {
            const response = await apiClient.get<User>("/users/profile"); // Ensure backend route is correct
            setUser(response.data);
            setIsLoggedIn(true);
        } catch (error) {
            setUser(null);
            setIsLoggedIn(false);

            if (authMode === "oidc") {
                window.location.href = "/auth/oidc-login"; // Auto-login for OIDC
            }
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await apiClient.post("/auth/logout"); // Backend clears secure cookie
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
