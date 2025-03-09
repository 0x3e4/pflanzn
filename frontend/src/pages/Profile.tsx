import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import StatisticsPanel from "../components/StatisticsPanel";
import AdminPanel from "../components/AdminPanel";
import "../styles/profile.css";
import LoadingOverlay from "../components/LoadingOverlay";

type ProfileSection = "profile" | "statistics" | "admin";

const Profile: React.FC = () => {
    const { user, logout, fetchProfile, isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<ProfileSection>("profile");

    useEffect(() => {
        const loadProfile = async () => {
            try {
                await fetchProfile();
            } catch {
                toast.error("Failed to load profile data.");
            } finally {
                setLoading(false);
            }
        };
    
        loadProfile();
    }, []);
    
    useEffect(() => {
        if (!loading && !isLoggedIn) {
            navigate("/login");
        }
    }, [loading, isLoggedIn]);

    const handleLogout = () => {
        logout();
        toast.info("You have been logged out.");
        navigate("/login");
    };

    if (loading) return <LoadingOverlay />;

    return (
        <div className="profile-container">
            <aside className="profile-sidebar">
                <h3>My Account</h3>
                <ul>
                    <li 
                        className={activeSection === "profile" ? "active" : ""}
                        onClick={() => setActiveSection("profile")}
                    >
                        User details
                    </li>

                    <li 
                        className={activeSection === "statistics" ? "active" : ""}
                        onClick={() => setActiveSection("statistics")}
                    >
                        Statistics
                    </li>

                    {user?.role === "admin" && (
                        <li 
                            className={activeSection === "admin" ? "active" : ""}
                            onClick={() => setActiveSection("admin")}
                        >
                            Admin
                        </li>
                    )}

                    <li className="logout-link" onClick={handleLogout}>Logout</li>
                </ul>
            </aside>

            <main className="profile-main-content">
                {activeSection === "profile" && (
                    <div className="profile-info">
                        <h2>User Details</h2>
                        <p><strong>Username:</strong> {user?.username}</p>
                        <p><strong>Email:</strong> {user?.email}</p>
                        <p><strong>Role:</strong> {user?.role}</p>
                    </div>
                )}

                {activeSection === "statistics" && (
                    <StatisticsPanel />
                )}

                {activeSection === "admin" && user?.role === "admin" && (
                    <AdminPanel />
                )}
            </main>
        </div>
    );
};

export default Profile;