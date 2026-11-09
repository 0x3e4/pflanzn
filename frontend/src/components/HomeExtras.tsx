import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DateTime } from "luxon";
import Skeleton from "react-loading-skeleton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCamera,
    faCloudRain,
    faDroplet,
    faSeedling,
    faStickyNote,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { ActivityDay, RecentEvent, fetchActivity, fetchRecent } from "../services/StatisticService";
import { careTotal, heatLevel, heatThresholds } from "../services/careHeat";
import { relativeDay } from "../services/dates";
import { getWateringStatus } from "../services/wateringSchedule";
import { Plant } from "../types/Plant";

// The home page below "Recently photographed": what happened lately, the care rhythm of the
// last twelve weeks, and the tags as areas. Everything here is what this reader may see
// anyway; the feed names who did something only for members (the backend leaves it out).

// ── Lately ──────────────────────────────────────────────────────────────────

const EVENT_ICON = {
    watering: faDroplet,
    fertilizing: faSeedling,
    photo: faCamera,
    note: faStickyNote,
    care_advice: faWandMagicSparkles,
} as const;

const EVENT_VERB = {
    watering: "Watered",
    fertilizing: "Fertilized",
    photo: "New photo",
    note: "Note",
    care_advice: "New care advice",
} as const;

const PlantNames = ({ plants }: { plants: RecentEvent["plants"] }) => {
    const shown = plants.slice(0, 2);
    const more = plants.length - shown.length;
    return (
        <span className="home-lately-plants">
            {shown.map((plant, i) => (
                <span key={plant.id}>
                    {i > 0 && (more > 0 || i < shown.length - 1 ? ", " : " and ")}
                    <Link to={`/plant/${plant.id}`}>{plant.name}</Link>
                </span>
            ))}
            {more > 0 && ` and ${more} more`}
        </span>
    );
};

