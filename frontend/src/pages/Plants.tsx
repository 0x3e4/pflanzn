import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPlant, uploadPlantImage, identifyPlant, updatePlant, Plant } from "../services/Plant";
import "../styles/plants.css";
import { toast } from 'react-toastify';
import IdentifyResults from "../components/IdentifyResults";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

export default function Plants() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newPlant, setNewPlant] = useState({ name: "", species: "" });
  const [_file, setFile] = useState<File | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [identifyResults, setIdentifyResults] = useState<{ plantId: number; results: any[] } | null>(null);

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

  const handleCreatePlant = async () => {
    try {
      const plant = await createPlant(newPlant.name, newPlant.species);
      setPlants([...plants, plant]); // Update UI
      setNewPlant({ name: "", species: "" }); // Reset input
      setModalOpen(false); // Close modal
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleIdentifyPlant = async (plantId: number) => {
    try {
      const result = await identifyPlant(plantId);
      if (result.identified_species.length === 0) {
        toast.warning("No species found.");
        return;
      }
      setIdentifyResults({
        plantId,
        results: result.identified_species.map((r: any) => ({
          species: r.scientific_name || "Unknown",
          commonName: r.common_name || "No common name",
          score: r.score,
        })),
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleFileChange = (plantId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile) {
      uploadPlantImage(plantId, selectedFile)
        .then(() => {
          toast.success("Image uploaded successfully!");
          fetchPlants(); // re-fetch to update images in the list
        })
        .catch((err) => toast.error(err.message));
    }
  };

  if (loading) {
    return <p>Loading plants...</p>;
  }

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  return (
    <div className="container plants-container">
      {/* Header with Plants title & "+" button */}
      <div className="plants-header">
        <h1>Plants</h1>
        <button className="add-plant-btn" onClick={() => setModalOpen(true)}>+</button>
      </div>

      {/* PLANTS LIST */}
      <div className="plants-list">
        {plants.map((plant) => {
          // Sort images newest-first
          const sortedImages = [...(plant.images || [])].sort(
            (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
          );
          const latestImage = sortedImages.length > 0 ? sortedImages[0] : null;

          // Format last watered
          const lastWateredText = plant.lastWatered
            ? new Date(plant.lastWatered).toLocaleDateString()
            : "Not watered yet";

          return (
            <div key={plant.id} className="plant-card">
              <Link
                to={`/plants/${plant.id}`}
                key={plant.id}
                onClick={(e) => {
                  // If the click originated from the .plant-buttons area, cancel navigation.
                  if ((e.target as HTMLElement).closest('.plant-buttons')) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                {/* Plant Image */}
                <div className="plant-image-container">
                  <img
                    src={
                      latestImage
                        ? `/api/uploads/${latestImage.image_path}`
                        : "/placeholder-plant.webp"
                    }
                    alt={plant.name}
                    className="plant-image"
                  />
                </div>

                {/* Plant Information */}
                <div className="plant-card-text">
                  <h3>{plant.name}</h3>
                  <p><strong>Species:</strong> {plant.species || "Unknown"}</p>
                  <p><strong>Last Watered:</strong> {lastWateredText}</p>
                </div>
              </Link>

              {/* Upload Image & Identify Species Buttons */}
              <div
                className="plant-buttons"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                {/* Hidden File Input */}
                <input
                  type="file"
                  id={`file-upload-${plant.id}`}
                  className="file-input"
                  onChange={(e) => handleFileChange(plant.id, e)}
                />
                <button onClick={() => {
                  document.getElementById(`file-upload-${plant.id}`)?.click();
                }}>
                  <FontAwesomeIcon icon={faUpload} />
                </button>

                {/* Identify Species Button */}
                <button onClick={() => handleIdentifyPlant(plant.id)}>
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* IDENTIFY RESULTS MODAL */}
      {identifyResults && (
        <IdentifyResults
          plantId={identifyResults.plantId}
          results={identifyResults.results}
          onSelectSpecies={(plantId, identifiedName, identifiedSpecies) => {
            updatePlant(plantId, {
              name: identifiedName,
              species: identifiedSpecies,
            }).then(fetchPlants);
            setIdentifyResults(null);
          }}
          onClose={() => setIdentifyResults(null)}
        />
      )}

      {/* CREATE PLANT MODAL */}
      {modalOpen && (
        <div className="add-plant-modal">
          <div className="add-plant-modal-content">
            <span className="close" onClick={() => setModalOpen(false)}>&times;</span>
            <h2>Add a New Plant</h2>
            <input
              type="text"
              placeholder="Plant Name"
              value={newPlant.name}
              onChange={(e) => setNewPlant({ ...newPlant, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Species (Optional)"
              value={newPlant.species}
              onChange={(e) => setNewPlant({ ...newPlant, species: e.target.value })}
            />
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={handleCreatePlant}>Add Plant</button>
          </div>
        </div>
      )}
    </div>
  );
}
