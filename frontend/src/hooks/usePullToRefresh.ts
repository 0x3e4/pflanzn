import { useEffect, useState } from "react";
import { getOverlayOpen } from "../services/overlayControl";

export function usePullToRefresh(ref: React.RefObject<HTMLElement | null>, onTrigger: () => void) {
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const indicator = document.getElementById("pull-indicator");

        let startX = 0;
        let startY = 0;
        let currentY = 0;
        // A touch that may become a pull; it only becomes one once it clearly moves down.
        let candidate = false;
        let pulling = false;
        const TRIGGER_DISTANCE = 70;
        const MAX_PULL = 100;
        // Movement before the gesture is decided, and how much more vertical than horizontal
        // it must be. A sideways swipe that drifts down a few pixels stays a sideways swipe.
        const DECIDE_DISTANCE = 10;
        const VERTICAL_BIAS = 1.5;

        // Inside a row that scrolls sideways (the tag chips, the care calendar), the touch
        // belongs to that row: moving the page under it makes iOS drop the scroll.
        function insideHorizontalScroller(target: HTMLElement | null) {
            for (let node = target; node && node !== document.body; node = node.parentElement) {
                if (node.scrollWidth > node.clientWidth + 1) {
                    const overflowX = getComputedStyle(node).overflowX;
                    if (overflowX === "auto" || overflowX === "scroll") return true;
                }
            }
            return false;
        }

        function getPageScrollTop() {
            return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        }

        function handleTouchStart(e: TouchEvent) {
            const el = ref.current;
            if (!el) return;
            if (getPageScrollTop() !== 0 || getOverlayOpen()) return;

            const target = e.target as HTMLElement;

            const isInsideAllowedZone = target.closest(".container");
            const isInsideSwipeBlock =
                target.closest(".plant-carousel-viewer") ||
                target.closest(".plant-image-container") ||
                target.closest(".plants-list") ||
                target.closest(".profile-main-content") ||
                target.closest(".profile-sidebar") ||
                target.closest(".activity-log-list") ||
                target.closest(".activity-log-container") ||
                target.closest(".species-wordcloud") ||
                target.closest(".notes-section") ||
                target.closest(".tag-dropdown") ||
                target.closest(".description") ||
                target.closest("textarea") ||
                target.closest("input");
            const container = target.closest(".container") as HTMLElement;

            if (container) {
                const { left, right } = container.getBoundingClientRect();
                const styles = getComputedStyle(container);
                const paddingLeft = parseFloat(styles.paddingLeft);
                const paddingRight = parseFloat(styles.paddingRight);

                const touchX = e.touches[0].clientX;

                // Exclude if touch is in the left or right padding
                if (touchX < left + paddingLeft || touchX > right - paddingRight) {
                    return;
                }
            }

            if (!isInsideAllowedZone || isInsideSwipeBlock || insideHorizontalScroller(target)) return;

            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentY = startY;
            candidate = true;
            pulling = false;
        }

        function handleTouchMove(e: TouchEvent) {
            const el = ref.current;
            if (!el) return;
            if (!candidate && !pulling) return;

            currentY = e.touches[0].clientY;
            let dy = currentY - startY;

            if (!pulling) {
                const dx = e.touches[0].clientX - startX;
                if (Math.abs(dx) < DECIDE_DISTANCE && Math.abs(dy) < DECIDE_DISTANCE) return;
                candidate = false;
                // Only a clear downward drag is a pull; anything else is left to the browser.
                if (dy <= 0 || dy < Math.abs(dx) * VERTICAL_BIAS) return;
                pulling = true;
            }

            if (dy > 0) {
                dy = Math.min(dy, MAX_PULL);

                el.style.transform = `translateY(${dy}px)`;

                if (indicator) {
                    indicator.style.transform = `translateY(${Math.min(dy - 70, 50)}px)`;

                    if (dy > TRIGGER_DISTANCE) {
                        indicator.classList.add("flip");
                    } else {
                        indicator.classList.remove("flip");
                    }
                }
            }
        }

        function handleTouchEnd() {
            const el = ref.current;
            candidate = false;
            if (!el) return;
            if (!pulling) return;

            const dy = currentY - startY;
            el.style.transition = "transform 0.3s ease";

            if (dy > TRIGGER_DISTANCE) {
                setRefreshing(true);
                onTrigger();
            } else {
                el.style.transform = "translateY(0)";
                resetIndicator();
            }

            pulling = false;
        }

        function resetIndicator() {
            setTimeout(() => {
                const el = ref.current;
                if (!el) return;
                el.style.transition = "";
                el.style.transform = "";

                if (indicator) {
                    indicator.style.transition = "transform 0.3s ease";
                    indicator.style.transform = "translateY(-100%)";
                    indicator.classList.remove("flip");
                    setTimeout(() => {
                        indicator.style.transition = "";
                    }, 300);
                }
            }, 300);
        }

        function handleTouchCancel() {
            const el = ref.current;
            candidate = false;
            if (!el || !pulling) return;
            pulling = false;
            el.style.transition = "transform 0.3s ease";
            el.style.transform = "translateY(0)";
            resetIndicator();
        }

        // Passive: nothing here calls preventDefault, and a non-passive listener on the whole
        // app makes iOS wait for it on every touch before it scrolls.
        el.addEventListener("touchstart", handleTouchStart, { passive: true });
        el.addEventListener("touchmove", handleTouchMove, { passive: true });
        el.addEventListener("touchend", handleTouchEnd, { passive: true });
        el.addEventListener("touchcancel", handleTouchCancel, { passive: true });

        return () => {
            el.removeEventListener("touchstart", handleTouchStart);
            el.removeEventListener("touchmove", handleTouchMove);
            el.removeEventListener("touchend", handleTouchEnd);
            el.removeEventListener("touchcancel", handleTouchCancel);
        };
    }, [ref, onTrigger]);

    // Expose refreshing state
    return { refreshing, setRefreshing };
}
