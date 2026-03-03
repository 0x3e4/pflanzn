import { useEffect, useRef } from "react";
import "../styles/staticLeafletMap.css";

type LeafletMarkerLike = {
  addTo: (map: any) => LeafletMarkerLike;
  bindTooltip?: (content: string, options?: Record<string, unknown>) => void;
  on?: (event: string, handler: () => void) => void;
};

type LeafletMapLike = {
  setView: (latlng: [number, number], zoom: number, options?: Record<string, unknown>) => void;
  fitBounds?: (bounds: [number, number][], options?: Record<string, unknown>) => void;
  remove: () => void;
};

type LeafletLike = {
  map: (element: HTMLElement, options: Record<string, unknown>) => LeafletMapLike;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: any) => void };
  circleMarker: (latlng: [number, number], options: Record<string, unknown>) => LeafletMarkerLike;
};

declare global {
  interface Window {
    L?: LeafletLike;
    __leafletLoadPromise?: Promise<LeafletLike>;
  }
}

const LEAFLET_CSS_ID = "leaflet-css-cdn";
const LEAFLET_SCRIPT_ID = "leaflet-js-cdn";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

const ensureLeaflet = async (): Promise<LeafletLike> => {
  if (window.L) {
    return window.L;
  }

  if (!document.getElementById(LEAFLET_CSS_ID)) {
    const cssLink = document.createElement("link");
    cssLink.id = LEAFLET_CSS_ID;
    cssLink.rel = "stylesheet";
    cssLink.href = LEAFLET_CSS_URL;
    document.head.appendChild(cssLink);
  }

  if (!window.__leafletLoadPromise) {
    window.__leafletLoadPromise = new Promise<LeafletLike>((resolve, reject) => {
      const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;

      const handleLoaded = () => {
        if (window.L) {
          resolve(window.L);
        } else {
          reject(new Error("Leaflet loaded but window.L is unavailable."));
        }
      };

      const handleError = () => reject(new Error("Failed to load Leaflet script."));

      if (existingScript) {
        existingScript.addEventListener("load", handleLoaded, { once: true });
        existingScript.addEventListener("error", handleError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = LEAFLET_SCRIPT_ID;
      script.src = LEAFLET_JS_URL;
      script.async = true;
      script.onload = handleLoaded;
      script.onerror = handleError;
      document.body.appendChild(script);
    });
  }

  return window.__leafletLoadPromise;
};

interface StaticLeafletMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  className?: string;
  interactive?: boolean;
  tooltipText?: string;
  markers?: StaticLeafletMarker[];
  fitToMarkers?: boolean;
}

export interface StaticLeafletMarker {
  id?: number | string;
  latitude: number;
  longitude: number;
  tooltipText?: string;
  radius?: number;
  weight?: number;
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  onClick?: () => void;
}

export default function StaticLeafletMap({
  latitude,
  longitude,
  zoom = 15,
  className = "",
  interactive = false,
  tooltipText,
  markers,
  fitToMarkers = false,
}: StaticLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapLike | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      try {
        const leaflet = await ensureLeaflet();
        if (cancelled || !containerRef.current) {
          return;
        }

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        const map = leaflet.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
          dragging: interactive,
          scrollWheelZoom: interactive,
          doubleClickZoom: interactive,
          boxZoom: interactive,
          keyboard: interactive,
          touchZoom: interactive,
          tap: interactive,
        });

        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            minZoom: 3,
            maxZoom: 19,
          })
          .addTo(map);

        const mapMarkers = markers && markers.length > 0
          ? markers
          : [{
            latitude,
            longitude,
            tooltipText,
            radius: 8,
            weight: 2,
            color: "#2e6a31",
            fillColor: "#4caf50",
            fillOpacity: 0.85,
          }];

        const markerPositions: [number, number][] = [];
        mapMarkers.forEach((markerConfig) => {
          const marker = leaflet
            .circleMarker([markerConfig.latitude, markerConfig.longitude], {
              radius: markerConfig.radius ?? 8,
              weight: markerConfig.weight ?? 2,
              color: markerConfig.color ?? "#2e6a31",
              fillColor: markerConfig.fillColor ?? "#4caf50",
              fillOpacity: markerConfig.fillOpacity ?? 0.85,
            })
            .addTo(map);

          if (markerConfig.tooltipText && typeof marker.bindTooltip === "function") {
            marker.bindTooltip(markerConfig.tooltipText, {
              direction: "top",
              offset: [0, -10],
              className: "location-leaflet-tooltip",
            });
          }

          if (markerConfig.onClick && typeof marker.on === "function") {
            marker.on("click", markerConfig.onClick);
          }

          markerPositions.push([markerConfig.latitude, markerConfig.longitude]);
        });

        if (fitToMarkers && markerPositions.length > 1 && typeof map.fitBounds === "function") {
          map.fitBounds(markerPositions, {
            padding: [24, 24],
            maxZoom: zoom,
            animate: false,
          });
        } else if (fitToMarkers && markerPositions.length === 1) {
          map.setView(markerPositions[0], zoom, { animate: false });
        } else {
          map.setView([latitude, longitude], zoom, { animate: false });
        }

        mapRef.current = map;
      } catch (error) {
        console.error("Unable to initialize Leaflet map:", error);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [fitToMarkers, interactive, latitude, longitude, markers, tooltipText, zoom]);

  return <div ref={containerRef} className={`static-leaflet-map${interactive ? " is-interactive" : " is-static"} ${className}`} />;
}
