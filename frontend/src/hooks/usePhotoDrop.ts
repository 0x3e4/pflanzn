import { useEffect, useRef, useState } from "react";

// HEIC from an iPhone often arrives without a MIME type, so the extension counts too.
const IMAGE_NAME = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$/i;

export const isImageFile = (file: File) => file.type.startsWith("image/") || IMAGE_NAME.test(file.name);

const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

export interface DropTarget {
    plantId: number;
    name: string;
}

/** The plant card or row under the pointer (marked with data-drop-plant-id), if any. */
function targetAt(element: EventTarget | null): DropTarget | null {
    const card = element instanceof Element ? element.closest<HTMLElement>("[data-drop-plant-id]") : null;
    if (!card) return null;
    const plantId = Number(card.dataset.dropPlantId);
    return Number.isFinite(plantId) ? { plantId, name: card.dataset.dropPlantName || `#${plantId}` } : null;
}

/**
 * Photos dragged from the desktop onto the page. While a drag with files is over the
 * window, `dragging` is true and `target` names the plant card under the pointer.
 * `onDrop` gets the image files and that target (null: dropped elsewhere).
 */
export function usePhotoDrop(enabled: boolean, onDrop: (files: File[], target: DropTarget | null) => void) {
    const [dragging, setDragging] = useState(false);
    const [target, setTarget] = useState<DropTarget | null>(null);
    const depth = useRef(0);
    const onDropRef = useRef(onDrop);
    useEffect(() => {
        onDropRef.current = onDrop;
    });

    useEffect(() => {
        if (!enabled) return;

        const reset = () => {
            depth.current = 0;
            setDragging(false);
            setTarget(null);
        };
        const onEnter = (event: DragEvent) => {
            if (!carriesFiles(event)) return;
            event.preventDefault();
            depth.current += 1;
            setDragging(true);
        };
        const onOver = (event: DragEvent) => {
            if (!carriesFiles(event)) return;
            event.preventDefault(); // allows the drop
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
            const next = targetAt(event.target);
            setTarget((current) => (current?.plantId === next?.plantId ? current : next));
        };
        const onLeave = (event: DragEvent) => {
            if (!carriesFiles(event)) return;
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0) reset();
        };
        const onDropEvent = (event: DragEvent) => {
            if (!carriesFiles(event)) return;
            event.preventDefault(); // otherwise the browser opens the photo
            const dropTarget = targetAt(event.target);
            const files = Array.from(event.dataTransfer?.files ?? []).filter(isImageFile);
            reset();
            onDropRef.current(files, dropTarget);
        };

        window.addEventListener("dragenter", onEnter);
        window.addEventListener("dragover", onOver);
        window.addEventListener("dragleave", onLeave);
        window.addEventListener("drop", onDropEvent);
        return () => {
            window.removeEventListener("dragenter", onEnter);
            window.removeEventListener("dragover", onOver);
            window.removeEventListener("dragleave", onLeave);
            window.removeEventListener("drop", onDropEvent);
            reset();
        };
    }, [enabled]);

    return { dragging, target };
}
