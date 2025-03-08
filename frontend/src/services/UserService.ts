import apiClient from "./apiClient";
import { User } from "../types/User";

const API_BASE = "/users";

export const fetchUsers = async (): Promise<User[]> => {
    const response = await apiClient.get<User[]>(`${API_BASE}/`);
    return response.data;
};
