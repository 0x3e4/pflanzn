import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DateTime } from "luxon";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
    ActivityDay,
    ActivityWeek,
    CaredPlant,
    RecentCount,
    StatisticsActivity,
    StatisticsSummary,
    fetchActivity,
    fetchStatistics,
} from "../services/StatisticService";
import { fetchPlants } from "../services/PlantService";
import { getWateringStatus } from "../services/wateringSchedule";
import { useConfig } from "../context/ConfigContext";
import { Plant } from "../types/Plant";
import "../styles/statisticsPanel.css";

// ── Tooltip ────────────────────────────────────────────────────────────────
// One tooltip for the whole panel. Marks set it on hover and on keyboard focus;
// it only repeats what a label or a table view already shows.

interface Tip {
    x: number;
    y: number;
    title: string;
    rows: { label: string; value: string; color?: string }[];
}

type ShowTip = (target: Element, tip: Omit<Tip, "x" | "y">, event?: { clientX: number; clientY: number }) => void;

function useTooltip() {
    const [tip, setTip] = useState<Tip | null>(null);
    const show: ShowTip = (target, content, event) => {
        const rect = target.getBoundingClientRect();
        setTip({
            ...content,
            x: event ? event.clientX : rect.left + rect.width / 2,
            y: event ? event.clientY : rect.top,
        });
    };
    const hide = useCallback(() => setTip(null), []);
    return { tip, show, hide };
}

function Tooltip({ tip }: { tip: Tip | null }) {
    if (!tip) return null;
    // Keep it on screen: flip to the left half when the pointer is on the right.
    const flip = tip.x > window.innerWidth - 240;
    return (
        <div
            className="stats-tooltip"
            role="status"
            style={{
                left: flip ? undefined : tip.x + 14,
                right: flip ? window.innerWidth - tip.x + 14 : undefined,
                top: tip.y + 14,
            }}
        >
            <p className="stats-tooltip-title">{tip.title}</p>
            {tip.rows.map((row) => (
                <p key={row.label} className="stats-tooltip-row">
                    {row.color && <span className="stats-key-line" style={{ background: row.color }} aria-hidden />}
                    <strong>{row.value}</strong> <span>{row.label}</span>
                </p>
            ))}
        </div>
    );
}

const markProps = (show: ShowTip, hide: () => void, content: Omit<Tip, "x" | "y">) => ({
    onPointerEnter: (e: React.PointerEvent) => show(e.currentTarget, content, e),
    onPointerMove: (e: React.PointerEvent) => show(e.currentTarget, content, e),
    onPointerLeave: hide,
    onFocus: (e: React.FocusEvent) => show(e.currentTarget, content),
    onBlur: hide,
});

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

// ── Figures ────────────────────────────────────────────────────────────────

function Figure({ label, value, recent }: { label: string; value?: number; recent?: RecentCount }) {
    let trend = "";
    if (recent) {
        const { last30, previous30 } = recent;
        trend =
            last30 === previous30
                ? `${last30.toLocaleString()} in the last 30 days, as many as before`
                : `${last30.toLocaleString()} in the last 30 days, ${last30 > previous30 ? "up" : "down"} from ${previous30.toLocaleString()}`;
    }
    return (
        <div className="stats-figure">
            <dt>{label}</dt>
            <dd className="stats-figure-value">{value === undefined ? "—" : value.toLocaleString()}</dd>
            {recent && <dd className="stats-figure-recent">{trend}</dd>}
        </div>
    );
}

// ── Watering status ────────────────────────────────────────────────────────

interface StatusPart {
    key: string;
    label: string;
    count: number;
    color: string;
    href?: string;
}

