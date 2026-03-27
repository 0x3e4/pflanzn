import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../styles/Calendar.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { useModalA11y } from "../hooks/useModalA11y";
import { createPortal } from "react-dom";
import {
    deleteWatering,
    deleteFertilizing,
    deletePlantImage,
    deleteCareAdvice,
    deletePlantNote,
} from "../services/PlantService";
import { PlantWatering, PlantFertilizing, PlantImage, PlantCareAdvice, PlantNote } from "../types/Plant";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faTrash,
    faCircleXmark,
    faDroplet,
    faCamera,
    faStickyNote,
    faWandMagicSparkles,
    faSeedling,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { setOverlayOpen } from "../services/overlayControl";

interface Props {
    waterings: PlantWatering[];
    fertilizings: PlantFertilizing[];
    images: PlantImage[];
    careadvice: PlantCareAdvice[];
    notes: PlantNote[];
    plantId: number;
    onChanged?: () => void;
}

interface TooltipPosition {
    top: number;
    left: number;
    width: number;
}

function TooltipOverlay({
    content,
    position,
    innerRef,
}: {
    content: React.ReactNode;
    position: TooltipPosition;
    innerRef?: React.Ref<HTMLDivElement>;
}) {
    const style: React.CSSProperties = {
        position: "absolute",
        top: position.top + position.width + 6,
        left: position.left + position.width / 2,
        transform: "translateX(-50%)",
        zIndex: 9999,
        backgroundColor: "var(--background-color)",
        color: "var(--text-color)",
        border: "1px solid var(--border-color)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        borderRadius: "8px",
        padding: "8px",
        pointerEvents: "auto",
        opacity: 1,
        whiteSpace: "nowrap",
    };

    return createPortal(
        <div ref={innerRef} style={style} className="watering-tooltip-overlay">
            {content}
        </div>,
        document.body,
    );
}

const EVENT_COLORS: Record<string, string> = {
    "watered-day": "var(--octal-color)",
    "fertilized-day": "var(--duodecimal-color)",
    "image-day": "var(--quinary-color)",
    "advice-day": "var(--decimal-color)",
    "note-day": "var(--primary-color)",
};

