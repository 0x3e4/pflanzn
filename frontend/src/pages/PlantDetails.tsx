import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    fetchSinglePlant,
    deletePlant,
    updatePlant,
    generatePlantDescription,
    waterPlant,
    fertilizePlant,
    identifyPlant,
    uploadPlantImage,
    assignTagToPlant,
    removeTagFromPlant,
    archivePlant,
    generateCareAdvice,
    fetchPlantActivities,
    createPlantNote,
    fetchPlantNotes,
} from "../services/PlantService";
import { fetchTags, deleteTag } from "../services/TagService";
import { fetchWeatherConfigs, WeatherConfig } from "../services/WeatherService";
import { Plant } from "../types/Plant";
import { Tag } from "../types/Tag";
import TimelineImages from "../components/TimelineImages";
import Description from "../components/Description";
import Calendar from "../components/Calendar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faTrash,
    faWandMagicSparkles,
    faDroplet,
    faFingerprint,
    faCircleXmark,
    faUpload,
    faBoxArchive,
    faTrashCanArrowUp,
    faCamera,
    faStickyNote,
    faSeedling,
    faPlus,
} from "@fortawesome/free-solid-svg-icons";
import EditableDiv from "../components/EditableDiv";
import "../styles/plantDetails.css";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import LoadingOverlay from "../components/LoadingOverlay";
import IdentifyResults from "../components/IdentifyResults";
import { useAuth } from "../context/AuthContext";
import { setOverlayOpen } from "../services/overlayControl";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

type ActionLoadingState = {
    title: string;
    message: string;
    details?: string[];
} | null;

