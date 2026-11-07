import { useEffect, useState } from "react";
import { fetchSpeciesDescription, updatePlant } from "../services/PlantService";
import { Plant } from "../types/Plant";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import EditableDiv from "../components/EditableDiv";

interface Props {
    plant: Plant;
    onDescriptionUpdated: (updatedPlant: Plant) => void;
    // Offered in the empty state when the AI can write one.
    onGenerate?: () => void;
}

export default function Description({ plant, onDescriptionUpdated, onGenerate }: Props) {
    const { isLoggedIn } = useAuth();
    // Another plant of the same species may already have a description to reuse.
    const [reuse, setReuse] = useState<{ species: string; text: string; from: string } | null>(null);
    const species = plant.species?.trim() ?? "";
    const wantsReuse = isLoggedIn && !plant.description && species !== "";

    useEffect(() => {
        if (!wantsReuse) return;
        let cancelled = false;
        fetchSpeciesDescription(plant.id)
            .then((found) => {
                if (!cancelled && found.description) {
                    setReuse({ species, text: found.description, from: found.source_plant_name ?? "another plant" });
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [plant.id, species, wantsReuse]);
    const offer = wantsReuse && reuse?.species === species ? reuse : null;

    const handleUpdate = async (updatedFields: Partial<Plant>) => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to update plants.");
            return;
        }

        const hasChanges = Object.keys(updatedFields).some((key) => {
            const fieldKey = key as keyof Plant;
            return plant[fieldKey] !== updatedFields[fieldKey];
        });

        if (!hasChanges) return;

        try {
            const updatedPlant = await updatePlant(plant.id, updatedFields);
            onDescriptionUpdated(updatedPlant);
            toast.success("Description updated successfully!");
        } catch (error) {
            toast.error((error as Error).message || "Failed to update description");
        }
    };

    return (
        <div className={`description-container${plant.description ? "" : " description-container--empty"}`}>
            <h3>Description</h3>
            <EditableDiv
                value={plant.description || ""}
                onSave={(newValue) => handleUpdate({ description: newValue })}
                editable={isLoggedIn}
                placeholder="No description yet."
            />
            {!plant.description && (offer || onGenerate) && (
                <div className="description-actions">
                    {offer && (
                        <button
                            type="button"
                            className="description-generate"
                            onClick={() => handleUpdate({ description: offer.text })}
                        >
                            Use the description from {offer.from}
                        </button>
                    )}
                    {onGenerate && (
                        <button type="button" className="description-generate" onClick={onGenerate}>
                            Write with AI
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
