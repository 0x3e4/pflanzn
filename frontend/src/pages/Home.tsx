import { useEffect, useState } from "react";
import Slider from "react-slick";
import { Plant } from "../types/Plant";
import { fetchPlants } from "../services/PlantService";
import "../styles/home.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import LoadingOverlay from "../components/LoadingOverlay";
import { toast } from "react-toastify";

export default function Home() {
    const [plants, setPlants] = useState<Plant[]>([]);
    const [loadingPlants, setLoadingPlants] = useState(true);
    const [speciesCounts, setSpeciesCounts] = useState<Record<string, number>>({});
    const [wordPositions, setWordPositions] = useState<{ species: string }[]>([]);
    const [allImagesLoaded, setAllImagesLoaded] = useState(false);
    const [_loadedImagesCount, setLoadedImagesCount] = useState(0);

    useEffect(() => {
        loadPlants();
    }, []);

    const loadPlants = async () => {
        try {
            const data = await fetchPlants();
            setPlants(data);

            const speciesCountMap = data.reduce((acc, plant) => {
                const species = plant.species ?? "Unknown";
                acc[species] = (acc[species] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            setSpeciesCounts(speciesCountMap);

            const speciesList = Object.keys(speciesCountMap);
            const positions = generateWordPositions(speciesList);
            setWordPositions(positions);

            // Take 5 random plants with images for the slider
            const plantsWithImages = data.filter((plant) => plant.images?.length);
            setPlants(shuffleArray(plantsWithImages).slice(0, 5));
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

    const maxCount = Math.max(...Object.values(speciesCounts) || [0]);

    const getSpeciesColor = (species: string) => {
        const intensity = (speciesCounts[species] || 0) / maxCount;
        const greyScale = Math.floor(100 + intensity * 155);
        return `rgb(${greyScale}, ${greyScale}, ${greyScale})`;
    };

    const getFontSize = (species: string) => {
        const intensity = (speciesCounts[species] || 0) / maxCount;
        return `${Math.max(1.0, 0.3 + intensity)}rem`;
    };

    useEffect(() => {
        if (plants.length > 0) {
            setLoadedImagesCount(0);
            setAllImagesLoaded(false);
        }
    }, [plants]);

    const handleImageLoad = () => {
        setLoadedImagesCount((count) => {
            const newCount = count + 1;
            if (newCount === plants.length) setAllImagesLoaded(true);
            return newCount;
        });
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

    if (loadingPlants) return <LoadingOverlay />;

    return (
        <div className="container home-container">
            <div className="home-content">
                <h1>Pflanzn</h1>
                <p>A simple and efficient plant management system.</p>
            </div>

            {plants.length > 0 && (
                <>
                    {!allImagesLoaded && <p>Images loading...</p>}

                    <div className="carousel-container" style={{ visibility: allImagesLoaded ? "visible" : "hidden" }}>
                        <Slider {...sliderSettings}>
                            {plants.map((plant) => {
                                const latestImage = plant.images?.[plant.images.length - 1];
                                const imageUrl = latestImage
                                    ? `/api/uploads/${latestImage.image_path}`
                                    : "/placeholder-plant.webp";

                                return (
                                    <div key={plant.id} className="plant-slide">
                                        <img
                                            src={imageUrl}
                                            alt={plant.name}
                                            className="home-plant-image"
                                            onLoad={handleImageLoad}
                                            onError={handleImageLoad}
                                        />
                                    </div>
                                );
                            })}
                        </Slider>
                    </div>
                </>
            )}

            <section className="species-wordcloud">
                <div className="wordcloud">
                    {wordPositions.map(({ species }) => (
                        <span
                            key={species}
                            className="wordcloud-item"
                            style={{ color: getSpeciesColor(species), fontSize: getFontSize(species) }}
                        >
                            {species}
                        </span>
                    ))}
                </div>
            </section>
        </div>
    );
}