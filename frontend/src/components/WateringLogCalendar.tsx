import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import "../styles/wateringLogCalendar.css";
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { PlantWatering } from '../services/Plant';

interface Props {
    waterings: PlantWatering[];
}

interface TooltipPosition {
    top: number;
    left: number;
    width: number;
}

function WateringTooltipOverlay({ content, position }: { content: React.ReactNode; position: TooltipPosition }) {
    const style: React.CSSProperties = {
        position: 'absolute',
        top: position.top + position.width + 4,
        left: position.left + position.width / 2,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: 'var(--background-color)',
        color: 'var(--text-color)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        borderRadius: '8px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: 0.95,
        padding: 0,
    };    

    return createPortal(
        <div style={style}>
            {content}
        </div>,
        document.body
    );
}

export default function WateringLogCalendar({ waterings }: Props) {
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);

    const locale = import.meta.env.VITE_Locale || 'en-GB';
    const timezone = import.meta.env.VITE_TZ || 'Europe/Vienna';

    const wateredDates = waterings.reduce((acc, watering) => {
        const date = new Date(watering.watered_at);
        const formatter = new Intl.DateTimeFormat('en-CA', {
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
        const formatter = new Intl.DateTimeFormat('en-CA', {
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
        const formatter = new Intl.DateTimeFormat('en-CA', {
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
                                <li key={watering.id}>
                                    {new Date(watering.watered_at).toLocaleTimeString(locale, {
                                        timeZone: timezone,
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </li>
                            ))}
                        </ul>
                    </div>
                }
            />
        );
    };

    return (
        <div
            className="watering-calendar"
            onMouseLeave={() => {
                setHoveredDate(null);
                setTooltipPosition(null);
            }}
        >
            <Calendar
                tileClassName={tileClassName}
                onActiveStartDateChange={() => {
                    setHoveredDate(null);
                    setTooltipPosition(null);
                }}
                onClickDay={(date, event) => handleClickDay(date, event)}
            />
            {renderTooltip()}
        </div>
    );
}
