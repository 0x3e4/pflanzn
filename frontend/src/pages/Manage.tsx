import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { updateUser, updateUserPassword } from "../services/UserService";
import StatisticsPanel from "../components/StatisticsPanel";
import UsersPanel from "../components/UsersPanel";
import PlantsPanel from "../components/PlantsPanel";
import IdentificationsPanel from "../components/IdentificationsPanel";
import LocationsPanel from "../components/LocationsPanel";
import MapPanel from "../components/MapPanel";
import SharePanel from "../components/SharePanel";
import TagsPanel from "../components/TagsPanel";
import WateringsPanel from "../components/WateringsPanel";
import WeatherPanel from "../components/WeatherPanel";
import "../styles/manage.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faUnlock } from "@fortawesome/free-solid-svg-icons";
import { User } from "../types/User";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { APP_VERSION } from "../config/appInfo";
import { getUiPreferences, pushUserPreferences, updateUiPreferences } from "../config/uiPreferences";

type ManageSection =
    | "profile"
    | "statistics"
    | "identification"
    | "users"
    | "plants"
    | "locations"
    | "map"
    | "tags"
    | "waterings"
    | "customize"
    | "weather"
    | "share";

const Manage: React.FC = () => {
    const { user, logout, fetchProfile, isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const { authMode, showProtectedView } = useConfig();
    const showShare = (authMode === "oidc" || authMode === "local") && showProtectedView;
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<ManageSection>("statistics");
    const [editedUser, setEditedUser] = useState<Partial<User>>({
        username: user?.username || "",
        email: user?.email || "",
    });
    const [passwords, setPasswords] = useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [defaultWidescreen, setDefaultWidescreen] = useState(() => getUiPreferences().defaultWidescreen);

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
    }, [user]);

    useEffect(() => {
        if (user) {
            setEditedUser({
                id: user.id,
                username: user.username,
                email: user.email,
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
            await updateUserPassword(user!.id, {
                oldPassword: passwords.oldPassword,
                newPassword: passwords.newPassword,
            });
            toast.success("Password changed successfully!");
            setPasswords({ oldPassword: "", newPassword: "", confirmPassword: "" });
        } catch {
            toast.error("Failed to update password.");
        }
    };

    const handleDefaultWidescreenChange = async (enabled: boolean) => {
        setDefaultWidescreen(enabled);
        updateUiPreferences({ defaultWidescreen: enabled });
        if (authMode !== "no" && isLoggedIn) {
            try {
                await pushUserPreferences({ defaultWidescreen: enabled });
            } catch {
                toast.error("Saved locally, but failed to sync to your account.");
                return;
            }
        }
        toast.success(`Default widescreen ${enabled ? "enabled" : "disabled"}.`);
    };

    if (loading) {
        return (
            <div className="container profile-container">
                <aside className="profile-sidebar">
                    <ul>
                        {[...Array(5)].map((_, index) => (
                            <li key={index}>
                                <Skeleton height={18} />
                            </li>
                        ))}
                    </ul>
                </aside>
                <div className="profile-main-content">
                    <div className="profile-info">
                        <Skeleton height={34} width={180} style={{ marginBottom: "1rem" }} />
                        {[...Array(6)].map((_, index) => (
                            <Skeleton key={index} height={44} style={{ marginBottom: "0.8rem" }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container profile-container">
            <aside className="profile-sidebar">
                <ul>
                    {authMode !== "no" && (
                        <>
                            <h3>Details</h3>
                            <li
                                className={`sidebar-subsection ${activeSection === "profile" ? "active" : ""}`}
                                onClick={() => setActiveSection("profile")}
                            >
                                Profile
                            </li>
                        </>
                    )}

                    {(authMode === "no" || (authMode !== "no" && user?.role === "admin")) && (
                        <>
                            <h3>Management</h3>

                            <li
                                className={`sidebar-subsection ${activeSection === "statistics" ? "active" : ""}`}
                                onClick={() => setActiveSection("statistics")}
                            >
                                Statistics
                            </li>

                            {authMode !== "no" && (
                                <li
                                    className={`sidebar-subsection ${activeSection === "users" ? "active" : ""}`}
                                    onClick={() => setActiveSection("users")}
                                >
                                    Users
                                </li>
                            )}

                            <li
                                className={`sidebar-subsection ${activeSection === "plants" ? "active" : ""}`}
                                onClick={() => setActiveSection("plants")}
                            >
                                Plants
                            </li>

                            <li
                                className={`sidebar-subsection ${activeSection === "locations" ? "active" : ""}`}
                                onClick={() => setActiveSection("locations")}
                            >
                                Locations
                            </li>

                            <li
                                className={`sidebar-subsection ${activeSection === "tags" ? "active" : ""}`}
                                onClick={() => setActiveSection("tags")}
                            >
                                Tags
                            </li>

                            <li
                                className={`sidebar-subsection ${activeSection === "map" ? "active" : ""}`}
                                onClick={() => setActiveSection("map")}
                            >
                                Map
                            </li>

                            <li
                                className={`sidebar-subsection ${activeSection === "identification" ? "active" : ""}`}
                                onClick={() => setActiveSection("identification")}
                            >
                                Identifications
                            </li>

                            <li
                                className={`sidebar-subsection ${activeSection === "waterings" ? "active" : ""}`}
                                onClick={() => setActiveSection("waterings")}
                            >
                                Waterings
                            </li>
                        </>
                    )}

                    <h3>Settings</h3>
                    <li
                        className={`sidebar-subsection ${activeSection === "customize" ? "active" : ""}`}
                        onClick={() => setActiveSection("customize")}
                    >
                        Customize
                    </li>
                    <li
                        className={`sidebar-subsection ${activeSection === "weather" ? "active" : ""}`}
                        onClick={() => setActiveSection("weather")}
                    >
                        Weather
                    </li>
                    {showShare && user?.role === "admin" && (
                        <li
                            className={`sidebar-subsection ${activeSection === "share" ? "active" : ""}`}
                            onClick={() => setActiveSection("share")}
                        >
                            Share
                        </li>
                    )}
                    <li className="sidebar-info-item">Version {APP_VERSION}</li>

                    {authMode !== "no" && (
                        <li className="logout-link" onClick={handleLogout}>
                            Logout
                        </li>
                    )}
                </ul>
            </aside>

            <div className="profile-main-content">
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

                {activeSection === "statistics" && <StatisticsPanel />}

                {activeSection === "identification" && (authMode === "no" || user?.role === "admin") && (
                    <IdentificationsPanel />
                )}

                {activeSection === "users" && authMode !== "no" && (authMode === "no" || user?.role === "admin") && (
                    <UsersPanel />
                )}

                {activeSection === "plants" && (authMode === "no" || user?.role === "admin") && <PlantsPanel />}

                {activeSection === "locations" && (authMode === "no" || user?.role === "admin") && <LocationsPanel />}

                {activeSection === "map" && (authMode === "no" || user?.role === "admin") && <MapPanel />}

                {activeSection === "tags" && (authMode === "no" || user?.role === "admin") && <TagsPanel />}

                {activeSection === "waterings" && (authMode === "no" || user?.role === "admin") && <WateringsPanel />}

                {activeSection === "share" && showShare && user?.role === "admin" && <SharePanel />}

                {activeSection === "weather" && <WeatherPanel />}

                {activeSection === "customize" && (
                    <div className="profile-info manage-customize-panel">
                        <h2>Customize</h2>
                        <p>Override layout defaults used across the app.</p>

                        <label className="manage-setting-row">
                            <input
                                type="checkbox"
                                checked={defaultWidescreen}
                                onChange={(e) => handleDefaultWidescreenChange(e.target.checked)}
                            />
                            <span>Enable widescreen by default for Plants and Locations</span>
                        </label>

                        <small className="manage-setting-hint">
                            You can still collapse the page width with the expand/collapse icon directly in Plants and
                            Locations.
                        </small>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Manage;
