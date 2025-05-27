import { useEffect, useState } from "react";
import { fetchIdentifications } from "../services/PlantService";
import { PlantIdentification } from "../types/Identification";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faFingerprint,
    faPercentage,
    faCalendarAlt,
    faSortAlphaDown,
    faChevronLeft,
    faChevronRight,
    faExpand
} from "@fortawesome/free-solid-svg-icons";
import "../styles/identificationsPanel.css";
import { setOverlayOpen } from "../services/overlayControl";
import LoadingOverlay from "../components/LoadingOverlay";

type SortBy = "confidence" | "date" | "name";

export default function IdentificationsPanel() {
    const [identifications, setIdentifications] = useState<PlantIdentification[]>([]);
    const [sortBy, setSortBy] = useState<SortBy>("date");
    
    const itemsPerPage = 10;
    const [currentPage, setCurrentPage] = useState(1);

    const [fullSizeImagePath, setFullSizeImagePath] = useState<string | null>(null);
    const openFullSizeModal = (path: string) => setFullSizeImagePath(path);
    const closeFullSizeModal = () => setFullSizeImagePath(null);

    const [loading, setLoading] = useState(true);

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

    const sorted = [...identifications].sort((a, b) => {
        if (sortBy === "confidence") {
            return parseFloat(b.confidence_score) - parseFloat(a.confidence_score);
        } else if (sortBy === "date") {
            return new Date(b.identified_at).getTime() - new Date(a.identified_at).getTime();
        } else if (sortBy === "name") {
            return a.scientific_name.localeCompare(b.scientific_name);
        }
        return 0;
    });

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageData = sorted.slice(startIndex, endIndex);

    const totalPages = Math.ceil(sorted.length / itemsPerPage);

    const timezone = import.meta.env.VITE_TZ;
    const locale = import.meta.env.VITE_Locale;

    useEffect(() => {
        setOverlayOpen(fullSizeImagePath !== null);
    }, [fullSizeImagePath]);

    return (
        <div className="statistics-panel">
            {loading && <LoadingOverlay />}
            <h2>Recent Identifications</h2>
            <p>These are recent identification results powered by Pl@ntNet.</p>

            {/* Sort Controls */}
            <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center" }}>
                <span><strong>Sort by:</strong></span>
                <button onClick={() => setSortBy("date")} className={`sort-button ${sortBy === "date" ? "active" : ""}`}>
                    <FontAwesomeIcon icon={faCalendarAlt} /> Date
                </button>
                <button onClick={() => setSortBy("confidence")} className={`sort-button ${sortBy === "confidence" ? "active" : ""}`}>
                    <FontAwesomeIcon icon={faPercentage} /> Confidence
                </button>
                <button onClick={() => setSortBy("name")} className={`sort-button ${sortBy === "name" ? "active" : ""}`}>
                    <FontAwesomeIcon icon={faSortAlphaDown} /> Name
                </button>
            </div>

            {/* Identification List */}
            <div className="identification-list">
                {currentPageData.length > 0 ? (
                    currentPageData.map((item) => (
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
                                    <img
                                        src={`/api/uploads/${item.image_path}`}
                                        alt={item.scientific_name}
                                        className="identification-image"
                                    />
                                    <div className="identification-image-overlay">
                                        <button className="plant-view-fullsize-btn" onClick={() => openFullSizeModal(item.image_path!)}>
                                            <FontAwesomeIcon icon={faExpand} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <p>No identifications found.</p>
                )}
                {totalPages > 1 && (
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