export default function LogCalendar({ waterings, fertilizings, images, careadvice, notes, plantId, onChanged }: Props) {
    const { isLoggedIn } = useAuth();

    const [localWaterings, setLocalWaterings] = useState<PlantWatering[]>(waterings);
    const [localFertilizings, setLocalFertilizings] = useState<PlantFertilizing[]>(fertilizings);
    const [uploadedImages, setUploadedImages] = useState<PlantImage[]>(images);
    const [careAdvices, setCareAdvices] = useState<PlantCareAdvice[]>(careadvice);
    const [plantNotes, setPlantNotes] = useState<PlantNote[]>(notes);
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const closeDeleteModal = useCallback(() => setDeleteModalOpen(false), []);
    const { modalRef: deleteModalRef } = useModalA11y({ isOpen: deleteModalOpen, onClose: closeDeleteModal });
    const [deleteTarget, setDeleteTarget] = useState<{
        type: "watering" | "fertilizing" | "image" | "advice" | "note";
        id: number;
    } | null>(null);

    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalWaterings(waterings);
        setLocalFertilizings(fertilizings);
        setUploadedImages(images);
        setCareAdvices(careadvice);
        setPlantNotes(notes);
    }, [waterings, fertilizings, images, careadvice, notes]);

    const locale = import.meta.env.VITE_LOCALE;
    const timezone = import.meta.env.VITE_TZ;

    const formatDateKey = (date: Date) => {
        const formatter = new Intl.DateTimeFormat(locale, {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        const parts = formatter.formatToParts(date);
        return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
    };

    const wateredDates = localWaterings.reduce(
        (acc, watering) => {
            const date = new Date(watering.watered_at);
            const formatter = new Intl.DateTimeFormat(locale, {
                timeZone: timezone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            });

            const parts = formatter.formatToParts(date);
            const dateKey = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;

            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(watering);
            return acc;
        },
        {} as Record<string, PlantWatering[]>,
    );

    const imageDates = uploadedImages.reduce(
        (acc, image) => {
            const dateKey = formatDateKey(new Date(image.uploaded_at));
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(image);
            return acc;
        },
        {} as Record<string, PlantImage[]>,
    );

    const adviceDates = careAdvices.reduce(
        (acc, advice) => {
            const dateKey = formatDateKey(new Date(advice.generated_at));
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(advice);
            return acc;
        },
        {} as Record<string, PlantCareAdvice[]>,
    );

    const noteDates = plantNotes.reduce(
        (acc, note) => {
            const dateKey = formatDateKey(new Date(note.created_at));
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(note);
            return acc;
        },
        {} as Record<string, PlantNote[]>,
    );

    const fertilizedDates = localFertilizings.reduce(
        (acc, fertilizing) => {
            const dateKey = formatDateKey(new Date(fertilizing.fertilized_at));
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(fertilizing);
            return acc;
        },
        {} as Record<string, PlantFertilizing[]>,
    );

    const getActiveEventTypes = (dateKey: string): string[] => {
        const types: string[] = [];
        if (wateredDates[dateKey]) types.push("watered-day");
        if (fertilizedDates[dateKey]) types.push("fertilized-day");
        if (imageDates[dateKey]) types.push("image-day");
        if (adviceDates[dateKey]) types.push("advice-day");
        if (noteDates[dateKey]) types.push("note-day");
        return types;
    };

    const tileClassName = ({ date }: { date: Date }) => {
        const dateKey = formatDateKey(date);
        const classes = getActiveEventTypes(dateKey);
        if (classes.length >= 2) classes.push("multi-day");
        return classes.join(" ");
    };

    const tileContent = ({ date }: { date: Date }) => {
        const dateKey = formatDateKey(date);
        const activeTypes = getActiveEventTypes(dateKey);
        if (activeTypes.length < 2) return null;

        const pct = 100 / activeTypes.length;
        const stops = activeTypes
            .map((t, i) => `${EVENT_COLORS[t]} ${i * pct}%, ${EVENT_COLORS[t]} ${(i + 1) * pct}%`)
            .join(", ");
        return (
            <div
                className="multi-day-indicator"
                style={{ background: `linear-gradient(135deg, ${stops})` }}
            />
        );
    };

    const handleClickDay = (date: Date, event: React.MouseEvent) => {
        const dateKey = formatDateKey(date);

        if (wateredDates[dateKey] || fertilizedDates[dateKey] || imageDates[dateKey] || adviceDates[dateKey] || noteDates[dateKey]) {
            setHoveredDate(dateKey);

            const rect = (event.target as HTMLElement).getBoundingClientRect();
            setTooltipPosition({
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
            });
        } else {
            setHoveredDate(null);
            setTooltipPosition(null);
        }
    };

    const openDeleteModal = (type: "watering" | "fertilizing" | "image" | "advice" | "note", id: number) => {
        // Hide tooltip immediately before showing modal
        setHoveredDate(null);
        setTooltipPosition(null);

        // Then show modal
        setDeleteTarget({ type, id });
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to delete events.");
            return;
        }

        if (!deleteTarget) return;
        try {
            if (deleteTarget.type === "watering") {
                await deleteWatering(plantId, deleteTarget.id);
                setLocalWaterings((prev) => prev.filter((w) => w.id !== deleteTarget.id));
                toast.success("Watering deleted successfully!");
            } else if (deleteTarget.type === "fertilizing") {
                await deleteFertilizing(plantId, deleteTarget.id);
                setLocalFertilizings((prev) => prev.filter((f) => f.id !== deleteTarget.id));
                toast.success("Fertilizing deleted successfully!");
            } else if (deleteTarget.type === "image") {
                await deletePlantImage(plantId, deleteTarget.id);
                setUploadedImages((prev) => prev.filter((img) => img.id !== deleteTarget.id));
                toast.success("Image deleted successfully!");
            } else if (deleteTarget.type === "advice") {
                await deleteCareAdvice(plantId, deleteTarget.id);
                setCareAdvices((prev) => prev.filter((adv) => adv.id !== deleteTarget.id));
                toast.success("Care Advice deleted successfully!");
            } else if (deleteTarget.type === "note") {
                await deletePlantNote(plantId, deleteTarget.id);
                setPlantNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id));
                toast.success("Note deleted successfully!");
            }
            setDeleteModalOpen(false);
            setHoveredDate(null);
            onChanged?.();
        } catch (err) {
            toast.error((err as Error).message);
        }
    };

    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setDeleteTarget(null);
    };

    // Click outside reset
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
                setTooltipPosition(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (deleteModalOpen) {
            setOverlayOpen(true);
        } else {
            setOverlayOpen(false);
        }
    }, [deleteModalOpen]);

    const renderTooltip = () => {
        if (
            !hoveredDate ||
            (!wateredDates[hoveredDate] &&
                !fertilizedDates[hoveredDate] &&
                !imageDates[hoveredDate] &&
                !adviceDates[hoveredDate] &&
                !noteDates[hoveredDate]) ||
            !tooltipPosition
        )
            return null;

        return (
            <TooltipOverlay
                innerRef={tooltipRef}
                position={tooltipPosition}
                content={
                    <div className="watering-tooltip-content">
                        {wateredDates[hoveredDate] && (
                            <>
                                <strong>Watered at:</strong>
                                <ul>
                                    {wateredDates[hoveredDate].map((watering) => (
                                        <li className="watering-tooltip-item" key={watering.id}>
                                            <FontAwesomeIcon icon={faDroplet} className="image-icon" />
                                            {new Date(watering.watered_at).toLocaleTimeString(locale, {
                                                timeZone: timezone,
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            {isLoggedIn ? (
                                                <>
                                                    <button
                                                        className="watering-delete-btn"
                                                        onClick={() => openDeleteModal("watering", watering.id)}
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    className="watering-delete-btn"
                                                    onClick={() =>
                                                        toast.warning(
                                                            "You must be logged in to delete watering events.",
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {fertilizedDates[hoveredDate] && (
                            <>
                                <strong>Fertilized at:</strong>
                                <ul>
                                    {fertilizedDates[hoveredDate].map((fertilizing) => (
                                        <li className="watering-tooltip-item" key={fertilizing.id}>
                                            <FontAwesomeIcon icon={faSeedling} className="image-icon" />
                                            {new Date(fertilizing.fertilized_at).toLocaleTimeString(locale, {
                                                timeZone: timezone,
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            {isLoggedIn ? (
                                                <button
                                                    className="watering-delete-btn"
                                                    onClick={() => openDeleteModal("fertilizing", fertilizing.id)}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            ) : (
                                                <button
                                                    className="watering-delete-btn"
                                                    onClick={() =>
                                                        toast.warning(
                                                            "You must be logged in to delete fertilizing events.",
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {imageDates[hoveredDate] && (
                            <>
                                <strong>Image uploaded at:</strong>
                                <ul>
                                    {imageDates[hoveredDate].map((image) => (
                                        <li className="watering-tooltip-item" key={image.id}>
                                            <FontAwesomeIcon icon={faCamera} className="image-icon" />
                                            {new Date(image.uploaded_at).toLocaleTimeString(locale, {
                                                timeZone: timezone,
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            {isLoggedIn ? (
                                                <>
                                                    <button
                                                        className="watering-delete-btn"
                                                        onClick={() => openDeleteModal("image", image.id)}
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    className="watering-delete-btn"
                                                    onClick={() =>
                                                        toast.warning(
                                                            "You must be logged in to delete uploaded image events.",
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {adviceDates[hoveredDate] && (
                            <>
                                <strong>Care Advice generated at:</strong>
                                <ul>
                                    {adviceDates[hoveredDate].map((advice) => (
                                        <li className="watering-tooltip-item" key={advice.id}>
                                            <FontAwesomeIcon icon={faWandMagicSparkles} className="advice-icon" />
                                            {new Date(advice.generated_at).toLocaleTimeString(locale, {
                                                timeZone: timezone,
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            {isLoggedIn ? (
                                                <>
                                                    <button
                                                        className="watering-delete-btn"
                                                        onClick={() => openDeleteModal("advice", advice.id)}
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    className="watering-delete-btn"
                                                    onClick={() =>
                                                        toast.warning(
                                                            "You must be logged in to delete care advice events.",
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {noteDates[hoveredDate] && (
                            <>
                                <strong>Notes added at:</strong>
                                <ul>
                                    {noteDates[hoveredDate].map((note) => (
                                        <li className="watering-tooltip-item" key={note.id}>
                                            <FontAwesomeIcon icon={faStickyNote} className="note-icon" />
                                            {new Date(note.created_at).toLocaleTimeString(locale, {
                                                timeZone: timezone,
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            {isLoggedIn ? (
                                                <button
                                                    className="watering-delete-btn"
                                                    onClick={() => openDeleteModal("note", note.id)}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            ) : (
                                                <button
                                                    className="watering-delete-btn"
                                                    onClick={() =>
                                                        toast.warning("You must be logged in to delete notes.")
                                                    }
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                }
            />
        );
    };

    return (
        <div className="watering-calendar">
            <Calendar
                locale={locale}
                tileClassName={tileClassName}
                tileContent={tileContent}
                onActiveStartDateChange={() => {
                    setHoveredDate(null);
                    setTooltipPosition(null);
                }}
                onClickDay={(date, event) => handleClickDay(date, event)}
            />
            {renderTooltip()}

            {deleteModalOpen && (
                <div className="watering-delete-modal-overlay">
                    <div className="watering-delete-modal" ref={deleteModalRef} role="dialog" aria-modal="true" aria-label="Confirm deletion">
                        <p>Are you sure you want to delete this entry?</p>
                        <div className="watering-delete-modal-buttons">
                            <button className="watering-delete-confirm" onClick={handleConfirmDelete}>
                                <FontAwesomeIcon icon={faTrash} /> Delete
                            </button>
                            <button className="watering-delete-cancel" onClick={handleCancelDelete}>
                                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
