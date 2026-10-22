import { RefObject, useCallback, useEffect, useRef, useState } from "react";

export interface PanZoomState {
    scale: number;
    x: number;
    y: number;
}

interface Point {
    x: number;
    y: number;
}

const TAP_SLOP_PX = 6;
const IDENTITY: PanZoomState = { scale: 1, x: 0, y: 0 };

/**
 * Pinch-zoom (touch), wheel-zoom (desktop) and drag-to-pan for a viewport whose
 * child is transformed with `translate(x, y) scale(scale)` and origin 0 0.
 *
 * Pointers are only captured once they move past a small slop, so taps still reach
 * child elements (plant markers); `wasGesture()` tells click handlers to ignore the
 * click that ends a pan or pinch.
 */
export function usePanZoom(viewportRef: RefObject<HTMLElement | null>, maxScale = 5) {
    const [state, setState] = useState<PanZoomState>(IDENTITY);
    const stateRef = useRef(state);
    stateRef.current = state;

    const pointers = useRef(new Map<number, Point>());
    const panStart = useRef<{ pointer: Point; state: PanZoomState } | null>(null);
    const pinchStart = useRef<{ distance: number; mid: Point; state: PanZoomState } | null>(null);
    const moved = useRef(false);

    const clamp = useCallback(
        (next: PanZoomState): PanZoomState => {
            const el = viewportRef.current;
            const scale = Math.min(maxScale, Math.max(1, next.scale));
            if (!el) return { ...next, scale };
            const { width, height } = el.getBoundingClientRect();
            return {
                scale,
                x: Math.min(0, Math.max(width - width * scale, next.x)),
                y: Math.min(0, Math.max(height - height * scale, next.y)),
            };
        },
        [viewportRef, maxScale],
    );

    // Zoom so the content point under (clientX, clientY) stays under it.
    const zoomAt = useCallback(
        (clientX: number, clientY: number, scale: number, from: PanZoomState = stateRef.current) => {
            const el = viewportRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const px = clientX - rect.left;
            const py = clientY - rect.top;
            const target = Math.min(maxScale, Math.max(1, scale));
            const ratio = target / from.scale;
            setState(clamp({ scale: target, x: px - (px - from.x) * ratio, y: py - (py - from.y) * ratio }));
        },
        [viewportRef, maxScale, clamp],
    );

    const zoomBy = useCallback(
        (factor: number) => {
            const el = viewportRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, stateRef.current.scale * factor);
        },
        [viewportRef, zoomAt],
    );

    const reset = useCallback(() => setState(IDENTITY), []);

    // Wheel needs a non-passive listener to stop the page from scrolling.
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            zoomAt(e.clientX, e.clientY, stateRef.current.scale * Math.exp(-e.deltaY * 0.0015));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [viewportRef, zoomAt]);

    const startPan = (pointer: Point) => {
        panStart.current = { pointer, state: stateRef.current };
        pinchStart.current = null;
    };

    const onPointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 1) {
            moved.current = false;
            startPan({ x: e.clientX, y: e.clientY });
        } else if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinchStart.current = {
                distance: Math.hypot(a.x - b.x, a.y - b.y),
                mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
                state: stateRef.current,
            };
            panStart.current = null;
        }
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.current.size >= 2 && pinchStart.current) {
            moved.current = true;
            const [a, b] = [...pointers.current.values()];
            const start = pinchStart.current;
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const scale = start.state.scale * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, start.distance));
            const panned = {
                ...start.state,
                x: start.state.x + mid.x - start.mid.x,
                y: start.state.y + mid.y - start.mid.y,
            };
            zoomAt(start.mid.x, start.mid.y, scale, panned);
            return;
        }

        const start = panStart.current;
        if (!start) return;
        const dx = e.clientX - start.pointer.x;
        const dy = e.clientY - start.pointer.y;
        if (!moved.current && Math.hypot(dx, dy) < TAP_SLOP_PX) return;
        if (!moved.current) {
            moved.current = true;
            viewportRef.current?.setPointerCapture?.(e.pointerId);
        }
        setState(clamp({ ...start.state, x: start.state.x + dx, y: start.state.y + dy }));
    };

    const onPointerUp = (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size === 1) {
            // Pinch ended with one finger still down: continue as a pan from here.
            startPan([...pointers.current.values()][0]);
        } else if (pointers.current.size === 0) {
            panStart.current = null;
            pinchStart.current = null;
        }
    };

    /** Stop tracking a pointer (e.g. it started dragging a marker instead). */
    const releasePointer = useCallback((pointerId: number) => {
        pointers.current.delete(pointerId);
        if (pointers.current.size === 0) {
            panStart.current = null;
            pinchStart.current = null;
        }
    }, []);

    const wasGesture = useCallback(() => moved.current, []);

    return {
        state,
        zoomBy,
        reset,
        wasGesture,
        releasePointer,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onDoubleClick: reset,
        },
    };
}
