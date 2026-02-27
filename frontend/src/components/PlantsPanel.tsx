import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchPlants, updatePlant, deletePlant } from "../services/PlantService";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faSave, faEye, faChevronLeft, faChevronRight, faCircleXmark } from "@fortawesome/free-solid-svg-icons";
import { Plant } from "../types/Plant";
import { setOverlayOpen } from "../services/overlayControl";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function PlantsPanel() {
    const navigate = useNavigate();
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const { user, isLoggedIn } = useAuth();
    const [plants, setPlants] = useState<Plant[]>([]);
    // Changed: Track edits per plant ID instead of a single editedPlant
    const [editedPlants, setEditedPlants] = useState<{ [plantId: number]: Partial<Plant> }>({});
    const [deleteModalOpen, setDeleteModalOpen] = useState<number | null>(null);
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
        let isActive = true;

        const loadPlants = async () => {
            setLoading(true);
            const canManagePlants = authMode === "no" || user?.role === "admin";

            if (!canManagePlants) {
                if (isActive) {
                    setPlants([]);
                    setLoading(false);
                }
                return;
            }

            try {
                const fetchedPlants = await fetchPlants();
                if (isActive) {
                    setPlants(fetchedPlants.map((p) => ({ ...p, species: p.species ?? "" })));
                }
            } catch {
                toast.error("Failed to load plants.");
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        loadPlants();
        return () => {
            isActive = false;
        };
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

    // Helper function to get the current value for a field
    const getCurrentValue = (plantId: number, field: keyof Plant, originalValue: any) => {
        return editedPlants[plantId]?.[field] ?? originalValue;
    };

    // Helper function to update a specific plant's field
    const updatePlantField = (plantId: number, field: keyof Plant, value: any) => {
        setEditedPlants(prev => ({
            ...prev,
            [plantId]: {
                ...prev[plantId],
                [field]: value
            }
        }));
    };

    // Update Plant
    const handleUpdatePlant = async (plantId: number) => {
        const changes = editedPlants[plantId];
        if (!changes || Object.keys(changes).length === 0) {
            toast.info("No changes to save.");
            return;
        }

        try {
            await updatePlant(plantId, changes);
            toast.success("Plant updated successfully.");
            fetchPlants().then((plants) =>
                setPlants(plants.map(p => ({ ...p, species: p.species ?? "" })))
            );
            // Clear the edits for this plant
            setEditedPlants(prev => {
                const updated = { ...prev };
                delete updated[plantId];
                return updated;
            });
        } catch {
            toast.error("Failed to update plant.");
        }
    };

    // Delete Plant
    const handleConfirmDelete = async (plantId: number) => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to delete plants.");
            return;
        }

        try {
            await deletePlant(plantId);
            toast.success("Plant deleted successfully.");
            fetchPlants().then((plants) =>
                setPlants(plants.map((p) => ({ ...p, species: p.species ?? "" })))
            );            
        } catch {
            toast.error("Failed to delete plant.");
        } finally {
            setDeleteModalOpen(null);
        }
    };

    if (!isLoggedIn && authMode !== "no") {
        return <p>Access denied</p>;
    }

    useEffect(() => {
        if (deleteModalOpen) {
        setOverlayOpen(true);
        } else {
        setOverlayOpen(false);
        }
    }, [deleteModalOpen]);  

    return (
        <div className="plants-panel">
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
                        {loading
                            ? [...Array(6)].map((_, index) => (
                                <tr key={`plant-skeleton-${index}`}>
                                    <td><Skeleton width={24} /></td>
                                    <td><Skeleton /></td>
                                    <td><Skeleton /></td>
                                    <td className="action-buttons">
                                        <Skeleton circle width={30} height={30} />
                                        <Skeleton circle width={30} height={30} />
                                        <Skeleton circle width={30} height={30} />
                                    </td>
                                </tr>
                            ))
                            : currentPlants.map((p) => (
                                <tr key={p.id}>
                                    <td>{p.id}</td>
                                    <td>
                                        <input 
                                            type="text" 
                                            value={getCurrentValue(p.id, 'name', p.name)} 
                                            onChange={(e) => updatePlantField(p.id, 'name', e.target.value)} 
                                            className="editable-input"
                                        />
                                    </td>
                                    <td>
                                        <input 
                                            type="text" 
                                            value={getCurrentValue(p.id, 'species', p.species)} 
                                            onChange={(e) => updatePlantField(p.id, 'species', e.target.value)} 
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
                                        <button className="delete-btn" onClick={() => setDeleteModalOpen(p.id)}>
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>

                {!loading && totalPages > 1 && (
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

                {/* Delete Confirmation Modal */}
                {deleteModalOpen && (
                    <div className="delete-plant-modal-overlay">
                        <div className="delete-plant-modal">
                            <div className="delete-modal-header">
                                <span>Are you sure you want to delete this plant?</span>
                            </div>
                            <div className="delete-plant-modal-buttons">
                                <button className="delete-plant-confirm" onClick={() => handleConfirmDelete(deleteModalOpen)}>
                                <FontAwesomeIcon icon={faTrash} /> Delete
                                </button>
                                <button className="delete-plant-cancel" onClick={() => setDeleteModalOpen(null)}>
                                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
