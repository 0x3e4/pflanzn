import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationCrosshairs, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import {
    fetchWeatherConfigs,
    saveWeatherConfig,
    updateWeatherConfig,
    deleteWeatherConfig,
    fetchCurrentWeather,
    fetchWeatherLogs,
    triggerWeatherCheck,
    WeatherConfig,
    WeatherCurrent,
    WeatherLog,
} from "../services/WeatherService";
import "../styles/weatherPanel.css";

export default function WeatherPanel() {
    const [configs, setConfigs] = useState<WeatherConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [checking, setChecking] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [logs, setLogs] = useState<WeatherLog[]>([]);
    const [weatherPreviews, setWeatherPreviews] = useState<Record<number, WeatherCurrent>>({});

    // New location form
    const [showAddForm, setShowAddForm] = useState(false);
    const [cityName, setCityName] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        try {
            const data = await fetchWeatherConfigs();
            setConfigs(data);

            // Load weather for each config
            const previews: Record<number, WeatherCurrent> = {};
            for (const c of data) {
                if (c.enabled) {
                    try {
                        previews[c.id] = await fetchCurrentWeather(c.id);
                    } catch {
                        /* skip */
                    }
                }
            }
            setWeatherPreviews(previews);

            try {
                const logData = await fetchWeatherLogs(10);
                setLogs(logData);
            } catch {
                /* no logs */
            }
        } catch {
            /* no configs */
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            toast.error("Latitude and longitude must be valid numbers.");
            return;
        }

        setSaving(true);
        try {
            const created = await saveWeatherConfig({
                city_name: cityName.trim() || null,
                latitude: lat,
                longitude: lng,
                enabled: true,
            });
            setConfigs((prev) => [...prev, created]);
            setCityName("");
            setLatitude("");
            setLongitude("");
            setShowAddForm(false);
            toast.success("Location added.");

            // Load weather preview
            try {
                const weather = await fetchCurrentWeather(created.id);
                setWeatherPreviews((prev) => ({ ...prev, [created.id]: weather }));
            } catch {
                /* skip */
            }
        } catch {
            toast.error("Failed to save weather configuration.");
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (config: WeatherConfig) => {
        try {
            const updated = await updateWeatherConfig(config.id, { enabled: !config.enabled });
            setConfigs((prev) => prev.map((c) => (c.id === config.id ? updated : c)));
        } catch {
            toast.error("Failed to update configuration.");
        }
    };

    const handleDelete = async (configId: number) => {
        try {
            await deleteWeatherConfig(configId);
            setConfigs((prev) => prev.filter((c) => c.id !== configId));
            setWeatherPreviews((prev) => {
                const next = { ...prev };
                delete next[configId];
                return next;
            });
            toast.success("Location removed.");
        } catch {
            toast.error("Failed to delete configuration.");
        }
    };

    const handleCheck = async () => {
        setChecking(true);
        try {
            const result = await triggerWeatherCheck();
            toast.success(result.message);
            const logData = await fetchWeatherLogs(10);
            setLogs(logData);
        } catch {
            toast.error("Weather check failed.");
        } finally {
            setChecking(false);
        }
    };

    const fillFromGps = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser.");
            return;
        }
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLatitude(pos.coords.latitude.toFixed(6));
                setLongitude(pos.coords.longitude.toFixed(6));
                setGpsLoading(false);
                toast.success("Location detected.");
            },
            (err) => {
                toast.error("Could not get location: " + err.message);
                setGpsLoading(false);
            },
        );
    };

    if (loading) {
        return <div className="weather-panel-empty">Loading weather settings...</div>;
    }

    return (
        <div className="weather-panel">
            <h2>Weather & Auto-Watering</h2>
            <p className="weather-panel-description">
                Configure locations to automatically water outdoor plants when it rains. Plants must be marked as
                "Outdoor" and "Reaches Rain" in their details.
            </p>

            {/* Saved locations */}
            {configs.length > 0 && (
                <div className="weather-locations-list">
                    {configs.map((config, index) => (
                        <div key={config.id} className={`weather-location-card${config.enabled ? "" : " disabled"}`}>
                            <div className="weather-location-header">
                                <div className="weather-location-title">
                                    <strong>{config.city_name || `Location ${index + 1}`}</strong>
                                    {index === 0 && <span className="weather-default-badge">Default</span>}
                                </div>
                                <div className="weather-location-actions">
                                    <label className="weather-toggle-switch" title={config.enabled ? "Disable" : "Enable"}>
                                        <input
                                            type="checkbox"
                                            checked={config.enabled}
                                            onChange={() => handleToggle(config)}
                                        />
                                        <span className="weather-toggle-slider" />
                                    </label>
                                    <button
                                        className="weather-location-delete"
                                        onClick={() => handleDelete(config.id)}
                                        title="Remove location"
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            </div>
                            <div className="weather-location-coords">
                                {config.latitude.toFixed(4)}, {config.longitude.toFixed(4)}
                            </div>
                            {config.enabled && weatherPreviews[config.id] && (
                                <div className="weather-location-preview">
                                    {weatherPreviews[config.id].description} &middot;{" "}
                                    {weatherPreviews[config.id].temperature !== null
                                        ? `${weatherPreviews[config.id].temperature!.toFixed(1)}°C`
                                        : ""}{" "}
                                    &middot; {weatherPreviews[config.id].rainfall_mm.toFixed(1)} mm rain
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add new location */}
            {!showAddForm ? (
                <button className="weather-add-btn" onClick={() => setShowAddForm(true)}>
                    <FontAwesomeIcon icon={faPlus} /> Add Location
                </button>
            ) : (
                <div className="weather-add-form">
                    <input
                        type="text"
                        placeholder="City Name (optional, e.g. Vienna, Austria)"
                        value={cityName}
                        onChange={(e) => setCityName(e.target.value)}
                    />
                    <div className="weather-coord-row">
                        <div className="weather-coord-inputs">
                            <input
                                type="text"
                                placeholder="Latitude"
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Longitude"
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            className="gps-btn"
                            onClick={fillFromGps}
                            disabled={gpsLoading}
                            title="Use my location"
                        >
                            <FontAwesomeIcon icon={faLocationCrosshairs} spin={gpsLoading} />
                        </button>
                    </div>
                    <div className="weather-form-actions">
                        <button className="weather-save-btn" onClick={handleAdd} disabled={saving}>
                            {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                            className="weather-cancel-btn"
                            onClick={() => {
                                setShowAddForm(false);
                                setCityName("");
                                setLatitude("");
                                setLongitude("");
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Check now */}
            {configs.length > 0 && (
                <div className="weather-check-section">
                    <button className="weather-check-btn" onClick={handleCheck} disabled={checking}>
                        {checking ? "Checking..." : "Check Now"}
                    </button>
                </div>
            )}

            {/* Logs */}
            {logs.length > 0 && (
                <div className="weather-logs">
                    <h3>Recent Weather Checks</h3>
                    <table className="weather-logs-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Condition</th>
                                <th>Rain</th>
                                <th>Temp</th>
                                <th>Watered</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id}>
                                    <td>
                                        {new Date(log.checked_at).toLocaleString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </td>
                                    <td>{log.weather_condition || "-"}</td>
                                    <td>{log.rainfall_mm.toFixed(1)} mm</td>
                                    <td>{log.temperature !== null ? `${log.temperature.toFixed(1)}°C` : "-"}</td>
                                    <td>{log.auto_watered_count > 0 ? `${log.auto_watered_count} plants` : "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
