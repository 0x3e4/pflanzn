import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StaticLeafletMap from "../components/StaticLeafletMap";
import { tooltipNode } from "../services/leafletText";

// Leaflet puts a string tooltip into the page as HTML. A location name like the one below
// must reach it as text, never as markup that runs.
const PAYLOAD = `<img src=x onerror="window.__pwned = true">`;

const fakeLeaflet = () => {
    const tooltips: unknown[] = [];
    const marker = {
        addTo: () => marker,
        bindTooltip: (content: unknown) => {
            tooltips.push(content);
        },
        on: () => {},
    };
    window.L = {
        map: () => ({ setView: () => {}, fitBounds: () => {}, remove: () => {} }),
        tileLayer: () => ({ addTo: () => {} }),
        circleMarker: () => marker,
    };
    return tooltips;
};

afterEach(() => {
    delete window.L;
    vi.restoreAllMocks();
});

describe("StaticLeafletMap tooltips", () => {
    it("hands Leaflet a text node, not an HTML string", async () => {
        const tooltips = fakeLeaflet();
        render(
            <StaticLeafletMap
                latitude={48.2}
                longitude={16.37}
                markers={[{ latitude: 48.2, longitude: 16.37, tooltipText: `${PAYLOAD} (elder)` }]}
            />,
        );

        await waitFor(() => expect(tooltips).toHaveLength(1));
        const content = tooltips[0];
        expect(content).toBeInstanceOf(HTMLElement);
        expect((content as HTMLElement).textContent).toBe(`${PAYLOAD} (elder)`);
        expect((content as HTMLElement).querySelector("img")).toBeNull();
    });

    it("keeps markup as text even once it is in the page", () => {
        const node = tooltipNode(PAYLOAD);
        document.body.appendChild(node);
        expect(node.children).toHaveLength(0);
        expect(node.innerHTML).toBe('&lt;img src=x onerror="window.__pwned = true"&gt;');
        node.remove();
    });
});
