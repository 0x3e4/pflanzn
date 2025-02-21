import { useEffect, useState } from "react";
import { createPlant, uploadPlantImage, identifyPlant, updatePlant, Plant } from "../services/Plant";
import "../styles/plants.css";
import IdentifyResults from "../components/IdentifyResults";

export default function Plants() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPlant, setNewPlant] = useState({ name: "", species: "" });
  const [file, setFile] = useState<File | null>(null);
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
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlant = async () => {
    try {
      const plant = await createPlant(newPlant.name, newPlant.species);
      setPlants([...plants, plant]); // Update UI
      setNewPlant({ name: "", species: "" }); // Reset input
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleUploadImage = async (plantId: number) => {
    if (!file) return alert("Please select a file.");
    try {
      await uploadPlantImage(plantId, file);
      alert("Image uploaded successfully!");
      setFile(null); // Reset file input
    } catch (err) {
      alert((err as Error).message);
    }
  };

const handleIdentifyPlant = async (plantId: number) => {
  try {
    const result = await identifyPlant(plantId);

    if (result.identified_species.length === 0) {
      alert("No species found.");
      return;
    }

    // Store identification results in state
    setIdentifyResults({
      plantId,
      results: result.identified_species.map((r: any) => ({
        species: r.scientific_name || "Unknown",
        commonName: r.common_name || "No common name",
        score: r.score,
      })),
    });
  } catch (err) {
    alert((err as Error).message);
  }
};

  const handleSelectSpecies = async (plantId: number, species: string) => {
    try {
      await updatePlant(plantId, { species });
      fetchPlants(); // Refresh the plants list
      setIdentifyResults(null); // Close modal
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (loading) return <p>Loading plants...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="plants-container">
      <h1>Plants</h1>

      {/* CREATE PLANT FORM */}
      <div className="create-plant">
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
        <button onClick={handleCreatePlant}>Add Plant</button>
      </div>

      {/* PLANTS LIST */}
      <div className="plants-list">
        {plants.map((plant) => (
          <div key={plant.id} className="plant-card">
            <img
              src={plant.images.length > 0 ? `/api/uploads/${plant.images[0].image_path}` : "/placeholder-plant.webp"}
              alt={plant.name}
              className="plant-image"
            />
            <h3>{plant.name}</h3>
            <p>
              <strong>Species:</strong> {plant.species || "Unknown"}
            </p>
            <p>
              <strong>Last Watered:</strong> {new Date(plant.lastWatered).toLocaleDateString()}
            </p>

            {/* UPLOAD IMAGE */}
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={() => handleUploadImage(plant.id)}>Upload Image</button>

            {/* IDENTIFY SPECIES */}
            <button onClick={() => handleIdentifyPlant(plant.id)}>Identify Species</button>
          </div>
        ))}
      </div>

      {/* IDENTIFY RESULTS MODAL */}
      {identifyResults && (
        <IdentifyResults
          plantId={identifyResults.plantId}
          results={identifyResults.results}
          onSelectSpecies={handleSelectSpecies}
          onClose={() => setIdentifyResults(null)}
        />
      )}
    </div>
  );
}