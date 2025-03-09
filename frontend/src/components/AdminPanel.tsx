import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchUsers, addUser, updateUserRole, deleteUser } from "../services/UserService";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import "../styles/adminPanel.css";

type User = {
    id: number;
    username: string;
    email: string;
    role: string;
};

const roles = ["user", "admin"];

export default function AdminPanel() {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [newUser, setNewUser] = useState({ username: "", email: "", password: "", role: "user" });
    const [modalOpen, setModalOpen] = useState(false);
    const authMode = import.meta.env.VITE_AUTH_MODE;

    useEffect(() => {
        if (user?.role === "admin") {
            fetchUsers().then(setUsers).catch(() => toast.error("Failed to load users."));
        }
    }, [user]);

    const handleAddUser = async () => {
        if (!newUser.username || !newUser.email || !newUser.password) {
            toast.error("Please fill all fields.");
            return;
        }

        try {
            await addUser(newUser);
            toast.success("User added successfully.");
            setNewUser({ username: "", email: "", password: "", role: "user" });
            fetchUsers().then(setUsers);
            setModalOpen(false);
        } catch {
            toast.error("Failed to add user.");
        }
    };

    const handleRoleChange = async (userId: number, role: string) => {
        try {
            await updateUserRole(userId, role);
            toast.success("Role updated successfully.");
            fetchUsers().then(setUsers);
        } catch {
            toast.error("Failed to update role.");
        }
    };

    const handleDeleteUser = async (userId: number, username: string) => {
        if (username === import.meta.env.VITE_ADMIN_USER) {
            toast.error("Cannot delete the default admin.");
            return;
        }
    
        // Check if this is the last admin
        const adminCount = users.filter((u) => u.role === "admin").length;
        if (adminCount === 1 && users.find((u) => u.id === userId)?.role === "admin") {
            toast.error("Cannot delete the last admin user.");
            return;
        }
    
        if (!window.confirm(`Are you sure you want to delete ${username}?`)) return;
    
        try {
            await deleteUser(userId);
            toast.success("User deleted successfully.");
            fetchUsers().then(setUsers);
        } catch {
            toast.error("Failed to delete user.");
        }
    };
    
    if (user?.role !== "admin") {
        return <p>Access denied</p>;
    }

    return (
        <div className="admin-panel">
            <h2>Admin Panel</h2>
            <p>Welcome to the admin area. Here you can manage users, plants, and all other app settings.</p>

            {/* User Management Table */}
            <div className="admin-user-mgmt-header">
                <h3>User Management</h3>
                {authMode === "local" && (
                    <button className="add-user-btn" onClick={() => setModalOpen(true)}>
                        <FontAwesomeIcon icon={faPlus} />
                    </button>
                )}
            </div>
            <table className="users-table">
                <thead>
                    <tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th></th></tr>
                </thead>
                <tbody>
                    {users.length > 0 ? (
                        users.map((u) => (
                            <tr key={u.id}>
                                <td>{u.id}</td>
                                <td>{u.username}</td>
                                <td>{u.email}</td>
                                <td>
                                    {users.length > 1 ? (
                                        <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                                            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                                        </select>
                                    ) : (
                                        u.role
                                    )}
                                </td>
                                <td>
                                    {users.length > 1 && u.username !== import.meta.env.VITE_ADMIN_USER && (
                                        <button className="delete-user-btn" onClick={() => handleDeleteUser(u.id, u.username)}>
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5}>Loading users...</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Add User Modal */}
            {modalOpen && (
                <div className="add-user-modal" onClick={() => setModalOpen(false)}>
                    <div className="add-user-modal-content" onClick={(e) => e.stopPropagation()}>
                        <span className="close" onClick={() => setModalOpen(false)}>&times;</span>
                        <h2>Add User</h2>

                        <div className="input-row">
                            <input type="text" placeholder="Username" value={newUser.username} 
                                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                            <input type="email" placeholder="Email" value={newUser.email} 
                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                        </div>

                        <div className="input-row">
                            <input type="password" placeholder="Password" value={newUser.password} 
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                        </div>

                        <div className="input-row">
                            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                            </select>
                        </div>

                        <button onClick={handleAddUser}>Add User</button>
                    </div>
                </div>
            )}
        </div>
    );
}