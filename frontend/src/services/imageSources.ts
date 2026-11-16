import type { ImageQuality } from "../config/uiPreferences";

// Every photo is stored as WebP in three widths: thumb (300px), medium (800px) and
// original (up to 2000px). Which one a preview or the main photo uses follows the
// "Image quality" setting under Manage → Customize:
//   auto   previews offer thumb and medium and the browser picks by screen density
//          (sharp on HiDPI, 2K and 4K screens, small on ordinary ones)
//   saver  the smallest that works: thumb for previews, medium for the main photo
//   high   medium for previews, original for the main photo
// Full-screen views always load the original.

const url = (path: string, size: "thumb" | "medium" | "original") => `/api/uploads/${path}?size=${size}`;

export interface ImageSource {
    src: string;
    srcSet?: string;
    sizes?: string;
}

/** A small preview (cards, list rows, filmstrips). `displayWidth` is its CSS width in px. */
export function previewSource(path: string, quality: ImageQuality, displayWidth = 300): ImageSource {
    if (quality === "high") return { src: url(path, "medium") };
    if (quality === "saver") return { src: url(path, "thumb") };
    return {
        src: url(path, "thumb"),
        srcSet: `${url(path, "thumb")} 300w, ${url(path, "medium")} 800w`,
        sizes: `${displayWidth}px`,
    };
}

/** The large photo on a plant or location page. */
export function mainPhotoSource(path: string, quality: ImageQuality): ImageSource {
    if (quality === "high") return { src: url(path, "original") };
    if (quality === "saver") return { src: url(path, "medium") };
    return {
        src: url(path, "medium"),
        srcSet: `${url(path, "thumb")} 300w, ${url(path, "medium")} 800w, ${url(path, "original")} 2000w`,
        sizes: "(max-width: 768px) 100vw, 800px",
    };
}

/** The URL to preload so the main photo shows at once (matches mainPhotoSource's src). */
export function mainPhotoPreloadUrl(path: string, quality: ImageQuality): string {
    return url(path, quality === "high" ? "original" : "medium");
}
