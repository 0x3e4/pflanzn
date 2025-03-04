import { useState } from "react";
import { PlantImage } from "../services/Plant";
import "../styles/timelineImages.css";

interface TimelineImagesProps {
  images: PlantImage[];
}

export default function TimelineImages({ images }: TimelineImagesProps) {
  // Sort: oldest -> newest
  const sortedImages = [...images].sort(
    (a, b) =>
      new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );

  // Make the last image (newest) active initially:
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    return sortedImages.length > 0 ? sortedImages.length - 1 : 0;
  });

  // The currently active image
  const activeImage = sortedImages[activeIndex];

  return (
    <div className="timeline-container">
      {/* Large image */}
      <div className="timeline-active-viewer">
        <img
          className="timeline-large-image"
          src={`/api/uploads/${activeImage.image_path}`}
          alt="Active Plant"
        />
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
