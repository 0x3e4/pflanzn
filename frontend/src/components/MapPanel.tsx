import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLocations } from "../services/LocationService";
import StaticLeafletMap, { StaticLeafletMarker } from "./StaticLeafletMap";
import { Location } from "../types/Location";
import "../styles/mapPanel.css";

export default function MapPanel() {
    const navigate = useNavigate();
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchLocations();
                setLocations(data);
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const geoLocations = locations.filter((l) => l.latitude !== null && l.longitude !== null);

    const markers: StaticLeafletMarker[] = geoLocations.map((l) => ({
        id: l.id,
        latitude: l.latitude as number,
        longitude: l.longitude as number,
        tooltipText: l.item_name ? `${l.name} (${l.item_name})` : l.name,
        radius: 10,
        weight: 2,
        color: "#2e6a31",
        fillColor: "#4caf50",
        fillOpacity: 0.85,
        onClick: () => navigate(`/location/${l.id}`),
    }));

    if (loading) {
        return <div className="map-panel-empty">Loading map...</div>;
    }

    if (geoLocations.length === 0) {
        return <div className="map-panel-empty">No locations with coordinates found.</div>;
    }

    const center = geoLocations[0];

    return (
        <div className="map-panel">
            <h2>All Locations</h2>
            <div className="map-panel-container">
                <StaticLeafletMap
                    latitude={center.latitude as number}
                    longitude={center.longitude as number}
                    zoom={13}
                    className="map-panel-map"
                    interactive
                    markers={markers}
                    fitToMarkers
                />
            </div>
        </div>
    );
}
