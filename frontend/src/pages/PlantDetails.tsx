import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    fetchSinglePlant,
    deletePlant,
    updatePlant,
    generatePlantDescription,
    waterPlant,
    identifyPlant,
    uploadPlantImage
} from "../services/PlantService";
import { Plant } from "../types/Plant";
import TimelineImages from "../components/TimelineImages";
import Description from "../components/Description";
import Calendar from "../components/Calendar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faWandMagicSparkles, faDroplet, faCalendarAlt, faFingerprint, faCircleXmark, faUpload } from "@fortawesome/free-solid-svg-icons";
import "../styles/plantDetails.css";
import { DateTime } from 'luxon';
import { toast } from 'react-toastify';
import LoadingOverlay from "../components/LoadingOverlay";
import IdentifyResults from "../components/IdentifyResults";
import { useAuth } from "../context/AuthContext";

export default function PlantDetails() {
    const { isLoggedIn } = useAuth();

    const { plantId } = useParams();
    const navigate = useNavigate();

    const [plant, setPlant] = useState<Plant | null>(null);
    const [loadingPlant, setLoadingPlant] = useState(true);
    const [selectedDateTime, setSelectedDateTime] = useState<string>(
        DateTime.now().toISO({ includeOffset: false }) ?? ""
    );
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [identifyResults, setIdentifyResults] = useState<{ species: string; commonName: string; score: string; images: string[] }[] | null>(null);

    // Fetch plant data on load
    useEffect(() => {
        if (plantId) {
            loadPlant();
        }
    }, [plantId]);

    const loadPlant = async () => {
        try {
            const data = await fetchSinglePlant(Number(plantId));
            setPlant(data);
        } catch (error) {
            toast.error((error as Error).message || "Failed to load plant.");
            navigate("/plants"); // fallback if plant doesn't exist
        } finally {
            setLoadingPlant(false);
        }
    };

    const handleUploadImageForPlant = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!plantId) return;

        if (!isLoggedIn) {
            toast.error("You must be logged in to add images to plants.");
            return;
        }

        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await uploadPlantImage(Number(plantId), file);
            toast.success("Image uploaded!");
        } catch (err) {
            toast.error((err as Error).message || "Failed to upload the image.");
        }
    };

    const handleIdentifyPlant = async () => {
        if (!plantId) return;

        if (!isLoggedIn) {
            toast.error("You must be logged in to identify plants.");
            return;
        }

        setLoadingPlant(true);

        try {
            const result = await identifyPlant(Number(plantId));

            if (result.identified_species.length === 0) {
                toast.warning("No species found.");
                return;
            }

            setIdentifyResults(result.identified_species.map((r: any) => ({
                species: r.scientific_name || "Unknown",
                commonName: r.common_name || "No common name",
                score: r.score.toString(),
                images: r.images,
            })));
        } catch (error) {
            toast.error((error as Error).message || "Failed to identify plant.");
        } finally {
            setLoadingPlant(false);
        }
    };

    // Handle updating plant (name/species/description/etc.)
    const handleUpdate = async (updatedFields: Partial<Plant>) => {
      if (!plant || !plantId) return;

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
          const updated = await updatePlant(Number(plantId), updatedFields);
          setPlant(updated);
          toast.success("Plant updated successfully!");
      } catch (err) {
          toast.error((err as Error).message);
      }
    };

    // Handle delete plant via confirmation modal
    const handleConfirmDelete = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to delete plants.");
            return;
        }

        try {
            await deletePlant(Number(plantId));
            toast.success("Plant deleted successfully!");
            navigate("/plants");
        } catch (error) {
            toast.error((error as Error).message || "Failed to delete plant.");
        } finally {
            setDeleteModalOpen(false);
        }
    };

    // Water the plant (log watering date)
    const handleWaterPlant = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to water plants.");
            return;
        }

        try {
            await waterPlant(Number(plantId), { watered_at: selectedDateTime });
            loadPlant(); // refresh after watering
            toast.success("Watering logged successfully!");
        } catch (error) {
            toast.error((error as Error).message || "Failed to log watering.");
        }
    };

    // Generate AI description
    const handleGenerateDescription = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to update plants.");
            return;
        }

        try {
            const { description } = await generatePlantDescription(Number(plantId));
            handleUpdate({ description });
        } catch (error) {
            toast.error((error as Error).message || "Failed to generate description.");
        }
    };

    if (loadingPlant) {
        return <LoadingOverlay />;
    }

    if (!plant) {
        return <div>Plant not found.</div>;
    }

    return (
        <div className="container plant-details-container">
            <div className="plant-columns">
                {/* Left Column - Plant Info + Images + Watering Log */}
                <div className="plant-left-column">
                    <div className="plant-information">
                        <h2>
                            {isLoggedIn ? (
                                <>
                                    <span 
                                        className="editable-input"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleUpdate({ name: e.target.innerText })}
                                        tabIndex={0}
                                    >
                                        {plant.name || "Unnamed Plant"}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span
                                        className="editable-input-noauth"
                                        suppressContentEditableWarning
                                        onClick={() => toast.warning("You must be logged in to update plants.")}
                                        tabIndex={0}
                                    >
                                        {plant.species || "Unknown"}
                                    </span>
                                </>
                            )}
                        </h2>
                        <small>#{plant.id}</small>
                        <span>
                            <strong>Species:</strong>{" "}
                            {isLoggedIn ? (
                                <>
                                    <span
                                        className="editable-input"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleUpdate({ species: e.target.innerText })}
                                        tabIndex={0}
                                    >
                                        {plant.species || "Unknown"}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span
                                        className="editable-input-noauth"
                                        suppressContentEditableWarning
                                        onClick={() => toast.warning("You must be logged in to update plants.")}
                                        tabIndex={0}
                                    >
                                        {plant.species || "Unknown"}
                                    </span>
                                </>
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
                                    minute: '2-digit'
                                })
                                : "Not watered yet"}
                        </span>
                    </div>

                    <TimelineImages images={plant.images} plantId={plant.id} />
                    <Calendar waterings={plant.waterings} images={plant.images} plantId={plant.id} />
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
                            {isLoggedIn ? (
                                <>
                                    <button className="water-plant-btn" onClick={handleWaterPlant}>
                                        <FontAwesomeIcon icon={faDroplet} /> Water Plant
                                    </button>
                                </>
                            ) : (
                                <button className="water-plant-btn" onClick={() => toast.warning("You must be logged in to water plants.")}>
                                    <FontAwesomeIcon icon={faDroplet} /> Water Plant
                                </button>
                            )}
                            <div className="water-plant-datetime">
                                <FontAwesomeIcon icon={faCalendarAlt} />
                                <input
                                    type="datetime-local"
                                    value={selectedDateTime.slice(0, 16)}
                                    onChange={(e) => setSelectedDateTime(e.target.value)}
                                />
                            </div>
                        </div>

                        {isLoggedIn ? (
                            <>
                                <input
                                    type="file"
                                    id={`file-upload-${plant.id}`}
                                    className="file-input"
                                    onChange={(e) => handleUploadImageForPlant(e)}
                                />
                                <button className="file-input-plant-btn" onClick={() => document.getElementById(`file-upload-${plant.id}`)?.click()}>
                                    <FontAwesomeIcon icon={faUpload} /> Upload Image
                                </button>
                            </>
                        ) : (
                                <button className="file-input-plant-btn" onClick={() => toast.warning("You must be logged in to upload images.")}>
                                    <FontAwesomeIcon icon={faUpload} /> Upload Image
                                </button>
                        )}

                        {isLoggedIn ? (
                            <>
                                <button className="identify-plant-btn" onClick={handleIdentifyPlant}>
                                    <FontAwesomeIcon icon={faFingerprint} /> Identify Plant
                                </button>
                            </>
                        ) : (
                                <button className="identify-plant-btn" onClick={() => toast.warning("You must be logged in to identify images.")}>
                                    <FontAwesomeIcon icon={faFingerprint} /> Identify Plant
                                </button>
                        )}

                        {import.meta.env.VITE_LLM_PROVIDER && (
                            <>
                                {isLoggedIn ? (
                                    <>
                                        <button className="ai-care-helper-btn" onClick={handleGenerateDescription}> {/* WORK IN PROGRESS */}
                                            <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Care Helper
                                        </button>

                                        <button className="generate-description-btn" onClick={handleGenerateDescription}>
                                            <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Description
                                        </button>
                                    </>
                                ) : (
                                        <>
                                            <button className="ai-care-helper-btn" onClick={() => toast.warning("You must be logged in to receive tips from AI.")}> {/* WORK IN PROGRESS */}
                                                <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Care Helper
                                            </button>

                                            <button className="generate-description-btn" onClick={() => toast.warning("You must be logged in to generate a description with AI.")}>
                                                <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Description
                                            </button>
                                        </>
                                )}
                            </>
                        )}
                    </div>

                    {isLoggedIn ? (
                        <>
                            <button className="delete-plant-btn" onClick={() => setDeleteModalOpen(true)}>
                                <FontAwesomeIcon icon={faTrash} /> Delete Plant
                            </button>
                        </>
                    ) : (
                        <button className="delete-plant-btn" onClick={() => toast.warning("You must be logged in to delete plants.")}>
                            <FontAwesomeIcon icon={faTrash} /> Delete Plant
                        </button>
                    )}
                </div>
            </div>

            {identifyResults && (
                <IdentifyResults
                    plantId={Number(plantId)}
                    results={identifyResults}
                    onSelectSpecies={(plantId, name, species) => {
                        updatePlant(plantId, { name, species });
                        setIdentifyResults(null);
                        loadPlant();
                        toast.success(`Plant updated to ${name} (${species})`);
                    }}
                    onClose={() => setIdentifyResults(null)}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="delete-plant-modal-overlay">
                    <div className="delete-plant-modal">
                        <p>Are you sure you want to delete this plant?</p>
                        <div className="delete-plant-modal-buttons">
                            <button className="delete-plant-confirm" onClick={handleConfirmDelete}>
                              <FontAwesomeIcon icon={faTrash} /> Delete
                            </button>
                            <button className="delete-plant-cancel" onClick={() => setDeleteModalOpen(false)}>
                              <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}