import { renderHook, act } from "@testing-library/react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useOnlineStatus", () => {
    beforeEach(() => {
        Object.defineProperty(navigator, "onLine", {
            writable: true,
            value: true,
        });
    });

    it("returns true when browser is online", () => {
        const { result } = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(true);
    });

    it("returns false when browser is offline", () => {
        Object.defineProperty(navigator, "onLine", { value: false });
        const { result } = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(false);
    });

    it("updates when going offline", () => {
        const { result } = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(true);

        act(() => {
            window.dispatchEvent(new Event("offline"));
        });
        expect(result.current).toBe(false);
    });

    it("updates when going back online", () => {
        Object.defineProperty(navigator, "onLine", { value: false });
        const { result } = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(false);

        act(() => {
            window.dispatchEvent(new Event("online"));
        });
        expect(result.current).toBe(true);
    });

    it("cleans up event listeners on unmount", () => {
        const addSpy = vi.spyOn(window, "addEventListener");
        const removeSpy = vi.spyOn(window, "removeEventListener");

        const { unmount } = renderHook(() => useOnlineStatus());

        expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));

        unmount();

        expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));

        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
