import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

// Regression: on iOS the tag chips at the top of the plants list would not scroll sideways,
// or got stuck mid-swipe. Every touch at the top of the page started a pull, and a swipe
// that drifted down a few pixels moved the whole page, which made Safari drop the scroll.

const touch = (target: Element, type: string, x: number, y: number) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientX: x, clientY: y }] });
    target.dispatchEvent(event);
};

const setup = () => {
    const root = document.createElement("div");
    const container = document.createElement("div");
    container.className = "container";
    // jsdom has no layout: give the container a width, or every touch counts as in its padding.
    container.getBoundingClientRect = () =>
        ({ left: 0, right: 400, top: 0, bottom: 800, width: 400, height: 800 }) as DOMRect;
    const chip = document.createElement("span");
    container.appendChild(chip);
    root.appendChild(container);
    document.body.appendChild(root);
    const onTrigger = vi.fn();
    const ref = { current: root };
    renderHook(() => usePullToRefresh(ref, onTrigger));
    return { root, chip, onTrigger };
};

afterEach(() => {
    document.body.innerHTML = "";
});

describe("usePullToRefresh", () => {
    it("leaves a sideways swipe that drifts down alone", () => {
        const { root, chip, onTrigger } = setup();
        touch(chip, "touchstart", 200, 100);
        touch(chip, "touchmove", 140, 106); // mostly left, a little down
        touch(chip, "touchmove", 60, 112);
        expect(root.style.transform).toBe("");
        touch(chip, "touchend", 0, 0);
        expect(onTrigger).not.toHaveBeenCalled();
    });

    it("ignores tiny movements until the direction is clear", () => {
        const { root, chip } = setup();
        touch(chip, "touchstart", 200, 100);
        touch(chip, "touchmove", 203, 106);
        expect(root.style.transform).toBe("");
    });

    it("still pulls on a clear downward drag and refreshes past the threshold", () => {
        const { root, chip, onTrigger } = setup();
        touch(chip, "touchstart", 200, 100);
        touch(chip, "touchmove", 204, 130);
        expect(root.style.transform).toBe("translateY(30px)");
        touch(chip, "touchmove", 206, 190);
        touch(chip, "touchend", 0, 0);
        expect(onTrigger).toHaveBeenCalledOnce();
    });
});
