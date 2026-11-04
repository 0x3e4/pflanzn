import { parseCareAdvice } from "../services/careAdvice";
import "../styles/careAdvice.css";

interface CareAdviceTextProps {
    text: string;
    author?: string;
    expanded: boolean;
    onToggle: () => void;
}

const CareAdviceText = ({ text, author, expanded, onToggle }: CareAdviceTextProps) => {
    const sections = parseCareAdvice(text);
    const collapsible = sections.length > 1;
    const shown = collapsible && !expanded ? sections.slice(0, 1) : sections;

    return (
        <div className="care-advice">
            {shown.map((section, i) => (
                <section key={i} className="care-advice-section">
                    {section.label && <h4 className="care-advice-label">{section.label}</h4>}
                    {section.intro && <p className="care-advice-text">{section.intro}</p>}
                    {section.steps.length > 0 && (
                        <ol className="care-advice-steps">
                            {section.steps.map((step, j) => (
                                <li key={j}>{step}</li>
                            ))}
                        </ol>
                    )}
                </section>
            ))}
            <div className="care-advice-footer">
                {collapsible && (
                    <button type="button" className="care-advice-toggle" aria-expanded={expanded} onClick={onToggle}>
                        {expanded ? "Show less" : `Show all ${sections.length} sections`}
                    </button>
                )}
                {author && <span className="care-advice-author">by {author}</span>}
            </div>
        </div>
    );
};

export default CareAdviceText;
