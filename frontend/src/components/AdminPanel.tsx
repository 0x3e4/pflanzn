import { useEffect, useState } from "react";
import { fetchStatistics } from "../services/PlantService";
import { fetchUsers } from "../services/UserService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSeedling, faList, faDroplet, faClock } from "@fortawesome/free-solid-svg-icons";
import { Plant } from "../types/Plant";
import "../styles/adminPanel.css";

interface SpeciesStats {
    name: string;
    count: number;
}

interface StatisticsData {
    totalPlants: number;
    topSpecies: SpeciesStats[];
    totalWaterings: number;
    lastWateredPlant: Plant | null;
}

interface UsersData {
    id: number;
    username: string;
    email: string;
    role: string;
}

export default function AdminPanel() {
    const [stats, setStats] = useState<StatisticsData | null>(null);
    const [users, setUsers] = useState<UsersData[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsData, usersData] = await Promise.all([
                fetchStatistics(),
                fetchUsers(),
            ]);
            setStats(statsData);
            setUsers(usersData);
        } catch (error) {
            console.error("Failed to fetch admin data:", error);
        }
    };

    return (
        <div className="admin-panel">
            <h2>Admin Panel</h2>
            <p>Welcome to the admin area. Here you can monitor plant statistics.</p>

            {/* Top Row - Statistics Cards */}
            <div className="stats-row">
                <div className="stats-card">
                    <FontAwesomeIcon icon={faSeedling} className="stats-icon" />
                    <h3>{stats ? stats.totalPlants : "Loading..."}</h3>
                    <p>Total Plants</p>
                </div>

                <div className="stats-card">
                    <FontAwesomeIcon icon={faList} className="stats-icon" />
                    <h3>Top 5 Species</h3>
                    <ul>
                        {stats?.topSpecies.length ? (
                            stats.topSpecies.map((species, index) => (
                                <li key={index}>{species.name} ({species.count})</li>
                            ))
                        ) : (
                            <li>Loading...</li>
                        )}
                    </ul>
                </div>

                <div className="stats-card">
                    <FontAwesomeIcon icon={faDroplet} className="stats-icon" />
                    <h3>{stats ? stats.totalWaterings : "Loading..."}</h3>
                    <p>Total Waterings Logged</p>
                </div>

                <div className="stats-card">
                    <FontAwesomeIcon icon={faClock} className="stats-icon" />
                    <h3>{stats?.lastWateredPlant?.name || "N/A"}</h3>
                    <p>Last Watered Plant</p>
                </div>
            </div>

            {/* User List Section */}
            <div className="admin-users">
                <h3>User Management</h3>
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length > 0 ? (
                            users.map(user => (
                                <tr key={user.id}>
                                    <td>{user.id}</td>
                                    <td>{user.username}</td>
                                    <td>{user.email}</td>
                                    <td>{user.role}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4}>Loading users...</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}