function WateringStatusBar({ parts, show, hide }: { parts: StatusPart[]; show: ShowTip; hide: () => void }) {
    const total = parts.reduce((sum, part) => sum + part.count, 0);
    if (total === 0) return <p className="stats-empty">No active plants yet.</p>;
    const summary = parts.map((part) => `${part.label}: ${part.count}`).join(", ");
    return (
        <>
            <div className="stats-segmented" role="img" aria-label={`Watering status of ${total} plants. ${summary}`}>
                {parts
                    .filter((part) => part.count > 0)
                    .map((part) => (
                        <span
                            key={part.key}
                            className="stats-segment"
                            style={{ flexGrow: part.count, background: part.color }}
                            {...markProps(show, hide, {
                                title: part.label,
                                rows: [
                                    {
                                        label: part.count === 1 ? "plant" : "plants",
                                        value: part.count.toLocaleString(),
                                    },
                                    { label: "of the collection", value: `${Math.round((part.count / total) * 100)}%` },
                                ],
                            })}
                        />
                    ))}
            </div>
            <ul className="stats-legend">
                {parts.map((part) => {
                    const content = (
                        <>
                            <span className="stats-swatch" style={{ background: part.color }} aria-hidden />
                            <span className="stats-legend-label">{part.label}</span>
                            <strong>{part.count.toLocaleString()}</strong>
                        </>
                    );
                    return (
                        <li key={part.key}>
                            {part.href && part.count > 0 ? <Link to={part.href}>{content}</Link> : content}
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

// ── Care calendar ──────────────────────────────────────────────────────────

const careTotal = (day: ActivityDay) => day.waterings + day.fertilizings + day.photos;

// Four steps from the quartiles of the days that had any care, so a busy rain day
// doesn't flatten a quiet collection into one shade.
function heatThresholds(days: ActivityDay[]): number[] {
    const values = days
        .map(careTotal)
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
    if (values.length === 0) return [1, 2, 3];
    const at = (q: number) => values[Math.min(values.length - 1, Math.floor(q * values.length))];
    return [at(0.25), at(0.5), at(0.75)];
}

const heatLevel = (n: number, [q1, q2, q3]: number[]) => (n === 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4);

function CareCalendar({
    days,
    locale,
    show,
    hide,
}: {
    days: ActivityDay[];
    locale: string;
    show: ShowTip;
    hide: () => void;
}) {
    const thresholds = useMemo(() => heatThresholds(days), [days]);
    const scrollRef = useRef<HTMLDivElement>(null);
    // On a narrow screen the year doesn't fit; start at today, the end readers care about.
    useEffect(() => {
        const strip = scrollRef.current;
        if (strip) strip.scrollLeft = strip.scrollWidth;
    }, [days]);
    if (days.length === 0) return null;

    const first = DateTime.fromISO(days[0].date);
    const leading = first.weekday - 1; // Monday first
    const weeks = Math.ceil((leading + days.length) / 7);

    const months: { column: number; label: string }[] = [];
    days.forEach((day, index) => {
        const date = DateTime.fromISO(day.date);
        if (date.day === 1 || index === 0) {
            const column = Math.floor((leading + index) / 7);
            if (!months.length || column - months[months.length - 1].column >= 3) {
                months.push({ column, label: date.setLocale(locale).toFormat("LLL") });
            }
        }
    });

    const careDays = days.filter((day) => careTotal(day) > 0).length;
    const busiest = days.reduce((best, day) => (careTotal(day) > careTotal(best) ? day : best), days[0]);
    const label =
        careDays === 0
            ? "No care logged in the past year."
            : `Care on ${careDays} of the last ${days.length} days. Busiest day: ${DateTime.fromISO(busiest.date)
                  .setLocale(locale)
                  .toLocaleString(DateTime.DATE_MED)} with ${careTotal(busiest)}.`;

    return (
        <>
            <div className="stats-calendar-scroll" ref={scrollRef}>
                <div className="stats-calendar" style={{ "--weeks": weeks } as React.CSSProperties}>
                    <div className="stats-calendar-months" aria-hidden>
                        {months.map((month) => (
                            <span key={month.column} style={{ gridColumnStart: month.column + 1 }}>
                                {month.label}
                            </span>
                        ))}
                    </div>
                    <div className="stats-calendar-weekdays" aria-hidden>
                        <span>Mon</span>
                        <span />
                        <span>Wed</span>
                        <span />
                        <span>Fri</span>
                        <span />
                        <span />
                    </div>
                    <div className="stats-calendar-grid" role="img" aria-label={label}>
                        {Array.from({ length: leading }, (_, i) => (
                            <span key={`pad-${i}`} className="stats-cell stats-cell-pad" />
                        ))}
                        {days.map((day) => {
                            const total = careTotal(day);
                            return (
                                <span
                                    key={day.date}
                                    className="stats-cell"
                                    style={{ background: `var(--heat-${heatLevel(total, thresholds)})` }}
                                    {...markProps(show, hide, {
                                        title: DateTime.fromISO(day.date)
                                            .setLocale(locale)
                                            .toLocaleString(DateTime.DATE_MED_WITH_WEEKDAY),
                                        rows:
                                            total === 0
                                                ? [{ label: "nothing logged", value: "—" }]
                                                : [
                                                      { label: "waterings", value: String(day.waterings) },
                                                      { label: "fertilizings", value: String(day.fertilizings) },
                                                      { label: "photos", value: String(day.photos) },
                                                  ],
                                    })}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="stats-calendar-foot">
                <p className="stats-note">{label}</p>
                <div className="stats-heat-key" aria-hidden>
                    <span>Less</span>
                    {[0, 1, 2, 3, 4].map((level) => (
                        <span key={level} className="stats-cell" style={{ background: `var(--heat-${level})` }} />
                    ))}
                    <span>More</span>
                </div>
            </div>
            <details className="stats-table-view">
                <summary>Show as table</summary>
                <MonthTable days={days} locale={locale} />
            </details>
        </>
    );
}

function MonthTable({ days, locale }: { days: ActivityDay[]; locale: string }) {
    const months = new Map<string, { waterings: number; fertilizings: number; photos: number }>();
    days.forEach((day) => {
        const key = day.date.slice(0, 7);
        const month = months.get(key) ?? { waterings: 0, fertilizings: 0, photos: 0 };
        month.waterings += day.waterings;
        month.fertilizings += day.fertilizings;
        month.photos += day.photos;
        months.set(key, month);
    });
    return (
        <table className="stats-table">
            <thead>
                <tr>
                    <th scope="col">Month</th>
                    <th scope="col">Waterings</th>
                    <th scope="col">Fertilizings</th>
                    <th scope="col">Photos</th>
                </tr>
            </thead>
            <tbody>
                {[...months.entries()].reverse().map(([key, month]) => (
                    <tr key={key}>
                        <th scope="row">{DateTime.fromISO(`${key}-01`).setLocale(locale).toFormat("LLLL yyyy")}</th>
                        <td>{month.waterings}</td>
                        <td>{month.fertilizings}</td>
                        <td>{month.photos}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// ── Waterings per week ─────────────────────────────────────────────────────

const niceMax = (n: number) => {
    if (n <= 4) return Math.max(n, 1);
    const step = Math.pow(10, Math.floor(Math.log10(n)));
    const top = [1, 2, 2.5, 5, 10].map((m) => m * step).find((v) => v >= n) ?? n;
    return top;
};

function WeeklyWaterings({
    weeks,
    locale,
    show,
    hide,
}: {
    weeks: ActivityWeek[];
    locale: string;
    show: ShowTip;
    hide: () => void;
}) {
    const max = niceMax(Math.max(0, ...weeks.map((week) => week.manual + week.rain)));
    const ticks = [max, max / 2, 0];
    const label = (week: ActivityWeek) => DateTime.fromISO(week.start).setLocale(locale).toFormat("d LLL");
    const anyRain = weeks.some((week) => week.rain > 0);
    const total = weeks.reduce((sum, week) => sum + week.manual + week.rain, 0);

    return (
        <>
            <ul className="stats-legend stats-legend-inline">
                <li>
                    <span className="stats-swatch" style={{ background: "var(--chart-manual)" }} aria-hidden />
                    <span className="stats-legend-label">By hand</span>
                </li>
                <li>
                    <span className="stats-swatch" style={{ background: "var(--chart-rain)" }} aria-hidden />
                    <span className="stats-legend-label">By rain{anyRain ? "" : " (none yet)"}</span>
                </li>
            </ul>
            <div
                className="stats-columns"
                role="img"
                aria-label={`${plural(total, "watering")} in the last ${weeks.length} weeks. Details in the table below.`}
            >
                <div className="stats-columns-axis" aria-hidden>
                    {ticks.map((tick) => (
                        <span key={tick}>{Number.isInteger(tick) ? tick.toLocaleString() : tick.toFixed(1)}</span>
                    ))}
                </div>
                <div className="stats-columns-plot">
                    <div className="stats-gridlines" aria-hidden>
                        {ticks.map((tick) => (
                            <span key={tick} className="stats-gridline" style={{ bottom: `${(tick / max) * 100}%` }} />
                        ))}
                    </div>
                    {weeks.map((week, index) => {
                        const sum = week.manual + week.rain;
                        return (
                            <div
                                key={week.start}
                                className="stats-column"
                                {...markProps(show, hide, {
                                    title: `Week of ${label(week)}${index === weeks.length - 1 ? " (so far)" : ""}`,
                                    rows: [
                                        { label: "by hand", value: String(week.manual), color: "var(--chart-manual)" },
                                        { label: "by rain", value: String(week.rain), color: "var(--chart-rain)" },
                                    ],
                                })}
                            >
                                <div className="stats-column-stack" style={{ height: `${(sum / max) * 100}%` }}>
                                    {sum > 0 && <span className="stats-column-value">{sum.toLocaleString()}</span>}
                                    {week.rain > 0 && (
                                        <span
                                            className="stats-column-part"
                                            style={{ flexGrow: week.rain, background: "var(--chart-rain)" }}
                                        />
                                    )}
                                    {week.manual > 0 && (
                                        <span
                                            className="stats-column-part"
                                            style={{ flexGrow: week.manual, background: "var(--chart-manual)" }}
                                        />
                                    )}
                                </div>
                                <span className="stats-column-label">
                                    {index % 2 === weeks.length % 2 ? "" : label(week)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            <details className="stats-table-view">
                <summary>Show as table</summary>
                <table className="stats-table">
                    <thead>
                        <tr>
                            <th scope="col">Week of</th>
                            <th scope="col">By hand</th>
                            <th scope="col">By rain</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...weeks].reverse().map((week) => (
                            <tr key={week.start}>
                                <th scope="row">{label(week)}</th>
                                <td>{week.manual}</td>
                                <td>{week.rain}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </>
    );
}

// ── Bars and lists ─────────────────────────────────────────────────────────

function BarList({ items, empty }: { items: { label: string; value: number; href?: string }[]; empty: string }) {
    if (items.length === 0) return <p className="stats-empty">{empty}</p>;
    const max = Math.max(...items.map((item) => item.value));
    return (
        <ul className="stats-bars">
            {items.map((item) => (
                <li key={item.label}>
                    {item.href ? (
                        <Link to={item.href} className="stats-bar-label">
                            {item.label}
                        </Link>
                    ) : (
                        <span className="stats-bar-label">{item.label}</span>
                    )}
                    <span className="stats-bar-track">
                        <span className="stats-bar" style={{ width: `${(item.value / max) * 100}%` }} />
                        <span className="stats-bar-value">{item.value.toLocaleString()}</span>
                    </span>
                </li>
            ))}
        </ul>
    );
}

function CaredList({ plants }: { plants: CaredPlant[] }) {
    if (plants.length === 0) return <p className="stats-empty">Nothing logged by hand lately.</p>;
    return (
        <ol className="stats-plant-list">
            {plants.map((plant) => {
                const parts = [
                    plant.waterings && plural(plant.waterings, "watering"),
                    plant.fertilizings && plural(plant.fertilizings, "fertilizing"),
                    plant.photos && plural(plant.photos, "photo"),
                    plant.notes && plural(plant.notes, "note"),
                ].filter(Boolean);
                return (
                    <li key={plant.id}>
                        <Link to={`/plant/${plant.id}`}>{plant.name}</Link>
                        <span>{parts.join(", ")}</span>
                    </li>
                );
            })}
        </ol>
    );
}

function ThirstyList({ plants, timezone, locale }: { plants: Plant[]; timezone: string; locale: string }) {
    const watered = plants
        .filter((plant) => plant.last_watered)
        .map((plant) => ({ plant, at: DateTime.fromISO(String(plant.last_watered), { zone: timezone }) }))
        .filter(({ at }) => at.isValid)
        .sort((a, b) => a.at.toMillis() - b.at.toMillis())
        .slice(0, 5);
    const never = plants.filter((plant) => !plant.last_watered).length;
    if (watered.length === 0 && never === 0) return <p className="stats-empty">No active plants yet.</p>;
    return (
        <>
            <ol className="stats-plant-list">
                {watered.map(({ plant, at }) => (
                    <li key={plant.id}>
                        <Link to={`/plant/${plant.id}`}>{plant.name}</Link>
                        <span>{at.setLocale(locale).toRelativeCalendar({ unit: "days" })}</span>
                    </li>
                ))}
            </ol>
            {never > 0 && <p className="stats-note">{plural(never, "plant")} never watered yet.</p>}
        </>
    );
}

// ── Panel ──────────────────────────────────────────────────────────────────

export default function StatisticsPanel() {
    const { tz: timezone, locale } = useConfig();
    const [summary, setSummary] = useState<StatisticsSummary | null>(null);
    const [activity, setActivity] = useState<StatisticsActivity | null>(null);
    const [plants, setPlants] = useState<Plant[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { tip, show, hide } = useTooltip();
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        Promise.allSettled([fetchStatistics(), fetchActivity(), fetchPlants()]).then(([s, a, p]) => {
            if (cancelled) return;
            if (s.status === "fulfilled") setSummary(s.value);
            if (a.status === "fulfilled") setActivity(a.value);
            if (p.status === "fulfilled") setPlants(p.value);
            if ([s, a, p].some((result) => result.status === "rejected")) {
                setError("Some statistics could not be loaded.");
            }
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // The tooltip follows the pointer in viewport coordinates; scrolling would strand it.
    useEffect(() => {
        window.addEventListener("scroll", hide, true);
        return () => window.removeEventListener("scroll", hide, true);
    }, [hide]);

    const active = useMemo(() => (plants ?? []).filter((plant) => !plant.is_archived), [plants]);

    const statusParts = useMemo<StatusPart[]>(() => {
        const counts = { overdue: 0, today: 0, soon: 0, ok: 0, none: 0 };
        active.forEach((plant) => {
            const status = getWateringStatus(plant, timezone);
            if (!status) counts.none += 1;
            else if (status.daysUntilDue < 0) counts.overdue += 1;
            else if (status.daysUntilDue === 0) counts.today += 1;
            else if (status.daysUntilDue === 1) counts.soon += 1;
            else counts.ok += 1;
        });
        return [
            {
                key: "overdue",
                label: "Overdue",
                count: counts.overdue,
                color: "var(--chart-overdue)",
                href: "/plants?needs_water=1",
            },
            {
                key: "today",
                label: "Due today",
                count: counts.today,
                color: "var(--chart-today)",
                href: "/plants?needs_water=1",
            },
            { key: "soon", label: "Due tomorrow", count: counts.soon, color: "var(--chart-soon)" },
            { key: "ok", label: "Fine for now", count: counts.ok, color: "var(--chart-ok)" },
            { key: "none", label: "No schedule", count: counts.none, color: "var(--chart-none)" },
        ];
    }, [active, timezone]);

    const tagBars = useMemo(() => {
        const counts = new Map<string, number>();
        active.forEach((plant) => plant.tags.forEach((tag) => counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1)));
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 8)
            .map(([name, value]) => ({ label: `#${name}`, value, href: `/plants?tag=${encodeURIComponent(name)}` }));
    }, [active]);

    const outdoor = active.filter((plant) => plant.is_outdoor).length;
    const speciesBars = (summary?.topSpecies ?? [])
        .filter((species) => species.name)
        .map((species) => ({
            label: species.name as string,
            value: species.count,
            href: `/plants?species=${encodeURIComponent(species.name as string)}`,
        }));

    const card = (id: string, title: string, children: React.ReactNode, wide = false, sub?: string) => (
        <section className={`stats-card${wide ? " stats-card-wide" : ""}`} aria-labelledby={id}>
            <div className="stats-card-head">
                <h3 id={id}>{title}</h3>
                {sub && <p className="stats-note">{sub}</p>}
            </div>
            {loading ? <Skeleton height={wide ? 140 : 120} /> : children}
        </section>
    );

    return (
        <div className="statistics-panel" ref={panelRef}>
            <h2>Statistics</h2>

            {error && <p className="stats-error">{error}</p>}

            <dl className="stats-figures">
                {loading ? (
                    [...Array(6)].map((_, index) => (
                        <div key={index} className="stats-figure">
                            <Skeleton height={56} />
                        </div>
                    ))
                ) : (
                    <>
                        <Figure label="active plants" value={summary?.totalPlants} />
                        <Figure label="waterings" value={summary?.totalWaterings} recent={activity?.recent.waterings} />
                        <Figure
                            label="fertilizings"
                            value={summary?.totalFertilizings}
                            recent={activity?.recent.fertilizings}
                        />
                        <Figure label="photos" value={summary?.totalImages} recent={activity?.recent.photos} />
                        <Figure label="identified" value={summary?.identificationsCount} />
                        <Figure label="archived" value={summary?.archivedPlants} />
                    </>
                )}
            </dl>

            <div className="stats-grid">
                {card(
                    "stats-status",
                    "Watering right now",
                    plants ? <WateringStatusBar parts={statusParts} show={show} hide={hide} /> : null,
                    true,
                    plants
                        ? `${plural(active.length, "active plant")}; overdue and due today open the list.`
                        : undefined,
                )}

                {card(
                    "stats-calendar",
                    "Care over the past year",
                    activity ? <CareCalendar days={activity.days} locale={locale} show={show} hide={hide} /> : null,
                    true,
                    "Waterings, fertilizing and photos per day.",
                )}

                {card(
                    "stats-weeks",
                    "Waterings per week",
                    activity ? (
                        <WeeklyWaterings weeks={activity.weeks} locale={locale} show={show} hide={hide} />
                    ) : null,
                    true,
                    "The last twelve weeks, the current one so far.",
                )}

                {card(
                    "stats-tags",
                    "Plants per tag",
                    <>
                        <BarList items={tagBars} empty="No tags yet." />
                        {active.length > 0 && (
                            <p className="stats-note">
                                {plural(active.length - outdoor, "plant")} indoors, {outdoor.toLocaleString()} outdoors.
                            </p>
                        )}
                    </>,
                )}

                {card("stats-species", "Top species", <BarList items={speciesBars} empty="No species recorded yet." />)}

                {card(
                    "stats-cared",
                    "Most cared for",
                    activity ? <CaredList plants={activity.mostCared} /> : null,
                    false,
                    `By hand, the last ${activity?.mostCaredDays ?? 90} days.`,
                )}

                {card(
                    "stats-thirsty",
                    "Longest without water",
                    plants ? <ThirstyList plants={active} timezone={timezone} locale={locale} /> : null,
                )}
            </div>

            <Tooltip tip={tip} />
        </div>
    );
}
