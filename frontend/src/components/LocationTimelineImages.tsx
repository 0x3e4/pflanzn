import { useCallback, useEffect, useMemo, useState } from "react";
import { useModalA11y } from "../hooks/useModalA11y";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faCircleXmark, faExpand, faTrash } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import { LocationImage } from "../types/Location";
import { setOverlayOpen } from "../services/overlayControl";
import { useAuth } from "../context/AuthContext";
import { deleteLocationImage } from "../services/LocationService";
import "../styles/locationTimelineImages.css";

interface LocationTimelineImagesProps {
    locationId: number;
    images: LocationImage[];
    onChanged?: () => void;
}

export default function LocationTimelineImages({ locationId, images, onChanged }: LocationTimelineImagesProps) {
    const { isLoggedIn } = useAuth();

    const sortedImages = useMemo(
        () => [...images].sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()),
        [images],
    );

    const [activeIndex, setActiveIndex] = useState<number>(sortedImages.length > 0 ? sortedImages.length - 1 : 0);
    const [fullSizeModalOpen, setFullSizeModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const closeDeleteModal = useCallback(() => setDeleteModalOpen(false), []);
    const closeFullSizeModal = useCallback(() => setFullSizeModalOpen(false), []);
    const { modalRef: deleteModalRef } = useModalA11y({ isOpen: deleteModalOpen, onClose: closeDeleteModal });
    const { modalRef: fullSizeModalRef } = useModalA11y({ isOpen: fullSizeModalOpen, onClose: closeFullSizeModal });

    useEffect(() => {
        if (sortedImages.length === 0) {
            setActiveIndex(0);
            return;
        }
        if (activeIndex > sortedImages.length - 1) {
            setActiveIndex(sortedImages.length - 1);
        }
    }, [sortedImages, activeIndex]);

    useEffect(() => {
        setOverlayOpen(fullSizeModalOpen || deleteModalOpen);
        return () => setOverlayOpen(false);
    }, [fullSizeModalOpen, deleteModalOpen]);

    if (sortedImages.length === 0) {
        return null;
    }

    const activeImage = sortedImages[activeIndex];
    const locale = import.meta.env.VITE_LOCALE;
    const timezone = import.meta.env.VITE_TZ;

    const formattedDate = new Date(activeImage.uploaded_at).toLocaleString(locale, {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    const goToPrevious = () => setActiveIndex((prev) => (prev > 0 ? prev - 1 : sortedImages.length - 1));
    const goToNext = () => setActiveIndex((prev) => (prev < sortedImages.length - 1 ? prev + 1 : 0));

    const handleDeleteImage = async () => {
        if (!isLoggedIn) {
            toast.warning("You must be logged in to delete images.");
            return;
        }

        try {
            await deleteLocationImage(locationId, activeImage.id);
            toast.success("Image deleted successfully!");
            setDeleteModalOpen(false);
            onChanged?.();
        } catch (error) {
            toast.error((error as Error).message || "Failed to delete image.");
        }
    };

    return (
        <div className="location-carousel-container">
            {deleteModalOpen && (
                <div className="plant-delete-modal-overlay">
                    <div className="plant-delete-modal" ref={deleteModalRef} role="dialog" aria-modal="true" aria-label="Confirm image deletion">
                        <span>Are you sure you want to delete this image?</span>
                        <div className="plant-delete-modal-buttons">
                            <button className="plant-delete-btn" onClick={handleDeleteImage}>
                                <FontAwesomeIcon icon={faTrash} /> Delete
                            </button>
                            <button className="plant-cancel-btn" onClick={() => setDeleteModalOpen(false)}>
                                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {fullSizeModalOpen && (
                <div className="location-fullsize-modal-overlay" ref={fullSizeModalRef} role="dialog" aria-modal="true" aria-label="Full size image" onClick={closeFullSizeModal}>
                    <img
                        className="location-fullsize-image"
                        src={`/api/uploads/${activeImage.image_path}?size=original`}
                        alt="Location full size"
                    />
                </div>
            )}

            <div className="location-carousel-viewer">
                {sortedImages.length > 1 && (
                    <button className="location-carousel-nav-btn left" onClick={goToPrevious}>
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                )}

                <div className="location-image-frame">
                    <div className="location-fullsize-overlay">
                        <button className="location-view-fullsize-btn" onClick={() => setFullSizeModalOpen(true)}>
                            <FontAwesomeIcon icon={faExpand} />
                        </button>
                    </div>

                    <div className="location-delete-overlay">
                        {isLoggedIn ? (
                            <button className="location-image-delete-btn" onClick={() => setDeleteModalOpen(true)}>
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        ) : (
                            <button
                                className="location-image-delete-btn"
                                onClick={() => toast.warning("You must be logged in to delete images.")}
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        )}
                    </div>

                    <img
                        src={`/api/uploads/${activeImage.image_path}?size=medium`}
                        srcSet={`/api/uploads/${activeImage.image_path}?size=thumb 300w, /api/uploads/${activeImage.image_path}?size=medium 800w`}
                        sizes="(max-width: 768px) 100vw, 800px"
                        alt="Location"
                        className="location-carousel-image"
                        loading="lazy"
                    />

                    <div className="location-uploaded-date-overlay">{formattedDate}</div>
                </div>

                {sortedImages.length > 1 && (
                    <button className="location-carousel-nav-btn right" onClick={goToNext}>
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                )}
            </div>
        </div>
    );
}
