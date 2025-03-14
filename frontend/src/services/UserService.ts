import apiClient from "./apiClient";
import { User, UserPassword } from "../types/User";

const API_BASE = "/users";

// Fetch all users (Admin Only)
export const fetchUsers = async (): Promise<User[]> => {
    try {
        const response = await apiClient.get<User[]>(`${API_BASE}/`);
        return response.data;
    } catch (error) {
        console.error("Failed to fetch users:", error);
        throw error;
    }
};

// Fetch current user profile
export const fetchUserProfile = async (): Promise<User> => {
    try {
        const response = await apiClient.get<User>(`${API_BASE}/profile`);
        return response.data;
    } catch (error) {
        console.error("Failed to fetch user profile:", error);
        throw error;
    }
};

// Add a new user (only in local auth mode)
export const addUser = async (user: { username: string; email: string; password: string; role: string }) => {
    try {
        const response = await apiClient.post(`${API_BASE}/`, user);
        return response.data;
    } catch (error) {
        console.error("Failed to add user:", error);
        throw error;
    }
};

// Update user
export const updateUser = async (userId: number, data: Partial<User>) => {
    try {
        const response = await apiClient.put(`${API_BASE}/${userId}`, data );
        return response.data;
    } catch (error) {
        console.error("Failed to update user:", error);
        throw error;
    }
};

// Update user password
export const updateUserPassword = async (userId: number, data: Partial<UserPassword>) => {
    try {
        const response = await apiClient.put(`${API_BASE}/${userId}/changepassword`, {
            old_password: data.oldPassword,
            new_password: data.newPassword, 
        } );
        return response.data;
    } catch (error) {
        console.error("Failed to update user password:", error);
        throw error;
    }
};

// Delete user (Admin Only, prevents deleting default admin)
export const deleteUser = async (userId: number) => {
    try {
        await apiClient.delete(`${API_BASE}/${userId}`);
    } catch (error) {
        console.error("Failed to delete user:", error);
        throw error;
    }
};

// Logout user (Clears Secure Cookie)
export const logout = async () => {
    try {
        await apiClient.post("/auth/logout");
    } catch (error) {
        console.error("Logout failed:", error);
        throw error;
    }
};
