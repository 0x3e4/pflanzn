import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import "../styles/wateringLogCalendar.css";
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PlantWatering, deleteWatering } from '../services/Plant';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { toast } from 'react-toastify';

interface Props {
    waterings: PlantWatering[];
    plantId: number;
}

interface TooltipPosition {
    top: number;
    left: number;
    width: number;
}

function WateringTooltipOverlay({ content, position }: { content: React.ReactNode; position: TooltipPosition }) {
    const style: React.CSSProperties = {
        position: 'absolute',
        top: position.top + position.width + 6,
        left: position.left + position.width / 2,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: 'var(--background-color)',
        color: 'var(--text-color)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        borderRadius: '8px',
        padding: '8px',
        pointerEvents: 'auto',
        opacity: 1,
        whiteSpace: 'nowrap',
    };    

    return createPortal(
        <div style={style} className="watering-tooltip-overlay">
            {content}
        </div>,
        document.body
    );
}

export default function WateringLogCalendar({ waterings, plantId }: Props) {
    const [localWaterings, setLocalWaterings] = useState<PlantWatering[]>(waterings);
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [wateringToDelete, setWateringToDelete] = useState<number | null>(null);

    useEffect(() => {
        setLocalWaterings(waterings); // sync with parent updates
    }, [waterings]);

    const locale = import.meta.env.VITE_Locale;
    const timezone = import.meta.env.VITE_TZ;

    const wateredDates = localWaterings.reduce((acc, watering) => {
        const date = new Date(watering.watered_at);
        const formatter = new Intl.DateTimeFormat(locale, {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const parts = formatter.formatToParts(date);
        const dateKey = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;

        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(watering);
        return acc;
    }, {} as Record<string, PlantWatering[]>);

    const tileClassName = ({ date }: { date: Date }) => {
        const formatter = new Intl.DateTimeFormat(locale, {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const parts = formatter.formatToParts(date);
        const dateKey = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;

        return wateredDates[dateKey] ? 'watered-day' : '';
    };

    const handleClickDay = (date: Date, event: React.MouseEvent) => {
        const formatter = new Intl.DateTimeFormat(locale, {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const parts = formatter.formatToParts(date);
        const dateKey = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;

        if (wateredDates[dateKey]) {
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

    const openDeleteModal = (wateringId: number) => {
        setWateringToDelete(wateringId);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (wateringToDelete === null) return;
        await deleteWatering(plantId, wateringToDelete);
        setLocalWaterings((prev) => prev.filter(w => w.id !== wateringToDelete));
        toast.success("Watering deleted successfully!");
        setDeleteModalOpen(false);
        setHoveredDate(null);
    };

    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setWateringToDelete(null);
    };

    const renderTooltip = () => {
        if (!hoveredDate || !wateredDates[hoveredDate] || !tooltipPosition) return null;

        return (
            <WateringTooltipOverlay
                position={tooltipPosition}
                content={
                    <div className="watering-tooltip-content">
                        <strong>Watered at:</strong>
                        <ul style={{ paddingLeft: '0', margin: '4px 0 0 0' }}>
                            {wateredDates[hoveredDate].map(watering => (
                                <li key={watering.id} className="watering-tooltip-item">
                                    {new Date(watering.watered_at).toLocaleTimeString(locale, {
                                        timeZone: timezone,
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                    <button
                                        className="watering-delete-btn"
                                        onClick={() => openDeleteModal(watering.id)}
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </li>
                            ))}
                        </ul>
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
                onActiveStartDateChange={() => {
                    setHoveredDate(null);
                    setTooltipPosition(null);
                }}
                onClickDay={(date, event) => handleClickDay(date, event)}
            />
            {renderTooltip()}

            {deleteModalOpen && (
                <div className="watering-delete-modal-overlay">
                    <div className="watering-delete-modal">
                        <p>Are you sure you want to delete this watering entry?</p>
                        <div className="watering-delete-modal-buttons">
                            <button className="watering-delete-confirm" onClick={handleConfirmDelete}>
                                Delete
                            </button>
                            <button className="watering-delete-cancel" onClick={handleCancelDelete}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}