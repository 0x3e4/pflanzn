import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchSinglePlant, deletePlant, updatePlant, Plant, generatePlantDescription, waterPlant } from "../services/Plant";
import TimelineImages from "../components/TimelineImages";
import Description from "../components/Description";
import WateringLogCalendar from "../components/WateringLogCalendar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faWandMagicSparkles, faDroplet, faCalendarAlt } from "@fortawesome/free-solid-svg-icons";
import "../styles/plantDetails.css";
import { DateTime } from 'luxon';
import { toast } from 'react-toastify';

export default function PlantDetails() {
  const isAiAvailable = () => {
    return !!(
      import.meta.env.VITE_LLM_PROVIDER
    );
  };

  const { plantId } = useParams();
  const navigate = useNavigate();

  const [plant, setPlant] = useState<Plant | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local state for editing name/species
  const [editingName, setEditingName] = useState(false);
  const [editingSpecies, setEditingSpecies] = useState(false);
  const [localName, setLocalName] = useState("");
  const [localSpecies, setLocalSpecies] = useState("");

  // DateTime picker state - defaults to now
  const [selectedDateTime, setSelectedDateTime] = useState<string>(
    DateTime.now().toISO({ includeOffset: false }) ?? ""
  );

  useEffect(() => {
    if (plantId) {
      fetchSinglePlant(parseInt(plantId))
        .then((data) => {
          setPlant(data);
          setLocalName(data.name || "");
          setLocalSpecies(data.species || "");
        })
        .catch((err) => setError(err.message));
    }
  }, [plantId]);

  const handleDeletePlant = async () => {
    if (!plantId || !confirm("Are you sure you want to delete this plant?")) return;
    await deletePlant(Number(plantId));
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

  const handleGenerateDescription = async () => {
    try {
      const { description } = await generatePlantDescription(Number(plantId));
      handleUpdate({ description });
    } catch (error) {
      toast.error((error as Error).message || "Failed to generate description");
    }
  };

  const handleWaterPlant = async () => {
    try {
      await waterPlant(Number(plantId), { watered_at: selectedDateTime });
      const updatedPlant = await fetchSinglePlant(Number(plantId));
      setPlant(updatedPlant);
      toast.success(`Watering logged!`);
    } catch (err) {
      toast.error((err as Error).message);
    }
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

            <span>
              <strong>Last Watered:</strong>{" "}
              {plant.last_watered
                ? new Date(plant.last_watered).toLocaleString(import.meta.env.VITE_Locale, {
                    timeZone: import.meta.env.VITE_TZ,
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : "Not watered yet"}
            </span>
          </div>

          {/* Timeline Images */}
          {plant.images.length > 0 ? (
            <TimelineImages images={plant.images} plantId={plant.id} />
          ) : (
            <span>No images yet.</span>
          )}

          {/* Watering Log */}
          <div className="plant-information">
            <strong>Watering Log</strong>
            <WateringLogCalendar 
                waterings={plant.waterings} 
                plantId={plant.id}
            />
          </div>
        </div>

        {/* Right Column - Description */}
        <div className="plant-right-column">
          <Description plant={plant} onDescriptionUpdated={setPlant} />
        </div>
      </div>

      <hr />

      {/* Bottom Controls */}
      <div className="plant-below-column">
        <div className="plant-global-button-section">
          <div className="plant-global-button-left">
            <div className="water-plant-input-container">
              <button className="water-plant-btn" onClick={handleWaterPlant}>
                <FontAwesomeIcon icon={faDroplet} /> Water Plant
              </button>
              <div className="water-plant-datetime">
                <FontAwesomeIcon icon={faCalendarAlt} />
                <input
                  type="datetime-local"
                  value={selectedDateTime.slice(0, 16)}
                  onChange={(e) => setSelectedDateTime(e.target.value)}
                />
              </div>
            </div>

            {isAiAvailable() && (
              <>
                <button className="ai-care-helper-btn" onClick={handleGenerateDescription}>
                  <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Care Helper
                </button>
                <button className="generate-description-btn" onClick={handleGenerateDescription}>
                  <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Description
                </button>
              </>
            )}
          </div>

          <button className="delete-plant-btn" onClick={handleDeletePlant}>
            <FontAwesomeIcon icon={faTrash} /> Delete Plant
          </button>
        </div>
      </div>
    </div>
  );
}