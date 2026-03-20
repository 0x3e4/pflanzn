import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../styles/Calendar.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faCircleXmark, faSeedling, faStickyNote, faTrash } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import { LocationImage } from "../types/Location";
import { deleteLocationImage } from "../services/LocationService";
import { useAuth } from "../context/AuthContext";
import { setOverlayOpen } from "../services/overlayControl";

export interface LocationLocalNote {
    id: string;
    text: string;
    created_at: string;
}

export interface LocationSeasonEvent {
    id: string;
    title: string;
    occurred_at: string;
    created_at: string;
}

interface LocationCalendarProps {
    locationId: number;
    images: LocationImage[];
    notes: LocationLocalNote[];
    seasonEvents: LocationSeasonEvent[];
    onDeleteNote: (noteId: string) => void;
    onDeleteSeasonEvent: (eventId: string) => void;
    onChanged?: () => void;
}

interface TooltipPosition {
    top: number;
    left: number;
    width: number;
}

type DeleteTarget = { type: "image"; id: number } | { type: "note"; id: string } | { type: "season"; id: string };

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

const buildDateKey = (date: Date, locale: string, timezone: string) => {
    const parts = new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return `${year}-${month}-${day}`;
};

export default function LocationCalendar({
    locationId,
    images,
    notes,
    seasonEvents,
    onDeleteNote,
    onDeleteSeasonEvent,
    onChanged,
}: LocationCalendarProps) {
    const { isLoggedIn } = useAuth();

    const locale = import.meta.env.VITE_LOCALE;
    const timezone = import.meta.env.VITE_TZ;
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const imagesByDate = useMemo(() => {
        return images.reduce<Record<string, LocationImage[]>>((acc, image) => {
            const key = buildDateKey(new Date(image.uploaded_at), locale, timezone);
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(image);
            return acc;
        }, {});
    }, [images, locale, timezone]);

    const notesByDate = useMemo(() => {
        return notes.reduce<Record<string, LocationLocalNote[]>>((acc, note) => {
            const key = buildDateKey(new Date(note.created_at), locale, timezone);
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(note);
            return acc;
        }, {});
    }, [notes, locale, timezone]);

    const seasonEventsByDate = useMemo(() => {
        return seasonEvents.reduce<Record<string, LocationSeasonEvent[]>>((acc, event) => {
            const key = buildDateKey(new Date(event.occurred_at), locale, timezone);
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(event);
            return acc;
        }, {});
    }, [locale, seasonEvents, timezone]);

    const tileClassName = ({ date, view }: { date: Date; view: string }) => {
        if (view !== "month") {
            return "";
        }
        const key = buildDateKey(date, locale, timezone);
        const classes: string[] = [];
        if (imagesByDate[key]) {
            classes.push("image-day");
        }
        if (notesByDate[key]) {
            classes.push("note-day");
        }
        if (imagesByDate[key] && notesByDate[key]) {
            classes.push("location-dual-day");
        }
        if (seasonEventsByDate[key]) {
            classes.push("season-day");
        }
        if (imagesByDate[key] && notesByDate[key] && seasonEventsByDate[key]) {
            classes.push("location-triple-day");
        }
        return classes.join(" ");
    };

    const handleClickDay = (date: Date, event: React.MouseEvent) => {
        const dateKey = buildDateKey(date, locale, timezone);

        if (imagesByDate[dateKey] || notesByDate[dateKey] || seasonEventsByDate[dateKey]) {
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

    const openDeleteModal = (target: DeleteTarget) => {
        setHoveredDate(null);
        setTooltipPosition(null);
        setDeleteTarget(target);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to delete events.");
            return;
        }
        if (!deleteTarget) {
            return;
        }

        try {
            if (deleteTarget.type === "image") {
                await deleteLocationImage(locationId, deleteTarget.id);
                toast.success("Image deleted successfully!");
            } else if (deleteTarget.type === "note") {
                onDeleteNote(deleteTarget.id);
                toast.success("Note deleted successfully!");
            } else {
                onDeleteSeasonEvent(deleteTarget.id);
                toast.success("Season event deleted successfully!");
            }

            setDeleteModalOpen(false);
            setDeleteTarget(null);
            setHoveredDate(null);
            setTooltipPosition(null);
            onChanged?.();
        } catch (error) {
            toast.error((error as Error).message || "Failed to delete entry.");
        }
    };

    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setDeleteTarget(null);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                setTooltipPosition(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        setOverlayOpen(deleteModalOpen);
        return () => setOverlayOpen(false);
    }, [deleteModalOpen]);

    const renderTooltip = () => {
        if (
            !hoveredDate ||
            !tooltipPosition ||
            (!imagesByDate[hoveredDate] && !notesByDate[hoveredDate] && !seasonEventsByDate[hoveredDate])
        ) {
            return null;
        }

        return (
            <TooltipOverlay
                innerRef={tooltipRef}
                position={tooltipPosition}
                content={
                    <div className="watering-tooltip-content">
                        {imagesByDate[hoveredDate] && (
                            <>
                                <strong>Image uploaded at:</strong>
                                <ul>
                                    {imagesByDate[hoveredDate].map((image) => (
                                        <li className="watering-tooltip-item" key={image.id}>
                                            <FontAwesomeIcon icon={faCamera} className="image-icon" />
                                            {new Date(image.uploaded_at).toLocaleTimeString(locale, {
                                                timeZone: timezone,
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            {isLoggedIn ? (
                                                <button
                                                    className="watering-delete-btn"
                                                    onClick={() => openDeleteModal({ type: "image", id: image.id })}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
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

                        {notesByDate[hoveredDate] && (
                            <>
                                <strong>Notes added at:</strong>
                                <ul>
                                    {notesByDate[hoveredDate].map((note) => (
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
                                                    onClick={() => openDeleteModal({ type: "note", id: note.id })}
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

                        {seasonEventsByDate[hoveredDate] && (
                            <>
                                <strong>Season events at:</strong>
                                <ul>
                                    {seasonEventsByDate[hoveredDate].map((event) => (
                                        <li className="watering-tooltip-item" key={event.id}>
                                            <FontAwesomeIcon icon={faSeedling} className="note-icon" />
                                            {new Date(event.occurred_at).toLocaleTimeString(locale, {
                                                timeZone: timezone,
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            {isLoggedIn ? (
                                                <button
                                                    className="watering-delete-btn"
                                                    onClick={() => openDeleteModal({ type: "season", id: event.id })}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            ) : (
                                                <button
                                                    className="watering-delete-btn"
                                                    onClick={() =>
                                                        toast.warning("You must be logged in to delete season events.")
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
        <div className="watering-calendar location-calendar-section">
            <Calendar
                locale={locale}
                tileClassName={tileClassName}
                onActiveStartDateChange={() => {
                    setHoveredDate(null);
                    setTooltipPosition(null);
                }}
                onClickDay={(date, event) => handleClickDay(date, event as React.MouseEvent)}
            />
            {renderTooltip()}

            {deleteModalOpen && (
                <div className="watering-delete-modal-overlay">
                    <div className="watering-delete-modal">
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
