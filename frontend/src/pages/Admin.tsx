import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { updateUser, updateUserPassword } from "../services/UserService";
import StatisticsPanel from "../components/StatisticsPanel";
import ManagementPanel from "../components/ManagementPanel";
import "../styles/profile.css";
import LoadingOverlay from "../components/LoadingOverlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faUnlock } from "@fortawesome/free-solid-svg-icons";
import { User } from "../types/User";

type AdminSection = "profile" | "statistics" | "management";

const Admin: React.FC = () => {
    const { user, logout, fetchProfile, isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<AdminSection>("statistics");
    const [editedUser, setEditedUser] = useState<Partial<User>>({
        username: user?.username || "",
        email: user?.email || ""
    });    
    const [passwords, setPasswords] = useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    

    useEffect(() => {
        const loadProfile = async () => {
            if (!user) {
                try {
                    await fetchProfile();
                } catch {
                    toast.error("Failed to load profile data.");
                }
            }
    
            setLoading(false);
        };
    
        loadProfile();
    }, [user]) 
    
    useEffect(() => {
        if (user) {
            setEditedUser({
                id: user.id,
                username: user.username,
                email: user.email
            });
        }
    }, [user]);    

    useEffect(() => {
        if (!loading && authMode === "local" && !isLoggedIn) {
            navigate("/login");
        }
    }, [loading, isLoggedIn, authMode]);

    const handleLogout = () => {
        logout();
        toast.info("You have been logged out.");
        navigate("/login");
    };

    const handleUpdateUserDetails = async () => {
        try {
            if (!editedUser.username || !editedUser.email) {
                toast.error("Username and email cannot be empty.");
                return;
            }
    
            if (user!.id === 1) {
                toast.warning("Cannot update the default admin.");
                return;
            }

            // Ensure the logged-in user only updates their own profile
            if (user!.id !== editedUser.id) {
                toast.error("You can only update your own profile.");
                return;
            }
    
            await updateUser(user!.id, editedUser);
            toast.success("User details updated successfully!");
        } catch {
            toast.error("Failed to update user details.");
        }
    };    

    const handleChangePassword = async () => {
        if (user!.id === 1) {
            toast.warning("Cannot update the default admin.");
            return;
        }

        if (!passwords.oldPassword || !passwords.newPassword || !passwords.confirmPassword) {
            toast.error("Please fill all fields.");
            return;
        }
        if (passwords.newPassword !== passwords.confirmPassword) {
            toast.error("New passwords do not match.");
            return;
        }
    
        try {
            await updateUserPassword(user!.id, { oldPassword: passwords.oldPassword, newPassword: passwords.newPassword });
            toast.success("Password changed successfully!");
            setPasswords({ oldPassword: "", newPassword: "", confirmPassword: "" });
        } catch {
            toast.error("Failed to update password.");
        }
    };    

    if (loading) return <LoadingOverlay />;

    return (
        <div className="profile-container">
            <aside className="profile-sidebar">
                <h3>Details</h3>
                <ul>
                    <li 
                        className={activeSection === "statistics" ? "active" : ""}
                        onClick={() => setActiveSection("statistics")}
                    >
                        Statistics
                    </li>

                    {authMode !== "no" && (
                        <li 
                            className={activeSection === "profile" ? "active" : ""}
                            onClick={() => setActiveSection("profile")}
                        >
                            User details
                        </li>
                    )}

                    {(authMode === "no" || (authMode !== "no" && user?.role === "admin")) && (
                        <li 
                            className={activeSection === "management" ? "active" : ""}
                            onClick={() => setActiveSection("management")}
                        >
                            Management
                        </li>
                    )}

                    {authMode !== "no" && (
                        <li className="logout-link" onClick={handleLogout}>Logout</li>
                    )}
                </ul>
            </aside>

            <main className="profile-main-content">
                {activeSection === "profile" && authMode !== "no" && (
                    <div className="profile-info">
                        <h2>User Details</h2>
                        
                        <label>Username</label>
                        <input
                            type="text"
                            value={editedUser.username}
                            onChange={(e) => setEditedUser({ ...editedUser, username: e.target.value })}
                            className="profile-editable-input"
                            disabled={authMode === "oidc"}
                        />

                        <label>Email</label>
                        <input
                            type="email"
                            value={editedUser.email}
                            onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                            className="profile-editable-input"
                            disabled={authMode === "oidc"}
                        />

                        {authMode === "local" && (
                            <>
                                <button className="profile-update-btn" onClick={handleUpdateUserDetails}>
                                    <FontAwesomeIcon icon={faPenToSquare} /> Save Changes
                                </button>

                                <hr />

                                <h3>Change Password</h3>

                                <label>Old Password</label>
                                <input
                                    type="password"
                                    value={passwords.oldPassword}
                                    onChange={(e) => setPasswords({ ...passwords, oldPassword: e.target.value })}
                                    className="profile-editable-input"
                                />

                                <label>New Password</label>
                                <input
                                    type="password"
                                    value={passwords.newPassword}
                                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                                    className="profile-editable-input"
                                />

                                <label>Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwords.confirmPassword}
                                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                    className="profile-editable-input"
                                />

                                <button className="profile-update-btn" onClick={handleChangePassword}>
                                    <FontAwesomeIcon icon={faUnlock} /> Change Password
                                </button>
                            </>
                        )}
                    </div>
                )}

                {activeSection === "statistics" && (
                    <StatisticsPanel />
                )}

                {activeSection === "management" && (authMode === "no" || user?.role === "admin") && (
                    <ManagementPanel />
                )}
            </main>
        </div>
    );
};

export default Admin;