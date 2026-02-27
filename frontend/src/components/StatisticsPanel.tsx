import { useEffect, useState, useRef } from "react";
import { fetchStatistics, fetchDailyWaterings } from "../services/StatisticService";
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
import LoadingOverlay from "../components/LoadingOverlay";
import { toast } from 'react-toastify';

interface SpeciesStats {
    name: string;
    count: number;
}

interface DailyWateringData {
    date: string;
    waterings: number;
}

interface StatisticsData {
    totalPlants: number;
    archivedPlants: number;
    topSpecies: SpeciesStats[];
    totalWaterings: number;
    totalImages: number;
    lastWateredPlant: Plant | null;
}

// Chart.js Line Chart Component
const WateringChart = ({ data }: { data: DailyWateringData[] }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const resizeTimeoutRef = useRef<number | null>(null);
    const observerResizeTimeoutRef = useRef<number | null>(null);

    const clearPendingResizeTimeouts = () => {
        if (resizeTimeoutRef.current !== null) {
            window.clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = null;
        }
        if (observerResizeTimeoutRef.current !== null) {
            window.clearTimeout(observerResizeTimeoutRef.current);
            observerResizeTimeoutRef.current = null;
        }
    };

    const destroyChart = () => {
        clearPendingResizeTimeouts();
        if (chartRef.current) {
            chartRef.current.destroy();
            chartRef.current = null;
        }
    };

    const safeResizeChart = () => {
        const chart = chartRef.current;
        if (!chart || !canvasRef.current || !chart.ctx?.canvas) {
            return;
        }
        chart.resize();
    };

    // Resize handler
    const handleResize = () => {
        if (!chartRef.current) return;
        if (resizeTimeoutRef.current !== null) {
            window.clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = window.setTimeout(() => {
            safeResizeChart();
            resizeTimeoutRef.current = null;
        }, 100);
    };

    useEffect(() => {
        const loadChartJS = async () => {
            try {
                // Dynamic import of Chart.js
                const {
                    Chart,
                    CategoryScale,
                    LinearScale,
                    PointElement,
                    LineElement,
                    Title,
                    Tooltip,
                    Legend,
                    Filler
                } = await import('chart.js/auto');

                // Register components
                Chart.register(
                    CategoryScale,
                    LinearScale,
                    PointElement,
                    LineElement,
                    Title,
                    Tooltip,
                    Legend,
                    Filler
                );

                if (canvasRef.current) {
                    // Destroy existing chart if it exists
                    destroyChart();

                    // Format dates for labels
                    const labels = data.map(item => {
                        const date = new Date(item.date);
                        return date.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                        });
                    });

                    const ctx = canvasRef.current.getContext('2d');
                    if (ctx) {
                        const computedStyle = getComputedStyle(document.documentElement);
                        const primaryColor = computedStyle.getPropertyValue('--primary-color').trim() || '#4CAF50';
                        const backgroundColor = computedStyle.getPropertyValue('--background-color').trim() || '#2c2c2c';
                        const textColor = computedStyle.getPropertyValue('--text-color').trim() || '#ffffff';
                        const borderColor = computedStyle.getPropertyValue('--border-color').trim() || '#ccc';

                        chartRef.current = new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: labels,
                                datasets: [{
                                    label: 'Daily Waterings',
                                    data: data.map(item => item.waterings),
                                    borderColor: primaryColor,
                                    backgroundColor: `${primaryColor}20`,
                                    borderWidth: 2,
                                    fill: true,
                                    tension: 0.2,
                                    pointBackgroundColor: primaryColor,
                                    pointBorderColor: backgroundColor,
                                    pointBorderWidth: 2,
                                    pointRadius: 4,
                                    pointHoverRadius: 6,
                                    pointHoverBackgroundColor: primaryColor,
                                    pointHoverBorderColor: textColor
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                resizeDelay: 100,
                                plugins: {
                                    title: {
                                        display: false
                                    },
                                    legend: {
                                        display: false
                                    },
                                    tooltip: {
                                        mode: 'index',
                                        intersect: false,
                                        backgroundColor: backgroundColor,
                                        titleColor: textColor,
                                        bodyColor: textColor,
                                        borderColor: borderColor,
                                        borderWidth: 1,
                                        cornerRadius: 8,
                                        callbacks: {
                                            label: function(context: any) {
                                                return `${context.parsed.y} waterings`;
                                            }
                                        }
                                    }
                                },
                                scales: {
                                    x: {
                                        display: true,
                                        grid: {
                                            display: true,
                                            color: `${textColor}20`
                                        },
                                        ticks: {
                                            color: textColor,
                                            maxRotation: 45,
                                            minRotation: 0
                                        }
                                    },
                                    y: {
                                        display: true,
                                        beginAtZero: true,
                                        grid: {
                                            display: true,
                                            color: `${textColor}20`
                                        },
                                        ticks: {
                                            color: textColor,
                                            stepSize: 1
                                        }
                                    }
                                },
                                interaction: {
                                    mode: 'nearest',
                                    axis: 'x',
                                    intersect: false
                                },
                                onResize: (chart: any) => {
                                    // Force redraw on resize
                                    if (chart?.ctx?.canvas) {
                                        chart.update('none');
                                    }
                                }
                            }
                        });

                        // Add window resize event listener
                        window.addEventListener('resize', handleResize);
                    }
                }
            } catch (err: any) {
                console.error('Failed to load Chart.js:', err);
                toast.error('Failed to load chart: ' + err.message);
            }
        };

        if (data.length > 0) {
            loadChartJS();
        }

        // Cleanup function
        return () => {
            destroyChart();
            window.removeEventListener('resize', handleResize);
        };
    }, [data]);

    // Add ResizeObserver for container size changes
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            // Check if we have entries and chart exists
            if (entries.length > 0 && chartRef.current) {
                // Debounce the resize to avoid excessive calls
                if (observerResizeTimeoutRef.current !== null) {
                    window.clearTimeout(observerResizeTimeoutRef.current);
                }
                observerResizeTimeoutRef.current = window.setTimeout(() => {
                    safeResizeChart();
                    observerResizeTimeoutRef.current = null;
                }, 150);
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            clearPendingResizeTimeouts();
        };
    }, []);

    return (
        <div ref={containerRef} style={{ 
            position: 'relative', 
            height: '100%', 
            width: '100%', 
        }}>
            <canvas ref={canvasRef} style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'
            }} />
        </div>
    );
};

