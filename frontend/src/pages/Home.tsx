import { useEffect, useState } from "react";
import Slider from "react-slick";
import { Plant } from "../types/Plant";
import { fetchPlants } from "../services/PlantService";
import "../styles/home.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import LoadingOverlay from "../components/LoadingOverlay";
import { toast } from "react-toastify";
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCamera,
    faDroplet,
    faSeedling,
    faWandMagicSparkles
} from "@fortawesome/free-solid-svg-icons";

type HomeOverview = {
    total: number;
    active: number;
    species: number;
    totalWaterings: number;
};

export default function Home() {
    const [plants, setPlants] = useState<Plant[]>([]);
    const [loadingPlants, setLoadingPlants] = useState(true);
    const [speciesCounts, setSpeciesCounts] = useState<Record<string, number>>({});
    const [wordPositions, setWordPositions] = useState<{ species: string }[]>([]);
    const [allImagesLoaded, setAllImagesLoaded] = useState(false);
    const [loadedImagesCount, setLoadedImagesCount] = useState(0);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [overview, setOverview] = useState<HomeOverview>({
        total: 0,
        active: 0,
        species: 0,
        totalWaterings: 0,
    });

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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
            const data = await fetchPlants();
            const nonArchivedPlants = data.filter((plant) => !plant.is_archived);

            const speciesCountMap = nonArchivedPlants.reduce((acc, plant) => {
                const species = plant.species ?? "Unknown";
                acc[species] = (acc[species] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            setSpeciesCounts(speciesCountMap);

            setOverview({
                total: data.length,
                active: nonArchivedPlants.length,
                species: Object.keys(speciesCountMap).length,
                totalWaterings: data.reduce(
                    (sum, plant) => sum + (Array.isArray(plant.waterings) ? plant.waterings.length : 0),
                    0
                ),
            });

            const speciesList = Object.keys(speciesCountMap);
            setWordPositions(generateWordPositions(speciesList));

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

    const generateWordPositions = (speciesList: string[]) => {
        return shuffleArray(speciesList).slice(0, 10).map((species) => ({ species }));
    };

    const maxCount = Math.max(1, ...Object.values(speciesCounts));

    const getSpeciesColor = (species: string) => {
        const intensity = (speciesCounts[species] || 0) / maxCount;
        const greyScale = Math.floor(100 + intensity * 155);
        return `rgb(${greyScale}, ${greyScale}, ${greyScale})`;
    };

    const getFontSize = (species: string) => {
        const intensity = (speciesCounts[species] || 0) / maxCount;
        return `${Math.max(1.0, 0.3 + intensity)}rem`;
    };

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
            {loadingPlants && <LoadingOverlay />}
            <section className="home-hero">
                <p className="home-kicker">Plant Care Cockpit</p>
                <h1>Pflanzn</h1>
                <p className="home-subtitle">
                    Keep your plants healthy with watering logs, image timelines, species identification and AI-powered care guidance.
                </p>
                <div className="home-cta-row">
                    <Link to="/plants" className="home-cta primary">
                        Open My Plants
                    </Link>
                    <Link to="/about" className="home-cta secondary">
                        Learn more about Pflanzn
                    </Link>
                </div>
                <div className="home-feature-pills">
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
                </div>
            </section>

            <section className="home-stats-grid">
                <article className="home-stat-card">
                    <FontAwesomeIcon icon={faSeedling} className="home-stat-icon" />
                    <span className="home-stat-value">{overview.total}</span>
                    <span className="home-stat-label">Total Plants</span>
                </article>
                <article className="home-stat-card">
                    <FontAwesomeIcon icon={faSeedling} className="home-stat-icon" />
                    <span className="home-stat-value">{overview.active}</span>
                    <span className="home-stat-label">Active Plants</span>
                </article>
                <article className="home-stat-card">
                    <FontAwesomeIcon icon={faDroplet} className="home-stat-icon" />
                    <span className="home-stat-value">{overview.totalWaterings}</span>
                    <span className="home-stat-label">Total Waterings Logged</span>
                </article>
                <article className="home-stat-card">
                    <FontAwesomeIcon icon={faWandMagicSparkles} className="home-stat-icon" />
                    <span className="home-stat-value">{overview.species}</span>
                    <span className="home-stat-label">Species Tracked</span>
                </article>
            </section>

            {plants.length > 0 && (
                <section className="home-carousel-section">
                    <div className="home-section-heading">
                        <h2>Recently Captured</h2>
                    </div>

                    {/* Show skeleton while images are loading */}
                    {!allImagesLoaded && (
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
                    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                        {plants.map((plant) => {
                            const latestImage = plant.images?.[plant.images.length - 1];
                            const imageUrl = latestImage
                                ? `/api/uploads/${latestImage.image_path}`
                                : "/placeholder-plant.webp";

                            return (
                                <img
                                    key={`preload-${plant.id}`}
                                    src={imageUrl}
                                    alt=""
                                    onLoad={handleImageLoad}
                                    onError={handleImageLoad}
                                    style={{ width: '1px', height: '1px' }}
                                />
                            );
                        })}
                    </div>

                    {/* Actual carousel - shown when images are loaded */}
                    {allImagesLoaded && (
                        <div className="carousel-container">
                            <Slider {...sliderSettings}>
                                {plants.map((plant) => {
                                    const latestImage = plant.images?.[plant.images.length - 1];
                                    const imageUrl = latestImage
                                        ? `/api/uploads/${latestImage.image_path}`
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
                    <span>Most frequent species in your collection</span>
                </div>
                <div className="wordcloud">
                    {wordPositions.length > 0 ? (
                        wordPositions.map(({ species }) => (
                            <Link
                                key={species}
                                to={`/plants?species=${encodeURIComponent(species)}`}
                                className="wordcloud-item species-link"
                                style={{ color: getSpeciesColor(species), fontSize: getFontSize(species) }}
                            >
                                {species}
                            </Link>
                        ))
                    ) : (
                        <p className="home-wordcloud-empty">No species data yet.</p>
                    )}
                </div>
            </section>
            {plants.length === 0 && !loadingPlants && (
                <section className="home-empty-state">
                    <h2>No plant photos yet</h2>
                    <p>Add your first plant image to unlock carousel highlights.</p>
                    <Link to="/plants" className="home-cta primary">Go to Plants</Link>
                </section>
            )}
        </div>
    );
}
