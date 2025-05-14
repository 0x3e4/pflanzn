import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchUsers, addUser, updateUser, deleteUser } from "../services/UserService";
import { fetchPlants, updatePlant, deletePlant } from "../services/PlantService";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faSave, faPlus, faEye, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import "../styles/managementPanel.css";
import { User } from "../types/User";
import { Plant } from "../types/Plant";

const roles = ["user", "admin"];

export default function ManagementPanel() {
    const navigate = useNavigate();
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const { user, isLoggedIn } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [plants, setPlants] = useState<Plant[]>([]);
    const [newUser, setNewUser] = useState({ username: "", email: "", password: "", role: "user" });
    const [modalOpen, setModalOpen] = useState(false);
    const [editedPlant, setEditedPlant] = useState<Partial<Plant>>({});
    const [editedUser, setEditedUser] = useState<Partial<User>>({});

    const [currentPage, setCurrentPage] = useState({ users: 1, plants: 1 });
    const itemsPerPage = 20;
    
    // Calculate total pages
    const totalUserPages = Math.ceil(users.length / itemsPerPage);
    const totalPlantPages = Math.ceil(plants.length / itemsPerPage);
    
    // Sort
    const [userSortField, setUserSortField] = useState<keyof User>('id');
    const [userSortDirection, setUserSortDirection] = useState<'asc' | 'desc'>('asc');

    const [plantSortField, setPlantSortField] = useState<keyof Plant>('id');
    const [plantSortDirection, setPlantSortDirection] = useState<'asc' | 'desc'>('asc');

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

    const handleUserSort = (field: keyof User) => {
        if (userSortField === field) {
            setUserSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setUserSortField(field);
            setUserSortDirection('asc');
        }
    };

    const handlePlantSort = (field: keyof Plant) => {
        if (plantSortField === field) {
            setPlantSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setPlantSortField(field);
            setPlantSortDirection('asc');
        }
    };

    // Get paginated users
    const indexOfLastUser = currentPage.users * itemsPerPage;
    const indexOfFirstUser = indexOfLastUser - itemsPerPage;
    const sortedUsers = [...users].sort((a, b) => compare(a, b, userSortField, userSortDirection));
    const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);
    
    // Get paginated plants
    const indexOfLastPlant = currentPage.plants * itemsPerPage;
    const indexOfFirstPlant = indexOfLastPlant - itemsPerPage;
    const sortedPlants = [...plants].sort((a, b) => compare(a, b, plantSortField, plantSortDirection));
    const currentPlants = sortedPlants.slice(indexOfFirstPlant, indexOfLastPlant);
    
    useEffect(() => {
        if (authMode === "no" || user?.role === "admin") {
            if (authMode !== "no") {
                fetchUsers().then(setUsers).catch(() => toast.error("Failed to load users."));
            }

            fetchPlants()
                .then((plants) => setPlants(plants.map((p) => ({ ...p, species: p.species ?? "" }))))
                .catch(() => toast.error("Failed to load plants."));
        }
    }, [user]);

    const handleNavigateToPlant = (plantId: number) => {
        navigate(`/plant/${plantId}`);
    };

    const handlePageChange = (type: "users" | "plants", direction: "prev" | "next") => {
        setCurrentPage((prev) => ({
            ...prev,
            [type]: direction === "next" 
                ? Math.min(prev[type] + 1, type === "users" ? totalUserPages : totalPlantPages) 
                : Math.max(prev[type] - 1, 1)
        }));
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

    // Update Plant
    const handleUpdatePlant = async (plantId: number) => {
        try {
            await updatePlant(plantId, editedPlant);
            toast.success("Plant updated successfully.");
            fetchPlants().then((plants) =>
                setPlants(plants.map(p => ({ ...p, species: p.species ?? "" })))
            );
            setEditedPlant({});
        } catch {
            toast.error("Failed to update plant.");
        }
    };

    // Delete Plant
    const handleDeletePlant = async (plantId: number) => {
        if (!window.confirm("Are you sure you want to delete this plant?")) return;

        try {
            await deletePlant(plantId);
            toast.success("Plant deleted successfully.");
            fetchPlants().then((plants) =>
                setPlants(plants.map((p) => ({ ...p, species: p.species ?? "" })))
            );            
        } catch {
            toast.error("Failed to delete plant.");
        }
    };

    if (!isLoggedIn && authMode !== "no") {
        return <p>Access denied</p>;
    }

    return (
        <div className="admin-panel">
            <h2>Management Panel</h2>
            <p>Welcome to the management area. Here you can manage most settings about the Pflanzn environment.</p>

            {/* User Management Section */}
            {(authMode === "local" || authMode === "oidc") && (
                <>
                    <div className="admin-user-mgmt-header">
                        <h3>User Management</h3>
                        {authMode === "local" && (
                            <button className="add-user-btn" onClick={() => setModalOpen(true)}>
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                        )}
                    </div>

                    <div className="users-table-container">
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleUserSort('id')}>ID</th>
                                    <th onClick={() => handleUserSort('username')}>Username</th>
                                    <th onClick={() => handleUserSort('email')}>Email</th>
                                    <th onClick={() => handleUserSort('role')}>Role</th>
                                    {authMode === "local" && <th>Actions</th>}
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
                                            >
                                                {roles.map((role) => (
                                                    <option key={role} value={role}>{role}</option>
                                                ))}
                                            </select>
                                        </td>
                                        {authMode === "local" && (
                                            <td className="action-buttons">
                                                <button className="admin-update-user-btn" onClick={() => handleUpdateUser(u.id)}>
                                                    <FontAwesomeIcon icon={faSave} />
                                                </button>
                                                <button className="admin-delete-user-btn" onClick={() => handleDeleteUser(u.id, u.username)}>
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {totalUserPages > 1 && (
                            <div className="pagination">
                                <button 
                                    onClick={() => handlePageChange("users", "prev")}
                                    disabled={currentPage.users === 1}
                                >
                                    <FontAwesomeIcon icon={faChevronLeft} />
                                </button>
                                <span>{currentPage.users} of {totalUserPages}</span>
                                <button 
                                    onClick={() => handlePageChange("users", "next")}
                                    disabled={currentPage.users === totalUserPages}
                                >
                                    <FontAwesomeIcon icon={faChevronRight} />
                                </button>
                            </div>
                        )}
                    </div>

                    {authMode === "local" && modalOpen && (
                        <div className="add-user-modal" onClick={() => setModalOpen(false)}>
                            <div className="add-user-modal-content" onClick={(e) => e.stopPropagation()}>
                                <span className="close" onClick={() => setModalOpen(false)}>&times;</span>
                                <h2>Add User</h2>
                                <div className="input-row">
                                    <input type="text" placeholder="Username" value={newUser.username}
                                        onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))} />
                                    <input type="email" placeholder="Email" value={newUser.email}
                                        onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))} />
                                </div>
                                <div className="input-row">
                                    <input type="password" placeholder="Password" value={newUser.password}
                                        onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))} />
                                </div>
                                <div className="input-row">
                                    <select value={newUser.role} onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}>
                                        {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                                    </select>
                                </div>
                                <button onClick={handleAddUser}>Add User</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            <hr />
            
            {/* Plant Management Table */}
            <div className="admin-plant-mgmt-header">
                <h3>Plant Management</h3>
            </div>
            <div className="plants-table-container">
                <table className="plants-table">
                    <thead>
                        <tr>
                            <th onClick={() => handlePlantSort('id')}>ID</th>
                            <th onClick={() => handlePlantSort('name')}>Name</th>
                            <th onClick={() => handlePlantSort('species')}>Species</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentPlants.map((p) => (
                            <tr key={p.id}>
                                <td>
                                    {p.id}
                                </td>
                                <td>
                                    <input 
                                        type="text" 
                                        value={editedPlant.name ?? p.name} 
                                        onChange={(e) => setEditedUser((prev) => ({ ...prev, name: e.target.value }))} 
                                        className="editable-input"
                                    />
                                </td>
                                <td>
                                    <input 
                                        type="text" 
                                        value={editedPlant.species ?? p.species} 
                                        onChange={(e) => setEditedUser((prev) => ({ ...prev, species: e.target.value }))} 
                                        className="editable-input"
                                    />
                                </td>
                                <td className="action-buttons">
                                    <button className="admin-view-plant-btn" onClick={() => handleNavigateToPlant(p.id)}>
                                        <FontAwesomeIcon icon={faEye} />
                                    </button>
                                    <button className="admin-update-plant-btn" onClick={() => handleUpdatePlant(p.id)}>
                                        <FontAwesomeIcon icon={faSave} />
                                    </button>
                                    <button className="admin-delete-plant-btn" onClick={() => handleDeletePlant(p.id)}>
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {totalPlantPages > 1 && (
                    <>
                        <div className="pagination">
                            <button 
                                onClick={() => handlePageChange("plants", "prev")}
                                disabled={currentPage.plants === 1}
                            >
                                <FontAwesomeIcon icon={faChevronLeft} />
                            </button>
                            <span>{currentPage.plants} of {totalPlantPages}</span>
                            <button 
                                onClick={() => handlePageChange("plants", "next")}
                                disabled={currentPage.plants === totalPlantPages}
                            >
                                <FontAwesomeIcon icon={faChevronRight} />
                            </button>
                        </div>
                    </>
                )}
            </div>

        </div>
    );
}
