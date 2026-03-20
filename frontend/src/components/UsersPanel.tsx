import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchUsers, addUser, updateUser, deleteUser } from "../services/UserService";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faSave, faPlus, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { User } from "../types/User";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const roles = ["user", "admin"];

export default function UsersPanel() {
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const { user, isLoggedIn } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [newUser, setNewUser] = useState({ username: "", email: "", password: "", role: "user" });
    // Fixed: Use proper state management like PlantsPanel
    const [editedUsers, setEditedUsers] = useState<{ [userId: number]: Partial<User> }>({});
    const [modalOpen, setModalOpen] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Calculate total pages
    const totalPages = Math.ceil(users.length / itemsPerPage);

    // Sort
    const [sortField, setSortField] = useState<keyof User>("id");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [loading, setLoading] = useState(true);

    // Sort function
    function compare<T>(a: T, b: T, field: keyof T, direction: "asc" | "desc") {
        if (a[field] == null) return direction === "asc" ? 1 : -1;
        if (b[field] == null) return direction === "asc" ? -1 : 1;
        if (typeof a[field] === "string" && typeof b[field] === "string") {
            return direction === "asc"
                ? (a[field] as string).localeCompare(b[field] as string)
                : (b[field] as string).localeCompare(a[field] as string);
        }
        return direction === "asc" ? (a[field] as any) - (b[field] as any) : (b[field] as any) - (a[field] as any);
    }

    const handleSort = (field: keyof User) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    // Get paginated users
    const indexOfLastUser = currentPage * itemsPerPage;
    const indexOfFirstUser = indexOfLastUser - itemsPerPage;
    const sortedUsers = [...users].sort((a, b) => compare(a, b, sortField, sortDirection));
    const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);

    useEffect(() => {
        let isActive = true;

        const loadUsers = async () => {
            setLoading(true);
            const canManageUsers =
                authMode !== "no" && (authMode === "local" || authMode === "oidc") && user?.role === "admin";

            if (!canManageUsers) {
                if (isActive) {
                    setUsers([]);
                    setLoading(false);
                }
                return;
            }

            try {
                const fetchedUsers = await fetchUsers();
                if (isActive) {
                    setUsers(fetchedUsers);
                }
            } catch {
                toast.error("Failed to load users.");
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        loadUsers();
        return () => {
            isActive = false;
        };
    }, [user, authMode]);

    const handlePageChange = (direction: "prev" | "next") => {
        setCurrentPage((prev) => (direction === "next" ? Math.min(prev + 1, totalPages) : Math.max(prev - 1, 1)));
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

    // Helper function to get the current value for a field
    const getCurrentValue = (userId: number, field: keyof User, originalValue: any) => {
        return editedUsers[userId]?.[field] ?? originalValue;
    };

    // Helper function to update a specific user's field
    const updateUserField = (userId: number, field: keyof User, value: any) => {
        setEditedUsers((prev) => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                [field]: value,
            },
        }));
    };

    // Update User
    const handleUpdateUser = async (userId: number, username: string) => {
        if (username === import.meta.env.VITE_ADMIN_USER) {
            toast.error("Cannot update the default admin.");
            return;
        }

        const changes = editedUsers[userId];
        if (!changes || Object.keys(changes).length === 0) {
            toast.info("No changes to save.");
            return;
        }

        try {
            await updateUser(userId, changes);
            toast.success("User updated successfully.");
            fetchUsers()
                .then(setUsers)
                .catch(() => toast.error("Failed to load users."));
            // Clear the edits for this user
            setEditedUsers((prev) => {
                const updated = { ...prev };
                delete updated[userId];
                return updated;
            });
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

    if (authMode === "no" || (authMode === "oidc" && user?.role !== "admin")) {
        return <p>User management not available</p>;
    }

    return (
        <div className="users-panel">
            <h2>User Management</h2>
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
                            <th onClick={() => handleSort("id")}>ID</th>
                            <th onClick={() => handleSort("username")}>Username</th>
                            <th onClick={() => handleSort("email")}>Email</th>
                            <th onClick={() => handleSort("role")}>Role</th>
                            {authMode !== "no" && <th></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading
                            ? [...Array(6)].map((_, index) => (
                                  <tr key={`user-skeleton-${index}`}>
                                      <td>
                                          <Skeleton width={24} />
                                      </td>
                                      <td>
                                          <Skeleton />
                                      </td>
                                      <td>
                                          <Skeleton />
                                      </td>
                                      <td>
                                          <Skeleton width={70} />
                                      </td>
                                      {authMode !== "no" && (
                                          <td className="action-buttons">
                                              <Skeleton circle width={30} height={30} />
                                              <Skeleton circle width={30} height={30} />
                                          </td>
                                      )}
                                  </tr>
                              ))
                            : currentUsers.map((u) => (
                                  <tr key={u.id}>
                                      <td>{u.id}</td>
                                      <td>
                                          <input
                                              type="text"
                                              value={getCurrentValue(u.id, "username", u.username)}
                                              onChange={(e) => updateUserField(u.id, "username", e.target.value)}
                                              className="editable-input"
                                              disabled={authMode === "oidc"}
                                          />
                                      </td>
                                      <td>
                                          <input
                                              type="email"
                                              value={getCurrentValue(u.id, "email", u.email)}
                                              onChange={(e) => updateUserField(u.id, "email", e.target.value)}
                                              className="editable-input"
                                              disabled={authMode === "oidc"}
                                          />
                                      </td>
                                      <td>
                                          <select
                                              value={getCurrentValue(u.id, "role", u.role)}
                                              onChange={(e) => updateUserField(u.id, "role", e.target.value)}
                                              disabled={authMode === "no"}
                                              className="editable-select"
                                          >
                                              {roles.map((role) => (
                                                  <option key={role} value={role}>
                                                      {role}
                                                  </option>
                                              ))}
                                          </select>
                                      </td>
                                      {authMode !== "no" && (
                                          <td className="action-buttons">
                                              <button
                                                  className="update-btn"
                                                  onClick={() => handleUpdateUser(u.id, u.username)}
                                              >
                                                  <FontAwesomeIcon icon={faSave} />
                                              </button>
                                              <button
                                                  className="delete-btn"
                                                  onClick={() => handleDeleteUser(u.id, u.username)}
                                              >
                                                  <FontAwesomeIcon icon={faTrash} />
                                              </button>
                                          </td>
                                      )}
                                  </tr>
                              ))}
                    </tbody>
                </table>

                {!loading && totalPages > 1 && (
                    <div className="pagination">
                        <button onClick={() => handlePageChange("prev")} disabled={currentPage === 1}>
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span>
                            {currentPage} of {totalPages}
                        </span>
                        <button onClick={() => handlePageChange("next")} disabled={currentPage === totalPages}>
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>
                )}
            </div>

            {authMode === "local" && modalOpen && (
                <div className="modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <span className="close" onClick={() => setModalOpen(false)}>
                            &times;
                        </span>
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
                                {roles.map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleAddUser}>Add User</button>
                    </div>
                </div>
            )}
        </div>
    );
}
