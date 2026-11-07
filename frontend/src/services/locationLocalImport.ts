// Before tags, notes and harvest times were stored on the server, the location page kept them
// in this browser's localStorage. Hand them to the server once, then forget them here.
import { importLocalLocationData, LocalLocationData } from "./LocationService";

const KEY = /^location_(tags|notes|season_events)_(\d+)$/;

let running: Promise<number[]> | null = null;

const readJson = (key: string): unknown => {
    try {
        return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
        return null;
    }
};

const collect = (): Map<number, { keys: string[]; data: LocalLocationData }> => {
    const byLocation = new Map<number, { keys: string[]; data: LocalLocationData }>();
    let keys: string[];
    try {
        keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) || "");
    } catch {
        return byLocation; // storage blocked: nothing to move
    }
    for (const key of keys) {
        const match = KEY.exec(key);
        if (!match) continue;
        const id = Number(match[2]);
        const entry = byLocation.get(id) ?? { keys: [], data: { tags: [], notes: [], season_events: [] } };
        entry.keys.push(key);
        const value = readJson(key);
        if (Array.isArray(value)) {
            if (match[1] === "tags") {
                entry.data.tags = value.map((tag) => String(tag ?? "").trim()).filter(Boolean);
            } else if (match[1] === "notes") {
                entry.data.notes = value
                    .filter((note) => note && typeof note.text === "string" && note.text.trim())
                    .map((note) => ({ text: note.text, created_at: note.created_at }));
            } else {
                entry.data.season_events = value
                    .filter((event) => event && event.occurred_at)
                    .map((event) => ({
                        title: event.title || "Harvest time",
                        occurred_at: event.occurred_at,
                        created_at: event.created_at,
                    }));
            }
        }
        byLocation.set(id, entry);
    }
    return byLocation;
};

/** Moves what this browser still holds to the server. Returns the ids of the locations that changed.
 *  Runs once per page load; the server skips entries it already has, so a retry is harmless. */
export const importLocalLocationDataOnce = (): Promise<number[]> => {
    running ??= (async () => {
        const changed: number[] = [];
        for (const [id, { keys, data }] of collect()) {
            const empty = !data.tags.length && !data.notes.length && !data.season_events.length;
            try {
                if (!empty) {
                    await importLocalLocationData(id, data);
                    changed.push(id);
                }
            } catch (error) {
                const status = (error as { response?: { status?: number } }).response?.status;
                if (status !== 404) continue; // keep it for the next try; 404 means the location is gone
            }
            keys.forEach((key) => {
                try {
                    localStorage.removeItem(key);
                } catch {
                    // Storage blocked: the server skips duplicates next time.
                }
            });
        }
        return changed;
    })();
    return running;
};
