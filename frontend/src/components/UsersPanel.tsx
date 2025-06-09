import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchUsers, addUser, updateUser, deleteUser } from "../services/UserService";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faSave, faPlus, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { User } from "../types/User";
import LoadingOverlay from "../components/LoadingOverlay";

const roles = ["user", "admin"];

export default function UsersPanel() {
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const { user, isLoggedIn } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [newUser, setNewUser] = useState({ username: "", email: "", password: "", role: "user" });
    const [modalOpen, setModalOpen] = useState(false);
    const [editedUser, setEditedUser] = useState<Partial<User>>({});

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    
    // Calculate total pages
    const totalPages = Math.ceil(users.length / itemsPerPage);
    
    // Sort
    const [sortField, setSortField] = useState<keyof User>('id');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [loading, setLoading] = useState(true);

    // Sort function
    function compare<T>(a: T, b: T, field: keyof T, direction: 'asc' | 'desc') {
        if (a[field] == null) return direction === 'asc' ? 1 : -1;
        if (b[field] == null) return direction === 'asc' ? -1 : 1;
        if (typeof a[field] === 'string' && typeof b[field] === 'string') {
            return direction === 'asc'
                ? (a[field] as string).localeCompare(b[field] as string)
                : (b[field] as string).localeCompare(a[field] as string);
        }
        return direction === 'asc'
            ? (a[field] as any) - (b[field] as any)
            : (b[field] as any) - (a[field] as any);
    }

    const handleSort = (field: keyof User) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Get paginated users
    const indexOfLastUser = currentPage * itemsPerPage;
    const indexOfFirstUser = indexOfLastUser - itemsPerPage;
    const sortedUsers = [...users].sort((a, b) => compare(a, b, sortField, sortDirection));
    const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);
    
    useEffect(() => {
        if (authMode !== "no" && (authMode === "local" || authMode === "oidc") && (user?.role === "admin")) {
            fetchUsers().then(setUsers).catch(() => toast.error("Failed to load users."));
        }
        setLoading(false);
    }, [user, authMode]);

    const handlePageChange = (direction: "prev" | "next") => {
        setCurrentPage(prev => 
            direction === "next" 
                ? Math.min(prev + 1, totalPages) 
                : Math.max(prev - 1, 1)
        );
    };    

    // Add User
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

    // Update User
    const handleUpdateUser = async (userId: number) => {
        try {
            await updateUser(userId, editedUser);
            toast.success("User updated successfully.");
            fetchUsers().then(setUsers).catch(() => toast.error("Failed to load users."));
            setEditedUser({});
        } catch {
            toast.error(`Failed to update user.`);
        }
    };

    // Delete User
    const handleDeleteUser = async (userId: number, username: string) => {
        if (username === import.meta.env.VITE_ADMIN_USER) {
            toast.error("Cannot delete the default admin.");
            return;
        }

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

    if (!isLoggedIn && authMode !== "no") {
        return <p>Access denied</p>;
    }

    if (authMode === "no" || authMode === "oidc" && user?.role !== "admin") {
        return <p>User management not available</p>;
    }

    return (
        <div className="users-panel">
            {loading && <LoadingOverlay />}

            <h3>User Management</h3>
            {authMode === "local" && (
                <button className="add-btn" onClick={() => setModalOpen(true)}>
                    <FontAwesomeIcon icon={faPlus} />
                </button>
            )}
            <p>Here you can manage all the users.</p>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('id')}>ID</th>
                            <th onClick={() => handleSort('username')}>Username</th>
                            <th onClick={() => handleSort('email')}>Email</th>
                            <th onClick={() => handleSort('role')}>Role</th>
                            {authMode === "local" && <th></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {currentUsers.map((u) => (
                            <tr key={u.id}>
                                <td>{u.id}</td>
                                <td>
                                    <input
                                        type="text"
                                        value={editedUser.username ?? u.username}
                                        onChange={(e) => setEditedUser({ ...editedUser, username: e.target.value })}
                                        className="editable-input"
                                        disabled={authMode === "oidc"}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="email"
                                        value={editedUser.email ?? u.email}
                                        onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                                        className="editable-input"
                                        disabled={authMode === "oidc"}
                                    />
                                </td>
                                <td>
                                    <select
                                        value={editedUser.role ?? u.role}
                                        onChange={(e) => setEditedUser({ ...editedUser, role: e.target.value })}
                                        disabled={authMode === "oidc"}
                                        className="editable-select"
                                    >
                                        {roles.map((role) => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </td>
                                {authMode === "local" && (
                                    <td className="action-buttons">
                                        <button className="update-btn" onClick={() => handleUpdateUser(u.id)}>
                                            <FontAwesomeIcon icon={faSave} />
                                        </button>
                                        <button className="delete-btn" onClick={() => handleDeleteUser(u.id, u.username)}>
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {totalPages > 1 && (
                    <div className="pagination">
                        <button 
                            onClick={() => handlePageChange("prev")}
                            disabled={currentPage === 1}
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span>{currentPage} of {totalPages}</span>
                        <button 
                            onClick={() => handlePageChange("next")}
                            disabled={currentPage === totalPages}
                        >
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>
                )}
            </div>

            {authMode === "local" && modalOpen && (
                <div className="modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <span className="close" onClick={() => setModalOpen(false)}>&times;</span>
                        <h2>Add User</h2>
                        <div className="input-row">
                            <input 
                                type="text" 
                                placeholder="Username" 
                                value={newUser.username}
                                onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))} 
                            />
                            <input 
                                type="email" 
                                placeholder="Email" 
                                value={newUser.email}
                                onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))} 
                            />
                        </div>
                        <div className="input-row">
                            <input 
                                type="password" 
                                placeholder="Password" 
                                value={newUser.password}
                                onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))} 
                            />
                        </div>
                        <div className="input-row">
                            <select 
                                value={newUser.role} 
                                onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
                            >
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