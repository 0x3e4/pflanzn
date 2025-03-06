import { useState, useEffect } from "react";
import { PlantImage, deletePlantImage } from "../services/Plant";
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faCircleXmark, faChevronLeft, faChevronRight, faExpand } from "@fortawesome/free-solid-svg-icons";
import "../styles/timelineImages.css";

interface TimelineImagesProps {
    images: PlantImage[];
    plantId: number;
}

export default function TimelineImages({ images, plantId }: TimelineImagesProps) {
    const [localImages, setLocalImages] = useState<PlantImage[]>(images);

    useEffect(() => {
        setLocalImages(images);
    }, [images]);

    const sortedImages = [...localImages].sort(
        (a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
    );

    const [activeIndex, setActiveIndex] = useState<number>(
        sortedImages.length > 0 ? sortedImages.length - 1 : 0
    );

    const activeImage = sortedImages[activeIndex];

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [fullSizeModalOpen, setFullSizeModalOpen] = useState(false);

    const openDeleteModal = () => setDeleteModalOpen(true);
    const closeDeleteModal = () => setDeleteModalOpen(false);

    const openFullSizeModal = () => setFullSizeModalOpen(true);
    const closeFullSizeModal = () => setFullSizeModalOpen(false);

    const handleConfirmDelete = async () => {
        if (!activeImage) return;
        try {
            await deletePlantImage(plantId, activeImage.id);
            setLocalImages(prev => prev.filter(img => img.id !== activeImage.id));
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
        return <div>No images yet.</div>;
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

                <div className="plant-image-container">
                    <img
                        className="plant-carousel-image"
                        src={`/api/uploads/${activeImage.image_path}`}
                        alt="Plant Image"
                        tabIndex={-1}
                    />

                    <div className="plant-image-overlay">
                        <button className="plant-view-fullsize-btn" onClick={openFullSizeModal}>
                            <FontAwesomeIcon icon={faExpand} />
                        </button>
                        <button className="plant-image-delete-btn" onClick={openDeleteModal}>
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    </div>

                    <div className="plant-uploaded-date-overlay">
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
