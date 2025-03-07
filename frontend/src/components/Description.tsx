import { useState, useEffect, useRef } from "react";
import { updatePlant } from "../services/PlantService";
import { Plant } from "../types/Plant";
import { toast } from "react-toastify";

interface Props {
    plant: Plant;
    onDescriptionUpdated: (updatedPlant: Plant) => void;
}

export default function Description({ plant, onDescriptionUpdated }: Props) {
    const [editingDescription, setEditingDescription] = useState(false);
    const [localDescription, setLocalDescription] = useState(plant.description || "");
    const descriptionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalDescription(plant.description || "");
    }, [plant.description]);

    const handleUpdate = async (updatedFields: Partial<Plant>) => {
        try {
            const updatedPlant = await updatePlant(plant.id, updatedFields);
            onDescriptionUpdated(updatedPlant);
            setLocalDescription(updatedPlant.description || "");
            toast.success("Description updated successfully!");
        } catch (error) {
            toast.error((error as Error).message || "Failed to update description");
        }
    };

    useEffect(() => {
      if (editingDescription) {
          const handleClickOutside = (event: MouseEvent | TouchEvent) => {
              if (descriptionRef.current && !descriptionRef.current.contains(event.target as Node)) {
                  exitEditingMode();
              }
          };
  
          document.addEventListener("mousedown", handleClickOutside);
          document.addEventListener("touchstart", handleClickOutside);
  
          return () => {
              document.removeEventListener("mousedown", handleClickOutside);
              document.removeEventListener("touchstart", handleClickOutside);
          };
      }
    }, [editingDescription]);  

    const exitEditingMode = () => {
        if (descriptionRef.current) {
            const newContent = descriptionRef.current.innerText.trim();
            setEditingDescription(false);
            if (newContent !== plant.description) {
                handleUpdate({ description: newContent });
            }
        }
    };

    return (
        <div className="description-container">
            <h3>Description</h3>
            <div
                className={`editable-div ${editingDescription ? "editing" : ""}`}
                contentEditable={editingDescription}
                suppressContentEditableWarning
                ref={descriptionRef}
                onClick={() => setEditingDescription(true)}
                onFocus={(e) => {
                    e.currentTarget.dataset.prevContent = e.currentTarget.innerText;
                }}
            >
                {localDescription || "No description found."}
            </div>
        </div>
    );
}