export default function PlantDetails() {
    const { isLoggedIn } = useAuth();
    const { plantId } = useParams();
    const navigate = useNavigate();
    const [plant, setPlant] = useState<Plant | null>(null);
    const [loadingPlant, setLoadingPlant] = useState(true);
    const [weatherConfigs, setWeatherConfigs] = useState<WeatherConfig[]>([]);
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
    const [newTag, setNewTag] = useState("");
    const [showTagDropdown, setShowTagDropdown] = useState(false);
    const [selectedDateTime, setSelectedDateTime] = useState<string>(
        DateTime.now()
            .setZone(import.meta.env.VITE_TZ)
            .toISO({ includeOffset: false }) ?? "",
    );
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [identifyResults, setIdentifyResults] = useState<
        { species: string; commonName: string; score: string; images: string[] }[] | null
    >(null);
    const [archiveModalOpen, setArchiveModalOpen] = useState(false);
    const [archiveReason, setArchiveReason] = useState("");
    const [isArchiving, setIsArchiving] = useState(true);
    const [toastVisible, setToastVisible] = useState(false);
    const [activities, setActivities] = useState<any[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [notesModalOpen, setNotesModalOpen] = useState(false);
    const [notes, setNotes] = useState<any[]>([]);
    const [newNote, setNewNote] = useState("");
    const [careAdviceModalOpen, setCareAdviceModalOpen] = useState(false);
    const [careAdviceMessage, setCareAdviceMessage] = useState("");
    const [actionLoading, setActionLoading] = useState<ActionLoadingState>(null);

    // Fetch plant and activites data on load
    useEffect(() => {
        if (plantId) {
            loadPlant();
            loadActivities();
        }
        loadAvailableTags();
        fetchWeatherConfigs().then(setWeatherConfigs).catch(() => {});
    }, [plantId]);

    const loadPlant = async () => {
        try {
            const data = await fetchSinglePlant(Number(plantId));
            setPlant(data);
        } catch (error) {
            toast.error((error as Error).message || "Failed to load plant.");
            navigate("/plants"); // fallback if plant doesn't exist
        } finally {
            setLoadingPlant(false);
        }
    };

    const handleUploadImageForPlant = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!plantId) return;

        if (!isLoggedIn) {
            toast.error("You must be logged in to add images to plants.");
            return;
        }

        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const currentDateTimeUTC = DateTime.now().toUTC().toISO({ includeOffset: false });
            await uploadPlantImage(Number(plantId), file, currentDateTimeUTC);
            toast.success("Image uploaded!");
            await loadPlant();

            // Always refresh activity feed
            loadActivities();
        } catch (err) {
            toast.error((err as Error).message || "Failed to upload the image.");
        }
    };

    const handleArchivePlant = async () => {
        if (!plant) return;

        if (!isLoggedIn) {
            toast.error("You must be logged in to archive or restore plants.");
            return;
        }

        try {
            await archivePlant(plant.id, isArchiving, archiveReason);
            toast.success(isArchiving ? "Plant archived!" : "Plant restored!");
            navigate("/plants");
        } catch (err) {
            toast.error(`Failed to ${isArchiving ? "archive" : "restore"} plant.`);
        }
    };

    const handleIdentifyPlant = async () => {
        if (!plantId) return;

        if (!isLoggedIn) {
            toast.error("You must be logged in to identify plants.");
            return;
        }

        setLoadingPlant(true);

        try {
            const result = await identifyPlant(Number(plantId));

            if (result.identified_species.length === 0) {
                toast.warning("No species found.");
                return;
            }

            setIdentifyResults(
                result.identified_species.map((r: any) => ({
                    species: r.scientific_name || "Unknown",
                    commonName: r.common_name || "No common name",
                    score: r.score.toString(),
                    images: r.images,
                })),
            );
        } catch (error) {
            toast.error((error as Error).message || "Failed to identify plant.");
        } finally {
            setLoadingPlant(false);
        }
    };

    // Handle updating plant (name/species/description/etc.)
    const handleUpdate = async (updatedFields: Partial<Plant>) => {
        if (!plant || !plantId) return;

        if (!isLoggedIn) {
            toast.error("You must be logged in to update plants.");
            return;
        }

        const hasChanges = Object.keys(updatedFields).some((key) => {
            const fieldKey = key as keyof Plant;
            return plant[fieldKey] !== updatedFields[fieldKey];
        });

        if (!hasChanges) return;

        try {
            const updated = await updatePlant(Number(plantId), updatedFields);
            setPlant(updated);
            toast.success("Plant updated successfully!");
        } catch (err) {
            toast.error((err as Error).message);
        }
    };

    // Handle delete plant via confirmation modal
    const handleConfirmDelete = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to delete plants.");
            return;
        }

        try {
            await deletePlant(Number(plantId));
            toast.success("Plant deleted successfully!");
            navigate("/plants");
        } catch (error) {
            toast.error((error as Error).message || "Failed to delete plant.");
        } finally {
            setDeleteModalOpen(false);
        }
    };

    // Water the plant (log watering date)
    const handleWaterPlant = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to water plants.");
            return;
        }

        try {
            const wateringDateTimeUTC = DateTime.fromISO(selectedDateTime, { zone: import.meta.env.VITE_TZ })
                .toUTC()
                .toISO({ includeOffset: false });

            const newWatering = await waterPlant(Number(plantId), { watered_at: wateringDateTimeUTC });

            // Update plant state directly instead of reloading everything
            if (plant) {
                setPlant({
                    ...plant,
                    last_watered: new Date(wateringDateTimeUTC),
                    waterings: [...(plant.waterings || []), newWatering],
                });
            }

            toast.success("Watering logged successfully!");

            // Always refresh activity feed
            loadActivities();
        } catch (error) {
            toast.error((error as Error).message || "Failed to log watering.");
        }
    };

    const handleFertilizePlant = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to fertilize plants.");
            return;
        }

        try {
            const fertilizingDateTimeUTC = DateTime.fromISO(selectedDateTime, { zone: import.meta.env.VITE_TZ })
                .toUTC()
                .toISO({ includeOffset: false });

            const newFertilizing = await fertilizePlant(Number(plantId), {
                fertilized_at: fertilizingDateTimeUTC,
            });

            if (plant) {
                setPlant({
                    ...plant,
                    last_fertilized: new Date(fertilizingDateTimeUTC),
                    fertilizings: [...(plant.fertilizings || []), newFertilizing],
                });
            }

            toast.success("Fertilizing logged successfully!");
            loadActivities();
        } catch (error) {
            toast.error((error as Error).message || "Failed to log fertilizing.");
        }
    };

    // Generate AI description
    const handleGenerateDescription = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to update plants.");
            return;
        }

        setActionLoading({
            title: "Generating AI Description",
            message: "Analyzing your plant details to produce a better description.",
            details: [
                "Checking existing plant data and context",
                "Generating text with the configured AI provider",
                "Saving the new description to this plant",
            ],
        });

        try {
            const { description } = await generatePlantDescription(Number(plantId));
            await handleUpdate({ description });
        } catch (error) {
            toast.error((error as Error).message || "Failed to generate description.");
        } finally {
            setActionLoading(null);
        }
    };

    // Open care advice modal
    const handleOpenCareAdviceModal = () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to receive care tips.");
            return;
        }
        setCareAdviceModalOpen(true);
    };

    // Generate AI Care Helper
    const handleGenerateCareAdvice = async () => {
        setToastVisible(true);
        setCareAdviceModalOpen(false);
        setActionLoading({
            title: "Generating AI Care Advice",
            message: "Reviewing recent plant state and preparing actionable care guidance.",
            details: [
                "Evaluating your optional symptom message",
                "Generating advice based on plant context",
                "Saving advice to activity history",
            ],
        });

        try {
            const careAdviceEntry = await generateCareAdvice(Number(plantId), careAdviceMessage.trim() || undefined);

            if (plant) {
                setPlant({
                    ...plant,
                    care_advice: [careAdviceEntry, ...(plant.care_advice || [])],
                });
            }

            toast.info(careAdviceEntry.advice_text, {
                position: "top-center",
                autoClose: false,
                closeOnClick: true,
                className: "care-advice-toast",
                style: {
                    width: "min(860px, calc(100vw - 2rem))",
                    maxWidth: "min(860px, calc(100vw - 2rem))",
                },
                onClose: () => setToastVisible(false),
            });

            toast.success("Care advice saved to your plant's history!");

            // Clear the message for next time
            setCareAdviceMessage("");

            // Always refresh activity feed
            loadActivities();
        } catch (error) {
            toast.error((error as Error).message || "Failed to generate care advice.");
            setToastVisible(false);
        } finally {
            setActionLoading(null);
        }
    };

    const loadAvailableTags = async () => {
        try {
            const tags = await fetchTags();
            if (!Array.isArray(tags)) {
                console.error("Error: fetchTags() did not return an array!", tags);
                return;
            }
            setAvailableTags([...tags]);
        } catch (error) {
            toast.error("Failed to load tags.");
        }
    };

    const handleAddTag = async (tagName: string) => {
        if (!plant || !tagName.trim()) return;
        if (!isLoggedIn) {
            toast.error("You must be logged in to manage tags.");
            return;
        }

        if (tagName === "archive") {
            toast.warning("Using archive as tag is not allowed.");
            return;
        }

        try {
            const updatedPlant = await assignTagToPlant(plant.id, tagName.trim());
            setPlant(updatedPlant);
            setNewTag("");
            setShowTagDropdown(false);

            // Refetch all tags to include the new one
            const updatedTags = await fetchTags();
            setAvailableTags(updatedTags);

            toast.success(`Tag "${tagName}" added!`);
        } catch (error) {
            toast.error((error as Error).message || "Failed to add tag.");
        }
    };

    const handleRemoveTag = async (tagId: number) => {
        if (!plant) return;
        if (!isLoggedIn) {
            toast.error("You must be logged in to manage tags.");
            return;
        }

        try {
            const updatedPlant = await removeTagFromPlant(plant.id, tagId);
            setPlant(updatedPlant);
            toast.success("Tag removed!");
        } catch (error) {
            toast.error((error as Error).message || "Failed to remove tag.");
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        setNewTag(input);
        setShowTagDropdown(input.length > 0);

        if (input.length > 0) {
            // Filter available tags based on input
            const filtered = availableTags
                .filter((tag) => tag.name.toLowerCase().includes(input.toLowerCase()))
                .slice(0, 5);
            setFilteredTags(filtered);
        } else {
            setFilteredTags([]);
        }
    };

    const handleTagClick = (tagName: string) => {
        handleAddTag(tagName);
    };

    const handleDeleteTag = async (tagId: number) => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to delete tags.");
            return;
        }

        try {
            await deleteTag(tagId);
            setAvailableTags((prevTags) => prevTags.filter((tag) => tag.id !== tagId));
            setFilteredTags((prevTags) => prevTags.filter((tag) => tag.id !== tagId));
            toast.success("Tag deleted successfully!");
        } catch (error) {
            toast.error("Failed to delete tag.");
        }
    };

    const loadActivities = async () => {
        if (!plantId) return;

        setLoadingActivities(true);
        try {
            const data = await fetchPlantActivities(Number(plantId), { limit: 20 });
            setActivities(data);
        } catch (error) {
            toast.error("Failed to load activity log.");
        } finally {
            setLoadingActivities(false);
        }
    };

    const loadNotes = async () => {
        if (!plantId) return;

        try {
            const data = await fetchPlantNotes(Number(plantId), { limit: 10 });
            setNotes(data);
        } catch (error) {
            toast.error("Failed to load notes.");
        }
    };

    const handleCreateNote = async () => {
        if (!plantId || !newNote.trim()) return;

        if (!isLoggedIn) {
            toast.error("You must be logged in to create notes.");
            return;
        }

        try {
            const note = await createPlantNote(Number(plantId), newNote.trim());
            setNotes([note, ...notes]);
            setPlant((p) => (p ? { ...p, notes: [note, ...(p.notes || [])] } : p));
            setNewNote("");
            toast.success("Note created!");

            // Always refresh activity feed
            loadActivities();
        } catch (error) {
            toast.error("Failed to create note.");
        }
    };

    const getActivityIcon = (activityType: string) => {
        switch (activityType) {
            case "watering":
                return faDroplet;
            case "fertilizing":
                return faSeedling;
            case "care_advice":
                return faWandMagicSparkles;
            case "image_upload":
                return faCamera;
            case "note":
                return faStickyNote;
            default:
                return faStickyNote;
        }
    };

    const getActivityTitle = (activity: any) => {
        switch (activity.activity_type) {
            case "watering":
                return "Watered";
            case "fertilizing":
                return "Fertilized";
            case "care_advice":
                return "Care Advice";
            case "image_upload":
                return "Image";
            case "note":
                return "Note";
            default:
                return "Activity";
        }
    };

    const getActivityDescription = (activity: any) => {
        const userName = activity.activity_data?.user_name || "";

        switch (activity.activity_type) {
            case "watering":
                if (activity.activity_data?.is_auto_watered) {
                    const zone = activity.activity_data.weather_zone;
                    const threshold = activity.activity_data.rainfall_threshold_mm;
                    return `Plant was watered due to rain${threshold ? ` (≥${threshold}mm` : ""}${zone ? `, ${zone})` : threshold ? ")" : ""}`;
                }
                return `Plant was watered${userName ? ` by ${userName}` : ""}`;
            case "fertilizing":
                return `Plant was fertilized${userName ? ` by ${userName}` : ""}`;
            case "care_advice":
                return `${activity.activity_data?.advice || "Care advice was generated"}${
                    userName ? ` by ${userName}` : ""
                }`;
            case "image_upload":
                return `New photo was uploaded${userName ? ` by ${userName}` : ""}`;
            case "note":
                return `${activity.activity_data?.note || "A new note was added"}${userName ? ` by ${userName}` : ""}`;
            default:
                return "";
        }
    };

    const handleOpenNotesModal = () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to manage notes.");
            return;
        }
        setNotesModalOpen(true);
        loadNotes();
    };

    const hasBlockingOverlay = Boolean(
        identifyResults ||
        deleteModalOpen ||
        archiveModalOpen ||
        notesModalOpen ||
        careAdviceModalOpen ||
        actionLoading,
    );

    useEffect(() => {
        setOverlayOpen(hasBlockingOverlay);
    }, [hasBlockingOverlay]);

    useEffect(() => {
        return () => {
            setOverlayOpen(false);
        };
    }, []);

    useEffect(() => {
        document.body.classList.toggle("modal-open", hasBlockingOverlay);
        return () => {
            document.body.classList.remove("modal-open");
        };
    }, [hasBlockingOverlay]);

    const ActivityFeedSection = () => (
        <div className="activity-log-container">
            <div className="activity-log-header">
                <h3>Activity Feed</h3>
                <button className="notes-btn" onClick={handleOpenNotesModal} title="Manage Notes">
                    <FontAwesomeIcon icon={faStickyNote} />
                </button>
            </div>

            <div className="activity-log-list">
                {loadingActivities ? (
                    // Skeleton loading
                    <>
                        {[...Array(3)].map((_, index) => (
                            <div key={index} className="activity-item activity-skeleton">
                                <div className="activity-icon skeleton"></div>
                                <div className="activity-content">
                                    <div className="skeleton-header">
                                        <div className="skeleton-line skeleton-title"></div>
                                        <div className="skeleton-line skeleton-timestamp"></div>
                                    </div>
                                    <div className="skeleton-line skeleton-description"></div>
                                </div>
                            </div>
                        ))}
                    </>
                ) : activities.length === 0 ? (
                    <div className="activity-log-empty">No activities yet</div>
                ) : (
                    activities.map((activity) => (
                        <div key={activity.id} className="activity-item">
                            <div className={`activity-icon ${activity.activity_type}`}>
                                <FontAwesomeIcon icon={getActivityIcon(activity.activity_type)} size="sm" />
                            </div>
                            <div className="activity-content">
                                <div className="activity-header">
                                    <p className="activity-title">{getActivityTitle(activity)}</p>
                                    <p className="activity-timestamp">
                                        {new Date(activity.timestamp).toLocaleString(import.meta.env.VITE_LOCALE, {
                                            timeZone: import.meta.env.VITE_TZ,
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </p>
                                </div>
                                <p className="activity-description">{getActivityDescription(activity)}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    if (loadingPlant) {
        return (
            <div className="container plant-details-container">
                <div className="plant-columns">
                    <div className="plant-left-column">
                        <div className="plant-information">
                            <h2>
                                <Skeleton width="80%" />
                            </h2>
                            <small>
                                <Skeleton width={48} />
                            </small>
                            <span className="plant-information-names">
                                <Skeleton width="90%" />
                            </span>
                            <span className="plant-information-names">
                                <Skeleton width="95%" />
                            </span>
                        </div>
                        <div style={{ marginTop: "1rem" }}>
                            <Skeleton height={320} />
                        </div>
                        <div style={{ marginTop: "1rem" }}>
                            <Skeleton height={280} />
                        </div>
                    </div>
                    <div className="plant-right-column">
                        <div style={{ marginBottom: "1rem" }}>
                            <Skeleton height={42} />
                        </div>
                        <div style={{ marginBottom: "1.5rem" }}>
                            <Skeleton height={180} />
                        </div>
                        <div>
                            <Skeleton height={260} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!plant) return;

    return (
        <div className="container plant-details-container">
            {actionLoading && (
                <LoadingOverlay
                    title={actionLoading.title}
                    message={actionLoading.message}
                    details={actionLoading.details}
                />
            )}
            {toastVisible && <div className="toast-blur-overlay" />}
            <div className="plant-columns">
                {/* Left Column - Plant Info + Images + Watering Log */}
                <div className="plant-left-column">
                    <div className="plant-information">
                        <h2>
                            {isLoggedIn ? (
                                <>
                                    <span
                                        className="editable-input"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleUpdate({ name: e.target.innerText })}
                                        tabIndex={0}
                                    >
                                        {plant.name || "Unnamed Plant"}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span
                                        className="editable-input-noauth"
                                        suppressContentEditableWarning
                                        onClick={() => toast.warning("You must be logged in to update plants.")}
                                        tabIndex={0}
                                    >
                                        {plant.species || "Unknown"}
                                    </span>
                                </>
                            )}
                        </h2>
                        <small>#{plant.id}</small>
                        <span className="plant-information-names">
                            <strong>Species:</strong>{" "}
                            {isLoggedIn ? (
                                <>
                                    <span
                                        className="editable-input"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleUpdate({ species: e.target.innerText })}
                                        tabIndex={0}
                                    >
                                        {plant.species || "Unknown"}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span
                                        className="editable-input-noauth"
                                        suppressContentEditableWarning
                                        onClick={() => toast.warning("You must be logged in to update plants.")}
                                        tabIndex={0}
                                    >
                                        {plant.species || "Unknown"}
                                    </span>
                                </>
                            )}
                        </span>
                        <span className="plant-information-names">
                            <strong>Last Watered:</strong>{" "}
                            {plant.last_watered
                                ? new Date(plant.last_watered).toLocaleString(import.meta.env.VITE_LOCALE, {
                                      timeZone: import.meta.env.VITE_TZ,
                                      weekday: "long",
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                  })
                                : "Not watered yet"}
                        </span>
                    </div>

                    <TimelineImages images={plant.images} plantId={plant.id} />
                    <Calendar
                        waterings={plant.waterings}
                        fertilizings={plant.fertilizings}
                        images={plant.images}
                        careadvice={plant.care_advice}
                        notes={plant.notes}
                        plantId={plant.id}
                        onChanged={() => {
                            loadPlant();
                            loadActivities();
                        }}
                    />

                    {!plant.is_archived && (
                        <div className="plant-outdoor-section">
                            <h4>Environment</h4>
                            <label className="plant-toggle-row">
                                <input
                                    type="checkbox"
                                    checked={plant.is_outdoor}
                                    onChange={async (e) => {
                                        const val = e.target.checked;
                                        const updates: Record<string, boolean> = { is_outdoor: val };
                                        if (!val) updates.reaches_rain = false;
                                        await updatePlant(Number(plantId), updates);
                                        let tagged: Plant = { ...plant, ...updates };
                                        if (val) {
                                            tagged = { ...(await assignTagToPlant(plant.id, "outdoor")), ...updates };
                                        } else {
                                            const outdoorTag = plant.tags.find((t: { name: string }) => t.name === "outdoor");
                                            if (outdoorTag) tagged = { ...(await removeTagFromPlant(plant.id, outdoorTag.id)), ...updates };
                                            const rainTag = tagged.tags?.find((t: { name: string }) => t.name === "rain");
                                            if (rainTag) tagged = { ...(await removeTagFromPlant(plant.id, rainTag.id)), ...updates };
                                        }
                                        setPlant(tagged);
                                    }}
                                    disabled={!isLoggedIn}
                                />
                                <span>Outdoor Plant</span>
                            </label>
                            {plant.is_outdoor && (
                                <label className="plant-toggle-row">
                                    <input
                                        type="checkbox"
                                        checked={plant.reaches_rain}
                                        onChange={async (e) => {
                                            const val = e.target.checked;
                                            await updatePlant(Number(plantId), { reaches_rain: val });
                                            let tagged: Plant;
                                            if (val) {
                                                tagged = await assignTagToPlant(plant.id, "rain");
                                            } else {
                                                const rainTag = plant.tags.find((t: { name: string }) => t.name === "rain");
                                                tagged = rainTag ? await removeTagFromPlant(plant.id, rainTag.id) : plant;
                                            }
                                            setPlant({ ...tagged, is_outdoor: plant.is_outdoor, reaches_rain: val });
                                        }}
                                        disabled={!isLoggedIn}
                                    />
                                    <span>Reaches Rain</span>
                                </label>
                            )}
                            {plant.is_outdoor && plant.reaches_rain && weatherConfigs.length > 0 && (
                                <div className="plant-weather-zone">
                                    <label>Weather Zone</label>
                                    <select
                                        value={plant.weather_config_id ?? weatherConfigs[0]?.id ?? ""}
                                        onChange={async (e) => {
                                            const val = e.target.value ? Number(e.target.value) : null;
                                            await updatePlant(Number(plantId), { weather_config_id: val });
                                            setPlant({ ...plant, weather_config_id: val });
                                        }}
                                        disabled={!isLoggedIn}
                                    >
                                        {weatherConfigs.map((wc, i) => (
                                            <option key={wc.id} value={wc.id}>
                                                {wc.city_name || `Location ${wc.id}`}{i === 0 ? " (default)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column - Description */}
                <div className="plant-right-column">
                    {/* Tags Section */}
                    <div className="tags-container">
                        {plant.tags.map((tag) => (
                            <span key={tag.id} className="tag">
                                #{tag.name}
                                {isLoggedIn && (
                                    <FontAwesomeIcon
                                        icon={faTrash}
                                        className="tag-delete-icon"
                                        onClick={() => handleRemoveTag(tag.id)}
                                    />
                                )}
                            </span>
                        ))}

                        {isLoggedIn && (
                            <div className="tag-input-wrapper">
                                <input
                                    type="text"
                                    className="tag-input"
                                    placeholder="Add tag..."
                                    value={newTag}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => e.key === "Enter" && handleAddTag(newTag)}
                                    onBlur={() => setShowTagDropdown(false)}
                                />
                                {showTagDropdown && filteredTags.length > 0 && (
                                    <div className="tag-dropdown">
                                        {filteredTags.map((tag) => {
                                            // Check if the tag is used in any plant
                                            const isTagUsed = plant?.tags.some((usedTag) => usedTag.id === tag.id);

                                            return (
                                                <div key={tag.id} className="tag-dropdown-item">
                                                    <span onMouseDown={() => handleTagClick(tag.name)}>
                                                        #{tag.name}
                                                    </span>

                                                    {isLoggedIn && (
                                                        <FontAwesomeIcon
                                                            icon={faTrash}
                                                            className={`tag-delete-icon ${isTagUsed ? "disabled" : ""}`}
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();

                                                                if (isTagUsed) {
                                                                    toast.warning(
                                                                        `"${tag.name}" is assigned to a plant and cannot be deleted.`,
                                                                    );
                                                                    setNewTag("");
                                                                } else {
                                                                    handleDeleteTag(tag.id);
                                                                }
                                                            }}
                                                            title={
                                                                isTagUsed
                                                                    ? "This tag is used and cannot be deleted"
                                                                    : "Delete tag"
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <Description plant={plant} onDescriptionUpdated={setPlant} />

                    <ActivityFeedSection />

                    {plant.is_archived && plant.archive_reason && (
                        <div className="archive-reason-box mt-5">
                            <h3>Archive Reason</h3>
                            <span>{plant.archive_reason}</span>
                        </div>
                    )}
                </div>
            </div>

            <hr />

            {/* Bottom Controls */}
            <div className="plant-below-column">
                <div className="plant-global-button-section">
                    <div className="plant-global-button-left">
                        {!plant.is_archived && (
                            <>
                                <div className="water-plant-input-container">
                                    {isLoggedIn ? (
                                        <>
                                            <button className="water-plant-btn" onClick={handleWaterPlant}>
                                                <FontAwesomeIcon icon={faDroplet} /> Water Plant
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="water-plant-btn"
                                            onClick={() => toast.warning("You must be logged in to water plants.")}
                                        >
                                            <FontAwesomeIcon icon={faDroplet} /> Water Plant
                                        </button>
                                    )}
                                    <div className="water-plant-datetime">
                                        <input
                                            type="datetime-local"
                                            value={selectedDateTime.slice(0, 16)}
                                            onChange={(e) => setSelectedDateTime(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {isLoggedIn ? (
                                    <button className="fertilize-plant-btn" onClick={handleFertilizePlant}>
                                        <FontAwesomeIcon icon={faSeedling} /> Fertilize
                                    </button>
                                ) : (
                                    <button
                                        className="fertilize-plant-btn"
                                        onClick={() =>
                                            toast.warning("You must be logged in to fertilize plants.")
                                        }
                                    >
                                        <FontAwesomeIcon icon={faSeedling} /> Fertilize
                                    </button>
                                )}

                                {isLoggedIn ? (
                                    <>
                                        <input
                                            type="file"
                                            id={`file-upload-${plant.id}`}
                                            className="file-input"
                                            onChange={(e) => handleUploadImageForPlant(e)}
                                        />
                                        <button
                                            className="file-input-plant-btn"
                                            onClick={() => document.getElementById(`file-upload-${plant.id}`)?.click()}
                                        >
                                            <FontAwesomeIcon icon={faUpload} /> Upload Image
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="file-input-plant-btn"
                                        onClick={() => toast.warning("You must be logged in to upload images.")}
                                    >
                                        <FontAwesomeIcon icon={faUpload} /> Upload Image
                                    </button>
                                )}

                                {isLoggedIn ? (
                                    <>
                                        <button className="identify-plant-btn" onClick={handleIdentifyPlant}>
                                            <FontAwesomeIcon icon={faFingerprint} /> Identify Plant
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="identify-plant-btn"
                                        onClick={() => toast.warning("You must be logged in to identify images.")}
                                    >
                                        <FontAwesomeIcon icon={faFingerprint} /> Identify Plant
                                    </button>
                                )}

                                {import.meta.env.VITE_LLM_PROVIDER && (
                                    <>
                                        {isLoggedIn ? (
                                            <>
                                                <button
                                                    className="ai-care-helper-btn"
                                                    onClick={handleOpenCareAdviceModal}
                                                >
                                                    <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Care Helper
                                                </button>

                                                <button
                                                    className="generate-description-btn"
                                                    onClick={handleGenerateDescription}
                                                >
                                                    <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Description
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    className="ai-care-helper-btn"
                                                    onClick={handleOpenCareAdviceModal}
                                                >
                                                    <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Care Helper
                                                </button>

                                                <button
                                                    className="generate-description-btn"
                                                    onClick={() =>
                                                        toast.warning(
                                                            "You must be logged in to generate a description with AI.",
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Description
                                                </button>
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    <div className="plant-global-button-right">
                        {isLoggedIn ? (
                            <>
                                <button
                                    className="archive-plant-btn"
                                    onClick={() => {
                                        setIsArchiving(!plant.is_archived);
                                        setArchiveModalOpen(true);
                                    }}
                                >
                                    <FontAwesomeIcon icon={plant.is_archived ? faTrashCanArrowUp : faBoxArchive} />
                                    {plant.is_archived ? " Restore Plant" : " Archive Plant"}
                                </button>
                                <button className="delete-plant-btn" onClick={() => setDeleteModalOpen(true)}>
                                    <FontAwesomeIcon icon={faTrash} /> Delete Plant
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className="archive-plant-btn"
                                    onClick={() => {
                                        setIsArchiving(!plant.is_archived);
                                        toast.warning(
                                            `You must be logged in to ${plant.is_archived ? "restore" : "archive"} plants.`,
                                        );
                                    }}
                                >
                                    <FontAwesomeIcon icon={plant.is_archived ? faTrashCanArrowUp : faBoxArchive} />
                                    {plant.is_archived ? " Restore Plant" : " Archive Plant"}
                                </button>
                                <button
                                    className="delete-plant-btn"
                                    onClick={() => toast.warning("You must be logged in to delete plants.")}
                                >
                                    <FontAwesomeIcon icon={faTrash} /> Delete Plant
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {identifyResults && (
                <IdentifyResults
                    plantId={Number(plantId)}
                    results={identifyResults}
                    onSelectSpecies={(plantId, name, species) => {
                        updatePlant(plantId, { name, species });
                        setIdentifyResults(null);
                        loadPlant();
                        toast.success(`Plant updated to ${name} (${species})`);
                    }}
                    onClose={() => setIdentifyResults(null)}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="delete-plant-modal-overlay">
                    <div className="delete-plant-modal">
                        <div className="delete-modal-header">
                            <span>Are you sure you want to delete this plant?</span>
                        </div>
                        <div className="delete-plant-modal-buttons">
                            <button className="delete-plant-confirm" onClick={handleConfirmDelete}>
                                <FontAwesomeIcon icon={faTrash} /> Delete
                            </button>
                            <button className="delete-plant-cancel" onClick={() => setDeleteModalOpen(false)}>
                                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Archive Confirmation Modal */}
            {archiveModalOpen && (
                <div className="archive-plant-modal-overlay">
                    <div className="archive-plant-modal">
                        <div className="archive-modal-header">
                            <span>
                                {isArchiving
                                    ? "Are you sure you want to archive this plant?"
                                    : "Are you sure you want to restore this plant?"}
                            </span>
                        </div>

                        {isArchiving && (
                            <EditableDiv
                                value={archiveReason}
                                onSave={setArchiveReason}
                                placeholder="e.g. Dead, moved, donated, etc."
                                className="archive-reason"
                            />
                        )}

                        <div className="archive-plant-modal-buttons">
                            <button className="archive-plant-confirm" onClick={handleArchivePlant}>
                                <FontAwesomeIcon icon={isArchiving ? faBoxArchive : faTrashCanArrowUp} />{" "}
                                {isArchiving ? "Archive" : "Restore"}
                            </button>
                            <button className="archive-plant-cancel" onClick={() => setArchiveModalOpen(false)}>
                                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes Modal */}
            {notesModalOpen && (
                <div className="notes-modal-overlay">
                    <div className="notes-modal">
                        <div className="notes-modal-header">
                            <span>Write a note about the plant</span>
                        </div>

                        <div className="note-input-container">
                            <EditableDiv
                                value={newNote}
                                onChange={setNewNote}
                                onSave={setNewNote}
                                placeholder="Add a note about your plant..."
                                className="note-input"
                            />
                            <div className="note-actions">
                                <button className="save-note-btn" onClick={handleCreateNote} disabled={!newNote.trim()}>
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

            {/* Care Advice Modal */}
            {careAdviceModalOpen && (
                <div className="notes-modal-overlay">
                    <div className="notes-modal">
                        <div className="notes-modal-header">
                            <span>AI Care Helper</span>
                        </div>

                        <div className="note-input-container">
                            <p style={{ marginBottom: "1rem", color: "#666", fontSize: "0.9rem" }}>
                                Describe what you're observing with your plant (optional):
                            </p>
                            <textarea
                                value={careAdviceMessage}
                                onChange={(e) => setCareAdviceMessage(e.target.value)}
                                placeholder="e.g., my plant is losing a lot of leaves, the leaves are turning yellow..."
                                className="note-input"
                                rows={4}
                                style={{
                                    width: "100%",
                                    padding: "0.75rem",
                                    borderRadius: "8px",
                                    border: "1px solid #ddd",
                                    fontFamily: "inherit",
                                    fontSize: "0.95rem",
                                    resize: "vertical",
                                }}
                            />
                            <div className="note-actions">
                                <button className="save-note-btn" onClick={handleGenerateCareAdvice}>
                                    <FontAwesomeIcon icon={faWandMagicSparkles} /> Get AI Advice
                                </button>
                                <button className="notes-modal-close" onClick={() => setCareAdviceModalOpen(false)}>
                                    <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
