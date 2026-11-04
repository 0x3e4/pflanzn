import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { Plant } from "../types/Plant";
import { fetchPlants, waterPlant } from "../services/PlantService";
import { fetchStatistics } from "../services/StatisticService";
import { extractErrorMessage } from "../services/apiClient";
import { formatWateringDue, getWateringStatus, wateringBadgeVariant, WateringStatus } from "../services/wateringSchedule";
import "../styles/home.css";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Link } from "react-router-dom";
import { useConfig } from "../context/ConfigContext";
import { useAuth } from "../context/AuthContext";
import { useShare } from "../context/ShareContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDroplet } from "@fortawesome/free-solid-svg-icons";

type HomeOverview = {
    active: number;
    identified: number;
    species: number;
    totalWaterings: number;
    totalFertilizings: number;
    totalPhotos: number;
};

type ScheduledPlant = { plant: Plant; status: WateringStatus };

const RECENT_PHOTOS = 4;
const COMING_UP = 4;

const thumb = (plant: Plant, size: "thumb" | "medium") => {
    const latest = [...(plant.images || [])].sort(
        (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
    )[0];
    return latest ? `/api/uploads/${latest.image_path}?size=${size}` : null;
};

export default function Home() {
    const { tz: timezone, locale, authMode } = useConfig();
    const { isLoggedIn } = useAuth();
    const { isShareAccess } = useShare();
    const canWater = !isShareAccess && (authMode === "no" || isLoggedIn);
    const [plants, setPlants] = useState<Plant[]>([]);
    const [loadingPlants, setLoadingPlants] = useState(true);
    const [watering, setWatering] = useState<Set<number>>(() => new Set());
    const [overview, setOverview] = useState<HomeOverview>({
        active: 0,
        identified: 0,
        species: 0,
        totalWaterings: 0,
        totalFertilizings: 0,
        totalPhotos: 0,
    });

    useEffect(() => {
        let cancelled = false;
        Promise.all([fetchPlants(), fetchStatistics().catch(() => null)])
            .then(([data, stats]) => {
                if (cancelled) return;
                const active = data.filter((plant) => !plant.is_archived);
                setPlants(active);
                setOverview({
                    active: active.length,
                    identified: stats?.identificationsCount ?? 0,
                    species: new Set(active.map((plant) => plant.species ?? "Unknown")).size,
                    totalWaterings: data.reduce((sum, plant) => sum + (plant.waterings?.length ?? 0), 0),
                    totalFertilizings: data.reduce((sum, plant) => sum + (plant.fertilizings?.length ?? 0), 0),
                    totalPhotos: data.reduce((sum, plant) => sum + (plant.images?.length ?? 0), 0),
                });
            })
            .catch(() => !cancelled && toast.error("Failed to fetch plants."))
            .finally(() => !cancelled && setLoadingPlants(false));
        return () => {
            cancelled = true;
        };
    }, []);

    const scheduled: ScheduledPlant[] = plants
        .map((plant) => ({ plant, status: getWateringStatus(plant, timezone) }))
        .filter((entry): entry is ScheduledPlant => entry.status !== null)
        .sort((a, b) => a.status.daysUntilDue - b.status.daysUntilDue);
    const due = scheduled.filter((entry) => entry.status.needsWater);
    const comingUp = scheduled.filter((entry) => !entry.status.needsWater).slice(0, COMING_UP);
    const recent = plants
        .filter((plant) => plant.images?.length)
        .map((plant) => ({ plant, at: Math.max(...plant.images.map((img) => new Date(img.uploaded_at).getTime())) }))
        .sort((a, b) => b.at - a.at)
        .slice(0, RECENT_PHOTOS);

    // The row leaves the list once watered: that is the confirmation, no toast.
    const handleWater = async (plantIds: number[]) => {
        const nowUTC = DateTime.now().toUTC().toISO({ includeOffset: false });
        const nowLocal = DateTime.now().setZone(timezone).toISO({ includeOffset: false });
        setWatering((current) => new Set([...current, ...plantIds]));
        try {
            for (const plantId of plantIds) {
                await waterPlant(plantId, { watered_at: nowUTC ?? undefined });
                setPlants((current) =>
                    current.map((plant) => (plant.id === plantId ? { ...plant, last_watered: nowLocal as unknown as Date } : plant)),
                );
            }
            setOverview((current) => ({ ...current, totalWaterings: current.totalWaterings + plantIds.length }));
        } catch (err) {
            toast.error(extractErrorMessage(err, "Failed to water plants."));
        } finally {
            setWatering((current) => new Set([...current].filter((id) => !plantIds.includes(id))));
        }
    };

    const today = DateTime.now().setZone(timezone).setLocale(locale || "en").toLocaleString({
        weekday: "long",
        day: "numeric",
        month: "long",
    });
    const heading =
        due.length > 0
            ? `${due.length} ${due.length === 1 ? "plant needs" : "plants need"} water`
            : scheduled.length > 0
              ? "Every plant is watered"
              : "Your plants";

    const figures: [number, string][] = [
        [overview.active, "plants"],
        [overview.species, "species"],
        [overview.identified, "identified"],
        [overview.totalWaterings, "waterings"],
        [overview.totalFertilizings, "fertilizings"],
        [overview.totalPhotos, "photos"],
    ];

    return (
        <div className="container home-container">
            <section className="home-today" aria-labelledby="home-heading">
                <div className="home-today-head">
                    <div>
                        <p className="home-date">{loadingPlants ? <Skeleton width={160} /> : today}</p>
                        <h1 id="home-heading">{loadingPlants ? <Skeleton width={320} /> : heading}</h1>
                    </div>
                    {!loadingPlants &&
                        (canWater && due.length > 1 ? (
                            <button
                                type="button"
                                className="home-water-all"
                                onClick={() => handleWater(due.map((entry) => entry.plant.id))}
                                disabled={watering.size > 0}
                            >
                                <FontAwesomeIcon icon={faDroplet} /> Water all {due.length}
                            </button>
                        ) : (
                            <Link to="/plants" className="home-cta primary">
                                Open my plants
                            </Link>
                        ))}
                </div>

                <div className="home-today-grid">
                    <div className="home-due">
                        {loadingPlants ? (
                            [...Array(3)].map((_, i) => <Skeleton key={i} height={64} borderRadius={10} />)
                        ) : due.length > 0 ? (
                            <ul className="home-due-list">
                                {due.map(({ plant, status }) => {
                                    const src = thumb(plant, "thumb");
                                    return (
                                        <li key={plant.id} className="home-due-row">
                                            <Link to={`/plant/${plant.id}`} className="home-due-plant">
                                                {src ? (
                                                    <img src={src} alt="" className="home-due-thumb" />
                                                ) : (
                                                    <span className="home-due-thumb home-due-initial" aria-hidden="true">
                                                        {plant.name.charAt(0)}
                                                    </span>
                                                )}
                                                <span className="home-due-names">
                                                    <span className="home-due-name">{plant.name}</span>
                                                    {plant.species && <span className="home-due-species">{plant.species}</span>}
                                                </span>
                                            </Link>
                                            <span className={`watering-badge watering-badge--${wateringBadgeVariant(status)}`}>
                                                {formatWateringDue(status)}
                                            </span>
                                            {canWater && (
                                                <button
                                                    type="button"
                                                    className="home-due-water"
                                                    onClick={() => handleWater([plant.id])}
                                                    disabled={watering.has(plant.id)}
                                                    aria-label={`Water ${plant.name}`}
                                                >
                                                    <FontAwesomeIcon icon={faDroplet} /> Water
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="home-due-empty">
                                <p>
                                    {scheduled.length > 0
                                        ? "Nothing to water today."
                                        : "Set a watering interval on a plant and it shows up here when it is due."}
                                </p>
                                <Link to="/plants">Open my plants</Link>
                            </div>
                        )}
                    </div>

                    <aside className="home-side">
                        {comingUp.length > 0 && (
                            <section className="home-coming-up" aria-labelledby="home-coming-up">
                                <h2 id="home-coming-up">Coming up</h2>
                                <ul>
                                    {comingUp.map(({ plant, status }) => (
                                        <li key={plant.id}>
                                            <Link to={`/plant/${plant.id}`}>{plant.name}</Link>
                                            <span className={`home-when home-when--${wateringBadgeVariant(status)}`}>
                                                {formatWateringDue(status)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        <dl className="home-figures">
                            {figures.map(([value, label]) => (
                                <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{loadingPlants ? <Skeleton width={40} /> : value}</dd>
                                </div>
                            ))}
                        </dl>
                    </aside>
                </div>
            </section>

            {(loadingPlants || recent.length > 0) && (
                <section className="home-recent" aria-labelledby="home-recent">
                    <h2 id="home-recent">Recently photographed</h2>
                    <div className="home-recent-grid">
                        {loadingPlants
                            ? [...Array(RECENT_PHOTOS)].map((_, i) => <Skeleton key={i} height={180} borderRadius={12} />)
                            : recent.map(({ plant, at }) => (
                                  <Link key={plant.id} to={`/plant/${plant.id}`} className="home-recent-item">
                                      <span className="home-recent-frame">
                                          <img src={thumb(plant, "medium") ?? ""} alt={plant.name} className="home-plant-image" />
                                      </span>
                                      <span>
                                          {plant.name},{" "}
                                          {DateTime.fromMillis(at).setZone(timezone).toRelativeCalendar()}
                                      </span>
                                  </Link>
                              ))}
                    </div>
                </section>
            )}

            {recent.length === 0 && !loadingPlants && (
                <section className="home-empty-state">
                    <h2>No plant photos yet</h2>
                    <p>Add a photo to a plant and it shows up here.</p>
                    <Link to="/plants" className="home-cta primary">
                        Go to Plants
                    </Link>
                </section>
            )}
        </div>
    );
}
