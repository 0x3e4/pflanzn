import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCompress, faExpand, faFingerprint, faPlus, faUpload } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import {
    createLocation,
    fetchLocations,
    identifyLocationFromImage,
    updateLocation,
    uploadLocationImage,
} from "../services/LocationService";
import IdentifyResults from "../components/IdentifyResults";
import StaticLeafletMap from "../components/StaticLeafletMap";
import { Location, SpotType } from "../types/Location";
import { useAuth } from "../context/AuthContext";
import "../styles/locations.css";
import { getUiPreferences } from "../config/uiPreferences";

const spotTypeLabels: Record<SpotType, string> = {
    field: "Field",
    public_spot: "Public Spot",
    forest: "Forest",
    meadow: "Meadow",
    other: "Other",
};

type LocationSortOption = "updatedDesc" | "updatedAsc" | "createdDesc" | "createdAsc" | "nameAsc" | "nameDesc";
type LocationIdentifyResult = { species: string; commonName: string; score: string; images: string[] };

export default function Locations() {
    const { isLoggedIn } = useAuth();
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [identifying, setIdentifying] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState<LocationSortOption>("updatedDesc");
    const [isStretched, setIsStretched] = useState(() => getUiPreferences().defaultWidescreen);
    const [selectedSpotType, setSelectedSpotType] = useState<SpotType | "all">("all");
    const [newLocationImage, setNewLocationImage] = useState<File | null>(null);
    const [modalIdentifyResults, setModalIdentifyResults] = useState<LocationIdentifyResult[] | null>(null);
    const [locationIdentifyResults, setLocationIdentifyResults] = useState<{
        locationId: number;
        results: LocationIdentifyResult[];
    } | null>(null);
    const [identifyingLocationId, setIdentifyingLocationId] = useState<number | null>(null);
    const [newLocation, setNewLocation] = useState({
        name: "",
        item_name: "",
        spot_type: "field" as SpotType,
        latitude: "",
        longitude: "",
    });

    const filteredLocations = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const filtered = locations.filter((location) => {
            const matchesSearch =
                normalizedSearch.length === 0 ||
                location.name.toLowerCase().includes(normalizedSearch) ||
                (location.item_name || "").toLowerCase().includes(normalizedSearch) ||
                (location.description || "").toLowerCase().includes(normalizedSearch);

            const matchesSpotType = selectedSpotType === "all" || location.spot_type === selectedSpotType;
            return matchesSearch && matchesSpotType;
        });

        const sorted = [...filtered];
        sorted.sort((a, b) => {
            switch (sortBy) {
                case "updatedAsc":
                    return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
                case "createdDesc":
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case "createdAsc":
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case "nameAsc":
                    return a.name.localeCompare(b.name);
                case "nameDesc":
                    return b.name.localeCompare(a.name);
                case "updatedDesc":
                default:
                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            }
        });

        return sorted;
    }, [locations, searchTerm, selectedSpotType, sortBy]);

    const loadLocations = async () => {
        setLoading(true);
        try {
            const data = await fetchLocations();
            setLocations(data);
        } catch (error) {
            toast.error((error as Error).message || "Failed to load locations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLocations();
    }, []);

    const resetModal = () => {
        setNewLocation({
            name: "",
            item_name: "",
            spot_type: "field",
            latitude: "",
            longitude: "",
        });
        setNewLocationImage(null);
        setModalIdentifyResults(null);
        setModalOpen(false);
    };

    const handleModalFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        setNewLocationImage(selectedFile);
        setModalIdentifyResults(null);
    };

    const handleIdentifyLocationItem = async () => {
        if (!newLocationImage) {
            toast.error("Please select a photo first.");
            return;
        }

        setIdentifying(true);
        try {
            const result = await identifyLocationFromImage(newLocationImage);

            if (result.identified_species.length === 0) {
                toast.warning("No species identified.");
                return;
            }

            setModalIdentifyResults(
                result.identified_species.map((identified) => ({
                    species: identified.scientific_name || "Unknown",
                    commonName: identified.common_name || "No common name",
                    score: identified.score.toString(),
                    images: identified.images || [],
                })),
            );
        } catch (error) {
            toast.error((error as Error).message || "Failed to identify species.");
        } finally {
            setIdentifying(false);
        }
    };

    const handleSelectIdentifiedItem = (species: string, commonName: string) => {
        const nextItemName =
            commonName && commonName !== "No common name" && commonName !== "Unknown" ? commonName : species;
        setNewLocation((prev) => ({
            ...prev,
            item_name: nextItemName,
        }));
        setModalIdentifyResults(null);
        toast.success(`Item set to "${nextItemName}".`);
    };

    const handleCreateLocation = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to add locations.");
            return;
        }
        if (!newLocation.name.trim()) {
            toast.error("Location name is required.");
            return;
        }

        const latitude = newLocation.latitude.trim() === "" ? undefined : Number(newLocation.latitude);
        const longitude = newLocation.longitude.trim() === "" ? undefined : Number(newLocation.longitude);

        if (
            (latitude !== undefined && Number.isNaN(latitude)) ||
            (longitude !== undefined && Number.isNaN(longitude))
        ) {
            toast.error("Coordinates must be valid numbers.");
            return;
        }

        setSaving(true);
        try {
            const createdLocation = await createLocation({
                name: newLocation.name.trim(),
                item_name: newLocation.item_name.trim() || undefined,
                spot_type: newLocation.spot_type,
                latitude,
                longitude,
            });

            if (newLocationImage) {
                try {
                    const uploadResponse = await uploadLocationImage(createdLocation.id, newLocationImage);
                    if (uploadResponse.exif_latitude !== null && uploadResponse.exif_longitude !== null) {
                        toast.success(
                            "Location created and image uploaded. Coordinates extracted from photo metadata.",
                        );
                    } else {
                        toast.success("Location created and image uploaded.");
                    }
                } catch (uploadError) {
                    toast.warning(`Location created, but image upload failed: ${(uploadError as Error).message}`);
                }
            } else {
                toast.success("Location created.");
            }

            resetModal();
            await loadLocations();
        } catch (error) {
            toast.error((error as Error).message || "Failed to create location.");
        } finally {
            setSaving(false);
        }
    };

    const handleUploadImage = async (locationId: number, file: File) => {
        try {
            const response = await uploadLocationImage(locationId, file);
            if (response.exif_latitude !== null && response.exif_longitude !== null) {
                toast.success("Image uploaded. Coordinates extracted from photo metadata.");
            } else {
                toast.success("Image uploaded.");
            }
            await loadLocations();
        } catch (error) {
            toast.error((error as Error).message || "Failed to upload image.");
        }
    };

    const getLatestImage = (location: Location) => {
        if (!location.images.length) {
            return null;
        }
        return [...location.images].sort(
            (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
        )[0];
    };

    const getLocationImageAsFile = async (imagePath: string, locationId: number) => {
        const response = await fetch(`/api/uploads/${imagePath}?size=original`);
        if (!response.ok) {
            throw new Error("Failed to load location image for identification.");
        }
        const imageBlob = await response.blob();
        return new File([imageBlob], `location-${locationId}.jpg`, { type: imageBlob.type || "image/jpeg" });
    };

    const handleIdentifyExistingLocation = async (location: Location) => {
        const latestImage = getLatestImage(location);

        if (!latestImage) {
            toast.warning("Upload at least one image before identifying.");
            return;
        }

        setIdentifyingLocationId(location.id);
        try {
            const identifyFile = await getLocationImageAsFile(latestImage.image_path, location.id);
            const result = await identifyLocationFromImage(identifyFile);

            if (result.identified_species.length === 0) {
                toast.warning("No species identified.");
                return;
            }

            setLocationIdentifyResults({
                locationId: location.id,
                results: result.identified_species.map((identified) => ({
                    species: identified.scientific_name || "Unknown",
                    commonName: identified.common_name || "No common name",
                    score: identified.score.toString(),
                    images: identified.images || [],
                })),
            });
        } catch (error) {
            toast.error((error as Error).message || "Failed to identify location.");
        } finally {
            setIdentifyingLocationId(null);
        }
    };

    const handleSelectIdentifiedLocationItem = async (locationId: number, commonName: string, species: string) => {
        const nextItemName =
            commonName && commonName !== "No common name" && commonName !== "Unknown" ? commonName : species;

        try {
            const updatedLocation = await updateLocation(locationId, { item_name: nextItemName });
            setLocations((prev) => prev.map((location) => (location.id === locationId ? updatedLocation : location)));
            toast.success(`Crop/Herb updated to "${nextItemName}".`);
        } catch (error) {
            toast.error((error as Error).message || "Failed to update location item.");
        } finally {
            setLocationIdentifyResults(null);
        }
    };

    return (
        <div
            className={`container plants-container locations-container${isStretched ? " locations-container--stretched" : ""}`}
        >
            <div className="locations-header">
                <h1>Locations</h1>
                <button
                    className="toggle-stretch-btn"
                    title={isStretched ? "Collapse container" : "Expand container"}
                    onClick={() => setIsStretched(!isStretched)}
                >
                    <FontAwesomeIcon icon={isStretched ? faCompress : faExpand} />
                </button>
                {isLoggedIn ? (
                    <button className="add-location-btn" onClick={() => setModalOpen(true)}>
                        <FontAwesomeIcon icon={faPlus} />
                    </button>
                ) : (
                    <button
                        className="add-location-btn"
                        onClick={() => toast.warning("You must be logged in to add locations.")}
                    >
                        <FontAwesomeIcon icon={faPlus} />
                    </button>
                )}
            </div>

            {modalOpen && (
                <div className="add-location-modal" onClick={resetModal}>
                    <div className="add-location-modal-content" onClick={(event) => event.stopPropagation()}>
                        <span className="close" onClick={resetModal}>
                            &times;
                        </span>
                        <h2>Add Location</h2>
                        <input
                            type="text"
                            placeholder="Location name"
                            value={newLocation.name}
                            onChange={(e) => setNewLocation((prev) => ({ ...prev, name: e.target.value }))}
                        />
                        <input
                            type="text"
                            placeholder="Crop / Herb / Fruit (optional)"
                            value={newLocation.item_name}
                            onChange={(e) => setNewLocation((prev) => ({ ...prev, item_name: e.target.value }))}
                        />
                        <div className="location-select-grid">
                            <select
                                value={newLocation.spot_type}
                                onChange={(e) =>
                                    setNewLocation((prev) => ({ ...prev, spot_type: e.target.value as SpotType }))
                                }
                            >
                                {Object.entries(spotTypeLabels).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <input type="file" accept="image/*" onChange={handleModalFileChange} />
                        {newLocationImage && (
                            <button
                                className="location-identify-button"
                                onClick={handleIdentifyLocationItem}
                                disabled={identifying || saving}
                            >
                                <FontAwesomeIcon icon={faFingerprint} />{" "}
                                {identifying ? "Identifying..." : "Identify Item"}
                            </button>
                        )}
                        {modalIdentifyResults && (
                            <ul className="location-identify-results-list">
                                {[...modalIdentifyResults]
                                    .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
                                    .map((result, index) => (
                                        <li
                                            key={`${result.species}-${index}`}
                                            className="location-identify-item"
                                            onClick={() =>
                                                handleSelectIdentifiedItem(result.species, result.commonName)
                                            }
                                        >
                                            <strong>{result.species}</strong> | {result.commonName} (
                                            {parseFloat(result.score).toFixed(2)}%)
                                        </li>
                                    ))}
                            </ul>
                        )}
                        <div className="location-coord-grid">
                            <input
                                type="text"
                                placeholder="Latitude (optional)"
                                value={newLocation.latitude}
                                onChange={(e) => setNewLocation((prev) => ({ ...prev, latitude: e.target.value }))}
                            />
                            <input
                                type="text"
                                placeholder="Longitude (optional)"
                                value={newLocation.longitude}
                                onChange={(e) => setNewLocation((prev) => ({ ...prev, longitude: e.target.value }))}
                            />
                        </div>
                        <button onClick={handleCreateLocation} disabled={saving}>
                            {saving ? "Saving..." : "Create"}
                        </button>
                    </div>
                </div>
            )}

            <div className="location-filter-sort-bar">
                <div className="location-tag-filter">
                    <span
                        className={`hashtag ${selectedSpotType === "all" ? "active" : ""}`}
                        onClick={() => setSelectedSpotType("all")}
                    >
                        #all
                    </span>
                </div>

                <div className="location-search-container">
                    <input
                        type="text"
                        placeholder="Search locations..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        className="location-search-input"
                    />
                </div>

                <div className="location-sort-container">
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value as LocationSortOption)}>
                        <option value="updatedDesc">Updated (newest)</option>
                        <option value="updatedAsc">Updated (oldest)</option>
                        <option value="createdDesc">Created (newest)</option>
                        <option value="createdAsc">Created (oldest)</option>
                        <option value="nameAsc">Name (A-Z)</option>
                        <option value="nameDesc">Name (Z-A)</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="locations-empty">Loading locations...</div>
            ) : filteredLocations.length === 0 ? (
                <div className="locations-empty">
                    {locations.length === 0
                        ? "No locations yet. Add your first one with the + button."
                        : "No locations match the current filters."}
                </div>
            ) : (
                <div className="locations-list">
                    {filteredLocations.map((location) => {
                        const hasCoordinates = location.latitude !== null && location.longitude !== null;
                        const latestImage = getLatestImage(location);
                        const coverImage = latestImage
                            ? `/api/uploads/${latestImage.image_path}?size=thumb`
                            : "/placeholder-plant.webp";

                        return (
                            <article className="location-card" key={location.id}>
                                <Link to={`/location/${location.id}`} className="location-card-main-link">
                                    <div className="location-image-container">
                                        <img
                                            src={coverImage}
                                            alt={location.name}
                                            className="location-image"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="location-card-text">
                                        <h3>{location.name}</h3>
                                        <p className="location-card-id">#{location.id}</p>
                                        <p>
                                            <strong>Area:</strong> {spotTypeLabels[location.spot_type]}
                                        </p>
                                        {location.item_name ? (
                                            <p>
                                                <strong>Crop / Herb:</strong> {location.item_name}
                                            </p>
                                        ) : null}

                                        {hasCoordinates && (
                                            <div className="location-map-wrap">
                                                <StaticLeafletMap
                                                    latitude={location.latitude as number}
                                                    longitude={location.longitude as number}
                                                    className="location-map-frame"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </Link>
                                <div className="location-buttons">
                                    {isLoggedIn ? (
                                        <>
                                            <label className="upload-location-btn">
                                                <FontAwesomeIcon icon={faUpload} />
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const selected = e.target.files?.[0];
                                                        if (selected) {
                                                            handleUploadImage(location.id, selected);
                                                        }
                                                        e.currentTarget.value = "";
                                                    }}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                className="identify-location-btn"
                                                onClick={() => handleIdentifyExistingLocation(location)}
                                                disabled={identifyingLocationId === location.id}
                                                title="Identify crop/herb from latest image"
                                            >
                                                <FontAwesomeIcon icon={faFingerprint} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                className="upload-location-btn"
                                                onClick={() => toast.warning("You must be logged in to upload images.")}
                                            >
                                                <FontAwesomeIcon icon={faUpload} />
                                            </button>
                                            <button
                                                className="identify-location-btn"
                                                onClick={() =>
                                                    toast.warning("You must be logged in to identify locations.")
                                                }
                                            >
                                                <FontAwesomeIcon icon={faFingerprint} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {locationIdentifyResults && (
                <IdentifyResults
                    plantId={locationIdentifyResults.locationId}
                    results={locationIdentifyResults.results}
                    onSelectSpecies={handleSelectIdentifiedLocationItem}
                    onClose={() => setLocationIdentifyResults(null)}
                />
            )}
        </div>
    );
}
