import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";

type User = {
    id: number;
    username: string;
    email: string;
    role: string;
};

const Admin: React.FC = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        if (user?.role === "admin") {
            axios.get("/auth/admin/users", {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            }).then((res) => {
                setUsers(res.data);
                toast.success("User list loaded.");
            }).catch(() => {
                toast.error("Failed to load users.");
            });
        }
    }, [user]);

    if (user?.role !== "admin") {
        return <p>Access denied</p>;
    }

    return (
        <div>
            <h2>Admin - User Management</h2>
            <ul>
                {users.map((u) => (
                    <li key={u.id}>{u.username} - {u.role}</li>
                ))}
            </ul>
        </div>
    );
};

export default Admin;