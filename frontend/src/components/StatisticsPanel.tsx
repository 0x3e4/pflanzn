import { useEffect, useState } from "react";
import { fetchStatistics } from "../services/PlantService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
    faSeedling, 
    faList, 
    faDroplet, 
    faClock, 
    faArchive, 
    faImage 
} from "@fortawesome/free-solid-svg-icons";
import { Plant } from "../types/Plant";
import "../styles/statisticsPanel.css";

interface SpeciesStats {
    name: string;
    count: number;
}

interface StatisticsData {
    totalPlants: number;
    archivedPlants: number;
    topSpecies: SpeciesStats[];
    totalWaterings: number;
    totalImages: number;
    lastWateredPlant: Plant | null;
}

export default function StatisticsPanel() {
    const [stats, setStats] = useState<StatisticsData | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const statsData = await fetchStatistics();
            setStats(statsData);
        } catch (error) {
            console.error("Failed to fetch statistics data:", error);
        }
    };

    return (
        <div className="statistics-panel">
            <h2>Statistics</h2>
            <p>Here you can monitor plant statistics.</p>

            {/* Top Row - Statistics Cards */}
            <div className="stats-row">
                <div className="stats-card">
                    <FontAwesomeIcon icon={faSeedling} className="stats-icon" />
                    <h3>{stats ? stats.totalPlants : "Loading..."}</h3>
                    <p>Active Plants</p>
                </div>

                <div className="stats-card">
                    <FontAwesomeIcon icon={faArchive} className="stats-icon" />
                    <h3>{stats ? stats.archivedPlants : "Loading..."}</h3>
                    <p>Archived Plants</p>
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
                    <FontAwesomeIcon icon={faImage} className="stats-icon" />
                    <h3>{stats ? stats.totalImages : "Loading..."}</h3>
                    <p>Total Images Uploaded</p>
                </div>

                <div className="stats-card">
                    <FontAwesomeIcon icon={faClock} className="stats-icon" />
                    <h3>{stats?.lastWateredPlant?.name || "N/A"}</h3>
                    <p>Last Watered Plant</p>
                </div>
            </div>
        </div>
    );
}