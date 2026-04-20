import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBoxArchive,
    faCamera,
    faCircleXmark,
    faFingerprint,
    faLocationCrosshairs,
    faPlus,
    faSeedling,
    faStickyNote,
    faTrash,
    faUpload,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { setOverlayOpen } from "../services/overlayControl";
import EditableDiv from "../components/EditableDiv";
import IdentifyResults from "../components/IdentifyResults";
import LoadingOverlay from "../components/LoadingOverlay";
import LocationTimelineImages from "../components/LocationTimelineImages";
import StaticLeafletMap from "../components/StaticLeafletMap";
import LocationCalendar, { LocationLocalNote, LocationSeasonEvent } from "../components/LocationCalendar";
import {
    deleteLocation,
    fetchLocations,
    fetchSingleLocation,
    generateLocationDescription,
    identifyLocationFromImage,
    updateLocation,
    uploadLocationImage,
} from "../services/LocationService";
import { Location, LocationUpdateInput, SpotType } from "../types/Location";
import "../styles/locationDetails.css";

type LocationIdentifyResult = { species: string; commonName: string; score: string; images: string[] };
type ActionLoadingState = {
    title: string;
    message: string;
    details?: string[];
} | null;

const spotTypeLabels: Record<SpotType, string> = {
    field: "Field",
    public_spot: "Public Spot",
    forest: "Forest",
    meadow: "Meadow",
    other: "Other",
};

const normalizeSpotType = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
const toHashtag = (value: string) =>
    `#${value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")}`;

const resolveSpotType = (value: string): SpotType | null => {
    const normalized = normalizeSpotType(value);
    for (const [spotType, label] of Object.entries(spotTypeLabels)) {
        if (normalizeSpotType(spotType) === normalized || normalizeSpotType(label) === normalized) {
            return spotType as SpotType;
        }
    }
    return null;
};

const formatCoordinate = (value: number | null) => (value === null ? "" : value.toFixed(6));

const readStorage = <T,>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return fallback;
        }
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

const writeStorage = (key: string, value: unknown) => {
    localStorage.setItem(key, JSON.stringify(value));
};

