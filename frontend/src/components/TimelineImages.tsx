import { useState, useEffect } from "react";
import { deletePlantImage } from "../services/PlantService";
import { PlantImage } from "../types/Plant";
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faCircleXmark, faChevronLeft, faChevronRight, faExpand } from "@fortawesome/free-solid-svg-icons";
import "../styles/timelineImages.css";
import { useAuth } from "../context/AuthContext";
import { setOverlayOpen } from "../services/overlayControl";
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

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
        setLocalImages(images);
        setLoadedImages(new Set()); // Reset loaded images when images prop changes
    }, [images]);

    const sortedImages = [...localImages].sort(
        (a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
    );

    const [activeIndex, setActiveIndex] = useState<number>(
        sortedImages.length > 0 ? sortedImages.length - 1 : 0
    );

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
    const closeDeleteModal = () => setDeleteModalOpen(false);

    const openFullSizeModal = () => setFullSizeModalOpen(true);
    const closeFullSizeModal = () => setFullSizeModalOpen(false);

    const handleImageLoad = (imageId: number) => {
        setLoadedImages(prev => {
            if (prev.has(imageId)) return prev;
            return new Set(prev).add(imageId);
        });
        
        if (activeImage && imageId === activeImage.id) {
            setCurrentImageLoaded(true);
        }
    };

    const handleImageError = (imageId: number) => {
        setLoadedImages(prev => {
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
            setLocalImages(prev => prev.filter(img => img.id !== activeImage.id));
            setLoadedImages(prev => {
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

    if (sortedImages.length === 0) {
        return;
    }

    const formattedDate = new Date(activeImage.uploaded_at).toLocaleString(import.meta.env.VITE_Locale, {
        timeZone: import.meta.env.VITE_TZ,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const minSwipeDistance = 50;

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEndX(null); // Reset previous
        setTouchStartX(e.targetTouches[0].clientX);
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
        const currentX = e.targetTouches[0].clientX;
    
        setTouchEndX(currentX);
    
        const deltaX = currentX - (touchStartX ?? 0);
    
        // If mostly horizontal, prevent scrolling the page
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
    // Mobile-specific aggressive preloading
    const isMobile = /Android|webOS|iPhone|iPad|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile && sortedImages.length > 0) {
        // On mobile, prioritize loading the current image and nearby images first
        const priorityImages = [
        sortedImages[activeIndex], // Current image
        sortedImages[activeIndex - 1], // Previous
        sortedImages[activeIndex + 1], // Next
        ].filter(Boolean); // Remove undefined entries

        priorityImages.forEach(image => {
        if (!loadedImages.has(image.id)) {
            const img = new Image();
            img.onload = () => handleImageLoad(image.id);
            img.onerror = () => handleImageError(image.id);
            img.src = `/api/uploads/${image.image_path}`;
        }
        });

        // Then load the rest with a small delay to prioritize visible content
        setTimeout(() => {
        sortedImages.forEach(image => {
            if (!loadedImages.has(image.id) && !priorityImages.includes(image)) {
            const img = new Image();
            img.onload = () => handleImageLoad(image.id);
            img.onerror = () => handleImageError(image.id);
            img.src = `/api/uploads/${image.image_path}`;
            }
        });
        }, 100);
    }
    }, [sortedImages, activeIndex, loadedImages]);

    useEffect(() => {
    // Immediately check if current image is loaded when component mounts
    if (activeImage && loadedImages.has(activeImage.id)) {
        setCurrentImageLoaded(true);
    } else if (activeImage) {
        setCurrentImageLoaded(false);
        
        // Force load the current image if not already loaded
        const img = new Image();
        img.onload = () => {
        handleImageLoad(activeImage.id);
        setCurrentImageLoaded(true);
        };
        img.onerror = () => {
        handleImageError(activeImage.id);
        setCurrentImageLoaded(true);
        };
        img.src = `/api/uploads/${activeImage.image_path}`;
    }
    }, [activeImage]);

    useEffect(() => {
        if (fullSizeModalOpen || deleteModalOpen) {
          setOverlayOpen(true);
        } else {
          setOverlayOpen(false);
        }
    }, [fullSizeModalOpen, deleteModalOpen]);

    return (
        <div className="plant-carousel-container">
            {deleteModalOpen && (
                <div className="plant-delete-modal-overlay">
                    <div className="plant-delete-modal">
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
                <div className="plant-fullsize-modal-overlay" onClick={closeFullSizeModal}>
                    <img
                        className="plant-fullsize-image"
                        src={`/api/uploads/${activeImage.image_path}`}
                        alt="Full Size Plant"
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
                    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                    {sortedImages
                        .filter(image => !loadedImages.has(image.id)) // Only preload unloaded images
                        .slice(0, 5) // Limit concurrent preloads to prevent overwhelming mobile
                        .map((image) => (
                        <img
                            key={`preload-${image.id}`}
                            src={`/api/uploads/${image.image_path}`}
                            alt=""
                            onLoad={() => handleImageLoad(image.id)}
                            onError={() => handleImageError(image.id)}
                            style={{ width: '1px', height: '1px' }}
                        />
                        ))}
                    </div>

                    {/* Main image */}
                    <img
                        className="plant-carousel-image"
                        src={`/api/uploads/${activeImage.image_path}`}
                        alt="Plant Image"
                        tabIndex={-1}
                        style={{ display: currentImageLoaded ? 'block' : 'none' }}
                    />

                    <div className="plant-fullsize-overlay" style={{ display: currentImageLoaded ? 'block' : 'none' }}>
                        <button className="plant-view-fullsize-btn" onClick={openFullSizeModal}>
                            <FontAwesomeIcon icon={faExpand} />
                        </button>
                    </div>

                    {/* Delete button overlay - bottom right */}
                    <div className="plant-delete-overlay" style={{ display: currentImageLoaded ? 'block' : 'none' }}>
                        {isLoggedIn ? (
                            <button className="plant-image-delete-btn" onClick={openDeleteModal}>
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        ) : (
                            <button className="plant-image-delete-btn" onClick={() => toast.warning("You must be logged in to delete images.")}>
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        )}
                    </div>

                    <div className="plant-uploaded-date-overlay" style={{ display: currentImageLoaded ? 'block' : 'none' }}>
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