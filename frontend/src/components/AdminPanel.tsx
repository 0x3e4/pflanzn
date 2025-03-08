import { useEffect, useState } from "react";
import { fetchStatistics } from "../services/PlantService";
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

export default function AdminPanel() {
    const [stats, setStats] = useState<StatisticsData>({
        totalPlants: 0,
        topSpecies: [],
        totalWaterings: 0,
        lastWateredPlant: null,
    });

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data: StatisticsData = await fetchStatistics();
            setStats(data);
        } catch (error) {
            console.error("Failed to fetch plant stats:", error);
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
                    <h3>{stats.totalPlants}</h3>
                    <p>Total Plants</p>
                </div>

                <div className="stats-card">
                    <FontAwesomeIcon icon={faList} className="stats-icon" />
                    <h3>Top 5 Species</h3>
                    <ul>
                        {stats.topSpecies.map((species, index) => (
                            <li key={index}>{species.name} ({species.count})</li>
                        ))}
                    </ul>
                </div>

                <div className="stats-card">
                    <FontAwesomeIcon icon={faDroplet} className="stats-icon" />
                    <h3>{stats.totalWaterings}</h3>
                    <p>Total Waterings Logged</p>
                </div>

                <div className="stats-card">
                    <FontAwesomeIcon icon={faClock} className="stats-icon" />
                    <h3>{stats.lastWateredPlant ? stats.lastWateredPlant.name : "N/A"}</h3>
                    <p>Last Watered Plant</p>
                </div>
            </div>
        </div>
    );
}
