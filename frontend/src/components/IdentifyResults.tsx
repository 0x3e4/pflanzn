import { useState, useEffect, useCallback } from "react";
import "../styles/identifyResults.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleXmark } from "@fortawesome/free-solid-svg-icons";
import { IdentifyResult } from "../types/IdentifyResult";
import { setOverlayOpen } from "../services/overlayControl";
import { useModalA11y } from "../hooks/useModalA11y";

interface IdentifyResultsProps {
    plantId: number;
    results: IdentifyResult[];
    onSelectSpecies: (plantId: number, name: string, species: string) => void;
    onClose: () => void;
    /**
     * When provided, clicking a row triggers this callback instead of `onSelectSpecies`.
     * Used by the standalone (camera-icon) flow to start an "add plant" flow,
     * pre-filled with the picked species.
     */
    onAddPlant?: (commonName: string, species: string) => void;
}

export default function IdentifyResults({ plantId, results, onSelectSpecies, onClose, onAddPlant }: IdentifyResultsProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const closeImageModal = useCallback(() => setSelectedImage(null), []);
    const { modalRef: resultsModalRef } = useModalA11y({ isOpen: true, onClose });
    const { modalRef: imageModalRef } = useModalA11y({ isOpen: !!selectedImage, onClose: closeImageModal });

    useEffect(() => {
        if (selectedImage) {
            setOverlayOpen(true);
        } else {
            setOverlayOpen(false);
        }
    }, [selectedImage]);

    return (
        <div className="identify-modal-overlay" onClick={onClose}>
            <div className="identify-modal" ref={resultsModalRef} role="dialog" aria-modal="true" aria-label="Species identification results" onClick={(e) => e.stopPropagation()}>
                <span className="close" onClick={onClose}>
                    &times;
                </span>
                <h2>{onAddPlant ? "Add a plant from this identification" : "Select Identified Species"}</h2>
                {onAddPlant && <p className="identify-modal-hint">Click a species to start adding a plant pre-filled with its details.</p>}
                <ul>
                    {results.length > 0 ? (
                        results
                            .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
                            .map((result, index) => (
                                <li
                                    key={index}
                                    onClick={() => {
                                        if (onAddPlant) {
                                            onAddPlant(result.commonName, result.species);
                                        } else {
                                            onSelectSpecies(plantId, result.commonName, result.species);
                                        }
                                    }}
                                    className="species-item"
                                >
                                    {/* Name & Percentage in the Same Row */}
                                    <div className="species-header">
                                        <div className="species-name">
                                            <strong>{result.species}</strong>
                                            <br />
                                            <span>{result.commonName || "No common name"}</span>
                                        </div>
                                        <div className="species-percentage">
                                            <span>{parseFloat(result.score).toFixed(2)}%</span>
                                        </div>
                                    </div>

                                    {/* Display related images below */}
                                    {Array.isArray(result.images) && result.images.length > 0 && (
                                        <div className="species-images">
                                            {result.images.map((imageUrl, i) => (
                                                <div key={i} className="image-container">
                                                    <img
                                                        src={imageUrl}
                                                        alt={`Related ${result.species}`}
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
                            ))
                    ) : (
                        <p>No species identified.</p>
                    )}
                </ul>

                <button className="cancel-btn" onClick={onClose}>
                    <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                </button>

                {/* Large image preview modal */}
                {selectedImage && (
                    <div className="image-modal" onClick={closeImageModal}>
                        <div className="image-modal-content" ref={imageModalRef} role="dialog" aria-modal="true" aria-label="Full size image preview">
                            <img src={selectedImage} alt="Full-sized" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