const toLocalDateTimeInputValue = (date: Date) => {
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export default function LocationDetails() {
    const { locationId } = useParams();
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();

    const [location, setLocation] = useState<Location | null>(null);
    const [allLocations, setAllLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [identifying, setIdentifying] = useState(false);
    const [identifyResults, setIdentifyResults] = useState<LocationIdentifyResult[] | null>(null);
    const [customTags, setCustomTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState("");
    const [showTagDropdown, setShowTagDropdown] = useState(false);
    const [filteredTags, setFilteredTags] = useState<string[]>([]);
    const [localNotes, setLocalNotes] = useState<LocationLocalNote[]>([]);
    const [localSeasonEvents, setLocalSeasonEvents] = useState<LocationSeasonEvent[]>([]);
    const [newNote, setNewNote] = useState("");
    const [seasonEventDateTime, setSeasonEventDateTime] = useState(() => toLocalDateTimeInputValue(new Date()));
    const [notesModalOpen, setNotesModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [generatingDescription, setGeneratingDescription] = useState(false);
    const [actionLoading, setActionLoading] = useState<ActionLoadingState>(null);
    const [gpsLoading, setGpsLoading] = useState(false);

    const sortedImages = useMemo(() => {
        if (!location?.images.length) {
            return [];
        }
        return [...location.images].sort(
            (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
        );
    }, [location]);

    const latestImage = sortedImages[0] || null;

    const { locale, tz: timezone, llmProvider } = useConfig();

    const mapLocations = useMemo(() => {
        const byId = new Map<number, Location>();

        allLocations.forEach((entry) => {
            if (entry.latitude !== null && entry.longitude !== null) {
                byId.set(entry.id, entry);
            }
        });

        if (location && location.latitude !== null && location.longitude !== null) {
            byId.set(location.id, location);
        }

        return [...byId.values()];
    }, [allLocations, location]);

    const mapCenterLocation = useMemo(() => {
        if (location && location.latitude !== null && location.longitude !== null) {
            return location;
        }
        return mapLocations[0] || null;
    }, [location, mapLocations]);

    const mapMarkers = useMemo(
        () =>
            mapLocations.map((entry) => {
                const isCurrent = location?.id === entry.id;
                const tooltip = entry.item_name ? `${entry.name} - ${entry.item_name}` : entry.name;

                return {
                    id: entry.id,
                    latitude: entry.latitude as number,
                    longitude: entry.longitude as number,
                    tooltipText: tooltip,
                    color: isCurrent ? "#2e6a31" : "#5f5f5f",
                    fillColor: isCurrent ? "#4caf50" : "#9a9a9a",
                    radius: isCurrent ? 8 : 6,
                    onClick: () => {
                        if (!isCurrent) {
                            navigate(`/location/${entry.id}`);
                        }
                    },
                };
            }),
        [mapLocations, location?.id, navigate],
    );

    const derivedTags = useMemo(() => {
        if (!location) {
            return [];
        }
        const tags = [toHashtag(spotTypeLabels[location.spot_type]), toHashtag(location.visibility)];
        if (location.item_name) {
            tags.push(toHashtag(location.item_name));
        }
        return [...new Set(tags.filter((tag) => tag !== "#"))];
    }, [location]);

    const allTags = useMemo(() => {
        const custom = customTags.map((tag) => toHashtag(tag));
        return [...derivedTags, ...custom.filter((tag) => !derivedTags.includes(tag))];
    }, [derivedTags, customTags]);

    const allKnownTagNames = useMemo(() => {
        const tagPool = new Set<string>();
        derivedTags.forEach((tag) => tagPool.add(tag.replace(/^#/, "").toLowerCase()));
        customTags.forEach((tag) => tagPool.add(tag.trim().toLowerCase()));

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key || !key.startsWith("location_tags_")) {
                continue;
            }
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || "[]");
                if (Array.isArray(parsed)) {
                    parsed.forEach((entry) => {
                        const value = String(entry || "")
                            .trim()
                            .toLowerCase()
                            .replace(/^#+/, "");
                        if (value) {
                            tagPool.add(value);
                        }
                    });
                }
            } catch {
                // Ignore malformed legacy entries.
            }
        }

        return [...tagPool];
    }, [customTags, derivedTags]);

    const activityEvents = useMemo(() => {
        if (!location) {
            return [];
        }

        const imageEvents = location.images.map((image) => ({
            id: `image-${image.id}`,
            type: "image" as const,
            title: "Image",
            description: "New photo uploaded",
            timestamp: image.uploaded_at,
        }));

        const noteEvents = localNotes.map((note) => ({
            id: `note-${note.id}`,
            type: "note" as const,
            title: "Note",
            description: note.text,
            timestamp: note.created_at,
        }));

        const seasonEvents = localSeasonEvents.map((event) => ({
            id: `season-${event.id}`,
            type: "season" as const,
            title: "Season",
            description: event.title,
            timestamp: event.occurred_at,
        }));

        return [...imageEvents, ...noteEvents, ...seasonEvents].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
    }, [localNotes, localSeasonEvents, location]);

    const loadLocation = async () => {
        const parsedId = Number(locationId);
        if (!Number.isFinite(parsedId)) {
            navigate("/locations");
            return;
        }

        setLoading(true);
        try {
            const data = await fetchSingleLocation(parsedId);
            setLocation(data);
        } catch (error) {
            toast.error((error as Error).message || "Failed to load location.");
            navigate("/locations");
        } finally {
            setLoading(false);
        }
    };

    const loadLocationsForMap = async () => {
        try {
            const data = await fetchLocations();
            setAllLocations(data);
        } catch (error) {
            console.error("Failed to load locations for map markers:", error);
        }
    };

    useEffect(() => {
        loadLocation();
        loadLocationsForMap();
    }, [locationId]);

    useEffect(() => {
        if (!location) {
            return;
        }
        const tagsKey = `location_tags_${location.id}`;
        const notesKey = `location_notes_${location.id}`;
        const seasonKey = `location_season_events_${location.id}`;
        setCustomTags(readStorage<string[]>(tagsKey, []));
        setLocalNotes(readStorage<LocationLocalNote[]>(notesKey, []));
        setLocalSeasonEvents(readStorage<LocationSeasonEvent[]>(seasonKey, []));
        setSeasonEventDateTime(toLocalDateTimeInputValue(new Date()));
    }, [location?.id]);

    const hasBlockingOverlay = Boolean(identifyResults || notesModalOpen || deleteModalOpen || actionLoading);

    useEffect(() => {
        setOverlayOpen(hasBlockingOverlay);
        document.body.classList.toggle("modal-open", hasBlockingOverlay);
        return () => {
            setOverlayOpen(false);
            document.body.classList.remove("modal-open");
        };
    }, [hasBlockingOverlay]);

    const persistCustomTags = (updater: (prev: string[]) => string[]) => {
        if (!location) {
            return;
        }
        setCustomTags((prev) => {
            const next = updater(prev);
            writeStorage(`location_tags_${location.id}`, next);
            return next;
        });
    };

    const persistNotes = (updater: (prev: LocationLocalNote[]) => LocationLocalNote[]) => {
        if (!location) {
            return;
        }
        setLocalNotes((prev) => {
            const next = updater(prev);
            writeStorage(`location_notes_${location.id}`, next);
            return next;
        });
    };

    const persistSeasonEvents = (updater: (prev: LocationSeasonEvent[]) => LocationSeasonEvent[]) => {
        if (!location) {
            return;
        }
        setLocalSeasonEvents((prev) => {
            const next = updater(prev);
            writeStorage(`location_season_events_${location.id}`, next);
            return next;
        });
    };

    const patchLocation = async (changes: LocationUpdateInput): Promise<boolean> => {
        if (!location) {
            return false;
        }
        if (!isLoggedIn) {
            toast.warning("You must be logged in to update locations.");
            return false;
        }

        try {
            const updatedLocation = await updateLocation(location.id, changes);
            setLocation(updatedLocation);
            setAllLocations((prev) => prev.map((entry) => (entry.id === updatedLocation.id ? updatedLocation : entry)));
            return true;
        } catch (error) {
            toast.error((error as Error).message || "Failed to update location.");
            await loadLocation();
            return false;
        }
    };

    const handleLocationNameBlur = async (value: string, el: HTMLSpanElement) => {
        if (!location) {
            return;
        }
        const nextValue = value.trim();
        if (!nextValue) {
            toast.warning("Location name cannot be empty.");
            el.innerText = location.name;
            return;
        }

        if (nextValue !== location.name) {
            await patchLocation({ name: nextValue });
        }
    };

    const handleSpotTypeBlur = async (value: string, el: HTMLSpanElement) => {
        if (!location) {
            return;
        }

        const resolved = resolveSpotType(value);
        if (!resolved) {
            toast.warning("Invalid area type. Use Field, Public Spot, Forest, Meadow, or Other.");
            el.innerText = spotTypeLabels[location.spot_type];
            return;
        }

        if (resolved !== location.spot_type) {
            await patchLocation({ spot_type: resolved });
        }
    };

    const handleItemNameBlur = async (value: string, el: HTMLSpanElement) => {
        if (!location) {
            return;
        }

        const nextValue = value.trim() || null;
        const currentValue = location.item_name || null;
        if (nextValue !== currentValue) {
            await patchLocation({ item_name: nextValue });
        } else if (!nextValue) {
            el.innerText = "";
        }
    };

    const handleCoordinateBlur = async (field: "latitude" | "longitude", value: string, el: HTMLSpanElement) => {
        if (!location) {
            return;
        }

        const nextValueText = value.trim();
        if (!nextValueText) {
            if (location[field] !== null) {
                await patchLocation({ [field]: null });
            } else {
                el.innerText = "";
            }
            return;
        }

        const numeric = Number(nextValueText);
        if (Number.isNaN(numeric)) {
            toast.warning(`${field === "latitude" ? "Latitude" : "Longitude"} must be a valid number.`);
            el.innerText = formatCoordinate(location[field]);
            return;
        }

        if (location[field] === null || Math.abs(location[field] - numeric) > Number.EPSILON) {
            await patchLocation({ [field]: numeric });
        }
    };

    const fillFromGps = () => {
        if (!location) return;
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser.");
            return;
        }
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                await patchLocation({
                    latitude: Number(pos.coords.latitude.toFixed(6)),
                    longitude: Number(pos.coords.longitude.toFixed(6)),
                });
                setGpsLoading(false);
                toast.success("Location updated from GPS.");
            },
            (err) => {
                toast.error("Could not get location: " + err.message);
                setGpsLoading(false);
            },
        );
    };

    const handleDescriptionSave = async (value: string) => {
        if (!location) {
            return;
        }

        const normalized = value.trim() || null;
        const current = location.description || null;
        if (normalized !== current) {
            await patchLocation({ description: normalized });
        }
    };

    const handleUploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
        if (!location) {
            return;
        }
        if (!isLoggedIn) {
            toast.warning("You must be logged in to upload location images.");
            return;
        }

        const input = event.currentTarget;
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            const response = await uploadLocationImage(location.id, file);
            if (response.exif_latitude !== null && response.exif_longitude !== null) {
                toast.success("Image uploaded. Coordinates extracted from photo metadata.");
            } else {
                toast.success("Image uploaded.");
            }
            await loadLocation();
        } catch (error) {
            toast.error((error as Error).message || "Failed to upload image.");
        } finally {
            input.value = "";
        }
    };

    const handleIdentifyFromLatestImage = async () => {
        if (!location) {
            return;
        }
        if (!isLoggedIn) {
            toast.warning("You must be logged in to identify locations.");
            return;
        }
        if (!latestImage) {
            toast.warning("Upload an image first.");
            return;
        }

        setIdentifying(true);
        try {
            const imageResponse = await fetch(`/api/uploads/${latestImage.image_path}?size=original`);
            if (!imageResponse.ok) {
                throw new Error("Failed to load location image for identification.");
            }

            const imageBlob = await imageResponse.blob();
            const identifyFile = new File([imageBlob], `location-${location.id}.jpg`, {
                type: imageBlob.type || "image/jpeg",
            });
            const result = await identifyLocationFromImage(identifyFile);

            if (result.identified_species.length === 0) {
                toast.warning("No species identified.");
                return;
            }

            setIdentifyResults(
                result.identified_species.map((identified) => ({
                    species: identified.scientific_name || "Unknown",
                    commonName: identified.common_name || "No common name",
                    score: identified.score.toString(),
                    images: identified.images || [],
                })),
            );
        } catch (error) {
            toast.error((error as Error).message || "Failed to identify location.");
        } finally {
            setIdentifying(false);
        }
    };

    const handleSelectIdentifiedItem = async (_locationId: number, commonName: string, species: string) => {
        if (!location) {
            return;
        }
        const nextItemName =
            commonName && commonName !== "No common name" && commonName !== "Unknown" ? commonName : species;

        const updated = await patchLocation({ item_name: nextItemName });
        if (updated) {
            toast.success(`Harvest focus updated to "${nextItemName}".`);
            setIdentifyResults(null);
        }
    };

    const handleGenerateLocationDescription = async () => {
        if (!location) {
            return;
        }
        if (!isLoggedIn) {
            toast.warning("You must be logged in to generate an AI description.");
            return;
        }

        setGeneratingDescription(true);
        setActionLoading({
            title: "Generating AI Description",
            message: "Building a seasonal location summary focused on planting and harvest timing.",
            details: [
                "Collecting location context (area type, crop/herb, coordinates)",
                "Generating seasonal recommendations with the configured AI provider",
                "Saving the generated description to this location",
            ],
        });
        try {
            const { description } = await generateLocationDescription(location.id);
            setLocation((prev) => (prev ? { ...prev, description } : prev));
            toast.success("AI description generated.");
        } catch (error) {
            toast.error((error as Error).message || "Failed to generate location description.");
        } finally {
            setActionLoading(null);
            setGeneratingDescription(false);
        }
    };

    const addCustomTag = () => {
        if (!location) {
            return;
        }
        if (!isLoggedIn) {
            toast.warning("You must be logged in to edit hashtags.");
            return;
        }
        const next = newTag.trim().replace(/^#+/, "");
        if (!next) {
            return;
        }

        const exists = [...customTags, ...derivedTags.map((tag) => tag.replace(/^#/, ""))].some(
            (tag) => tag.toLowerCase() === next.toLowerCase(),
        );
        if (exists) {
            setNewTag("");
            setShowTagDropdown(false);
            return;
        }

        persistCustomTags((prev) => [...prev, next]);
        setNewTag("");
        setShowTagDropdown(false);
    };

    const handleTagInputChange = (value: string) => {
        setNewTag(value);
        const normalized = value.trim().toLowerCase().replace(/^#+/, "");

        if (!normalized) {
            setFilteredTags([]);
            setShowTagDropdown(false);
            return;
        }

        const used = new Set(allTags.map((tag) => tag.replace(/^#/, "").toLowerCase()));
        const nextFiltered = allKnownTagNames.filter((tag) => tag.includes(normalized) && !used.has(tag)).slice(0, 6);

        setFilteredTags(nextFiltered);
        setShowTagDropdown(nextFiltered.length > 0);
    };

    const handleTagSuggestionClick = (tagName: string) => {
        setNewTag(tagName);
        setShowTagDropdown(false);
        setFilteredTags([]);
        persistCustomTags((prev) => {
            const exists = [...prev, ...derivedTags.map((tag) => tag.replace(/^#/, ""))].some(
                (tag) => tag.toLowerCase() === tagName.toLowerCase(),
            );
            if (exists) {
                return prev;
            }
            return [...prev, tagName];
        });
        setNewTag("");
    };

    const handleDeleteKnownTag = (tagName: string) => {
        if (!isLoggedIn) {
            toast.warning("You must be logged in to edit hashtags.");
            return;
        }

        const normalized = tagName.trim().toLowerCase().replace(/^#+/, "");
        if (!normalized) {
            return;
        }

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key || !key.startsWith("location_tags_")) {
                continue;
            }
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || "[]");
                if (!Array.isArray(parsed)) {
                    continue;
                }
                const next = parsed.filter(
                    (entry) =>
                        String(entry || "")
                            .trim()
                            .toLowerCase()
                            .replace(/^#+/, "") !== normalized,
                );
                writeStorage(key, next);
            } catch {
                // Ignore malformed legacy entries.
            }
        }

        persistCustomTags((prev) => prev.filter((entry) => entry.trim().toLowerCase() !== normalized));
        setFilteredTags((prev) => prev.filter((entry) => entry.toLowerCase() !== normalized));
        toast.success(`#${normalized} deleted.`);
    };

    const removeCustomTag = (tag: string) => {
        if (!isLoggedIn) {
            toast.warning("You must be logged in to edit hashtags.");
            return;
        }
        persistCustomTags((prev) => prev.filter((item) => item !== tag));
    };

    const addLocalNote = () => {
        if (!location) {
            return;
        }
        if (!isLoggedIn) {
            toast.warning("You must be logged in to add notes.");
            return;
        }
        const text = newNote.trim();
        if (!text) {
            return;
        }
        const next: LocationLocalNote = {
            id: crypto.randomUUID(),
            text,
            created_at: new Date().toISOString(),
        };
        persistNotes((prev) => [next, ...prev]);
        setNewNote("");
        setNotesModalOpen(false);
    };

    const addSeasonEvent = () => {
        if (!location) {
            return;
        }
        if (!isLoggedIn) {
            toast.warning("You must be logged in to add season events.");
            return;
        }

        const parsedDate = new Date(seasonEventDateTime);
        if (Number.isNaN(parsedDate.getTime())) {
            toast.warning("Please choose a valid date and time.");
            return;
        }

        const nextEvent: LocationSeasonEvent = {
            id: crypto.randomUUID(),
            title: "Harvest time",
            occurred_at: parsedDate.toISOString(),
            created_at: new Date().toISOString(),
        };

        persistSeasonEvents((prev) => [nextEvent, ...prev]);
        toast.success("Season event added.");
    };

    const removeLocalNote = (noteId: string) => {
        persistNotes((prev) => prev.filter((note) => note.id !== noteId));
    };

    const removeLocalSeasonEvent = (eventId: string) => {
        persistSeasonEvents((prev) => prev.filter((event) => event.id !== eventId));
    };

    const handleOpenNotesModal = () => {
        if (!isLoggedIn) {
            toast.warning("You must be logged in to manage notes.");
            return;
        }
        setNotesModalOpen(true);
    };

    const handleConfirmDeleteLocation = async () => {
        if (!location) {
            return;
        }
        if (!isLoggedIn) {
            toast.warning("You must be logged in to delete locations.");
            return;
        }

        try {
            await deleteLocation(location.id);
            toast.success("Location deleted successfully!");
            navigate("/locations");
        } catch (error) {
            toast.error((error as Error).message || "Failed to delete location.");
        } finally {
            setDeleteModalOpen(false);
        }
    };

    if (loading) {
        return (
            <div className="container location-details-page">
                <div className="location-details-empty">Loading location...</div>
            </div>
        );
    }

    if (!location) {
        return null;
    }

    return (
        <div className="container location-details-page">
            {actionLoading && (
                <LoadingOverlay
                    title={actionLoading.title}
                    message={actionLoading.message}
                    details={actionLoading.details}
                />
            )}

            <div className="location-columns">
                <div className="location-left-column">
                    <div className="location-information plant-information">
                        <h2>
                            {isLoggedIn ? (
                                <span
                                    className="editable-input location-inline-editable"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(event) =>
                                        handleLocationNameBlur(event.currentTarget.innerText, event.currentTarget)
                                    }
                                    tabIndex={0}
                                >
                                    {location.name}
                                </span>
                            ) : (
                                <span className="editable-input-noauth">{location.name}</span>
                            )}
                        </h2>
                        <small>#{location.id}</small>

                        <span className="location-information-names plant-information-names">
                            <strong>Area:</strong>{" "}
                            {isLoggedIn ? (
                                <span
                                    className="editable-input location-inline-editable"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(event) =>
                                        handleSpotTypeBlur(event.currentTarget.innerText, event.currentTarget)
                                    }
                                    tabIndex={0}
                                >
                                    {spotTypeLabels[location.spot_type]}
                                </span>
                            ) : (
                                <span className="editable-input-noauth">{spotTypeLabels[location.spot_type]}</span>
                            )}
                        </span>

                        <span className="location-information-names plant-information-names">
                            <strong>Crop / Herb / Fruit:</strong>{" "}
                            {isLoggedIn ? (
                                <span
                                    className="editable-input location-inline-editable"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(event) =>
                                        handleItemNameBlur(event.currentTarget.innerText, event.currentTarget)
                                    }
                                    tabIndex={0}
                                    data-placeholder="Set crop or herb"
                                >
                                    {location.item_name || ""}
                                </span>
                            ) : (
                                <span className="editable-input-noauth">{location.item_name || "Not set"}</span>
                            )}
                        </span>

                        <span className="location-information-names plant-information-names">
                            <strong>Latitude:</strong>{" "}
                            {isLoggedIn ? (
                                <span
                                    className="editable-input location-inline-editable"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(event) =>
                                        handleCoordinateBlur(
                                            "latitude",
                                            event.currentTarget.innerText,
                                            event.currentTarget,
                                        )
                                    }
                                    tabIndex={0}
                                    data-placeholder="Set latitude"
                                >
                                    {formatCoordinate(location.latitude)}
                                </span>
                            ) : (
                                <span className="editable-input-noauth">
                                    {formatCoordinate(location.latitude) || "Not set"}
                                </span>
                            )}
                        </span>

                        <span className="location-information-names plant-information-names">
                            <strong>Longitude:</strong>{" "}
                            {isLoggedIn ? (
                                <span
                                    className="editable-input location-inline-editable"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(event) =>
                                        handleCoordinateBlur(
                                            "longitude",
                                            event.currentTarget.innerText,
                                            event.currentTarget,
                                        )
                                    }
                                    tabIndex={0}
                                    data-placeholder="Set longitude"
                                >
                                    {formatCoordinate(location.longitude)}
                                </span>
                            ) : (
                                <span className="editable-input-noauth">
                                    {formatCoordinate(location.longitude) || "Not set"}
                                </span>
                            )}
                        </span>

                        {isLoggedIn && (
                            <button
                                className="gps-btn gps-btn-inline"
                                onClick={fillFromGps}
                                disabled={gpsLoading}
                                title="Use my location"
                            >
                                <FontAwesomeIcon icon={faLocationCrosshairs} spin={gpsLoading} /> Use my location
                            </button>
                        )}
                    </div>

                    <LocationTimelineImages
                        locationId={location.id}
                        images={location.images}
                        onChanged={loadLocation}
                    />
                    <LocationCalendar
                        locationId={location.id}
                        images={location.images}
                        notes={localNotes}
                        seasonEvents={localSeasonEvents}
                        onDeleteNote={removeLocalNote}
                        onDeleteSeasonEvent={removeLocalSeasonEvent}
                        onChanged={loadLocation}
                    />
                </div>

                <div className="location-right-column">
                    <div className="location-tags-container location-tags-container--top">
                        {allTags.map((tag) => {
                            const raw = tag.replace(/^#/, "");
                            const isCustom = customTags.some((item) => item.toLowerCase() === raw.toLowerCase());
                            return (
                                <span key={tag} className="location-tag">
                                    {tag}
                                    {isLoggedIn && isCustom && (
                                        <FontAwesomeIcon
                                            icon={faTrash}
                                            className="location-tag-delete-icon"
                                            onClick={() => removeCustomTag(raw)}
                                        />
                                    )}
                                </span>
                            );
                        })}
                        <div className="location-tag-input-wrapper">
                            <input
                                type="text"
                                className="location-tag-input"
                                placeholder="Add tag..."
                                value={newTag}
                                onChange={(event) => handleTagInputChange(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        addCustomTag();
                                    }
                                }}
                                onBlur={() => {
                                    setTimeout(() => setShowTagDropdown(false), 120);
                                }}
                            />
                            {showTagDropdown && filteredTags.length > 0 && (
                                <div className="location-tag-dropdown">
                                    {filteredTags.map((tag) => {
                                        const isTagUsed = allTags.some(
                                            (existingTag) =>
                                                existingTag.replace(/^#/, "").toLowerCase() === tag.toLowerCase(),
                                        );

                                        return (
                                            <div
                                                key={tag}
                                                className={`location-tag-dropdown-item${isTagUsed ? " disabled" : ""}`}
                                            >
                                                <span onMouseDown={() => handleTagSuggestionClick(tag)}>#{tag}</span>
                                                {isLoggedIn && (
                                                    <FontAwesomeIcon
                                                        icon={faTrash}
                                                        className={`location-tag-delete-icon ${isTagUsed ? "disabled" : ""}`}
                                                        onMouseDown={(event) => {
                                                            event.stopPropagation();
                                                            if (isTagUsed) {
                                                                toast.warning(
                                                                    `"${tag}" is used on this location and cannot be deleted.`,
                                                                );
                                                                setNewTag("");
                                                                return;
                                                            }
                                                            handleDeleteKnownTag(tag);
                                                        }}
                                                        title={
                                                            isTagUsed ? "Tag is in use on this location" : "Delete tag"
                                                        }
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="location-description-container">
                        <h3>Description</h3>
                        <EditableDiv
                            value={location.description || ""}
                            onSave={handleDescriptionSave}
                            editable={isLoggedIn}
                            placeholder="No description found."
                            className={isLoggedIn ? "location-description-editable" : "editable-div-noauth"}
                        />
                    </div>

                    <div className="location-map-panel">
                        {mapCenterLocation ? (
                            <div className="location-map-canvas-wrap">
                                <StaticLeafletMap
                                    latitude={mapCenterLocation.latitude as number}
                                    longitude={mapCenterLocation.longitude as number}
                                    zoom={15}
                                    className="location-map-canvas"
                                    interactive
                                    markers={mapMarkers}
                                    fitToMarkers
                                />
                            </div>
                        ) : (
                            <div className="location-details-empty">No coordinates set yet.</div>
                        )}
                    </div>

                    <div className="location-activity-log-container">
                        <div className="activity-log-header">
                            <h3>Activity Feed</h3>
                            <button className="notes-btn" onClick={handleOpenNotesModal} title="Manage Notes">
                                <FontAwesomeIcon icon={faStickyNote} />
                            </button>
                        </div>
                        <div className="location-activity-log-list">
                            {activityEvents.length === 0 ? (
                                <div className="location-details-empty">No activities yet.</div>
                            ) : (
                                activityEvents.map((activity) => (
                                    <div key={activity.id} className="location-activity-item">
                                        <div className={`location-activity-icon ${activity.type}`}>
                                            <FontAwesomeIcon
                                                icon={
                                                    activity.type === "image"
                                                        ? faCamera
                                                        : activity.type === "note"
                                                          ? faStickyNote
                                                          : faSeedling
                                                }
                                                size="sm"
                                            />
                                        </div>
                                        <div className="location-activity-content">
                                            <div className="location-activity-header">
                                                <p className="location-activity-title">{activity.title}</p>
                                                <p className="location-activity-timestamp">
                                                    {new Date(activity.timestamp).toLocaleString(locale, {
                                                        timeZone: timezone,
                                                        weekday: "short",
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>
                                            <p className="location-activity-description">{activity.description}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <hr />

            <div className="location-below-column">
                <div className="location-global-button-section">
                    <div className="location-global-button-left">
                        {isLoggedIn ? (
                            <>
                                <div className="season-event-input-container">
                                    <button className="season-event-btn" onClick={addSeasonEvent}>
                                        <FontAwesomeIcon icon={faSeedling} /> Add Harvest Time
                                    </button>
                                    <div className="season-event-datetime">
                                        <input
                                            type="datetime-local"
                                            value={seasonEventDateTime}
                                            onChange={(event) => setSeasonEventDateTime(event.target.value)}
                                        />
                                    </div>
                                </div>

                                <input
                                    type="file"
                                    id={`file-upload-location-${location.id}`}
                                    className="file-input"
                                    accept="image/*"
                                    onChange={handleUploadImage}
                                />
                                <button
                                    className="file-input-location-btn"
                                    onClick={() =>
                                        document.getElementById(`file-upload-location-${location.id}`)?.click()
                                    }
                                >
                                    <FontAwesomeIcon icon={faUpload} /> Upload Image
                                </button>

                                <button
                                    className="identify-location-btn-bottom"
                                    onClick={handleIdentifyFromLatestImage}
                                    disabled={identifying}
                                >
                                    <FontAwesomeIcon icon={faFingerprint} />{" "}
                                    {identifying ? "Identifying..." : "Identify Crop/Herb"}
                                </button>

                                {llmProvider && (
                                    <button
                                        className="generate-location-description-btn"
                                        onClick={handleGenerateLocationDescription}
                                        disabled={generatingDescription}
                                    >
                                        <FontAwesomeIcon icon={faWandMagicSparkles} />{" "}
                                        {generatingDescription ? "Generating..." : "AI Description"}
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="season-event-input-container">
                                    <button
                                        className="season-event-btn"
                                        onClick={() => toast.warning("You must be logged in to add season events.")}
                                    >
                                        <FontAwesomeIcon icon={faSeedling} /> Add Harvest Time
                                    </button>
                                    <div className="season-event-datetime">
                                        <input
                                            type="datetime-local"
                                            value={seasonEventDateTime}
                                            onChange={(event) => setSeasonEventDateTime(event.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    className="file-input-location-btn"
                                    onClick={() => toast.warning("You must be logged in to upload images.")}
                                >
                                    <FontAwesomeIcon icon={faUpload} /> Upload Image
                                </button>
                                <button
                                    className="identify-location-btn-bottom"
                                    onClick={() => toast.warning("You must be logged in to identify locations.")}
                                >
                                    <FontAwesomeIcon icon={faFingerprint} /> Identify Crop/Herb
                                </button>

                                {llmProvider && (
                                    <button
                                        className="generate-location-description-btn"
                                        onClick={() =>
                                            toast.warning("You must be logged in to generate an AI description.")
                                        }
                                    >
                                        <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Description
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="location-global-button-right">
                        {isLoggedIn ? (
                            <>
                                <button
                                    className="archive-location-btn"
                                    onClick={() => toast.info("Archive for locations is not wired to backend yet.")}
                                >
                                    <FontAwesomeIcon icon={faBoxArchive} /> Archive Location
                                </button>
                                <button className="delete-location-btn-bottom" onClick={() => setDeleteModalOpen(true)}>
                                    <FontAwesomeIcon icon={faTrash} /> Delete Location
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className="archive-location-btn"
                                    onClick={() => toast.warning("You must be logged in to archive locations.")}
                                >
                                    <FontAwesomeIcon icon={faBoxArchive} /> Archive Location
                                </button>
                                <button
                                    className="delete-location-btn-bottom"
                                    onClick={() => toast.warning("You must be logged in to delete locations.")}
                                >
                                    <FontAwesomeIcon icon={faTrash} /> Delete Location
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {identifyResults && (
                <IdentifyResults
                    plantId={location.id}
                    results={identifyResults}
                    onSelectSpecies={handleSelectIdentifiedItem}
                    onClose={() => setIdentifyResults(null)}
                />
            )}

            {notesModalOpen && (
                <div className="notes-modal-overlay">
                    <div className="notes-modal">
                        <div className="notes-modal-header">
                            <span>Write a note about the location</span>
                        </div>

                        <div className="note-input-container">
                            <EditableDiv
                                value={newNote}
                                onChange={setNewNote}
                                onSave={setNewNote}
                                placeholder="Add a note about this location..."
                                className="note-input"
                            />
                            <div className="note-actions">
                                <button className="save-note-btn" onClick={addLocalNote} disabled={!newNote.trim()}>
                                    <FontAwesomeIcon icon={faPlus} /> Add Note
                                </button>
                                <button className="notes-modal-close" onClick={() => setNotesModalOpen(false)}>
                                    <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {deleteModalOpen && (
                <div className="delete-plant-modal-overlay">
                    <div className="delete-plant-modal">
                        <div className="delete-modal-header">
                            <span>Are you sure you want to delete this location?</span>
                        </div>
                        <div className="delete-plant-modal-buttons">
                            <button className="delete-plant-confirm" onClick={handleConfirmDeleteLocation}>
                                <FontAwesomeIcon icon={faTrash} /> Delete
                            </button>
                            <button className="delete-plant-cancel" onClick={() => setDeleteModalOpen(false)}>
                                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
