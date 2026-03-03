import { useEffect, useRef, useState } from "react";
import { deleteIdentification, fetchIdentifications } from "../services/PlantService";
import { PlantIdentification } from "../types/Identification";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faFingerprint,
    faPercentage,
    faSortAlphaDown,
    faChevronLeft,
    faChevronRight,
    faExpand,
    faTrash
} from "@fortawesome/free-solid-svg-icons";
import "../styles/identificationsPanel.css";
import { setOverlayOpen } from "../services/overlayControl";
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from "react-toastify";

type SortBy = "confidence" | "name";

export default function IdentificationsPanel() {
    const [identifications, setIdentifications] = useState<PlantIdentification[]>([]);
    const [sortBy, setSortBy] = useState<SortBy | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);

    const [fullSizeImagePath, setFullSizeImagePath] = useState<string | null>(null);
    const openFullSizeModal = (path: string) => setFullSizeImagePath(path);
    const closeFullSizeModal = () => setFullSizeImagePath(null);

    const [loading, setLoading] = useState(true);

    const timezone = import.meta.env.VITE_TZ;
    const locale = import.meta.env.VITE_Locale;

    const sortRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await fetchIdentifications({ is_primary: 1 });
            setIdentifications(data);
        } catch (error) {
            console.error("Failed to fetch identifications:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        setOverlayOpen(fullSizeImagePath !== null);
    }, [fullSizeImagePath]);

    // Click outside sort buttons resets sortBy
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
                setSortBy(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Filter by date
    let filtered = [...identifications];
    if (selectedDate) {
        filtered = filtered.filter(item => {
            const itemDate = new Date(item.identified_at).toISOString().split("T")[0];
            return itemDate === selectedDate;
        });
    }

    // Sort if a sort mode is active
    const sorted = sortBy
        ? filtered.sort((a, b) => {
              if (sortBy === "confidence") {
                  return parseFloat(b.confidence_score) - parseFloat(a.confidence_score);
              } else if (sortBy === "name") {
                  return a.scientific_name.localeCompare(b.scientific_name);
              }
              return 0;
          })
        : filtered;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageData = sorted.slice(startIndex, endIndex);

    const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));

    const formatSelectedDate = (dateString: string) => {
        if (!dateString) return "";
        const date = new Date(dateString + "T00:00:00");
        return date.toLocaleDateString(locale, {
            timeZone: timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Reset loaded images when identifications change
    useEffect(() => {
        const newIds = new Set(identifications.map(item => item.id));
        const currentIds = new Set(Array.from(loadedImages));
        
        // Check if we have completely different identifications
        const hasSignificantChanges = identifications.length === 0 || 
                                    newIds.size !== currentIds.size ||
                                    [...newIds].some(id => !currentIds.has(id));
        
        if (hasSignificantChanges) {
            setLoadedImages(new Set()); // Only reset when truly necessary
        }
    }, [identifications.length]);

    useEffect(() => {
        // Mobile-specific aggressive preloading for current page
        const isMobile = /Android|webOS|iPhone|iPad|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile && currentPageData.length > 0) {
            // Preload images for current page items immediately
            const imagesToPreload = currentPageData
                .filter(item => item.image_path && !loadedImages.has(item.id))
                .slice(0, 6); // Limit to first 6 images on mobile
            
            imagesToPreload.forEach(item => {
                const img = new Image();
                img.onload = () => handleImageLoad(item.id);
                img.onerror = () => handleImageError(item.id);
                img.src = `/api/uploads/${item.image_path}`;
            });
        }
    }, [currentPageData, loadedImages]);

    const handleImageLoad = (imageId: number) => {
        setLoadedImages(prev => {
            if (prev.has(imageId)) return prev;
            return new Set(prev).add(imageId);
        });
    };

    const handleImageError = (imageId: number) => {
        setLoadedImages(prev => {
            if (prev.has(imageId)) return prev;
            return new Set(prev).add(imageId);
        });
    };

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const handleDeleteIdentification = async (item: PlantIdentification) => {
        if (deletingSessionId) {
            return;
        }

        const shouldDelete = window.confirm("Delete this identification entry?");
        if (!shouldDelete) {
            return;
        }

        setDeletingSessionId(item.session_id);
        try {
            await deleteIdentification(item.id);

            setIdentifications((prev) => {
                const removedIds = prev
                    .filter((entry) => entry.session_id === item.session_id)
                    .map((entry) => entry.id);

                setLoadedImages((prevLoaded) => {
                    const nextLoaded = new Set(prevLoaded);
                    removedIds.forEach((id) => nextLoaded.delete(id));
                    return nextLoaded;
                });

                return prev.filter((entry) => entry.session_id !== item.session_id);
            });

            toast.success("Identification deleted.");
        } catch (error) {
            toast.error((error as Error).message || "Failed to delete identification.");
        } finally {
            setDeletingSessionId(null);
        }
    };

    return (
        <div className="statistics-panel">
            <h2>Recent Identifications</h2>
            <p>These are recent identification results powered by Pl@ntNet.</p>

            {/* Controls */}
            <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div className="identification-plant-input-container">
                    <div className="identification-plant-datetime">
                        <input
                            id="datePicker"
                            type="date"
                            onChange={(e) => {
                                setSelectedDate(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>

                <div ref={sortRef} style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                        onClick={() => setSortBy("confidence")}
                        className={`sort-button ${sortBy === "confidence" ? "active" : ""}`}
                    >
                        <FontAwesomeIcon icon={faPercentage} /> Confidence
                    </button>
                    <button
                        onClick={() => setSortBy("name")}
                        className={`sort-button ${sortBy === "name" ? "active" : ""}`}
                    >
                        <FontAwesomeIcon icon={faSortAlphaDown} /> Name
                    </button>
                </div>
            </div>

            {/* Identification List */}
            <div className="identification-list">
                {loading ? (
                    [...Array(4)].map((_, index) => (
                        <div className="identification-entry" key={index}>
                            <div className="identification-meta">
                                <Skeleton width={220} height={28} />
                                <Skeleton width={160} />
                                <Skeleton width={140} />
                                <Skeleton width={260} />
                            </div>
                            <div className="identification-image-container">
                                <Skeleton
                                    height="100%"
                                    width="100%"
                                    baseColor="#444"
                                    highlightColor="#666"
                                />
                            </div>
                        </div>
                    ))
                ) : currentPageData.length > 0 ? (
                    currentPageData.map((item) => {
                        const imageLoaded = loadedImages.has(item.id);
                        
                        return (
                            <div className="identification-entry" key={item.id}>
                                <div className="identification-meta">
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <FontAwesomeIcon icon={faFingerprint} />
                                        <h3 className="no-margin-bottom">{item.scientific_name}</h3>
                                    </div>
                                    <p><strong>Common name:</strong> {item.common_name}</p>
                                    <p><strong>Confidence:</strong> {item.confidence_score}%</p>
                                    <p><strong>Date:</strong> {new Date(item.identified_at).toLocaleString(locale, {
                                        timeZone: timezone,
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}</p>
                                </div>
                                {item.image_path && (
                                    <div className="identification-image-container">
                                        {/* Skeleton loader */}
                                        {!imageLoaded && (
                                            <Skeleton
                                                height="100%"
                                                width="100%"
                                                baseColor="#444"
                                                highlightColor="#666"
                                                style={{ borderRadius: 6 }}
                                                className="identification-plant-image-skeleton"
                                            />
                                        )}
                                        
                                        <img
                                            src={`/api/uploads/${item.image_path}`}
                                            alt={item.scientific_name}
                                            className="identification-image"
                                            style={{ display: imageLoaded ? 'block' : 'none' }}
                                            onLoad={() => handleImageLoad(item.id)}
                                            onError={() => handleImageError(item.id)}
                                        />
                                        
                                        {imageLoaded && (
                                            <div className="identification-image-overlay">
                                                <button className="plant-view-fullsize-btn" onClick={() => openFullSizeModal(item.image_path!)}>
                                                    <FontAwesomeIcon icon={faExpand} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <button
                                    className="identification-delete-btn identification-delete-btn--row-corner"
                                    onClick={() => handleDeleteIdentification(item)}
                                    title="Delete identification"
                                    disabled={deletingSessionId === item.session_id}
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>
                        );
                    })
                ) : (
                    <p>No identifications found{selectedDate && ` for ${formatSelectedDate(selectedDate)}`}</p>
                )}

                {/* Pagination */}
                {!loading && sorted.length > 0 && totalPages > 1 && (
                    <div className="pagination">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span>{currentPage} of {totalPages}</span>
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                        >
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>
                )}

                {/* Full Size Image Modal */}
                {fullSizeImagePath && (
                    <div className="plant-fullsize-modal-overlay" onClick={closeFullSizeModal}>
                        <img
                            className="plant-fullsize-image"
                            src={`/api/uploads/${fullSizeImagePath}`}
                            alt="Full Size Plant"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
