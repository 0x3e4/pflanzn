import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    fetchPlants,
    createPlant,
    uploadPlantImage,
    identifyPlant,
    updatePlant,
    deletePlant,
    waterPlant
} from "../services/PlantService";
import { Plant } from "../types/Plant";
import "../styles/plants.css";
import { toast } from "react-toastify";
import { DateTime } from "luxon";
import IdentifyResults from "../components/IdentifyResults";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUpload,
    faPlus,
    faSeedling,
    faCircleXmark,
    faFingerprint,
    faDroplet,
} from "@fortawesome/free-solid-svg-icons";
import LoadingOverlay from "../components/LoadingOverlay";

export default function Plants() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newPlant, setNewPlant] = useState({ name: "", species: "" });
  const [file, setFile] = useState<File | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [modalIdentifyResults, setModalIdentifyResults] = useState<
    { species: string; commonName: string; score: string; images: string[] }[] | null
  >(null);

  const [plantIdentifyResults, setPlantIdentifyResults] = useState<{
    plantId: number;
    results: { species: string; commonName: string; score: string, images: string[] }[];
  } | null>(null);

  useEffect(() => {
    fetchPlantsFromService();
  }, []);

  const fetchPlantsFromService = async () => {
    try {
        const data = await fetchPlants();
        setPlants(data);
    } catch (err) {
        toast.error((err as Error).message);
        setError((err as Error).message);
    } finally {
        setLoading(false);
    }
  };

  const resetModal = () => {
    setNewPlant({ name: "", species: "" });
    setFile(null);
    setModalIdentifyResults(null);
    setModalOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setModalIdentifyResults(null);
  };

  const handleCreatePlant = async () => {
    try {
      const createdPlant = await createPlant(newPlant.name, newPlant.species);
      toast.success("Plant created!");

      if (file) {
        await uploadPlantImage(createdPlant.id, file);
        toast.success("Image uploaded!");
      }

      fetchPlantsFromService();
      resetModal();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleWaterPlant = async (plantId: number) => {  
    const currentDateTime = DateTime.now().toISO();

    try {
        await waterPlant(plantId, { watered_at: currentDateTime });
        fetchPlantsFromService();
        toast.success(`Plant watered!`);
    } catch (err) {
        toast.error((err as Error).message);
    }
  };

  const handleIdentifyExistingPlant = async (plantId: number) => {
    try {
      const result = await identifyPlant(plantId);

      if (result.identified_species.length === 0) {
        toast.warning("No species found.");
        return;
      }

      setPlantIdentifyResults({
        plantId,
        results: result.identified_species.map((r: any) => ({
          species: r.scientific_name || "Unknown",
          commonName: r.common_name || "No common name",
          score: r.score.toString(),
          images: r.images
        })),
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleUploadImageForPlant = async (plantId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadPlantImage(plantId, file);
      toast.success("Image uploaded!");
      fetchPlantsFromService();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleIdentifyPlant = async () => {
    if (!file) return toast.error("Please select a file first.");

    try {
      const tempPlant = await createPlant("Temp", "");
      await uploadPlantImage(tempPlant.id, file);

      const result = await identifyPlant(tempPlant.id);
      if (result.identified_species.length === 0) {
        toast.warning("No species identified.");
        await deletePlant(tempPlant.id);
        return;
      }

      setModalIdentifyResults(result.identified_species.map((r: any) => ({
        species: r.scientific_name || "Unknown",
        commonName: r.common_name || "No common name",
        score: r.score.toString(),
        images: r.images
      })));

      await deletePlant(tempPlant.id);

    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleSelectSpecies = (species: string, commonName: string) => {
    setNewPlant({ name: commonName, species: species });
    setModalIdentifyResults(null);
  };

  const handleSelectSpeciesForExistingPlant = async (plantId: number, name: string, species: string) => {
    await updatePlant(plantId, { name, species });
    fetchPlantsFromService();
    setPlantIdentifyResults(null);
    toast.success(`Plant updated to ${name} (${species})`);
  };

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (loading) {
    return <LoadingOverlay />;
  }
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div className="container plants-container">
      <div className="plants-header">
        <h1>Plants</h1>
        <button className="add-plant-btn" onClick={() => setModalOpen(true)}>
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>

      <div className="plants-list">
        {plants.map((plant) => {
          const sortedImages = [...(plant.images || [])].sort(
            (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
          );
          const latestImage = sortedImages[0] || null;

          const timezone = import.meta.env.VITE_TZ
          const locale = import.meta.env.VITE_Locale
          const lastWateredText = plant.last_watered
            ? new Date(plant.last_watered).toLocaleString(locale, {
                timeZone: timezone,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : "Not watered yet";

          return (
            <div key={plant.id} className="plant-card">
              <Link to={`/plant/${plant.id}`}>
                <div className="plant-image-container all-plants">
                  <img
                    src={latestImage ? `/api/uploads/${latestImage.image_path}` : "/placeholder-plant.webp"}
                    alt={plant.name}
                    className="plant-image"
                  />
                </div>
                <div className="plant-card-text">
                  <h3>{plant.name || "Unknown"}</h3>
                  <small>#{plant.id}</small>
                  <p><strong>Species:</strong> {plant.species || "Unknown"}</p>
                  <p><strong>Last Watered:</strong> {lastWateredText}</p>
                </div>
              </Link>
              <div className="plant-buttons">
                <button className="water-plant-btn" onClick={() => handleWaterPlant(plant.id)}>
                  <FontAwesomeIcon icon={faDroplet} />
                </button>
                <input
                  type="file"
                  id={`file-upload-${plant.id}`}
                  className="file-input"
                  onChange={(e) => handleUploadImageForPlant(plant.id, e)}
                />
                <button onClick={() => {
                  document.getElementById(`file-upload-${plant.id}`)?.click();
                }}>
                  <FontAwesomeIcon icon={faUpload} />
                </button>
                <button onClick={() => handleIdentifyExistingPlant(plant.id)}>
                  <FontAwesomeIcon icon={faFingerprint} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div className="add-plant-modal" onClick={resetModal}>
          <div className="add-plant-modal-content" onClick={(e) => e.stopPropagation()}>
            <span className="close" onClick={resetModal}>&times;</span>
            <h2>Add Plant</h2>
            <input type="text" placeholder="Name" value={newPlant.name} onChange={(e) => setNewPlant({ ...newPlant, name: e.target.value })} />
            <input type="text" placeholder="Species" value={newPlant.species} onChange={(e) => setNewPlant({ ...newPlant, species: e.target.value })} />
            <input type="file" onChange={handleFileChange} />
            {file && <button className="modal-identify-button" onClick={handleIdentifyPlant}>
              <FontAwesomeIcon icon={faFingerprint} /> Identify Plant
            </button>}
            {modalIdentifyResults && (
              <ul className="identify-results-list">
                {modalIdentifyResults.map((r, i) => (
                  <li
                    key={i}
                    className="species-item"
                    onClick={() => handleSelectSpecies(r.species, r.commonName)}
                  >
                    {/* Name & Percentage in the Same Row */}
                    <div className="species-header">
                      <div className="species-name">
                        <strong>{r.species}</strong>
                        <br />
                        <span>{r.commonName || "No common name"}</span>
                      </div>
                      <div className="species-percentage">
                        <span>{parseFloat(r.score).toFixed(2)}%</span>
                      </div>
                    </div>
    
                    {/* Display related images below */}
                    {Array.isArray(r.images) && r.images.length > 0 && (
                      <div className="species-images">
                        {r.images.map((imageUrl, i) => (
                          <div key={i} className="image-container">
                            <img
                              src={imageUrl}
                              alt={`Related ${r.species}`}
                              className="species-image"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImage(imageUrl);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-buttons modal-plant-buttons">
              <button className="modal-create-button" onClick={handleCreatePlant}>
                <FontAwesomeIcon icon={faSeedling} /> Add Plant
              </button>
              <button className="modal-cancel-button" onClick={resetModal}>
                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {plantIdentifyResults && (
        <IdentifyResults
          plantId={plantIdentifyResults.plantId}
          results={plantIdentifyResults.results}
          onSelectSpecies={handleSelectSpeciesForExistingPlant}
          onClose={() => setPlantIdentifyResults(null)}
        />
      )}

      {/* Large image preview modal */}
      {selectedImage && (
        <div className="image-modal" onClick={() => setSelectedImage(null)}>
          <div className="image-modal-content">
            <img src={selectedImage} alt="Full-sized" />
          </div>
        </div>
      )}
    </div>
  );
}
