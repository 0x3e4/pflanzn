import { updatePlant } from "../services/PlantService";
import { Plant } from "../types/Plant";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import EditableDiv from "../components/EditableDiv";

interface Props {
    plant: Plant;
    onDescriptionUpdated: (updatedPlant: Plant) => void;
}

export default function Description({ plant, onDescriptionUpdated }: Props) {
    const { isLoggedIn } = useAuth();

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
        <div className="description-container">
            <h3>Description</h3>
            <EditableDiv
                value={plant.description || ""}
                onSave={(newValue) => handleUpdate({ description: newValue })}
                editable={isLoggedIn}
                placeholder="No description found."
            />
        </div>
    );
}
