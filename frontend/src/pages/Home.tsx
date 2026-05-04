import { useEffect, useState } from "react";
import SliderModule from "react-slick";
const Slider = (SliderModule as { default?: typeof SliderModule }).default || SliderModule;
import { Plant } from "../types/Plant";
import { fetchPlants } from "../services/PlantService";
import { fetchStatistics } from "../services/StatisticService";
import "../styles/home.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCamera,
    faDroplet,
    faFlask,
    faImage,
    faMagnifyingGlass,
    faSeedling,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";

type HomeOverview = {
    total: number;
    active: number;
    identified: number;
    species: number;
    totalWaterings: number;
    totalFertilizings: number;
    totalPhotos: number;
};

export default function Home() {
    const [plants, setPlants] = useState<Plant[]>([]);
    const [loadingPlants, setLoadingPlants] = useState(true);
    const [speciesCounts, setSpeciesCounts] = useState<Record<string, number>>({});
    const [allImagesLoaded, setAllImagesLoaded] = useState(false);
    const [loadedImagesCount, setLoadedImagesCount] = useState(0);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [overview, setOverview] = useState<HomeOverview>({
        total: 0,
        active: 0,
        identified: 0,
        species: 0,
        totalWaterings: 0,
        totalFertilizings: 0,
        totalPhotos: 0,
    });

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Determine number of skeleton slides based on screen size
    const getSkeletonCount = () => {
        if (windowWidth <= 600) return 1; // Mobile
        if (windowWidth <= 1024) return 2; // Tablet
        return 3; // Desktop
    };

    useEffect(() => {
        loadPlants();
    }, []);

    // Reset image loading state when plants change
    useEffect(() => {
        if (plants.length > 0) {
            setLoadedImagesCount(0);
            setAllImagesLoaded(false);
        }
    }, [plants]);

    // Check if all images are loaded
    useEffect(() => {
        if (plants.length > 0 && loadedImagesCount >= plants.length) {
            setAllImagesLoaded(true);
        }
    }, [loadedImagesCount, plants.length]);

    const loadPlants = async () => {
        try {
            const [data, stats] = await Promise.all([
                fetchPlants(),
                fetchStatistics().catch(() => null),
            ]);
            const nonArchivedPlants = data.filter((plant) => !plant.is_archived);

            const speciesCountMap = nonArchivedPlants.reduce(
                (acc, plant) => {
                    const species = plant.species ?? "Unknown";
                    acc[species] = (acc[species] || 0) + 1;
                    return acc;
                },
                {} as Record<string, number>,
            );
            setSpeciesCounts(speciesCountMap);

            setOverview({
                total: data.length,
                active: nonArchivedPlants.length,
                identified: stats?.identificationsCount ?? 0,
                species: Object.keys(speciesCountMap).length,
                totalWaterings: data.reduce(
                    (sum, plant) => sum + (Array.isArray(plant.waterings) ? plant.waterings.length : 0),
                    0,
                ),
                totalFertilizings: data.reduce(
                    (sum, plant) => sum + (Array.isArray(plant.fertilizings) ? plant.fertilizings.length : 0),
                    0,
                ),
                totalPhotos: data.reduce(
                    (sum, plant) => sum + (Array.isArray(plant.images) ? plant.images.length : 0),
                    0,
                ),
            });

            // Only show 5 plants with images
            const plantsWithImages = nonArchivedPlants.filter((plant) => plant.images?.length);
            const selectedPlants = shuffleArray(plantsWithImages).slice(0, 5);
            setPlants(selectedPlants);
        } catch (error) {
            toast.error("Failed to fetch plants.");
        } finally {
            setLoadingPlants(false);
        }
    };

    const shuffleArray = <T,>(array: T[]): T[] => [...array].sort(() => Math.random() - 0.5);

    const sortedSpecies = Object.entries(speciesCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 12);
    const maxCount = Math.max(1, ...Object.values(speciesCounts));

    const handleImageLoad = () => {
        setLoadedImagesCount((count) => count + 1);
    };

    const sliderSettings = {
        arrows: false,
        dots: false,
        infinite: true,
        speed: 500,
        slidesToShow: 3,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 5000,
        responsive: [
            { breakpoint: 1024, settings: { slidesToShow: 2 } },
            { breakpoint: 600, settings: { slidesToShow: 1 } },
        ],
    };

    return (
        <div className="container home-container">
            <section className="home-hero">
                <p className="home-kicker">{loadingPlants ? <Skeleton width={140} /> : "Plant Care Cockpit"}</p>
                <h1>{loadingPlants ? <Skeleton width={220} /> : "Pflanzn"}</h1>
                <p className="home-subtitle">
                    {loadingPlants ? (
                        <>
                            <Skeleton />
                            <Skeleton width="88%" />
                        </>
                    ) : (
                        "Keep your plants healthy with watering logs, image timelines, species identification and AI-powered care guidance."
                    )}
                </p>
                <div className="home-cta-row">
                    {loadingPlants ? (
                        <>
                            <Skeleton height={40} width={150} borderRadius={10} />
                            <Skeleton height={40} width={220} borderRadius={10} />
                        </>
                    ) : (
                        <>
                            <Link to="/plants" className="home-cta primary">
                                Open My Plants
                            </Link>
                            <Link to="/about" className="home-cta secondary">
                                Learn more about Pflanzn
                            </Link>
                        </>
                    )}
                </div>
                <div className="home-feature-pills">
                    {loadingPlants ? (
                        <>
                            <Skeleton height={30} width={140} borderRadius={999} />
                            <Skeleton height={30} width={140} borderRadius={999} />
                            <Skeleton height={30} width={140} borderRadius={999} />
                        </>
                    ) : (
                        <>
                            <div className="feature-pill">
                                <FontAwesomeIcon icon={faDroplet} />
                                Watering history
                            </div>
                            <div className="feature-pill">
                                <FontAwesomeIcon icon={faCamera} />
                                Photo timelines
                            </div>
                            <div className="feature-pill">
                                <FontAwesomeIcon icon={faWandMagicSparkles} />
                                AI care helper
                            </div>
                        </>
                    )}
                </div>
            </section>

            <section className="home-stats-grid">
                <article className="home-stat-card">
                    <FontAwesomeIcon icon={faSeedling} className="home-stat-icon" />
                    <span className="home-stat-value">{loadingPlants ? <Skeleton width={56} /> : overview.active}</span>
                    <span className="home-stat-label">Active Plants</span>
                </article>
                <article className="home-stat-card">
                    <FontAwesomeIcon icon={faMagnifyingGlass} className="home-stat-icon" />
                    <span className="home-stat-value">
                        {loadingPlants ? <Skeleton width={56} /> : overview.identified}
                    </span>
                    <span className="home-stat-label">Identified Plants</span>
                </article>
                <article className="home-stat-card">
                    <FontAwesomeIcon icon={faDroplet} className="home-stat-icon" />
                    <span className="home-stat-value">
                        {loadingPlants ? <Skeleton width={72} /> : overview.totalWaterings}
                    </span>
                    <span className="home-stat-label">Total Waterings</span>
                </article>
                <article className="home-stat-card">
                    <FontAwesomeIcon icon={faFlask} className="home-stat-icon" />
                    <span className="home-stat-value">
                        {loadingPlants ? <Skeleton width={56} /> : overview.totalFertilizings}
                    </span>
                    <span className="home-stat-label">Total Fertilizings</span>
                </article>
                <article className="home-stat-card">
                    <FontAwesomeIcon icon={faImage} className="home-stat-icon" />
                    <span className="home-stat-value">
                        {loadingPlants ? <Skeleton width={56} /> : overview.totalPhotos}
                    </span>
                    <span className="home-stat-label">Photos Captured</span>
                </article>
                <article className="home-stat-card">
                    <FontAwesomeIcon icon={faWandMagicSparkles} className="home-stat-icon" />
                    <span className="home-stat-value">
                        {loadingPlants ? <Skeleton width={56} /> : overview.species}
                    </span>
                    <span className="home-stat-label">Species Tracked</span>
                </article>
            </section>

            {(loadingPlants || plants.length > 0) && (
                <section className="home-carousel-section">
                    <div className="home-section-heading">
                        <h2>Recently Captured</h2>
                    </div>

                    {/* Show skeleton while images are loading */}
                    {(loadingPlants || !allImagesLoaded) && (
                        <div className="carousel-skeleton carousel-container">
                            <div style={{ display: "flex", gap: "20px", justifyContent: "center" }}>
                                {[...Array(getSkeletonCount())].map((_, i) => (
                                    <div key={i} className="skeleton-slide">
                                        <Skeleton
                                            height="100%"
                                            width="100%"
                                            borderRadius={12}
                                            baseColor="#444"
                                            highlightColor="#666"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hidden images for preloading */}
                    {!loadingPlants && (
                        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
                            {plants.map((plant) => {
                                const latestImage = plant.images?.[plant.images.length - 1];
                                const imageUrl = latestImage
                                    ? `/api/uploads/${latestImage.image_path}?size=thumb`
                                    : "/placeholder-plant.webp";

                                return (
                                    <img
                                        key={`preload-${plant.id}`}
                                        src={imageUrl}
                                        alt=""
                                        onLoad={handleImageLoad}
                                        onError={handleImageLoad}
                                        style={{ width: "1px", height: "1px" }}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* Actual carousel - shown when images are loaded */}
                    {!loadingPlants && allImagesLoaded && (
                        <div className="carousel-container">
                            <Slider {...sliderSettings}>
                                {plants.map((plant) => {
                                    const latestImage = plant.images?.[plant.images.length - 1];
                                    const imageUrl = latestImage
                                        ? `/api/uploads/${latestImage.image_path}?size=medium`
                                        : "/placeholder-plant.webp";

                                    return (
                                        <div key={plant.id} className="plant-slide">
                                            <Link
                                                to={`/plant/${plant.id}`}
                                                className="home-carousel-link"
                                                title={`Open ${plant.name || "plant"}`}
                                            >
                                                <img
                                                    src={imageUrl}
                                                    alt={plant.name}
                                                    className="home-plant-image"
                                                    loading="lazy"
                                                />
                                            </Link>
                                        </div>
                                    );
                                })}
                            </Slider>
                        </div>
                    )}
                </section>
            )}

            <section className="species-wordcloud">
                <div className="home-section-heading">
                    <h2>Species Snapshot</h2>
                    <span>Top species in your collection</span>
                </div>
                <div className="species-bar-list">
                    {loadingPlants ? (
                        [...Array(6)].map((_, index) => (
                            <Skeleton key={index} height={36} borderRadius={8} />
                        ))
                    ) : sortedSpecies.length > 0 ? (
                        sortedSpecies.map(([species, count]) => {
                            const pct = (count / maxCount) * 100;
                            return (
                                <Link
                                    key={species}
                                    to={`/plants?species=${encodeURIComponent(species)}`}
                                    className="species-bar-row"
                                >
                                    <div className="species-bar-fill" style={{ width: `${pct}%` }} />
                                    <span className="species-bar-name">{species}</span>
                                    <span className="species-bar-count">{count}</span>
                                </Link>
                            );
                        })
                    ) : (
                        <p className="home-wordcloud-empty">No species data yet.</p>
                    )}
                </div>
            </section>
            {plants.length === 0 && !loadingPlants && (
                <section className="home-empty-state">
                    <h2>No plant photos yet</h2>
                    <p>Add your first plant image to unlock carousel highlights.</p>
                    <Link to="/plants" className="home-cta primary">
                        Go to Plants
                    </Link>
                </section>
            )}
        </div>
    );
}
