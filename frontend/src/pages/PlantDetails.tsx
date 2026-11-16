import { useCallback, useEffect, useRef, useState } from "react";
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
    fetchPlantNetReference,
    fetchPlantActivities,
    createPlantNote,
    fetchPlantNotes,
    deletePlantNote,
    ActivityFilter,
    PlantNetReference,
} from "../services/PlantService";
import {
    ACTIVITY_FILTERS,
    feedTypesParam,
    readFeedTypes,
    storeFeedTypes,
    toggleFeedType,
} from "../services/activityFilter";
import { fetchTags, deleteTag } from "../services/TagService";
import { fetchWeatherConfigs, WeatherConfig } from "../services/WeatherService";
import { fetchFloorPlans } from "../services/FloorPlanService";
import { FloorPlan } from "../types/FloorPlan";
import { useShare } from "../context/ShareContext";
import { Plant } from "../types/Plant";
import { Tag } from "../types/Tag";
import TimelineImages from "../components/TimelineImages";
import LoginHint from "../components/LoginHint";
import { useModalA11y } from "../hooks/useModalA11y";
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
    faBell,
    faSeedling,
    faPlus,
    faMap,
    faLocationDot,
    faArrowUpRightFromSquare,
    faChevronDown,
    faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import EditableDiv from "../components/EditableDiv";
import "../styles/plantDetails.css";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import LoadingOverlay from "../components/LoadingOverlay";
import IdentifyResults from "../components/IdentifyResults";
import CareAdviceText from "../components/CareAdviceText";
import { useLlmProviderPicker } from "../components/LlmProviderPicker";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { setOverlayOpen } from "../services/overlayControl";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { formatWateringDue, getWateringStatus, wateringBadgeVariant } from "../services/wateringSchedule";
import "../styles/listView.css";

type ActionLoadingState = {
    title: string;
    message: string;
    details?: string[];
} | null;

// Activities per request (the API allows up to 50).
const ACTIVITY_PAGE = 20;

