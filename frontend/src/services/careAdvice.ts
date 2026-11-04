export interface CareAdviceSection {
    label: string | null;
    intro: string;
    steps: string[];
}

// A section starts with a short label line ("Diagnose: …"); the label is in the
// LLM language, so it's recognised by shape, not by its words.
const LABEL = /^([^:\d][^:]{1,38}):\s*(.*)$/;
const STEP = /(?:^|\s)(\d{1,2})\.\s+/g;

// Numbered steps written inline ("1. … 2. …"). Only a run counting up from 1 counts,
// so dates ("am 20.10.") and ordinals ("3. November") stay in the text.
const splitSteps = (body: string): { intro: string; steps: string[] } => {
    const cuts: { start: number; end: number }[] = [];
    for (const match of body.matchAll(STEP)) {
        if (Number(match[1]) !== cuts.length + 1) continue;
        cuts.push({ start: match.index, end: match.index + match[0].length });
    }
    if (cuts.length < 2) return { intro: body, steps: [] };
    const steps = cuts.map((cut, i) => body.slice(cut.end, cuts[i + 1]?.start ?? body.length).trim());
    return { intro: body.slice(0, cuts[0].start).trim(), steps };
};

export const parseCareAdvice = (text: string): CareAdviceSection[] => {
    const sections: { label: string | null; lines: string[] }[] = [];
    for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
        const match = LABEL.exec(line);
        if (match && match[1].trim().split(/\s+/).length <= 5) {
            sections.push({ label: match[1].trim(), lines: match[2] ? [match[2]] : [] });
        } else if (sections.length) {
            sections[sections.length - 1].lines.push(line);
        } else {
            sections.push({ label: null, lines: [line] });
        }
    }
    return sections.map(({ label, lines }) => ({ label, ...splitSteps(lines.join(" ")) }));
};
