import "../styles/identifyResults.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleXmark } from "@fortawesome/free-solid-svg-icons";
import { IdentifyResult } from "../types/IdentifyResult";

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
                  <div className="species-name">
                    <span>
                      <strong>{result.species}</strong>
                    </span>
                    <span>{result.commonName || "No common name"}</span>
                  </div>
                  <div className="species-percentage">
                    <span>{parseFloat(result.score).toFixed(2)}%</span>
                  </div>
                </li>
              ))
          ) : (
            <p>No species identified.</p>
          )}
        </ul>
        <button className="cancel-btn" onClick={onClose}>
          <FontAwesomeIcon icon={faCircleXmark} /> Cancel
        </button>
      </div>
    </div>
  );
}