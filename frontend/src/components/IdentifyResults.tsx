import "../styles/identifyResults.css";

interface IdentifyResultsProps {
  plantId: number;
  results: { species: string; commonName: string; score: string }[]; // Updated types
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
    <div className="modal">
      <div className="modal-content">
        <h2>Select Identified Species</h2>
        <ul>
          {results
            .sort((a, b) => parseFloat(b.score) - parseFloat(a.score)) // Sort by highest score
            .map((result, index) => (
              <li
                key={index}
                onClick={() => onSelectSpecies(plantId, result.species)} // Use species here
              >
                <strong>{result.species}</strong> ({result.commonName || "No common name"}) - {parseFloat(result.score).toFixed(2)}% 
              </li>
            ))}
        </ul>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
