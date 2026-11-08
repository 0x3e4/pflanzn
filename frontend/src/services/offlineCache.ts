// The offline copies the service worker keeps of API reads and photos (cache names from
// workbox.runtimeCaching in vite.config.ts). They hold the collection, the profile (with the
// email) and photos of private locations, so they go when someone signs out: on a shared
// device the next person must not be able to read them offline.
export const OFFLINE_CACHES = ["api-plants", "api-locations", "plant-images", "api-user", "api-statistics"];

export const clearOfflineCaches = async (): Promise<void> => {
    if (typeof caches === "undefined") return;
    await Promise.all(OFFLINE_CACHES.map((name) => caches.delete(name).catch(() => false)));
};