export default function StatisticsPanel() {
    const [stats, setStats] = useState<StatisticsData | null>(null);
    const [dailyWaterings, setDailyWaterings] = useState<DailyWateringData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            
            const statsData = await fetchStatistics();
            setStats(statsData);
            
            try {
                const dailyWateringsResponse = await fetchDailyWaterings(7);
               
                if (dailyWateringsResponse && dailyWateringsResponse.dailyWaterings) {
                    setDailyWaterings(dailyWateringsResponse.dailyWaterings);
                }
            } catch (wateringError) {
                setError("Failed to load chart data");
            }
            
        } catch (error) {
            setError("Failed to load statistics");
        }
        setLoading(false);
    };

    return (
        <div className="statistics-panel">
            {loading && <LoadingOverlay />}
            <h2>Statistics</h2>
            <p>Here you can monitor plant statistics.</p>
            
            {error && (
                <div style={{
                    background: '#ffebee',
                    color: '#c62828',
                    padding: '10px',
                    borderRadius: '4px',
                    margin: '10px 0'
                }}>
                    Error: {error}
                </div>
            )}
            
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
                        {stats?.topSpecies?.length ? (
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

            {/* Daily Waterings Chart */}
            <div className="chart-section">
                <h3>
                    <FontAwesomeIcon icon={faDroplet} style={{ marginRight: '0.5rem' }} />
                    Daily Waterings
                </h3>
                
                <div className="chart-container">
                    {dailyWaterings.length > 0 ? (
                        <WateringChart data={dailyWaterings} />
                    ) : (
                        <div className="chart-loading">
                            <p>No watering data available or still loading...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
