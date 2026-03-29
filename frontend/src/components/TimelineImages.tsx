import { useState, useEffect, useCallback, useRef } from "react";
import { deletePlantImage } from "../services/PlantService";
import { PlantImage } from "../types/Plant";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faCircleXmark, faChevronLeft, faChevronRight, faExpand } from "@fortawesome/free-solid-svg-icons";
import "../styles/timelineImages.css";
import { useAuth } from "../context/AuthContext";
import { setOverlayOpen } from "../services/overlayControl";
import { useModalA11y } from "../hooks/useModalA11y";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

interface TimelineImagesProps {
    images: PlantImage[];
    plantId: number;
}

export default function TimelineImages({ images, plantId }: TimelineImagesProps) {
    const { isLoggedIn } = useAuth();

    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchEndX, setTouchEndX] = useState<number | null>(null);

    const [localImages, setLocalImages] = useState<PlantImage[]>(images);
    const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
    const [currentImageLoaded, setCurrentImageLoaded] = useState(false);

    useEffect(() => {
        // Only reset loaded images if the actual image IDs have changed
        const newImageIds = new Set(images.map((img) => img.id));
        const currentImageIds = new Set(localImages.map((img) => img.id));

        // Check if the sets are different
        const hasImageChanges =
            newImageIds.size !== currentImageIds.size || [...newImageIds].some((id) => !currentImageIds.has(id));

        setLocalImages(images);

        if (hasImageChanges) {
            // Only reset if images actually changed, not just reloaded
            setLoadedImages((prev) => {
                const newSet = new Set<number>();
                // Keep loaded state for images that still exist
                prev.forEach((imageId) => {
                    if (newImageIds.has(imageId)) {
                        newSet.add(imageId);
                    }
                });
                return newSet;
            });
        }
    }, [images]);

    const sortedImages = [...localImages].sort(
        (a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime(),
    );

    const [activeIndex, setActiveIndex] = useState<number>(sortedImages.length > 0 ? sortedImages.length - 1 : 0);

    const activeImage = sortedImages[activeIndex];

    // Reset current image loaded state when active image changes
    useEffect(() => {
        if (activeImage) {
            const isLoaded = loadedImages.has(activeImage.id);
            setCurrentImageLoaded(isLoaded);
        }
    }, [activeIndex, activeImage?.id, loadedImages]);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [fullSizeModalOpen, setFullSizeModalOpen] = useState(false);

    const openDeleteModal = () => setDeleteModalOpen(true);
    const closeDeleteModal = useCallback(() => setDeleteModalOpen(false), []);

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

    const openFullSizeModal = () => setFullSizeModalOpen(true);
    const closeFullSizeModal = useCallback(() => {
        setFullSizeModalOpen(false);
        resetZoom();
    }, [resetZoom]);

    const { modalRef: deleteModalRef } = useModalA11y({ isOpen: deleteModalOpen, onClose: closeDeleteModal });
    const { modalRef: fullSizeModalRef } = useModalA11y({ isOpen: fullSizeModalOpen, onClose: closeFullSizeModal });

    const handleImageLoad = (imageId: number) => {
        setLoadedImages((prev) => {
            if (prev.has(imageId)) return prev;
            return new Set(prev).add(imageId);
        });

        if (activeImage && imageId === activeImage.id) {
            setCurrentImageLoaded(true);
        }
    };

    const handleImageError = (imageId: number) => {
        setLoadedImages((prev) => {
            if (prev.has(imageId)) return prev;
            return new Set(prev).add(imageId);
        });

        if (activeImage && imageId === activeImage.id) {
            setCurrentImageLoaded(true);
        }
    };

    const handleConfirmDelete = async () => {
        if (!activeImage) return;
        try {
            await deletePlantImage(plantId, activeImage.id);
            setLocalImages((prev) => prev.filter((img) => img.id !== activeImage.id));
            setLoadedImages((prev) => {
                const newSet = new Set(prev);
                newSet.delete(activeImage.id);
                return newSet;
            });
            toast.success("Image deleted successfully!");
            setActiveIndex((prevIndex) => Math.max(0, prevIndex - 1));
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            closeDeleteModal();
        }
    };

    const goToPrevious = () => setActiveIndex((prev) => (prev > 0 ? prev - 1 : sortedImages.length - 1));
    const goToNext = () => setActiveIndex((prev) => (prev < sortedImages.length - 1 ? prev + 1 : 0));

    const minSwipeDistance = 50;

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEndX(null);
        setTouchStartX(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const currentX = e.targetTouches[0].clientX;
        setTouchEndX(currentX);
        const deltaX = currentX - (touchStartX ?? 0);
        if (Math.abs(deltaX) > 10) {
            e.preventDefault();
        }
    };

    const handleTouchEnd = () => {
        if (!touchStartX || !touchEndX) return;
        const distance = touchStartX - touchEndX;
        if (distance > minSwipeDistance) {
            goToNext();
        } else if (distance < -minSwipeDistance) {
            goToPrevious();
        }
    };

    useEffect(() => {
        const isMobile = /Android|webOS|iPhone|iPad|Opera Mini/i.test(navigator.userAgent);
        if (isMobile && sortedImages.length > 0) {
            const priorityImages = [
                sortedImages[activeIndex],
                sortedImages[activeIndex - 1],
                sortedImages[activeIndex + 1],
            ].filter(Boolean);

            priorityImages.forEach((image) => {
                if (!loadedImages.has(image.id)) {
                    const img = new Image();
                    img.onload = () => handleImageLoad(image.id);
                    img.onerror = () => handleImageError(image.id);
                    img.src = `/api/uploads/${image.image_path}?size=thumb`;
                }
            });

            setTimeout(() => {
                sortedImages.forEach((image) => {
                    if (!loadedImages.has(image.id) && !priorityImages.includes(image)) {
                        const img = new Image();
                        img.onload = () => handleImageLoad(image.id);
                        img.onerror = () => handleImageError(image.id);
                        img.src = `/api/uploads/${image.image_path}?size=thumb`;
                    }
                });
            }, 100);
        }
    }, [sortedImages, activeIndex, loadedImages]);

    useEffect(() => {
        if (activeImage && loadedImages.has(activeImage.id)) {
            setCurrentImageLoaded(true);
        } else if (activeImage) {
            setCurrentImageLoaded(false);
            const img = new Image();
            img.onload = () => {
                handleImageLoad(activeImage.id);
                setCurrentImageLoaded(true);
            };
            img.onerror = () => {
                handleImageError(activeImage.id);
                setCurrentImageLoaded(true);
            };
            img.src = `/api/uploads/${activeImage.image_path}?size=medium`;
        }
    }, [activeImage]);

    useEffect(() => {
        if (fullSizeModalOpen || deleteModalOpen) {
            setOverlayOpen(true);
        } else {
            setOverlayOpen(false);
        }
    }, [fullSizeModalOpen, deleteModalOpen]);

    const handleZoomWheel = useCallback(
        (e: React.WheelEvent) => {
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
        },
        [],
    );

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

    const handleZoomTouchMove = useCallback(
        (e: React.TouchEvent) => {
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
        },
        [],
    );

    const handleZoomTouchEnd = useCallback(() => {
        pinchStartDist.current = null;
    }, []);

    const handleFullsizeOverlayClick = useCallback(
        (e: React.MouseEvent) => {
            if (zoomScale > 1) return;
            if (e.target === e.currentTarget) {
                closeFullSizeModal();
            }
        },
        [zoomScale, closeFullSizeModal],
    );

    if (sortedImages.length === 0) {
        return;
    }

    const formattedDate = new Date(activeImage.uploaded_at).toLocaleString(import.meta.env.VITE_Locale, {
        timeZone: import.meta.env.VITE_TZ,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <div className="plant-carousel-container">
            {deleteModalOpen && (
                <div className="plant-delete-modal-overlay">
                    <div className="plant-delete-modal" ref={deleteModalRef} role="dialog" aria-modal="true" aria-label="Confirm image deletion">
                        <span>Are you sure you want to delete this image?</span>
                        <div className="plant-delete-modal-buttons">
                            <button className="plant-delete-btn" onClick={handleConfirmDelete}>
                                <FontAwesomeIcon icon={faTrash} /> Delete
                            </button>
                            <button className="plant-cancel-btn" onClick={closeDeleteModal}>
                                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {fullSizeModalOpen && (
                <div
                    className="plant-fullsize-modal-overlay"
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
                        className={`plant-fullsize-image${zoomScale > 1 ? " zoomed" : ""}`}
                        src={`/api/uploads/${activeImage.image_path}?size=original`}
                        alt="Full Size Plant"
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

            <div className="plant-carousel-viewer">
                {sortedImages.length > 1 && (
                    <button className="plant-carousel-nav-btn left" onClick={goToPrevious}>
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                )}

                <div
                    className="plant-image-container timeline-images"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Skeleton loader */}
                    {!currentImageLoaded && (
                        <>
                            <Skeleton
                                height="100%"
                                width="100%"
                                baseColor="#444"
                                highlightColor="#666"
                                className="timeline-image-skeleton"
                            />
                        </>
                    )}

                    {/* Hidden preloader for all images */}
                    <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
                        {sortedImages
                            .filter((image) => !loadedImages.has(image.id)) // Only preload unloaded images
                            .slice(0, 5) // Limit concurrent preloads to prevent overwhelming mobile
                            .map((image) => (
                                <img
                                    key={`preload-${image.id}`}
                                    src={`/api/uploads/${image.image_path}?size=thumb`}
                                    alt=""
                                    onLoad={() => handleImageLoad(image.id)}
                                    onError={() => handleImageError(image.id)}
                                    style={{ width: "1px", height: "1px" }}
                                />
                            ))}
                    </div>

                    {/* Main image */}
                    <img
                        className="plant-carousel-image"
                        src={`/api/uploads/${activeImage.image_path}?size=medium`}
                        srcSet={`/api/uploads/${activeImage.image_path}?size=thumb 300w, /api/uploads/${activeImage.image_path}?size=medium 800w`}
                        sizes="(max-width: 768px) 100vw, 800px"
                        alt="Plant Image"
                        tabIndex={-1}
                        style={{ display: currentImageLoaded ? "block" : "none" }}
                    />

                    <div className="plant-fullsize-overlay" style={{ display: currentImageLoaded ? "block" : "none" }}>
                        <button className="plant-view-fullsize-btn" onClick={openFullSizeModal}>
                            <FontAwesomeIcon icon={faExpand} />
                        </button>
                    </div>

                    {/* Delete button overlay - bottom right */}
                    <div className="plant-delete-overlay" style={{ display: currentImageLoaded ? "block" : "none" }}>
                        {isLoggedIn ? (
                            <button className="plant-image-delete-btn" onClick={openDeleteModal}>
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        ) : (
                            <button
                                className="plant-image-delete-btn"
                                onClick={() => toast.warning("You must be logged in to delete images.")}
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        )}
                    </div>

                    <div
                        className="plant-uploaded-date-overlay"
                        style={{ display: currentImageLoaded ? "block" : "none" }}
                    >
                        {formattedDate}
                    </div>
                </div>

                {sortedImages.length > 1 && (
                    <button className="plant-carousel-nav-btn right" onClick={goToNext}>
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                )}
            </div>
        </div>
    );
}
