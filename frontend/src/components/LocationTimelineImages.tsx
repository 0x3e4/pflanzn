import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useModalA11y } from "../hooks/useModalA11y";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faCircleXmark, faExpand, faTrash } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import { LocationImage } from "../types/Location";
import { setOverlayOpen } from "../services/overlayControl";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { deleteLocationImage } from "../services/LocationService";
import "../styles/locationTimelineImages.css";

interface LocationTimelineImagesProps {
    locationId: number;
    images: LocationImage[];
    onChanged?: () => void;
}

export default function LocationTimelineImages({ locationId, images, onChanged }: LocationTimelineImagesProps) {
    const { isLoggedIn } = useAuth();
    const { locale, tz: timezone } = useConfig();

    const sortedImages = useMemo(
        () => [...images].sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()),
        [images],
    );

    const [activeIndex, setActiveIndex] = useState<number>(sortedImages.length > 0 ? sortedImages.length - 1 : 0);
    const [fullSizeModalOpen, setFullSizeModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [zoomScale, setZoomScale] = useState(1);
    const [zoomTranslate, setZoomTranslate] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const lastTranslate = useRef({ x: 0, y: 0 });
    const pinchStartDist = useRef<number | null>(null);
    const pinchStartScale = useRef(1);

    const resetZoom = useCallback(() => {
        setZoomScale(1);
        setZoomTranslate({ x: 0, y: 0 });
        lastTranslate.current = { x: 0, y: 0 };
    }, []);

    const closeDeleteModal = useCallback(() => setDeleteModalOpen(false), []);
    const closeFullSizeModal = useCallback(() => {
        setFullSizeModalOpen(false);
        resetZoom();
    }, [resetZoom]);
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

    const handleZoomWheel = useCallback((e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        setZoomScale((prev) => {
            const next = Math.min(5, Math.max(1, prev + delta));
            if (next === 1) {
                setZoomTranslate({ x: 0, y: 0 });
                lastTranslate.current = { x: 0, y: 0 };
            }
            return next;
        });
    }, []);

    const handleZoomPointerDown = useCallback(
        (e: React.PointerEvent) => {
            if (zoomScale <= 1) return;
            e.preventDefault();
            isDragging.current = true;
            dragStart.current = { x: e.clientX, y: e.clientY };
            lastTranslate.current = { ...zoomTranslate };
        },
        [zoomScale, zoomTranslate],
    );

    const handleZoomPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!isDragging.current) return;
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setZoomTranslate({
                x: lastTranslate.current.x + dx / zoomScale,
                y: lastTranslate.current.y + dy / zoomScale,
            });
        },
        [zoomScale],
    );

    const handleZoomPointerUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    const getTouchDistance = (touches: React.TouchList) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleZoomTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (e.touches.length === 2) {
                pinchStartDist.current = getTouchDistance(e.touches);
                pinchStartScale.current = zoomScale;
            }
        },
        [zoomScale],
    );

    const handleZoomTouchMove = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchStartDist.current !== null) {
            e.preventDefault();
            const dist = getTouchDistance(e.touches);
            const ratio = dist / pinchStartDist.current;
            const next = Math.min(5, Math.max(1, pinchStartScale.current * ratio));
            setZoomScale(next);
            if (next === 1) {
                setZoomTranslate({ x: 0, y: 0 });
                lastTranslate.current = { x: 0, y: 0 };
            }
        }
    }, []);

    const handleZoomTouchEnd = useCallback(() => {
        pinchStartDist.current = null;
    }, []);

    const handleFullsizeOverlayClick = useCallback(
        (e: React.MouseEvent) => {
            if (zoomScale > 1) return;
            if (e.target === e.currentTarget) closeFullSizeModal();
        },
        [zoomScale, closeFullSizeModal],
    );

    if (sortedImages.length === 0) {
        return null;
    }

    const activeImage = sortedImages[activeIndex];

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
                <div
                    className="location-fullsize-modal-overlay"
                    ref={fullSizeModalRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Full size image"
                    onClick={handleFullsizeOverlayClick}
                >
                    <button className="fullsize-close-btn" onClick={closeFullSizeModal}>
                        <FontAwesomeIcon icon={faCircleXmark} />
                    </button>
                    <img
                        className={`location-fullsize-image${zoomScale > 1 ? " zoomed" : ""}`}
                        src={`/api/uploads/${activeImage.image_path}?size=original`}
                        alt="Location full size"
                        draggable={false}
                        style={{
                            transform: `scale(${zoomScale}) translate(${zoomTranslate.x}px, ${zoomTranslate.y}px)`,
                            cursor: zoomScale > 1 ? "grab" : "default",
                        }}
                        onWheel={handleZoomWheel}
                        onPointerDown={handleZoomPointerDown}
                        onPointerMove={handleZoomPointerMove}
                        onPointerUp={handleZoomPointerUp}
                        onPointerLeave={handleZoomPointerUp}
                        onTouchStart={handleZoomTouchStart}
                        onTouchMove={handleZoomTouchMove}
                        onTouchEnd={handleZoomTouchEnd}
                        onDoubleClick={resetZoom}
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
