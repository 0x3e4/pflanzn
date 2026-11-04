import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import CareAdviceText from "../components/CareAdviceText";
import { parseCareAdvice } from "../services/careAdvice";

const ADVICE = [
    "Diagnose: Der Erbsenblatt ist innerhalb von zwei Wochen stark eingebrochen. Am 20.09. und 20.10. war er noch dicht.",
    "Wahrscheinliche Ursachen: Wurzelfäule durch zu viel Nässe. Du hast am 24.10. gegossen.",
    "Was jetzt zu tun ist: 1. Nicht mehr gießen. 2. Schneide sofort alle prallen Triebspitzen ab, je 5 bis 10 cm. 3. Leg die Stecklinge auf trockene Erde.",
    "Darauf achten: Die Stecklinge brauchen etwa 2 bis 4 Wochen, bis sie Wurzeln bilden.",
].join("\n");

describe("parseCareAdvice", () => {
    it("splits the labelled sections and numbered steps", () => {
        const sections = parseCareAdvice(ADVICE);
        expect(sections.map((s) => s.label)).toEqual([
            "Diagnose", "Wahrscheinliche Ursachen", "Was jetzt zu tun ist", "Darauf achten",
        ]);
        expect(sections[0].intro).toContain("Am 20.09. und 20.10. war er noch dicht.");
        expect(sections[0].steps).toEqual([]);
        expect(sections[2].intro).toBe("");
        expect(sections[2].steps).toEqual([
            "Nicht mehr gießen.",
            "Schneide sofort alle prallen Triebspitzen ab, je 5 bis 10 cm.",
            "Leg die Stecklinge auf trockene Erde.",
        ]);
    });

    it("keeps dates and ordinals in the text", () => {
        const [section] = parseCareAdvice("Watch for: new leaves after 3. November and on 20.10. as well.");
        expect(section.steps).toEqual([]);
        expect(section.intro).toBe("new leaves after 3. November and on 20.10. as well.");
    });

    it("leaves old unstructured advice as one paragraph", () => {
        const sections = parseCareAdvice("Water less often, the soil stays wet for days.\nMove it closer to the window.");
        expect(sections).toEqual([
            { label: null, intro: "Water less often, the soil stays wet for days. Move it closer to the window.", steps: [] },
        ]);
    });
});

describe("CareAdviceText", () => {
    it("shows the diagnosis first and the rest on request", () => {
        const onToggle = vi.fn();
        const { rerender } = render(<CareAdviceText text={ADVICE} author="raphael" expanded={false} onToggle={onToggle} />);

        expect(screen.getByRole("heading", { name: "Diagnose" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Darauf achten" })).not.toBeInTheDocument();
        expect(screen.getByText("by raphael")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Show all 4 sections" }));
        expect(onToggle).toHaveBeenCalled();

        rerender(<CareAdviceText text={ADVICE} expanded onToggle={onToggle} />);
        expect(screen.getAllByRole("listitem")).toHaveLength(3);
        expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    });
});
