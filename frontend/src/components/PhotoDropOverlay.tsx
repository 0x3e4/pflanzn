import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImages, faSeedling } from "@fortawesome/free-solid-svg-icons";
import { DropTarget } from "../hooks/usePhotoDrop";
import "../styles/photoDrop.css";

/** The dashed "drop here" frame over the plants page while photos are dragged over it.
 *  It lets the pointer through, so the plant card underneath can be the target. */
export default function PhotoDropOverlay({ target }: { target: DropTarget | null }) {
    return createPortal(
        <div className={`photo-drop-overlay${target ? " has-target" : ""}`} aria-hidden="true">
            <div className="photo-drop-label">
                <FontAwesomeIcon icon={target ? faImages : faSeedling} />
                <strong>{target ? `Add to ${target.name}` : "Drop photos to add a plant"}</strong>
                <span>{target ? "The photos join this plant's timeline" : "or onto a plant to add them to it"}</span>
            </div>
        </div>,
        document.body,
    );
}
