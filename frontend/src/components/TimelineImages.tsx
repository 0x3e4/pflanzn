import { useState, useEffect  } from "react";
import { PlantImage, deletePlantImage } from "../services/Plant";
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import "../styles/timelineImages.css";

interface TimelineImagesProps {
  images: PlantImage[];
  plantId: number; // so we can call deletePlantImage(plantId, imageId)
}

export default function TimelineImages({ images, plantId }: TimelineImagesProps) {
    const [localImages, setLocalImages] = useState<PlantImage[]>(images);

    // If the parent sends new images, sync them:
    useEffect(() => {
        setLocalImages(images);
    }, [images]);

  // Sort: oldest -> newest
  const sortedImages = [...localImages].sort(
    (a, b) =>
      new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
  );

  // Make the last image (newest) active initially
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    return sortedImages.length > 0 ? sortedImages.length - 1 : 0;
  });

  // The currently active image
  const activeImage = sortedImages[activeIndex];

  // State for controlling the delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Open the modal when user clicks the overlay
  const openDeleteModal = () => {
    setDeleteModalOpen(true);
  };

  // When user confirms deletion, call the backend API and close the modal
  const handleConfirmDelete = async () => {
    if (!activeImage) return;
    try {
      await deletePlantImage(plantId, activeImage.id);
      // Remove the deleted image from local state
      setLocalImages((prevImages: PlantImage[]) =>
        prevImages.filter((img: PlantImage) => img.id !== activeImage.id)
      );
      toast.success("Image deleted successfully!");
    } catch (err: any) {
        toast.error(err.message);
    } finally {
      setDeleteModalOpen(false);
    }
  };

  // Simply close the modal if user cancels
  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
  };

  if (sortedImages.length === 0) {
    return <div>No images yet.</div>;
  }

  return (
    <div className="timeline-container">
      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <p>Are you sure you want to delete this image?</p>
            <button className="delete-btn" onClick={handleConfirmDelete}>Delete</button>
            <button className="cancel-btn" onClick={handleCancelDelete}>Cancel</button>
          </div>
        </div>
      )}

      {/* Large image */}
      <div className="timeline-active-viewer">
        <div className="image-container">
          <img
            className="timeline-large-image"
            src={`/api/uploads/${activeImage.image_path}`}
            alt="Active Plant"
          />
          {/* Red overlay with white 'X' shown on hover */}
          <div className="image-delete-overlay" onClick={openDeleteModal}>
            <span className="delete-icon">
              <FontAwesomeIcon icon={faTrash} />
            </span>
          </div>
        </div>
      </div>

      <h5>{new Date(activeImage.uploaded_at).toLocaleString()}</h5>

      {/* Horizontal timeline */}
      <div className="timeline-row">
        {sortedImages.map((img, i) => {
          const dateLabel = new Date(img.uploaded_at).toLocaleDateString();
          const isActive = i === activeIndex;
          return (
            <div
              key={img.id}
              onClick={() => setActiveIndex(i)}
              className={`timeline-item ${isActive ? "active" : ""}`}
            >
              <div className="timeline-date">{dateLabel}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}