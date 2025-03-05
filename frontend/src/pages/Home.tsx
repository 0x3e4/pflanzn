import { useEffect, useState } from "react";
import Slider from "react-slick";
import { Plant } from "../services/Plant";
import "../styles/home.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export default function Home() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loadingPlants, setLoadingPlants] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speciesCounts, setSpeciesCounts] = useState<Record<string, number>>({});
  const [wordPositions, setWordPositions] = useState<{ species: string }[]>([]);

  // Number of images loaded so far (for the loading spinner)
  const [_loadedImagesCount, setLoadedImagesCount] = useState(0);
  const [allImagesLoaded, setAllImagesLoaded] = useState(false);

  useEffect(() => {
    fetchPlants();
  }, []);

  function shuffleArray<T>(array: T[]): T[] {
      return [...array].sort(() => Math.random() - 0.5);
  }

  const fetchPlants = async () => {
      try {
          const response = await fetch("/api/plants/");
          if (!response.ok) throw new Error("Failed to fetch plants.");

          const data: Plant[] = await response.json();
          setPlants(data);

          const speciesCountMap = data.reduce((acc, plant) => {
              const species = plant.species ?? "Unknown";
              acc[species] = (acc[species] || 0) + 1;
              return acc;
          }, {} as Record<string, number>);
          
          // Set speciesCounts here!
          setSpeciesCounts(speciesCountMap);
          
          const speciesList = Object.keys(speciesCountMap);
          const positions = generateWordPositions(speciesList);
          setWordPositions(positions); 
          
          // Filter to only plants with images, shuffle, and take first 5
          const plantsWithImages = data.filter(plant => plant.images && plant.images.length > 0);
          const shuffledPlants = shuffleArray(plantsWithImages);
          const selectedPlants = shuffledPlants.slice(0, 5);

          setPlants(selectedPlants)
      } catch (err) {
          setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
          setLoadingPlants(false);
      }
  };

  const maxCount = Math.max(...Object.values(speciesCounts) as number[]);

  function generateWordPositions(speciesList: string[]) {
      const shuffledSpecies = shuffleArray(speciesList);
      const limitedSpecies = shuffledSpecies.slice(0, 10);

      return limitedSpecies.map(species => ({ species }));
  }

  const getSpeciesColor = (species: string) => {
      const count = speciesCounts[species] || 0;
      const intensity = count / maxCount; // 0 = low count, 1 = max count
      const greyScale = Math.floor(100 + intensity * 155); // 100 is darker, 255 is white
      return `rgb(${greyScale}, ${greyScale}, ${greyScale})`;
  };

  const getFontSize = (species: string) => {
      const count = speciesCounts[species] || 0;
      const intensity = count / maxCount;
      return `${0.5 + intensity}rem`;
  };

  // Whenever plants data changes, reset counters for loading images
  useEffect(() => {
    if (plants.length > 0) {
      setLoadedImagesCount(0);
      setAllImagesLoaded(false);
    }
  }, [plants]);

  // Slick slider settings
  const settings = {
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
      { breakpoint: 600, settings: { slidesToShow: 1 } }
    ]
  };

  // Called each time an <img> finishes loading (or errors)
  const handleImageLoad = () => {
    setLoadedImagesCount((count) => {
      const newCount = count + 1;
      if (newCount === plants.length) {
        setAllImagesLoaded(true);
      }
      return newCount;
    });
  };

  if (loadingPlants) {
    return <p>Loading plants...</p>;
  }

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  return (
    <div className="container home-container">
      {/* Main Content */}
      <div className="home-content">
        <h1>Pflanzn</h1>
        <p>A simple and efficient plant management system.</p>
      </div>

      {/* Carousel Section */}
      {plants.length > 0 && (
        <>
          {/* Optional loading text until all images have finished loading */}
          {!allImagesLoaded && (
            <p>Images loading...</p>
          )}

          <div
            className="carousel-container"
            style={{ visibility: allImagesLoaded ? "visible" : "hidden" }}
          >
            <Slider {...settings}>
              {plants.map((plant) => {
                // Sort images newest-first
                const sortedImages = [...(plant.images || [])].sort(
                  (a, b) =>
                    new Date(b.uploaded_at).getTime() -
                    new Date(a.uploaded_at).getTime()
                );
                const latestImage = sortedImages.length > 0 ? sortedImages[0] : null;

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

      {/* Species Word Cloud Section */}
      <section className="species-wordcloud">
        <div className="wordcloud">
            {wordPositions.map(({ species }) => (
                <span
                    key={species}
                    className="wordcloud-item"
                    style={{
                      color: getSpeciesColor(species),
                      fontSize: getFontSize(species),
                  }}
                >
                    {species}
                </span>
            ))}
        </div>

      </section>
    </div>
  );
}
