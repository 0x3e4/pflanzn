import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchSinglePlant, deletePlant, updatePlant, Plant } from "../services/Plant";
import TimelineImages from "../components/TimelineImages";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import "../styles/plantDetails.css";

export default function PlantDetails() {
  const { plantId } = useParams();
  const navigate = useNavigate();

  const [plant, setPlant] = useState<Plant | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local state for editing name/species
  const [editingName, setEditingName] = useState(false);
  const [editingSpecies, setEditingSpecies] = useState(false);

  // We'll store local input values when editing:
  const [localName, setLocalName] = useState("");
  const [localSpecies, setLocalSpecies] = useState("");

  useEffect(() => {
    if (!plantId) return; // if somehow missing
    const idNumber = parseInt(plantId);

    fetchSinglePlant(idNumber)
      .then((data) => {
        setPlant(data);
        setLocalName(data.name || "");
        setLocalSpecies(data.species || "");
      })
      .catch((err) => setError(err.message));
  }, [plantId]);

  // -- Deletion logic
  const handleDeletePlant = async () => {
    if (!plantId) return;
    if (!confirm("Are you sure you want to delete this plant?")) return;

    try {
      await deletePlant(parseInt(plantId));
      alert("Plant deleted successfully!");
      navigate("/plants");
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // -- Inline update logic
  const handleUpdate = async (updatedFields: Partial<Plant>) => {
    if (!plant || !plantId) return;
    try {
      const updated = await updatePlant(Number(plantId), updatedFields);
      setPlant(updated);       // update local state with fresh data from server
      // Also reset localName/localSpecies so future edits reflect what's on server
      setLocalName(updated.name || "");
      setLocalSpecies(updated.species || "");
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // When user finishes editing name (e.g. on blur or Enter)
  const handleNameBlur = () => {
    setEditingName(false);
    if (localName !== plant?.name) {
      handleUpdate({ name: localName });
    }
  };

  // Similarly for species
  const handleSpeciesBlur = () => {
    setEditingSpecies(false);
    if (localSpecies !== plant?.species) {
      handleUpdate({ species: localSpecies });
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
        {/* -- NAME Field -- */}
        <h2>
          {editingName ? (
            <input
              className="editable-input"
              autoFocus
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameBlur();
              }}
            />
          ) : (
            <span onClick={() => setEditingName(true)}>
              {plant.name || "Untitled"}
            </span>
          )}
        </h2>

        {/* -- SPECIES Field -- */}
        <span>
          <strong>Species:</strong>{" "}
          {editingSpecies ? (
            <input
              className="editable-input"
              autoFocus
              type="text"
              value={localSpecies}
              onChange={(e) => setLocalSpecies(e.target.value)}
              onBlur={handleSpeciesBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSpeciesBlur();
              }}
            />
          ) : (
            <span onClick={() => setEditingSpecies(true)}>
              {plant.species ?? "Unknown"}
            </span>
          )}
        </span>
        
        <span><strong>Last Watered:</strong> {plant.lastWatered ?? "Not watered yet"}</span>

      </div>

      {/* Timeline-based image viewer */}
      {plant.images.length > 0 ? (
        <TimelineImages images={plant.images} plantId={plant.id} />
      ) : (
        <span>No images yet.</span>
      )}

      {/* Delete button */}
      <button className="delete-plant-btn" onClick={handleDeletePlant}>
        <FontAwesomeIcon icon={faTrash} />
      </button>
    </div>
  );
}
