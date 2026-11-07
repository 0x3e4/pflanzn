import { useEffect, useState, useRef } from "react";
import { fetchStatistics, fetchDailyWaterings } from "../services/StatisticService";
import { Plant } from "../types/Plant";
import "../styles/statisticsPanel.css";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

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
                const { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } =
                    await import("chart.js/auto");

                // Register components
                Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

                if (canvasRef.current) {
                    // Destroy existing chart if it exists
                    destroyChart();

                    // Format dates for labels
                    const labels = data.map((item) => {
                        const date = new Date(item.date);
                        return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                        });
                    });

                    const ctx = canvasRef.current.getContext("2d");
                    if (ctx) {
                        const computedStyle = getComputedStyle(document.documentElement);
                        const primaryColor = computedStyle.getPropertyValue("--primary-color").trim() || "#4CAF50";
                        const backgroundColor =
                            computedStyle.getPropertyValue("--background-color").trim() || "#2c2c2c";
                        const textColor = computedStyle.getPropertyValue("--text-color").trim() || "#ffffff";
                        const borderColor = computedStyle.getPropertyValue("--border-color").trim() || "#ccc";

                        chartRef.current = new Chart(ctx, {
                            type: "line",
                            data: {
                                labels: labels,
                                datasets: [
                                    {
                                        label: "Daily Waterings",
                                        data: data.map((item) => item.waterings),
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
                                        pointHoverBorderColor: textColor,
                                    },
                                ],
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                resizeDelay: 100,
                                plugins: {
                                    title: {
                                        display: false,
                                    },
                                    legend: {
                                        display: false,
                                    },
                                    tooltip: {
                                        mode: "index",
                                        intersect: false,
                                        backgroundColor: backgroundColor,
                                        titleColor: textColor,
                                        bodyColor: textColor,
                                        borderColor: borderColor,
                                        borderWidth: 1,
                                        cornerRadius: 8,
                                        callbacks: {
                                            label: function (context: any) {
                                                return `${context.parsed.y} waterings`;
                                            },
                                        },
                                    },
                                },
                                scales: {
                                    x: {
                                        display: true,
                                        grid: {
                                            display: true,
                                            color: `${textColor}20`,
                                        },
                                        ticks: {
                                            color: textColor,
                                            maxRotation: 45,
                                            minRotation: 0,
                                        },
                                    },
                                    y: {
                                        display: true,
                                        beginAtZero: true,
                                        grid: {
                                            display: true,
                                            color: `${textColor}20`,
                                        },
                                        ticks: {
                                            color: textColor,
                                            stepSize: 1,
                                        },
                                    },
                                },
                                interaction: {
                                    mode: "nearest",
                                    axis: "x",
                                    intersect: false,
                                },
                                onResize: (chart: any) => {
                                    // Force redraw on resize
                                    if (chart?.ctx?.canvas) {
                                        chart.update("none");
                                    }
                                },
                            },
                        });

                        // Add window resize event listener
                        window.addEventListener("resize", handleResize);
                    }
                }
            } catch (err: any) {
                console.error("Failed to load Chart.js:", err);
                toast.error("Failed to load chart: " + err.message);
            }
        };

        if (data.length > 0) {
            loadChartJS();
        }

        // Cleanup function
        return () => {
            destroyChart();
            window.removeEventListener("resize", handleResize);
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
        <div
            ref={containerRef}
            style={{
                position: "relative",
                height: "100%",
                width: "100%",
            }}
        >
            <canvas
                ref={canvasRef}
                role="img"
                aria-label="Daily waterings chart"
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                }}
            />
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
            } catch {
                setError("Failed to load chart data");
            }
        } catch {
            setError("Failed to load statistics");
        }
        setLoading(false);
    };

    return (
        <div className="statistics-panel">
            <h2>Statistics</h2>

            {error && (
                <div
                    style={{
                        background: "color-mix(in srgb, var(--status-due-bg) 16%, transparent)",
                        color: "var(--text-color)",
                        padding: "10px",
                        borderRadius: "4px",
                        margin: "10px 0",
                    }}
                >
                    Error: {error}
                </div>
            )}

            <dl className="stats-figures">
                <div>
                    <dt>active plants</dt>
                    <dd>{loading ? <Skeleton width={56} /> : (stats?.totalPlants ?? 0)}</dd>
                </div>
                <div>
                    <dt>archived</dt>
                    <dd>{loading ? <Skeleton width={56} /> : (stats?.archivedPlants ?? 0)}</dd>
                </div>
                <div>
                    <dt>waterings logged</dt>
                    <dd>{loading ? <Skeleton width={56} /> : (stats?.totalWaterings ?? 0)}</dd>
                </div>
                <div>
                    <dt>images uploaded</dt>
                    <dd>{loading ? <Skeleton width={56} /> : (stats?.totalImages ?? 0)}</dd>
                </div>
                <div className="stats-figure-text">
                    <dt>last watered</dt>
                    <dd title={stats?.lastWateredPlant?.name || undefined}>
                        {loading ? <Skeleton width={120} /> : stats?.lastWateredPlant?.name || "N/A"}
                    </dd>
                </div>
            </dl>

            <div className="stats-grid">
                <section className="chart-section" aria-labelledby="stats-daily-heading">
                    <h3 id="stats-daily-heading">Daily waterings</h3>
                    <div className="chart-container">
                        {loading ? (
                            <Skeleton height="100%" />
                        ) : dailyWaterings.length > 0 ? (
                            <WateringChart data={dailyWaterings} />
                        ) : (
                            <div className="chart-loading">
                                <p>No waterings logged in this period.</p>
                            </div>
                        )}
                    </div>
                </section>

                <section className="stats-species" aria-labelledby="stats-species-heading">
                    <h3 id="stats-species-heading">Top species</h3>
                    {loading ? (
                        [...Array(5)].map((_, index) => <Skeleton key={index} height={28} />)
                    ) : stats?.topSpecies?.length ? (
                        <table className="stats-species-table">
                            <thead>
                                <tr>
                                    <th scope="col">Species</th>
                                    <th scope="col">Plants</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.topSpecies.map((species, index) => (
                                    <tr key={index}>
                                        <td>{species.name}</td>
                                        <td>{species.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="stats-empty">No species recorded yet.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
