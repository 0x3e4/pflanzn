import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchSinglePlant, deletePlant, updatePlant, Plant } from "../services/Plant";
import TimelineImages from "../components/TimelineImages";
import Description from "../components/Description";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import "../styles/plantDetails.css";
import { toast } from 'react-toastify';

export default function PlantDetails() {
  const { plantId } = useParams();
  const navigate = useNavigate();

  const [plant, setPlant] = useState<Plant | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local state for editing
  const [editingName, setEditingName] = useState(false);
  const [editingSpecies, setEditingSpecies] = useState(false);
  const [localName, setLocalName] = useState("");
  const [localSpecies, setLocalSpecies] = useState("");

  useEffect(() => {
    if (!plantId) return;

    fetchSinglePlant(parseInt(plantId)).then((data) => {
      setPlant(data);
      setLocalName(data.name || "");
      setLocalSpecies(data.species || "");
    }).catch((err) => setError(err.message));
  }, [plantId]);

  const handleDeletePlant = async () => {
    if (!plantId || !confirm("Are you sure you want to delete this plant?")) return;
    await deletePlant(parseInt(plantId));
    toast.success("Plant deleted successfully!");
    navigate("/plants");
  };

  const handleUpdate = async (updatedFields: Partial<Plant>) => {
    if (!plant || !plantId) return;
    const updated = await updatePlant(Number(plantId), updatedFields);
    setPlant(updated);
    setLocalName(updated.name || "");
    setLocalSpecies(updated.species || "");
  };

  const handleNameBlur = () => {
    setEditingName(false);
    if (localName !== plant?.name) handleUpdate({ name: localName });
  };

  const handleSpeciesBlur = () => {
    setEditingSpecies(false);
    if (localSpecies !== plant?.species) handleUpdate({ species: localSpecies });
  };

  if (error) return <div>Error: {error}</div>;
  if (!plant) return <div>Loading plant info...</div>;

  return (
    <div className="container plant-details-container">
      <div className="plant-columns">
        {/* Left Column - Plant Information */}
        <div className="plant-left-column">
          <div className="plant-information">
            <h2>
              {editingName ? (
                <input
                  className="editable-input"
                  value={localName}
                  autoFocus
                  onChange={(e) => setLocalName(e.target.value)}
                  onBlur={handleNameBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleNameBlur()}
                />
              ) : (
                <span onClick={() => setEditingName(true)}>
                  {plant.name || "Untitled"}
                </span>
              )}
            </h2>

            <span>
              <strong>Species:</strong>{" "}
              {editingSpecies ? (
                <input
                  className="editable-input"
                  value={localSpecies}
                  autoFocus
                  onChange={(e) => setLocalSpecies(e.target.value)}
                  onBlur={handleSpeciesBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleSpeciesBlur()}
                />
              ) : (
                <span onClick={() => setEditingSpecies(true)}>
                  {plant.species || "Unknown"}
                </span>
              )}
            </span>

            <span><strong>Last Watered:</strong> {plant.lastWatered ?? "Not watered yet"}</span>
          </div>

          {/* Timeline Images */}
          {plant.images.length > 0 ? (
            <TimelineImages images={plant.images} plantId={plant.id} />
          ) : (
            <span>No images yet.</span>
          )}

          <button className="delete-plant-btn" onClick={handleDeletePlant}>
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>

        {/* Right Column - Description */}
        <div className="plant-right-column">
          <Description plant={plant} onDescriptionUpdated={setPlant} />
        </div>
      </div>
    </div>
  );
}