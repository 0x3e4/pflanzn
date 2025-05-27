import { useEffect, useState } from "react";
import { getOverlayOpen } from "../services/overlayControl";

export function usePullToRefresh(
  ref: React.RefObject<HTMLElement | null>,
  onTrigger: () => void
) {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const indicator = document.getElementById("pull-indicator");

    let startY = 0;
    let currentY = 0;
    let pulling = false;
    const TRIGGER_DISTANCE = 70;
    const MAX_PULL = 100;

    function handleTouchStart(e: TouchEvent) {
      const el = ref.current;
      if (!el) return;
      if (el.scrollTop !== 0 || getOverlayOpen()) return;

      const target = e.target as HTMLElement;

      const isInsideAllowedZone = target.closest(".container");
      const isInsideSwipeBlock = target.closest(".plant-carousel-viewer") || target.closest(".plant-image-container") || target.closest(".plants-list") || target.closest(".profile-main-content");

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

      if (!isInsideAllowedZone || isInsideSwipeBlock) return;

      startY = e.touches[0].clientY;
      pulling = true;
    }

    function handleTouchMove(e: TouchEvent) {
      const el = ref.current;
      if (!el) return;
      if (!pulling) return;

      currentY = e.touches[0].clientY;
      let dy = currentY - startY;

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

    el.addEventListener("touchstart", handleTouchStart);
    el.addEventListener("touchmove", handleTouchMove);
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, onTrigger]);

  // Expose refreshing state
  return { refreshing, setRefreshing };
}