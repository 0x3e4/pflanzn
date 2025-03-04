import { useEffect, useState } from "react";
import Slider from "react-slick";
import { Plant } from "../services/Plant";
import "../styles/home.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export default function Home() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlants();
  }, []);

  const fetchPlants = async () => {
    try {
      const response = await fetch("/api/plants/");
      if (!response.ok) throw new Error("Failed to fetch plants.");
      const data = await response.json();
      setPlants(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const settings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 20000,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 2 } },
      { breakpoint: 600, settings: { slidesToShow: 1 } }
    ]
  };

  return (
    <div className="home-container">
      {/* Main Content */}
      <div className="home-content">
        <h1>Pflanzn</h1>
        <p>A simple and efficient plant management system.</p>
      </div>

      {/* Carousel Section */}
      {loading ? (
        <p>Loading plants...</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : plants.length > 0 ? (
        <div className="carousel-container">
          <Slider {...settings}>
            {plants.map((plant) => (
              <div key={plant.id} className="plant-slide">
                <img
                  src={plant.images.length > 0 ? `/api/uploads/${plant.images[0].image_path}` : "/placeholder-plant.webp"}
                  alt={plant.name}
                  className="home-plant-image"
                />
              </div>
            ))}
          </Slider>
        </div>
      ) : null} 
    </div>
  );
}
