import "../styles/identifyResults.css";

interface IdentifyResultsProps {
  plantId: number;
  results: { species: string; commonName: string; score: string }[];
  onSelectSpecies: (plantId: number, species: string) => void;
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
              .sort((a, b) => parseFloat(b.score) - parseFloat(a.score)) // Sort by highest score
              .map((result, index) => (
                <li
                  key={index}
                  onClick={() => onSelectSpecies(plantId, result.species)}
                  className="species-item"
                >
                  <strong>{result.species}</strong> ({result.commonName || "No common name"}) -{" "}
                  {parseFloat(result.score).toFixed(2)}%
                </li>
              ))
          ) : (
            <p>No species identified.</p>
          )}
        </ul>
        <button className="cancel-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}