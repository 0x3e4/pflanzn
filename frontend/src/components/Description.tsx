import { useState, useEffect } from "react";
import { Plant, updatePlant } from "../services/Plant";
import { toast } from "react-toastify";

interface Props {
  plant: Plant;
  onDescriptionUpdated: (updatedPlant: Plant) => void;
}

export default function Description({ plant, onDescriptionUpdated }: Props) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [localDescription, setLocalDescription] = useState(plant.description || "");

  // Keep local description in sync if the parent plant object changes
  useEffect(() => {
    setLocalDescription(plant.description || "");
  }, [plant.description]);

  const handleUpdate = async (updatedFields: Partial<Plant>) => {
    try {
      const updatedPlant = await updatePlant(plant.id, updatedFields);
      onDescriptionUpdated(updatedPlant); // Update parent state
      setLocalDescription(updatedPlant.description || ""); // Sync local state
      toast.success("Description updated successfully!");
    } catch (error) {
      toast.error((error as Error).message || "Failed to update description");
    }
  };

  const handleDescriptionBlur = () => {
    setEditingDescription(false);
    if (localDescription !== plant.description) {
      handleUpdate({ description: localDescription });
    }
  };

  return (
    <div className="description-container">
      <h3>Description</h3>
      <div className="description">
        {editingDescription ? (
          <textarea
            className="editable-textarea"
            value={localDescription}
            autoFocus
            onChange={(e) => setLocalDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleDescriptionBlur()}
          />
        ) : (
          <span className="description-display" onClick={() => setEditingDescription(true)}>
            {plant.description || "No description found."}
          </span>
        )}
      </div>
    </div>
  );
}