import { useState, useEffect } from "react";
import "../styles/identifyResults.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleXmark } from "@fortawesome/free-solid-svg-icons";
import { IdentifyResult } from "../types/IdentifyResult";
import { setOverlayOpen } from "../services/overlayControl";

interface IdentifyResultsProps {
    plantId: number;
    results: IdentifyResult[];
    onSelectSpecies: (plantId: number, name: string, species: string) => void;
    onClose: () => void;
}

export default function IdentifyResults({
  plantId,
  results,
  onSelectSpecies,
  onClose,
}: IdentifyResultsProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedImage) {
      setOverlayOpen(true);
    } else {
      setOverlayOpen(false);
    }
}, [selectedImage]);

  return (
    <div className="identify-modal-overlay" onClick={onClose}>
      <div className="identify-modal" onClick={(e) => e.stopPropagation()}>
        <span className="close" onClick={onClose}>&times;</span>
        <h2>Select Identified Species</h2>
        <ul>
          {results.length > 0 ? (
            results
              .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
              .map((result, index) => (
                <li
                  key={index}
                  onClick={() => onSelectSpecies(plantId, result.commonName, result.species)}
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
          <div className="image-modal" onClick={() => setSelectedImage(null)}>
            <div className="image-modal-content">
              <img src={selectedImage} alt="Full-sized" />
            </div>
          </div>
        )}
      </div>
    </div>
  );  
}