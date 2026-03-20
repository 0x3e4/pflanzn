import { useCallback, useEffect, useState } from "react";
import { useModalA11y } from "../hooks/useModalA11y";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { deleteLocation, fetchLocations, updateLocation } from "../services/LocationService";
import { Location, LocationUpdateInput, SpotType } from "../types/Location";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronLeft,
    faChevronRight,
    faCircleXmark,
    faEye,
    faSave,
    faTrash,
} from "@fortawesome/free-solid-svg-icons";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { setOverlayOpen } from "../services/overlayControl";

const spotTypeLabels: Record<SpotType, string> = {
    field: "Field",
    public_spot: "Public Spot",
    forest: "Forest",
    meadow: "Meadow",
    other: "Other",
};

type LocationEditDraft = {
    name?: string;
    item_name?: string | null;
    spot_type?: SpotType;
    latitude?: number | string | null;
    longitude?: number | string | null;
};

export default function LocationsPanel() {
    const navigate = useNavigate();
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const { user, isLoggedIn } = useAuth();
    const [locations, setLocations] = useState<Location[]>([]);
    const [editedLocations, setEditedLocations] = useState<Record<number, LocationEditDraft>>({});
    const [deleteModalOpen, setDeleteModalOpen] = useState<number | null>(null);
    const closeDeleteModal = useCallback(() => setDeleteModalOpen(null), []);
    const { modalRef: deleteModalRef } = useModalA11y({ isOpen: !!deleteModalOpen, onClose: closeDeleteModal });
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<keyof Location>("id");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [loading, setLoading] = useState(true);
    const itemsPerPage = 20;
    const totalPages = Math.max(1, Math.ceil(locations.length / itemsPerPage));

    const loadLocations = async () => {
        setLoading(true);
        const canManageLocations = authMode === "no" || user?.role === "admin";

        if (!canManageLocations) {
            setLocations([]);
            setLoading(false);
            return;
        }

        try {
            const data = await fetchLocations();
            setLocations(data);
        } catch {
            toast.error("Failed to load locations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLocations();
    }, [user, authMode]);

    useEffect(() => {
        if (deleteModalOpen) {
            setOverlayOpen(true);
        } else {
            setOverlayOpen(false);
        }
    }, [deleteModalOpen]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const compare = <T,>(a: T, b: T, field: keyof T, direction: "asc" | "desc") => {
        if (a[field] == null) return direction === "asc" ? 1 : -1;
        if (b[field] == null) return direction === "asc" ? -1 : 1;

        if (typeof a[field] === "string" && typeof b[field] === "string") {
            return direction === "asc"
                ? (a[field] as string).localeCompare(b[field] as string)
                : (b[field] as string).localeCompare(a[field] as string);
        }

        return direction === "asc"
            ? Number(a[field] as number) - Number(b[field] as number)
            : Number(b[field] as number) - Number(a[field] as number);
    };

    const handleSort = (field: keyof Location) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    const sortedLocations = [...locations].sort((a, b) => compare(a, b, sortField, sortDirection));
    const indexOfLastLocation = currentPage * itemsPerPage;
    const indexOfFirstLocation = indexOfLastLocation - itemsPerPage;
    const currentLocations = sortedLocations.slice(indexOfFirstLocation, indexOfLastLocation);

    const handlePageChange = (direction: "prev" | "next") => {
        setCurrentPage((prev) => (direction === "next" ? Math.min(prev + 1, totalPages) : Math.max(prev - 1, 1)));
    };

    const getCurrentValue = (locationId: number, field: keyof LocationEditDraft, originalValue: unknown) => {
        return editedLocations[locationId]?.[field] ?? originalValue;
    };

    const updateLocationField = (
        locationId: number,
        field: keyof LocationEditDraft,
        value: LocationEditDraft[keyof LocationEditDraft],
    ) => {
        setEditedLocations((prev) => ({
            ...prev,
            [locationId]: {
                ...prev[locationId],
                [field]: value,
            },
        }));
    };

    const handleUpdateLocation = async (locationId: number) => {
        const changes = editedLocations[locationId];
        if (!changes || Object.keys(changes).length === 0) {
            toast.info("No changes to save.");
            return;
        }

        const payload: LocationUpdateInput = {};

        if (changes.name !== undefined) {
            if (changes.name.trim() === "") {
                toast.error("Location name cannot be empty.");
                return;
            }
            payload.name = changes.name;
        }

        if (changes.item_name !== undefined) {
            payload.item_name =
                typeof changes.item_name === "string" && changes.item_name.trim() === "" ? null : changes.item_name;
        }

        if (changes.spot_type !== undefined) {
            payload.spot_type = changes.spot_type;
        }

        if (changes.latitude !== undefined) {
            if (changes.latitude === "" || changes.latitude === null) {
                payload.latitude = null;
            } else {
                const lat = Number(changes.latitude);
                if (Number.isNaN(lat)) {
                    toast.error("Latitude must be a valid number.");
                    return;
                }
                payload.latitude = lat;
            }
        }

        if (changes.longitude !== undefined) {
            if (changes.longitude === "" || changes.longitude === null) {
                payload.longitude = null;
            } else {
                const lng = Number(changes.longitude);
                if (Number.isNaN(lng)) {
                    toast.error("Longitude must be a valid number.");
                    return;
                }
                payload.longitude = lng;
            }
        }

        if (Object.keys(payload).length === 0) {
            toast.info("No changes to save.");
            return;
        }

        if (typeof payload.name === "string" && payload.name.trim() === "") {
            toast.error("Location name cannot be empty.");
            return;
        }

        try {
            await updateLocation(locationId, payload);
            toast.success("Location updated successfully.");
            await loadLocations();

            setEditedLocations((prev) => {
                const next = { ...prev };
                delete next[locationId];
                return next;
            });
        } catch {
            toast.error("Failed to update location.");
        }
    };

    const handleConfirmDelete = async (locationId: number) => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to delete locations.");
            return;
        }

        try {
            await deleteLocation(locationId);
            toast.success("Location deleted successfully.");
            await loadLocations();
        } catch {
            toast.error("Failed to delete location.");
        } finally {
            setDeleteModalOpen(null);
        }
    };

    if (!isLoggedIn && authMode !== "no") {
        return <p>Access denied</p>;
    }

    return (
        <div className="locations-panel">
            <h2>Location Management</h2>
            <p>Here you can manage all the locations.</p>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort("id")}>ID</th>
                            <th onClick={() => handleSort("name")}>Name</th>
                            <th onClick={() => handleSort("item_name")}>Crop / Herb / Fruit</th>
                            <th onClick={() => handleSort("spot_type")}>Area</th>
                            <th onClick={() => handleSort("latitude")}>Latitude</th>
                            <th onClick={() => handleSort("longitude")}>Longitude</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading
                            ? [...Array(6)].map((_, index) => (
                                  <tr key={`location-skeleton-${index}`}>
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
                                          <Skeleton />
                                      </td>
                                      <td>
                                          <Skeleton />
                                      </td>
                                      <td>
                                          <Skeleton />
                                      </td>
                                      <td className="action-buttons">
                                          <Skeleton circle width={30} height={30} />
                                          <Skeleton circle width={30} height={30} />
                                          <Skeleton circle width={30} height={30} />
                                      </td>
                                  </tr>
                              ))
                            : currentLocations.map((location) => (
                                  <tr key={location.id}>
                                      <td>{location.id}</td>
                                      <td>
                                          <input
                                              type="text"
                                              value={String(getCurrentValue(location.id, "name", location.name))}
                                              onChange={(e) => updateLocationField(location.id, "name", e.target.value)}
                                              className="editable-input"
                                          />
                                      </td>
                                      <td>
                                          <input
                                              type="text"
                                              value={String(
                                                  getCurrentValue(location.id, "item_name", location.item_name ?? "") ??
                                                      "",
                                              )}
                                              onChange={(e) =>
                                                  updateLocationField(location.id, "item_name", e.target.value)
                                              }
                                              className="editable-input"
                                          />
                                      </td>
                                      <td>
                                          <select
                                              value={String(
                                                  getCurrentValue(location.id, "spot_type", location.spot_type),
                                              )}
                                              onChange={(e) =>
                                                  updateLocationField(
                                                      location.id,
                                                      "spot_type",
                                                      e.target.value as SpotType,
                                                  )
                                              }
                                              className="editable-select"
                                          >
                                              {Object.entries(spotTypeLabels).map(([value, label]) => (
                                                  <option key={value} value={value}>
                                                      {label}
                                                  </option>
                                              ))}
                                          </select>
                                      </td>
                                      <td>
                                          <input
                                              type="text"
                                              value={String(
                                                  getCurrentValue(location.id, "latitude", location.latitude ?? "") ??
                                                      "",
                                              )}
                                              onChange={(e) =>
                                                  updateLocationField(location.id, "latitude", e.target.value)
                                              }
                                              className="editable-input"
                                              placeholder="-"
                                          />
                                      </td>
                                      <td>
                                          <input
                                              type="text"
                                              value={String(
                                                  getCurrentValue(location.id, "longitude", location.longitude ?? "") ??
                                                      "",
                                              )}
                                              onChange={(e) =>
                                                  updateLocationField(location.id, "longitude", e.target.value)
                                              }
                                              className="editable-input"
                                              placeholder="-"
                                          />
                                      </td>
                                      <td className="action-buttons">
                                          <button
                                              className="view-btn"
                                              onClick={() => navigate(`/location/${location.id}`)}
                                          >
                                              <FontAwesomeIcon icon={faEye} />
                                          </button>
                                          <button
                                              className="update-btn"
                                              onClick={() => handleUpdateLocation(location.id)}
                                          >
                                              <FontAwesomeIcon icon={faSave} />
                                          </button>
                                          <button
                                              className="delete-btn"
                                              onClick={() => setDeleteModalOpen(location.id)}
                                          >
                                              <FontAwesomeIcon icon={faTrash} />
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                    </tbody>
                </table>

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

                {deleteModalOpen && (
                    <div className="delete-plant-modal-overlay">
                        <div className="delete-plant-modal" ref={deleteModalRef} role="dialog" aria-modal="true" aria-label="Confirm location deletion">
                            <div className="delete-modal-header">
                                <span>Are you sure you want to delete this location?</span>
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
            </div>
        </div>
    );
}