export default function PlantDetails() {
    const { isLoggedIn } = useAuth();
    const { tz: timezone, locale, llmProvider, identificationEnabled, floorPlansEnabled, authMode } = useConfig();
    const { choose: chooseLlmProvider, picker: llmPicker, providers: llmProviders } = useLlmProviderPicker();
    // The care advice dialog asks for the provider itself (a second dialog would be one too many).
    const [careAdviceProvider, setCareAdviceProvider] = useState("");
    const { isShareAccess } = useShare();
    const canSeePlans = floorPlansEnabled && !isShareAccess && (authMode === "no" || isLoggedIn);
    const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);

    useEffect(() => {
        if (!canSeePlans) return;
        fetchFloorPlans()
            .then(setFloorPlans)
            .catch(() => setFloorPlans([]));
    }, [canSeePlans]);
    const { plantId } = useParams();
    const navigate = useNavigate();
    const [plant, setPlant] = useState<Plant | null>(null);
    const [intervalDraft, setIntervalDraft] = useState("");
    const [loadingPlant, setLoadingPlant] = useState(true);
    const [weatherConfigs, setWeatherConfigs] = useState<WeatherConfig[]>([]);
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
    const [newTag, setNewTag] = useState("");
    const [showTagDropdown, setShowTagDropdown] = useState(false);
    const [selectedDateTime, setSelectedDateTime] = useState<string>(
        DateTime.now().setZone(timezone).toISO({ includeOffset: false }) ?? "",
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
    // Escape closes it and focus goes back to the button, like the other dialogs.
    const { modalRef: notesModalRef } = useModalA11y({
        isOpen: notesModalOpen,
        onClose: useCallback(() => setNotesModalOpen(false), []),
    });
    const [notes, setNotes] = useState<any[]>([]);
    const [newNote, setNewNote] = useState("");
    const [careAdviceModalOpen, setCareAdviceModalOpen] = useState(false);
    const [careAdviceMessage, setCareAdviceMessage] = useState("");
    const [actionLoading, setActionLoading] = useState<ActionLoadingState>(null);
    const [plantNet, setPlantNet] = useState<{ species: string; reference: PlantNetReference } | null>(null);
    // Care advice entries opened in the activity feed (held here: the feed is re-created each render)
    const [expandedAdvice, setExpandedAdvice] = useState<Set<string>>(() => new Set());
    // Actions: "Water now" logs the current time unless a time was picked.
    const [showWaterTime, setShowWaterTime] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);
    const [feedExpanded, setFeedExpanded] = useState(false);
    // The feed loads a page at a time; a full page means there may be more behind it.
    const [hasMoreActivities, setHasMoreActivities] = useState(false);
    const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);
    const [earlierAdviceOpen, setEarlierAdviceOpen] = useState(false);
    // Which kinds of entries the feed shows (remembered per browser); waterings tend to crowd out the rest.
    const [feedTypes, setFeedTypes] = useState<ActivityFilter[]>(readFeedTypes);
    const feedTypesKey = feedTypesParam(feedTypes) ?? "";
    const activityRequest = useRef(0);
    // "Now" for the reminders list, ticking once a minute so a passed reminder drops off.
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);
    // Notes modal: an optional "remind me" date and time (local, from the date/time inputs).
    const [remindDate, setRemindDate] = useState("");
    const [remindTime, setRemindTime] = useState("09:00");

    // Fetch plant and activites data on load
    useEffect(() => {
        if (plantId) {
            loadPlant();
        }
        loadAvailableTags();
        fetchWeatherConfigs()
            .then(setWeatherConfigs)
            .catch(() => {});
    }, [plantId]);

    // The feed loads on open and again whenever its filter changes.
    useEffect(() => {
        if (plantId) loadActivities();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plantId, feedTypesKey]);

    // Link to the species on Pl@ntNet; looked up again when the species changes
    const species = plant?.species;
    useEffect(() => {
        if (!plantId || !species) return;
        let cancelled = false;
        fetchPlantNetReference(Number(plantId))
            .then((reference) => {
                if (!cancelled) setPlantNet({ species, reference });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [plantId, species]);
    const speciesReference = plantNet && plantNet.species === species ? plantNet.reference : null;
    const plantNetUrl = speciesReference?.url ?? null;
    // Other common names of the species, without the one the plant is already called.
    const speciesAliases = (speciesReference?.common_names ?? [])
        .filter((name) => name.toLowerCase() !== (plant?.name ?? "").toLowerCase())
        .slice(0, 4);

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
        } catch {
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
            const at = showWaterTime
                ? selectedDateTime
                : (DateTime.now().setZone(timezone).toISO({ includeOffset: false }) ?? "");
            const wateringDateTimeUTC = DateTime.fromISO(at, { zone: timezone })
                .toUTC()
                .toISO({ includeOffset: false });

            const newWatering = await waterPlant(Number(plantId), { watered_at: wateringDateTimeUTC });

            // Update plant state directly instead of reloading everything
            if (plant) {
                setPlant({
                    ...plant,
                    // An ISO string with its offset, like the API sends: a Date object made the
                    // status read "Water today" until reload, and parsing the bare UTC string as
                    // local time put it an hour off.
                    last_watered: DateTime.fromISO(at, { zone: timezone }).toISO() as unknown as Date,
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
            const at = showWaterTime
                ? selectedDateTime
                : (DateTime.now().setZone(timezone).toISO({ includeOffset: false }) ?? "");
            const fertilizingDateTimeUTC = DateTime.fromISO(at, { zone: timezone })
                .toUTC()
                .toISO({ includeOffset: false });

            const newFertilizing = await fertilizePlant(Number(plantId), {
                fertilized_at: fertilizingDateTimeUTC,
            });

            if (plant) {
                setPlant({
                    ...plant,
                    last_fertilized: DateTime.fromISO(at, { zone: timezone }).toISO() as unknown as Date,
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
        const provider = await chooseLlmProvider("Write description");
        if (provider === null) return;

        setActionLoading({
            title: "Generating AI Description",
            message: "Analyzing your plant details to produce a better description.",
            details: [
                "Checking existing plant data and context",
                "Generating text with the configured AI provider",
                "Saving the description, and a watering interval if none is set",
            ],
        });

        try {
            // The server saves both; no second request, just take what it stored.
            const result = await generatePlantDescription(Number(plantId), provider);
            setPlant((current) =>
                current
                    ? {
                          ...current,
                          description: result.description,
                          watering_interval_days: result.watering_interval_days,
                      }
                    : current,
            );
            const suggested = result.suggested_watering_interval_days;
            if (result.watering_interval_applied && suggested) {
                toast.success(`Description saved. Watering every ${suggested} days, set from it.`);
            } else if (suggested && suggested !== result.watering_interval_days) {
                toast.success(
                    `Description saved. It suggests watering every ${suggested} days; your ${result.watering_interval_days} days stay.`,
                );
            } else {
                toast.success("Description saved.");
            }
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
            const careAdviceEntry = await generateCareAdvice(
                Number(plantId),
                careAdviceMessage.trim() || undefined,
                careAdviceProvider || undefined,
            );

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
        } catch {
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
        } catch {
            toast.error("Failed to delete tag.");
        }
    };

    const loadActivities = async () => {
        if (!plantId) return;

        // A filter clicked quickly twice: only the newest answer counts.
        const request = ++activityRequest.current;
        setLoadingActivities(true);
        try {
            const data = await fetchPlantActivities(Number(plantId), {
                limit: ACTIVITY_PAGE,
                types: feedTypesParam(feedTypes),
            });
            if (request !== activityRequest.current) return;
            setActivities(data);
            setHasMoreActivities(data.length === ACTIVITY_PAGE);
        } catch {
            if (request === activityRequest.current) toast.error("Failed to load activity log.");
        } finally {
            if (request === activityRequest.current) setLoadingActivities(false);
        }
    };

    const loadMoreActivities = async () => {
        if (!plantId) return;

        setLoadingMoreActivities(true);
        try {
            const data = await fetchPlantActivities(Number(plantId), {
                limit: ACTIVITY_PAGE,
                offset: activities.length,
                types: feedTypesParam(feedTypes),
            });
            setActivities((current) => {
                const seen = new Set(current.map((activity) => activity.id));
                return [...current, ...data.filter((activity) => !seen.has(activity.id))];
            });
            setHasMoreActivities(data.length === ACTIVITY_PAGE);
        } catch {
            toast.error("Failed to load older activities.");
        } finally {
            setLoadingMoreActivities(false);
        }
    };

    const loadNotes = async () => {
        if (!plantId) return;

        try {
            const data = await fetchPlantNotes(Number(plantId), { limit: 10 });
            setNotes(data);
        } catch {
            toast.error("Failed to load notes.");
        }
    };

    const handleCreateNote = async () => {
        if (!plantId || !newNote.trim()) return;

        if (!isLoggedIn) {
            toast.error("You must be logged in to create notes.");
            return;
        }

        // The date and time inputs are in the app's timezone, like every other time on the page.
        let remindAt: string | null = null;
        if (remindDate) {
            const when = DateTime.fromISO(`${remindDate}T${remindTime || "09:00"}`, { zone: timezone });
            if (!when.isValid) {
                toast.error("That reminder date isn't valid.");
                return;
            }
            if (when < DateTime.now().minus({ minutes: 1 })) {
                toast.error("A reminder needs a time in the future.");
                return;
            }
            remindAt = when.toUTC().toISO();
        }

        try {
            const note = await createPlantNote(Number(plantId), newNote.trim(), remindAt);
            setNotes([note, ...notes]);
            setPlant((p) => (p ? { ...p, notes: [note, ...(p.notes || [])] } : p));
            setNewNote("");
            setRemindDate("");
            setNotesModalOpen(false);
            toast.success(
                remindAt ? `Reminder set for ${formatReminder(remindAt)}` : "Note created!",
            );

            // Always refresh activity feed
            loadActivities();
        } catch {
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
                return "Care advice";
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

    // date (YYYY-MM-DD): opened from a calendar day, so the note starts as a reminder for that day.
    const handleOpenNotesModal = (date?: string) => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to manage notes.");
            return;
        }
        setRemindDate(date ?? "");
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
        setIntervalDraft(plant?.watering_interval_days ? String(plant.watering_interval_days) : "");
    }, [plant?.watering_interval_days]);

    const handleSaveWateringInterval = async () => {
        if (!plant) return;
        const trimmed = intervalDraft.trim();
        const value = trimmed === "" ? null : Number(trimmed);
        if (value !== null && (!Number.isInteger(value) || value < 1 || value > 365)) {
            toast.error("Watering interval must be a whole number between 1 and 365 days.");
            setIntervalDraft(plant.watering_interval_days ? String(plant.watering_interval_days) : "");
            return;
        }
        if (value === (plant.watering_interval_days ?? null)) return;

        try {
            await updatePlant(plant.id, { watering_interval_days: value });
            setPlant({ ...plant, watering_interval_days: value });
            toast.success(value ? `Watering every ${value} day${value === 1 ? "" : "s"}` : "Watering schedule removed");
        } catch (err) {
            toast.error((err as Error).message);
        }
    };

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

    useEffect(() => {
        if (!moreOpen) return;
        const onPointer = (e: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [moreOpen]);

    const FEED_PREVIEW = 6;
    // Earlier care advice is part of the plant's history too, so it shows here (collapsed) as well as above.
    const feedActivities = activities;
    // Rain only waters plants outside that reach it; elsewhere the chip would never match anything.
    const feedFilters = ACTIVITY_FILTERS.filter(
        (filter) => filter.id !== "rain" || (plant?.is_outdoor && plant?.reaches_rain),
    );
    const applyFeedTypes = (next: ActivityFilter[]) => {
        // Every chip on this page selected is the same as "All" (an indoor plant has no rain chip).
        const all = feedFilters.every((filter) => next.includes(filter.id));
        const types = all ? ACTIVITY_FILTERS.map((filter) => filter.id) : next;
        setFeedTypes(types);
        storeFeedTypes(types);
        setFeedExpanded(false);
    };
    const feedFiltered = feedTypes.length < ACTIVITY_FILTERS.length;
    // Reminders still to come (a sent one drops off once its time has passed).
    const upcomingReminders = (plant?.notes ?? [])
        .filter((note) => note.remind_at && new Date(note.remind_at).getTime() > nowMs - 60_000)
        .sort((a, b) => new Date(a.remind_at!).getTime() - new Date(b.remind_at!).getTime());
    const handleDeleteReminder = async (noteId: number) => {
        if (!plantId) return;
        try {
            await deletePlantNote(Number(plantId), noteId);
            setPlant((p) => (p ? { ...p, notes: (p.notes || []).filter((n) => n.id !== noteId) } : p));
            toast.success("Reminder deleted.");
            loadActivities();
        } catch (err) {
            toast.error((err as Error).message || "Failed to delete the reminder.");
        }
    };
    // From "All", a chip shows only that kind; after that, chips add and remove kinds.
    const pickFeedType = (type: ActivityFilter) =>
        applyFeedTypes(feedFiltered ? toggleFeedType(feedTypes, type) : [type]);
    const formatReminder = (iso: string) =>
        new Date(iso).toLocaleString(locale, {
            timeZone: timezone,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    // A render function, not a component: defined in here it would remount on every render.
    const renderActivityFeed = () => (
        <div className="activity-log-container">
            <div className="activity-log-header">
                <h3 id="activity-feed-heading">Activity feed</h3>
                {isLoggedIn && (
                    <button
                        className="notes-btn"
                        onClick={() => handleOpenNotesModal()}
                        title="Add a note or reminder"
                        aria-label="Add a note or reminder"
                    >
                        <FontAwesomeIcon icon={faStickyNote} />
                    </button>
                )}
            </div>
            <div className="activity-filter" role="group" aria-label="Show in the activity feed">
                <button
                    type="button"
                    className="activity-filter-chip"
                    aria-pressed={!feedFiltered}
                    onClick={() => applyFeedTypes(ACTIVITY_FILTERS.map((filter) => filter.id))}
                >
                    All
                </button>
                {feedFilters.map((filter) => (
                    <button
                        key={filter.id}
                        type="button"
                        className="activity-filter-chip"
                        aria-pressed={feedFiltered && feedTypes.includes(filter.id)}
                        onClick={() => pickFeedType(filter.id)}
                    >
                        {filter.label}
                    </button>
                ))}
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
                ) : feedActivities.length === 0 ? (
                    <div className="activity-log-empty">
                        {feedFiltered ? "Nothing of this kind yet" : "No activities yet"}
                    </div>
                ) : (
                    (feedExpanded ? feedActivities : feedActivities.slice(0, FEED_PREVIEW)).map((activity) => (
                        <div key={activity.id} className="activity-item">
                            <div className={`activity-icon ${activity.activity_type}`}>
                                <FontAwesomeIcon icon={getActivityIcon(activity.activity_type)} size="sm" />
                            </div>
                            <div className="activity-content">
                                <div className="activity-header">
                                    <p className="activity-title">{getActivityTitle(activity)}</p>
                                    <p className="activity-timestamp">
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
                                {activity.activity_type === "care_advice" && activity.activity_data?.advice ? (
                                    <CareAdviceText
                                        text={activity.activity_data.advice}
                                        author={activity.activity_data?.user_name}
                                        expanded={expandedAdvice.has(activity.id)}
                                        onToggle={() =>
                                            setExpandedAdvice((open) => {
                                                const next = new Set(open);
                                                if (next.has(activity.id)) next.delete(activity.id);
                                                else next.add(activity.id);
                                                return next;
                                            })
                                        }
                                    />
                                ) : (
                                    <p className="activity-description">{getActivityDescription(activity)}</p>
                                )}
                                {activity.activity_type === "note" && activity.activity_data?.remind_at && (
                                    <p className="activity-reminder">
                                        <FontAwesomeIcon icon={faBell} aria-hidden="true" /> Reminder{" "}
                                        {formatReminder(activity.activity_data.remind_at)}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
            {!loadingActivities && (feedActivities.length > FEED_PREVIEW || hasMoreActivities) && (
                <div className="plant-feed-actions">
                    {(!feedExpanded || hasMoreActivities) && (
                        <button
                            type="button"
                            className="plant-feed-more"
                            disabled={loadingMoreActivities}
                            onClick={() => {
                                // First reveal what is loaded; once open, fetch the next page.
                                if (!feedExpanded && feedActivities.length > FEED_PREVIEW) setFeedExpanded(true);
                                else {
                                    setFeedExpanded(true);
                                    loadMoreActivities();
                                }
                            }}
                        >
                            {loadingMoreActivities ? "Loading…" : "Show older"}
                        </button>
                    )}
                    {feedExpanded && (
                        <button type="button" className="plant-feed-more" onClick={() => setFeedExpanded(false)}>
                            Show fewer
                        </button>
                    )}
                </div>
            )}
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
            {llmPicker}
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
                                <span>{plant.name || "Unnamed Plant"}</span>
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
                                <span>{plant.species || "Unknown"}</span>
                            )}
                            {plantNetUrl && (
                                <a
                                    className="plantnet-link"
                                    href={plantNetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open on Pl@ntNet"
                                    aria-label={`Open ${plant.species} on Pl@ntNet (new tab)`}
                                >
                                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                                </a>
                            )}
                        </span>
                        {speciesReference &&
                            (speciesReference.family || speciesAliases.length > 0 || speciesReference.wikipedia_url) && (
                                <span className="plant-information-names plant-species-facts">
                                    {speciesReference.family && (
                                        <span>
                                            <span className="plant-species-fact-label">Family</span>{" "}
                                            {speciesReference.family}
                                        </span>
                                    )}
                                    {speciesAliases.length > 0 && (
                                        <span>
                                            <span className="plant-species-fact-label">Also known as</span>{" "}
                                            {speciesAliases.join(", ")}
                                        </span>
                                    )}
                                    {speciesReference.wikipedia_url && (
                                        <a
                                            href={speciesReference.wikipedia_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`${plant.species} on Wikipedia (new tab)`}
                                        >
                                            Wikipedia <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                                        </a>
                                    )}
                                </span>
                            )}
                        <span className="plant-information-names plant-status-line">
                            {(() => {
                                const status = plant.is_archived ? null : getWateringStatus(plant, timezone);
                                return (
                                    status && (
                                        <span
                                            className={`watering-badge watering-badge--${wateringBadgeVariant(status)}`}
                                        >
                                            {formatWateringDue(status)}
                                        </span>
                                    )
                                );
                            })()}
                            <span className="plant-last-watered">
                                {plant.last_watered
                                    ? `Last watered ${new Date(plant.last_watered).toLocaleString(locale, {
                                          timeZone: timezone,
                                          weekday: "short",
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                      })}`
                                    : "Not watered yet"}
                            </span>
                        </span>
                    </div>

                    {!isLoggedIn ? (
                        <LoginHint to="water, add photos or change this plant" />
                    ) : (
                        <div className="plant-actions">
                            {plant.is_archived ? (
                                <div className="plant-actions-secondary">
                                    <button
                                        type="button"
                                        className="plant-action archive-plant-btn"
                                        onClick={() => {
                                            if (!isLoggedIn) {
                                                toast.warning("You must be logged in to restore plants.");
                                                return;
                                            }
                                            setIsArchiving(false);
                                            setArchiveModalOpen(true);
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faTrashCanArrowUp} /> Restore plant
                                    </button>
                                    <button
                                        type="button"
                                        className="plant-action plant-action--danger delete-plant-btn"
                                        onClick={() =>
                                            isLoggedIn
                                                ? setDeleteModalOpen(true)
                                                : toast.warning("You must be logged in to delete plants.")
                                        }
                                    >
                                        <FontAwesomeIcon icon={faTrash} /> Delete plant
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="plant-action-primary water-plant-btn"
                                        onClick={() =>
                                            isLoggedIn
                                                ? handleWaterPlant()
                                                : toast.warning("You must be logged in to water plants.")
                                        }
                                    >
                                        <FontAwesomeIcon icon={faDroplet} />{" "}
                                        {showWaterTime ? "Log watering" : "Water now"}
                                    </button>
                                    <details
                                        className="plant-water-earlier"
                                        open={showWaterTime}
                                        onToggle={(e) => {
                                            const open = e.currentTarget.open;
                                            if (open && !showWaterTime) {
                                                setSelectedDateTime(
                                                    DateTime.now().setZone(timezone).toISO({ includeOffset: false }) ??
                                                        "",
                                                );
                                            }
                                            setShowWaterTime(open);
                                        }}
                                    >
                                        <summary>Watered earlier? Set the time</summary>
                                        <label className="plant-water-time">
                                            <span>Watered or fertilized at</span>
                                            <input
                                                type="datetime-local"
                                                value={selectedDateTime.slice(0, 16)}
                                                onChange={(e) => setSelectedDateTime(e.target.value)}
                                            />
                                        </label>
                                    </details>
                                    <div className="plant-actions-secondary">
                                        <button
                                            type="button"
                                            className="plant-action fertilize-plant-btn"
                                            onClick={() =>
                                                isLoggedIn
                                                    ? handleFertilizePlant()
                                                    : toast.warning("You must be logged in to fertilize plants.")
                                            }
                                        >
                                            <FontAwesomeIcon icon={faSeedling} /> Fertilize
                                        </button>
                                        {isLoggedIn && (
                                            <input
                                                type="file"
                                                onClick={(e) => (e.currentTarget.value = "")}
                                                id={`file-upload-${plant.id}`}
                                                className="file-input"
                                                onChange={(e) => handleUploadImageForPlant(e)}
                                            />
                                        )}
                                        <button
                                            type="button"
                                            className="plant-action file-input-plant-btn"
                                            onClick={() =>
                                                isLoggedIn
                                                    ? document.getElementById(`file-upload-${plant.id}`)?.click()
                                                    : toast.warning("You must be logged in to upload images.")
                                            }
                                        >
                                            <FontAwesomeIcon icon={faUpload} /> Add photo
                                        </button>
                                        <div className="plant-more" ref={moreRef}>
                                            <button
                                                type="button"
                                                className="plant-action"
                                                aria-haspopup="menu"
                                                aria-expanded={moreOpen}
                                                onClick={() => setMoreOpen((open) => !open)}
                                            >
                                                More <FontAwesomeIcon icon={faChevronDown} />
                                            </button>
                                            {moreOpen && (
                                                <div className="plant-more-menu" role="menu">
                                                    {identificationEnabled && (
                                                        <button
                                                            type="button"
                                                            role="menuitem"
                                                            className="identify-plant-btn"
                                                            onClick={() => {
                                                                setMoreOpen(false);
                                                                if (isLoggedIn) handleIdentifyPlant();
                                                                else
                                                                    toast.warning(
                                                                        "You must be logged in to identify images.",
                                                                    );
                                                            }}
                                                        >
                                                            <FontAwesomeIcon icon={faFingerprint} /> Identify species
                                                        </button>
                                                    )}
                                                    {llmProvider && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                className="ai-care-helper-btn"
                                                                onClick={() => {
                                                                    setMoreOpen(false);
                                                                    handleOpenCareAdviceModal();
                                                                }}
                                                            >
                                                                <FontAwesomeIcon icon={faWandMagicSparkles} /> Ask AI
                                                                for care advice
                                                            </button>
                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                className="generate-description-btn"
                                                                onClick={() => {
                                                                    setMoreOpen(false);
                                                                    if (isLoggedIn) handleGenerateDescription();
                                                                    else
                                                                        toast.warning(
                                                                            "You must be logged in to generate a description with AI.",
                                                                        );
                                                                }}
                                                            >
                                                                <FontAwesomeIcon icon={faWandMagicSparkles} /> Write
                                                                description with AI
                                                            </button>
                                                        </>
                                                    )}
                                                    <div role="separator" className="plant-more-separator" />
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="archive-plant-btn"
                                                        onClick={() => {
                                                            setMoreOpen(false);
                                                            if (!isLoggedIn) {
                                                                toast.warning(
                                                                    "You must be logged in to archive plants.",
                                                                );
                                                                return;
                                                            }
                                                            setIsArchiving(true);
                                                            setArchiveModalOpen(true);
                                                        }}
                                                    >
                                                        <FontAwesomeIcon icon={faBoxArchive} /> Archive plant
                                                    </button>
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="delete-plant-btn plant-more-danger"
                                                        onClick={() => {
                                                            setMoreOpen(false);
                                                            if (isLoggedIn) setDeleteModalOpen(true);
                                                            else
                                                                toast.warning(
                                                                    "You must be logged in to delete plants.",
                                                                );
                                                        }}
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} /> Delete plant
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <TimelineImages
                        images={plant.images}
                        plantId={plant.id}
                        onChanged={() => {
                            loadPlant();
                            loadActivities();
                        }}
                    />
                    <Calendar
                        waterings={plant.waterings}
                        fertilizings={plant.fertilizings}
                        images={plant.images}
                        careadvice={plant.care_advice}
                        notes={plant.notes}
                        plantId={plant.id}
                        onAddReminder={plant.is_archived ? undefined : (date) => handleOpenNotesModal(date)}
                        onChanged={() => {
                            loadPlant();
                            loadActivities();
                        }}
                    />

                    {!plant.is_archived && canSeePlans && floorPlans.length > 0 && (
                        <div className="plant-outdoor-section">
                            <h4>Floor plan</h4>
                            {(() => {
                                const plan = floorPlans.find((p) =>
                                    p.placements.some((pl) => pl.plant_id === plant.id),
                                );
                                const openPlan = (place: boolean) =>
                                    navigate("/plants", {
                                        state: { floorPlan: { plantId: plant.id, planId: plan?.id, place } },
                                    });
                                return (
                                    <div className="plant-interval-row">
                                        <span>{plan ? `On ${plan.name}` : "Not placed yet"}</span>
                                        {plan && (
                                            <button className="update-btn" onClick={() => openPlan(false)}>
                                                <FontAwesomeIcon icon={faMap} /> Show
                                            </button>
                                        )}
                                        {(authMode === "no" || isLoggedIn) && (
                                            <button className="update-btn" onClick={() => openPlan(true)}>
                                                <FontAwesomeIcon icon={faLocationDot} /> {plan ? "Move" : "Place"}
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {!plant.is_archived && (
                        <div className="plant-outdoor-section">
                            <h4>Watering schedule</h4>
                            <label className="plant-interval-row">
                                <span>Water every</span>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={365}
                                    placeholder="–"
                                    value={intervalDraft}
                                    onChange={(e) => setIntervalDraft(e.target.value)}
                                    onBlur={handleSaveWateringInterval}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") e.currentTarget.blur();
                                    }}
                                    disabled={!isLoggedIn}
                                    aria-label="Watering interval in days"
                                />
                                <span>days</span>
                            </label>
                            {!plant.watering_interval_days && (
                                <small className="plant-interval-hint">
                                    Set an interval to show this plant under #needs_water when it is due.
                                </small>
                            )}
                        </div>
                    )}

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
                                            const outdoorTag = plant.tags.find(
                                                (t: { name: string }) => t.name === "outdoor",
                                            );
                                            if (outdoorTag)
                                                tagged = {
                                                    ...(await removeTagFromPlant(plant.id, outdoorTag.id)),
                                                    ...updates,
                                                };
                                            const rainTag = tagged.tags?.find(
                                                (t: { name: string }) => t.name === "rain",
                                            );
                                            if (rainTag)
                                                tagged = {
                                                    ...(await removeTagFromPlant(plant.id, rainTag.id)),
                                                    ...updates,
                                                };
                                        }
                                        setPlant(tagged);
                                    }}
                                    disabled={!isLoggedIn}
                                />
                                <span>Outdoor plant</span>
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
                                                const rainTag = plant.tags.find(
                                                    (t: { name: string }) => t.name === "rain",
                                                );
                                                tagged = rainTag
                                                    ? await removeTagFromPlant(plant.id, rainTag.id)
                                                    : plant;
                                            }
                                            setPlant({ ...tagged, is_outdoor: plant.is_outdoor, reaches_rain: val });
                                        }}
                                        disabled={!isLoggedIn}
                                    />
                                    <span>Reaches rain</span>
                                </label>
                            )}
                            {plant.is_outdoor && plant.reaches_rain && weatherConfigs.length > 0 && (
                                <div className="plant-weather-zone">
                                    <label>Weather zone</label>
                                    <select
                                        value={
                                            plant.weather_config_id ??
                                            weatherConfigs.find((wc) => wc.is_default)?.id ??
                                            weatherConfigs[0]?.id ??
                                            ""
                                        }
                                        onChange={async (e) => {
                                            const val = e.target.value ? Number(e.target.value) : null;
                                            await updatePlant(Number(plantId), { weather_config_id: val });
                                            setPlant({ ...plant, weather_config_id: val });
                                        }}
                                        disabled={!isLoggedIn}
                                    >
                                        {weatherConfigs.map((wc) => (
                                            <option key={wc.id} value={wc.id}>
                                                {wc.city_name || `Location ${wc.id}`}
                                                {wc.is_default ? " (default)" : ""}
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

                    <Description
                        plant={plant}
                        onDescriptionUpdated={setPlant}
                        onGenerate={
                            llmProvider && isLoggedIn && !plant.is_archived ? handleGenerateDescription : undefined
                        }
                    />

                    {(() => {
                        const [latest, ...earlier] = [...(plant.care_advice || [])].sort(
                            (a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime(),
                        );
                        const when = (iso: string) =>
                            new Date(iso).toLocaleString(locale, {
                                timeZone: timezone,
                                year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            });
                        const toggle = (key: string) =>
                            setExpandedAdvice((open) => {
                                const next = new Set(open);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                            });
                        return (
                            latest && (
                                <section className="plant-latest-advice" aria-labelledby="latest-advice-heading">
                                    <div className="plant-latest-advice-head">
                                        <h3 id="latest-advice-heading">Care advice</h3>
                                        <span>{when(latest.generated_at)}</span>
                                    </div>
                                    <CareAdviceText
                                        text={latest.advice_text}
                                        expanded={expandedAdvice.has("latest")}
                                        onToggle={() => toggle("latest")}
                                    />
                                    {earlier.length > 0 && (
                                        <div className="plant-earlier-advice">
                                            <button
                                                type="button"
                                                className="plant-earlier-advice-toggle"
                                                aria-expanded={earlierAdviceOpen}
                                                aria-controls="plant-earlier-advice-list"
                                                onClick={() => setEarlierAdviceOpen((open) => !open)}
                                            >
                                                <FontAwesomeIcon
                                                    icon={earlierAdviceOpen ? faChevronUp : faChevronDown}
                                                />
                                                Earlier advice ({earlier.length})
                                            </button>
                                            {earlierAdviceOpen && (
                                                <ol
                                                    id="plant-earlier-advice-list"
                                                    className="plant-earlier-advice-list"
                                                >
                                                    {earlier.map((advice) => (
                                                        <li key={advice.id}>
                                                            <p className="plant-earlier-advice-date">
                                                                {when(advice.generated_at)}
                                                            </p>
                                                            <CareAdviceText
                                                                text={advice.advice_text}
                                                                expanded={expandedAdvice.has(`advice_${advice.id}`)}
                                                                onToggle={() => toggle(`advice_${advice.id}`)}
                                                            />
                                                        </li>
                                                    ))}
                                                </ol>
                                            )}
                                        </div>
                                    )}
                                </section>
                            )
                        );
                    })()}

                    {upcomingReminders.length > 0 && (
                        <section className="plant-reminders" aria-labelledby="plant-reminders-heading">
                            <h3 id="plant-reminders-heading">
                                <FontAwesomeIcon icon={faBell} aria-hidden="true" /> Reminders
                            </h3>
                            <ul>
                                {upcomingReminders.map((note) => (
                                    <li key={note.id}>
                                        <span className="plant-reminder-when">{formatReminder(note.remind_at!)}</span>
                                        <span className="plant-reminder-text">{note.note_text}</span>
                                        {isLoggedIn && (
                                            <button
                                                type="button"
                                                className="plant-reminder-delete"
                                                aria-label={`Delete reminder: ${note.note_text}`}
                                                onClick={() => handleDeleteReminder(note.id)}
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {renderActivityFeed()}

                    {plant.is_archived && plant.archive_reason && (
                        <div className="archive-reason-box mt-5">
                            <h3>Archive Reason</h3>
                            <span>{plant.archive_reason}</span>
                        </div>
                    )}
                </div>
            </div>

            {identifyResults && (
                <IdentifyResults
                    plantId={Number(plantId)}
                    results={identifyResults}
                    onSelectSpecies={async (plantId, name, species) => {
                        setIdentifyResults(null);
                        try {
                            setPlant(await updatePlant(plantId, { name, species }));
                            toast.success(`Plant updated to ${name} (${species})`);
                        } catch {
                            toast.error("Couldn't save the species. Try again.");
                        }
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
                    <div
                        className="notes-modal"
                        ref={notesModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={remindDate ? "Set a reminder" : "Write a note about the plant"}
                    >
                        <div className="notes-modal-header">
                            <span>{remindDate ? "Set a reminder" : "Write a note about the plant"}</span>
                        </div>

                        <div className="note-input-container">
                            <EditableDiv
                                value={newNote}
                                onChange={setNewNote}
                                onSave={setNewNote}
                                placeholder={remindDate ? "What should you be reminded of?" : "Add a note about your plant..."}
                                className="note-input"
                            />
                            <fieldset className="note-reminder">
                                <legend>
                                    <FontAwesomeIcon icon={faBell} aria-hidden="true" /> Remind me
                                </legend>
                                <input
                                    type="date"
                                    aria-label="Reminder date"
                                    value={remindDate}
                                    min={DateTime.now().setZone(timezone).toISODate() ?? undefined}
                                    onChange={(e) => setRemindDate(e.target.value)}
                                />
                                <input
                                    type="time"
                                    aria-label="Reminder time"
                                    value={remindTime}
                                    disabled={!remindDate}
                                    onChange={(e) => setRemindTime(e.target.value)}
                                />
                                {remindDate && (
                                    <button
                                        type="button"
                                        className="note-reminder-clear"
                                        aria-label="No reminder"
                                        onClick={() => setRemindDate("")}
                                    >
                                        <FontAwesomeIcon icon={faCircleXmark} />
                                    </button>
                                )}
                            </fieldset>
                            <div className="note-actions">
                                <button className="save-note-btn" onClick={handleCreateNote} disabled={!newNote.trim()}>
                                    <FontAwesomeIcon icon={remindDate ? faBell : faPlus} />{" "}
                                    {remindDate ? "Set reminder" : "Add Note"}
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
                            <p style={{ marginBottom: "1rem", color: "var(--muted-text-color)", fontSize: "0.9rem" }}>
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
                                    border: "1px solid var(--input-border)",
                                    fontFamily: "inherit",
                                    fontSize: "0.95rem",
                                    resize: "vertical",
                                }}
                            />
                            {llmProviders.length > 1 && (
                                <label className="care-advice-provider">
                                    <span>AI</span>
                                    <select
                                        value={careAdviceProvider || llmProviders[0].id}
                                        onChange={(e) => setCareAdviceProvider(e.target.value)}
                                    >
                                        {llmProviders.map((provider) => (
                                            <option key={provider.id} value={provider.id}>
                                                {provider.label}
                                                {provider.model ? ` (${provider.model})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
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
