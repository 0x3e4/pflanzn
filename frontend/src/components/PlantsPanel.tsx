import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { fetchPlants, updatePlant, deletePlant, setPlantTags, archivePlant } from "../services/PlantService";
import { fetchTags } from "../services/TagService";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faTrash,
    faSave,
    faEye,
    faChevronLeft,
    faChevronRight,
    faCircleXmark,
    faListCheck,
    faBoxArchive,
    faTrashCanArrowUp,
} from "@fortawesome/free-solid-svg-icons";
import { Plant } from "../types/Plant";
import { Tag } from "../types/Tag";
import { setOverlayOpen } from "../services/overlayControl";
import { useModalA11y } from "../hooks/useModalA11y";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function PlantsPanel() {
    const navigate = useNavigate();
    const { authMode } = useConfig();
    const { user, isLoggedIn } = useAuth();
    const [plants, setPlants] = useState<Plant[]>([]);
    // Changed: Track edits per plant ID instead of a single editedPlant
    const [editedPlants, setEditedPlants] = useState<{ [plantId: number]: Partial<Plant> }>({});
    const [deleteModalOpen, setDeleteModalOpen] = useState<number | null>(null);
    const [archiveModalOpen, setArchiveModalOpen] = useState<number | null>(null);
    const [archiveReason, setArchiveReason] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Calculate total pages
    const totalPages = Math.ceil(plants.length / itemsPerPage);

    // Sort
    const [sortField, setSortField] = useState<keyof Plant>("id");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [loading, setLoading] = useState(true);

    // Tag selector modal state
    const [tagModalPlant, setTagModalPlant] = useState<Plant | null>(null);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
    const [tagSearch, setTagSearch] = useState("");
    const [savingTags, setSavingTags] = useState(false);

    // Sort function
    function compare<T>(a: T, b: T, field: keyof T, direction: "asc" | "desc") {
        if (a[field] == null) return direction === "asc" ? 1 : -1;
        if (b[field] == null) return direction === "asc" ? -1 : 1;
        if (typeof a[field] === "string" && typeof b[field] === "string") {
            return direction === "asc"
                ? (a[field] as string).localeCompare(b[field] as string)
                : (b[field] as string).localeCompare(a[field] as string);
        }
        return direction === "asc" ? (a[field] as any) - (b[field] as any) : (b[field] as any) - (a[field] as any);
    }

    const handleSort = (field: keyof Plant) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDirection("asc");
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
        setCurrentPage((prev) => (direction === "next" ? Math.min(prev + 1, totalPages) : Math.max(prev - 1, 1)));
    };

    // Helper function to get the current value for a field
    const getCurrentValue = (plantId: number, field: keyof Plant, originalValue: any) => {
        return editedPlants[plantId]?.[field] ?? originalValue;
    };

    // Helper function to update a specific plant's field
    const updatePlantField = (plantId: number, field: keyof Plant, value: any) => {
        setEditedPlants((prev) => ({
            ...prev,
            [plantId]: {
                ...prev[plantId],
                [field]: value,
            },
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
            fetchPlants().then((plants) => setPlants(plants.map((p) => ({ ...p, species: p.species ?? "" }))));
            // Clear the edits for this plant
            setEditedPlants((prev) => {
                const updated = { ...prev };
                delete updated[plantId];
                return updated;
            });
        } catch {
            toast.error("Failed to update plant.");
        }
    };

    // Tag selector modal
    const openTagModal = async (plant: Plant) => {
        setTagModalPlant(plant);
        setSelectedTagIds(new Set(plant.tags.map((t) => t.id)));
        setTagSearch("");
        try {
            const tags = await fetchTags();
            setAllTags(tags);
        } catch {
            toast.error("Failed to load tags.");
        }
    };

    const closeTagModal = () => {
        setTagModalPlant(null);
        setAllTags([]);
        setSelectedTagIds(new Set());
        setTagSearch("");
    };

    const toggleTag = (tagId: number) => {
        setSelectedTagIds((prev) => {
            const next = new Set(prev);
            if (next.has(tagId)) {
                next.delete(tagId);
            } else {
                next.add(tagId);
            }
            return next;
        });
    };

    const handleSaveTags = async () => {
        if (!tagModalPlant) return;
        setSavingTags(true);
        try {
            const updated = await setPlantTags(tagModalPlant.id, Array.from(selectedTagIds));
            toast.success(`Updated tags for "${tagModalPlant.name}".`);
            setPlants((prev) =>
                prev.map((p) =>
                    p.id === updated.id ? { ...p, tags: updated.tags, species: updated.species ?? "" } : p,
                ),
            );
            closeTagModal();
        } catch {
            toast.error("Failed to update tags.");
        } finally {
            setSavingTags(false);
        }
    };

    const filteredTags = allTags.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()));

    const { modalRef: tagModalRef } = useModalA11y({ isOpen: !!tagModalPlant, onClose: closeTagModal });

    // Delete Plant
    const handleConfirmDelete = async (plantId: number) => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to delete plants.");
            return;
        }

        try {
            await deletePlant(plantId);
            toast.success("Plant deleted successfully.");
            fetchPlants().then((plants) => setPlants(plants.map((p) => ({ ...p, species: p.species ?? "" }))));
        } catch {
            toast.error("Failed to delete plant.");
        } finally {
            setDeleteModalOpen(null);
        }
    };

    // Archive / Restore Plant
    const handleConfirmArchive = async (plantId: number) => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to archive plants.");
            return;
        }

        const archive = !plants.find((p) => p.id === plantId)?.is_archived;

        try {
            await archivePlant(plantId, archive, archiveReason);
            toast.success(archive ? "Plant archived successfully." : "Plant restored successfully.");
            fetchPlants().then((plants) => setPlants(plants.map((p) => ({ ...p, species: p.species ?? "" }))));
        } catch {
            toast.error(archive ? "Failed to archive plant." : "Failed to restore plant.");
        } finally {
            setArchiveModalOpen(null);
            setArchiveReason("");
        }
    };

    if (!isLoggedIn && authMode !== "no") {
        return <p>Access denied</p>;
    }

    useEffect(() => {
        setOverlayOpen(!!deleteModalOpen || !!tagModalPlant || archiveModalOpen !== null);
    }, [deleteModalOpen, tagModalPlant, archiveModalOpen]);

    const archiveTarget = archiveModalOpen !== null ? plants.find((p) => p.id === archiveModalOpen) : undefined;
    const isArchivingTarget = !archiveTarget?.is_archived;

    return (
        <div className="plants-panel">
            <h2>Plant Management</h2>
            <p>Here you can manage all the plants.</p>

            <div className="table-container">
                <div className="table-scroll-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort("id")}>ID</th>
                            <th onClick={() => handleSort("name")}>Name</th>
                            <th onClick={() => handleSort("species")}>Species</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading
                            ? [...Array(6)].map((_, index) => (
                                  <tr key={`plant-skeleton-${index}`}>
                                      <td>
                                          <Skeleton width={24} />
                                      </td>
                                      <td>
                                          <Skeleton />
                                      </td>
                                      <td>
                                          <Skeleton />
                                      </td>
                                      <td>
                                          <div className="action-buttons">
                                              <Skeleton circle width={30} height={30} />
                                              <Skeleton circle width={30} height={30} />
                                              <Skeleton circle width={30} height={30} />
                                          </div>
                                      </td>
                                  </tr>
                              ))
                            : currentPlants.map((p) => (
                                  <tr key={p.id}>
                                      <td>{p.id}</td>
                                      <td>
                                          <input
                                              type="text"
                                              value={getCurrentValue(p.id, "name", p.name)}
                                              onChange={(e) => updatePlantField(p.id, "name", e.target.value)}
                                              className="editable-input"
                                          />
                                      </td>
                                      <td>
                                          <input
                                              type="text"
                                              value={getCurrentValue(p.id, "species", p.species)}
                                              onChange={(e) => updatePlantField(p.id, "species", e.target.value)}
                                              className="editable-input"
                                          />
                                      </td>
                                      <td>
                                          <div className="action-buttons">
                                              <button className="view-btn" onClick={() => openTagModal(p)} title="Manage tags">
                                                  <FontAwesomeIcon icon={faListCheck} />
                                              </button>
                                              <button className="view-btn" onClick={() => handleNavigateToPlant(p.id)}>
                                                  <FontAwesomeIcon icon={faEye} />
                                              </button>
                                              <button className="update-btn" onClick={() => handleUpdatePlant(p.id)}>
                                                  <FontAwesomeIcon icon={faSave} />
                                              </button>
                                              <button
                                                  className="archive-btn"
                                                  onClick={() => {
                                                      setArchiveReason("");
                                                      setArchiveModalOpen(p.id);
                                                  }}
                                                  title={p.is_archived ? "Restore plant" : "Archive plant"}
                                              >
                                                  <FontAwesomeIcon
                                                      icon={p.is_archived ? faTrashCanArrowUp : faBoxArchive}
                                                  />
                                              </button>
                                              <button className="delete-btn" onClick={() => setDeleteModalOpen(p.id)}>
                                                  <FontAwesomeIcon icon={faTrash} />
                                              </button>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                    </tbody>
                </table>
                </div>

                {!loading && totalPages > 1 && (
                    <div className="pagination">
                        <button onClick={() => handlePageChange("prev")} disabled={currentPage === 1}>
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span>
                            {currentPage} of {totalPages}
                        </span>
                        <button onClick={() => handlePageChange("next")} disabled={currentPage === totalPages}>
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
                                <button
                                    className="delete-plant-confirm"
                                    onClick={() => handleConfirmDelete(deleteModalOpen)}
                                >
                                    <FontAwesomeIcon icon={faTrash} /> Delete
                                </button>
                                <button className="delete-plant-cancel" onClick={() => setDeleteModalOpen(null)}>
                                    <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Archive Confirmation Modal */}
                {archiveModalOpen !== null && (
                    <div className="archive-plant-modal-overlay">
                        <div className="archive-plant-modal">
                            <div className="archive-modal-header">
                                <span>
                                    {isArchivingTarget
                                        ? "Are you sure you want to archive this plant?"
                                        : "Are you sure you want to restore this plant?"}
                                </span>
                            </div>

                            {isArchivingTarget && (
                                <textarea
                                    className="archive-reason"
                                    value={archiveReason}
                                    onChange={(e) => setArchiveReason(e.target.value)}
                                    placeholder="e.g. Dead, moved, donated, etc."
                                />
                            )}

                            <div className="archive-plant-modal-buttons">
                                <button
                                    className="archive-plant-confirm"
                                    onClick={() => handleConfirmArchive(archiveModalOpen)}
                                >
                                    <FontAwesomeIcon icon={isArchivingTarget ? faBoxArchive : faTrashCanArrowUp} />{" "}
                                    {isArchivingTarget ? "Archive" : "Restore"}
                                </button>
                                <button
                                    className="archive-plant-cancel"
                                    onClick={() => {
                                        setArchiveModalOpen(null);
                                        setArchiveReason("");
                                    }}
                                >
                                    <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tag selector modal */}
                {tagModalPlant && (
                    <div className="delete-plant-modal-overlay">
                        <div
                            className="tag-plants-modal"
                            ref={tagModalRef}
                            role="dialog"
                            aria-modal="true"
                            aria-label={`Manage tags for ${tagModalPlant.name}`}
                        >
                            <div className="tag-plants-modal-header">
                                <h3>Tags for {tagModalPlant.name}</h3>
                                <span className="tag-plants-count">{selectedTagIds.size} selected</span>
                            </div>
                            <input
                                type="text"
                                className="tag-plants-search"
                                placeholder="Search tags..."
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                                autoFocus
                            />
                            <div className="tag-plants-list">
                                {filteredTags.map((tag) => (
                                    <label key={tag.id} className="tag-plants-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedTagIds.has(tag.id)}
                                            onChange={() => toggleTag(tag.id)}
                                        />
                                        <span className="tag-plants-item-name">#{tag.name}</span>
                                    </label>
                                ))}
                                {filteredTags.length === 0 && (
                                    <div className="tag-plants-empty">No tags found.</div>
                                )}
                            </div>
                            <div className="tag-plants-modal-actions">
                                <button
                                    className="weather-save-btn"
                                    onClick={handleSaveTags}
                                    disabled={savingTags}
                                >
                                    {savingTags ? "Saving..." : "Save"}
                                </button>
                                <button className="weather-cancel-btn" onClick={closeTagModal}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
