import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchPlants, updatePlant, deletePlant } from "../services/PlantService";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faSave, faEye, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { Plant } from "../types/Plant";
import LoadingOverlay from "../components/LoadingOverlay";

export default function PlantsPanel() {
    const navigate = useNavigate();
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const { user, isLoggedIn } = useAuth();
    const [plants, setPlants] = useState<Plant[]>([]);
    const [editedPlant, setEditedPlant] = useState<Partial<Plant>>({});

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    
    // Calculate total pages
    const totalPages = Math.ceil(plants.length / itemsPerPage);
    
    // Sort
    const [sortField, setSortField] = useState<keyof Plant>('id');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [loading, setLoading] = useState(true);

    // Sort function
    function compare<T>(a: T, b: T, field: keyof T, direction: 'asc' | 'desc') {
        if (a[field] == null) return direction === 'asc' ? 1 : -1;
        if (b[field] == null) return direction === 'asc' ? -1 : 1;
        if (typeof a[field] === 'string' && typeof b[field] === 'string') {
            return direction === 'asc'
                ? (a[field] as string).localeCompare(b[field] as string)
                : (b[field] as string).localeCompare(a[field] as string);
        }
        return direction === 'asc'
            ? (a[field] as any) - (b[field] as any)
            : (b[field] as any) - (a[field] as any);
    }

    const handleSort = (field: keyof Plant) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Get paginated plants
    const indexOfLastPlant = currentPage * itemsPerPage;
    const indexOfFirstPlant = indexOfLastPlant - itemsPerPage;
    const sortedPlants = [...plants].sort((a, b) => compare(a, b, sortField, sortDirection));
    const currentPlants = sortedPlants.slice(indexOfFirstPlant, indexOfLastPlant);
    
    useEffect(() => {
        if (authMode === "no" || user?.role === "admin") {
            fetchPlants()
                .then((plants) => setPlants(plants.map((p) => ({ ...p, species: p.species ?? "" }))))
                .catch(() => toast.error("Failed to load plants."));
        }
        setLoading(false);
    }, [user, authMode]);

    const handleNavigateToPlant = (plantId: number) => {
        navigate(`/plant/${plantId}`);
    };

    const handlePageChange = (direction: "prev" | "next") => {
        setCurrentPage(prev => 
            direction === "next" 
                ? Math.min(prev + 1, totalPages) 
                : Math.max(prev - 1, 1)
        );
    };    

    // Update Plant
    const handleUpdatePlant = async (plantId: number) => {
        try {
            await updatePlant(plantId, editedPlant);
            toast.success("Plant updated successfully.");
            fetchPlants().then((plants) =>
                setPlants(plants.map(p => ({ ...p, species: p.species ?? "" })))
            );
            setEditedPlant({});
        } catch {
            toast.error("Failed to update plant.");
        }
    };

    // Delete Plant
    const handleDeletePlant = async (plantId: number) => {
        if (!window.confirm("Are you sure you want to delete this plant?")) return;

        try {
            await deletePlant(plantId);
            toast.success("Plant deleted successfully.");
            fetchPlants().then((plants) =>
                setPlants(plants.map((p) => ({ ...p, species: p.species ?? "" })))
            );            
        } catch {
            toast.error("Failed to delete plant.");
        }
    };

    if (!isLoggedIn && authMode !== "no") {
        return <p>Access denied</p>;
    }

    return (
        <div className="plants-panel">
            {loading && <LoadingOverlay />}

            <h2>Plant Management</h2>
            <p>Here you can manage all the plants.</p>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('id')}>ID</th>
                            <th onClick={() => handleSort('name')}>Name</th>
                            <th onClick={() => handleSort('species')}>Species</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentPlants.map((p) => (
                            <tr key={p.id}>
                                <td>{p.id}</td>
                                <td>
                                    <input 
                                        type="text" 
                                        value={editedPlant.name ?? p.name} 
                                        onChange={(e) => setEditedPlant((prev) => ({ ...prev, name: e.target.value }))} 
                                        className="editable-input"
                                    />
                                </td>
                                <td>
                                    <input 
                                        type="text" 
                                        value={editedPlant.species ?? p.species} 
                                        onChange={(e) => setEditedPlant((prev) => ({ ...prev, species: e.target.value }))} 
                                        className="editable-input"
                                    />
                                </td>
                                <td className="action-buttons">
                                    <button className="view-btn" onClick={() => handleNavigateToPlant(p.id)}>
                                        <FontAwesomeIcon icon={faEye} />
                                    </button>
                                    <button className="update-btn" onClick={() => handleUpdatePlant(p.id)}>
                                        <FontAwesomeIcon icon={faSave} />
                                    </button>
                                    <button className="delete-btn" onClick={() => handleDeletePlant(p.id)}>
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {totalPages > 1 && (
                    <div className="pagination">
                        <button 
                            onClick={() => handlePageChange("prev")}
                            disabled={currentPage === 1}
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span>{currentPage} of {totalPages}</span>
                        <button 
                            onClick={() => handlePageChange("next")}
                            disabled={currentPage === totalPages}
                        >
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}