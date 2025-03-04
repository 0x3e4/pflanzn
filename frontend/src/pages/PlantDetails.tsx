import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchSinglePlant, deletePlant, Plant } from "../services/Plant";
import TimelineImages from "../components/TimelineImages";
import "../styles/plantDetails.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

export default function PlantDetails() {
  const { plantId } = useParams();
  const navigate = useNavigate();

  const [plant, setPlant] = useState<Plant | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) return; // if somehow missing
    const idNumber = parseInt(plantId);

    fetchSinglePlant(idNumber)
      .then((data) => setPlant(data))
      .catch((err) => setError(err.message));
  }, [plantId]);

  const handleDeletePlant = async () => {
    if (!plantId) return;
    if (!confirm("Are you sure you want to delete this plant?")) {
      return;
    }

    try {
      await deletePlant(parseInt(plantId));
      alert("Plant deleted successfully!");
      navigate("/plants"); // redirect back to your main list
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!plant) {
    return <div>Loading plant info...</div>;
  }

  return (
    <div className="container plant-container">
      <div className="plant-information">
        <h2>{plant.name}</h2>
        <span><strong>Species:</strong> {plant.species ?? "Unknown"}</span>
      </div>

      {/* Our timeline-based image viewer */}
      {plant.images.length > 0 ? (
        <TimelineImages images={plant.images} />
      ) : (
        <span>No images yet.</span>
      )}

      <button className="delete-plant-btn" onClick={handleDeletePlant}>
        <FontAwesomeIcon icon={faTrash} />
      </button>
    </div>
  );
}