export function HomeLately({ timezone, locale }: { timezone: string; locale: string }) {
    const [events, setEvents] = useState<RecentEvent[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchRecent()
            .then((data) => !cancelled && setEvents(data.events))
            .catch(() => !cancelled && setEvents([]));
        return () => {
            cancelled = true;
        };
    }, []);

    const when = (iso: string) => {
        const at = DateTime.fromISO(iso, { zone: timezone });
        const day = relativeDay(at);
        return day === "today" ? `today, ${at.setLocale(locale || "en").toLocaleString(DateTime.TIME_SIMPLE)}` : day;
    };

    return (
        <section className="home-lately" aria-labelledby="home-lately">
            <h2 id="home-lately">Lately</h2>
            {events === null ? (
                [...Array(4)].map((_, i) => <Skeleton key={i} height={44} />)
            ) : events.length === 0 ? (
                <p className="home-muted">Nothing logged in the last two weeks.</p>
            ) : (
                <ol className="home-lately-list">
                    {events.map((event, i) => {
                        const what =
                            event.type === "watering" && event.rain ? "Watered by rain" : EVENT_VERB[event.type];
                        const who = event.by && !(event.type === "watering" && event.rain) ? ` by ${event.by}` : "";
                        return (
                            <li key={`${event.at}-${i}`} className="home-lately-item">
                                <span className={`home-lately-icon is-${event.rain ? "rain" : event.type}`} aria-hidden>
                                    <FontAwesomeIcon icon={event.rain ? faCloudRain : EVENT_ICON[event.type]} />
                                </span>
                                <span className="home-lately-body">
                                    <PlantNames plants={event.plants} />
                                    <span className="home-lately-meta">
                                        {what}
                                        {who}, <time dateTime={event.at}>{when(event.at)}</time>
                                    </span>
                                    {event.detail && <span className="home-lately-detail">{event.detail}</span>}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

// ── Care rhythm ─────────────────────────────────────────────────────────────

const RHYTHM_WEEKS = 12;

export function HomeRhythm({ locale }: { locale: string }) {
    const [days, setDays] = useState<ActivityDay[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchActivity()
            .then((data) => !cancelled && setDays(data.days))
            .catch(() => !cancelled && setDays([]));
        return () => {
            cancelled = true;
        };
    }, []);

    // Whole weeks, Monday first, ending with this one (its later days are still empty).
    const recent = useMemo(() => {
        if (!days || days.length === 0) return [];
        const last = DateTime.fromISO(days[days.length - 1].date);
        const firstMonday = last.minus({ days: last.weekday - 1 }).minus({ weeks: RHYTHM_WEEKS - 1 });
        const start = firstMonday.toISODate() ?? "";
        return days.filter((day) => day.date >= start);
    }, [days]);
    const thresholds = useMemo(() => heatThresholds(days ?? []), [days]);

    if (days === null) return <Skeleton height={130} />;
    if (recent.length === 0) return null;

    const last30 = recent.slice(-30);
    const careDays = last30.filter((day) => careTotal(day) > 0).length;
    const today = recent[recent.length - 1];
    const weekStart = DateTime.fromISO(today.date).weekday - 1;
    const thisWeek = recent.slice(-(weekStart + 1)).reduce((sum, day) => sum + day.waterings, 0);
    const label = `Care on ${careDays} of the last ${last30.length} days; ${thisWeek} waterings this week.`;
    const fmt = (iso: string) =>
        DateTime.fromISO(iso)
            .setLocale(locale || "en")
            .toLocaleString(DateTime.DATE_MED);

    return (
        <section className="home-rhythm" aria-labelledby="home-rhythm">
            <h2 id="home-rhythm">Care rhythm</h2>
            <p className="home-rhythm-figures">
                <span>
                    <strong>{careDays}</strong> of the last {last30.length} days with care
                </span>
                <span>
                    <strong>{thisWeek}</strong> {thisWeek === 1 ? "watering" : "waterings"} this week
                </span>
            </p>
            <div className="home-rhythm-grid" role="img" aria-label={label}>
                {recent.map((day) => {
                    const total = careTotal(day);
                    return (
                        <span
                            key={day.date}
                            className="home-rhythm-cell"
                            style={{ background: `var(--heat-${heatLevel(total, thresholds)})` }}
                            title={
                                total === 0
                                    ? `${fmt(day.date)}: nothing logged`
                                    : `${fmt(day.date)}: ${day.waterings} waterings, ${day.fertilizings} fertilizings, ${day.photos} photos`
                            }
                        />
                    );
                })}
            </div>
            <Link to="/manage?section=statistics" className="home-rhythm-more">
                The whole year in Statistics
            </Link>
        </section>
    );
}

// ── Your areas ──────────────────────────────────────────────────────────────

const AREAS = 6;

export function HomeAreas({ plants, timezone }: { plants: Plant[]; timezone: string }) {
    const areas = useMemo(() => {
        const byTag = new Map<string, { count: number; due: number }>();
        plants.forEach((plant) => {
            const due = Boolean(getWateringStatus(plant, timezone)?.needsWater);
            plant.tags.forEach((tag) => {
                const area = byTag.get(tag.name) ?? { count: 0, due: 0 };
                area.count += 1;
                if (due) area.due += 1;
                byTag.set(tag.name, area);
            });
        });
        return [...byTag.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).slice(0, AREAS);
    }, [plants, timezone]);

    if (areas.length === 0) return null;

    return (
        <section className="home-areas" aria-labelledby="home-areas">
            <h2 id="home-areas">Your areas</h2>
            <ul className="home-areas-grid">
                {areas.map(([name, { count, due }]) => (
                    <li key={name}>
                        <Link to={`/plants?tag=${encodeURIComponent(name)}`} className="home-area">
                            <span className="home-area-name">#{name}</span>
                            <span className="home-area-count">
                                {count} {count === 1 ? "plant" : "plants"}
                            </span>
                            {due > 0 && <span className="home-area-due">{due} need water</span>}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
