// Leaflet sets a string tooltip or popup as HTML (innerHTML). Location names are user data, so
// they always go in as a text node: markup in a name shows as text and never runs.
export const tooltipNode = (text: string): HTMLElement => {
    const node = document.createElement("span");
    node.textContent = text;
    return node;
};
