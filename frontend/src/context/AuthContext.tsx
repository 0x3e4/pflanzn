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
    logout: () => void;
    fetchProfile: () => Promise<void>;
    isLoggedIn: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

    const authMode = import.meta.env.VITE_AUTH_MODE || "no";

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (authMode !== "no" && token) {
            fetchProfile().catch(() => {});
        }
    }, [authMode]);

    const login = async (username: string, password: string) => {
        if (authMode === "local") {
            try {
                const response = await apiClient.post("/auth/login", { username, password });
                localStorage.setItem("token", response.data.access_token);
                await fetchProfile();
            } catch (error) {
                toast.error("Invalid credentials or login failed.");
                throw error;
            }
        } else if (authMode === "oidc") {
            window.location.href = "/auth/oidc-login";
        }
    };

    const fetchProfile = async () => {
        const token = localStorage.getItem("token");
        if (token) {
            try {
                const response = await apiClient.get<User>("/auth/profile");
                setUser(response.data);
                setIsLoggedIn(true);
            } catch (error) {
                localStorage.removeItem("token");
                setUser(null);
                setIsLoggedIn(false);
            }
        } else {
            setUser(null);
            setIsLoggedIn(false);
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        setUser(null);
        setIsLoggedIn(false);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, fetchProfile, isLoggedIn }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
