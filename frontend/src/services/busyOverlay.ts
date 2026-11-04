import { useSyncExternalStore } from "react";

export interface BusyMessage {
    title: string;
    message: string;
}

// One app-wide loading overlay for actions that take a few seconds (uploads, identification),
// so every page and the header camera show the same feedback.
let current: BusyMessage | null = null;
let depth = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export async function withBusy<T>(busy: BusyMessage, run: () => Promise<T>): Promise<T> {
    depth += 1;
    current = busy;
    emit();
    try {
        return await run();
    } finally {
        depth -= 1;
        if (depth === 0) current = null;
        emit();
    }
}

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useBusyOverlay = (): BusyMessage | null => useSyncExternalStore(subscribe, () => current);
