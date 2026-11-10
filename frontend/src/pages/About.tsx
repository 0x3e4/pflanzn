import "../styles/about.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
    faArrowUpRightFromSquare,
    faCamera,
    faChartColumn,
    faCloudRain,
    faDroplet,
    faImages,
    faMapLocationDot,
    faRobot,
    faShieldHalved,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { APP_VERSION } from "../config/appInfo";

// What Pflanzn does today, in the order people meet it. Keep in step with the README's
// Highlights and the docs; nothing here may promise more than the app does.
const FEATURES: { icon: IconDefinition; title: string; text: string }[] = [
    {
        icon: faDroplet,
        title: "Watering schedule",
        text: "Water every few days, per plant. Due plants come first on the home page and under #needs_water, and Water all takes care of them in one go.",
    },
    {
        icon: faImages,
        title: "Photos and history",
        text: "A photo timeline for every plant, and waterings, fertilizing, notes and care advice in one feed and one calendar.",
    },
    {
        icon: faCamera,
        title: "Species identification",
        text: "Pl@ntNet names the species from a photo, and the plant page links to it.",
    },
    {
        icon: faWandMagicSparkles,
        title: "AI care advice",
        text: "Care advice and descriptions from OpenAI, Claude, Mistral, Hugging Face or a local Ollama. A description also suggests the watering interval.",
    },
    {
        icon: faRobot,
        title: "Talk to your plants (MCP)",
        text: "Connect Claude or another assistant: ask which plants need water, and let it log the watering for you.",
    },
    {
        icon: faMapLocationDot,
        title: "Locations and floor plans",
        text: "Garden spots on a map with their harvest times, and a plan of your home with every plant on it.",
    },
    {
        icon: faCloudRain,
        title: "Rain counts",
        text: "Outdoor plants are watered automatically when it has rained enough where they stand.",
    },
    {
        icon: faChartColumn,
        title: "Statistics",
        text: "The watering status of the whole collection, a year of care, waterings per week and the plants that got the most attention.",
    },
    {
        icon: faShieldHalved,
        title: "Yours, on your server",
        text: "Self-hosted with no telemetry. Sign in locally or with your identity provider, share read-only links, and keep an audit log of every change.",
    },
];

const LINKS = [
    { href: "/docs/", label: "Documentation" },
    { href: "https://github.com/0x3e4/pflanzn/blob/main/CHANGELOG.md", label: "What's new" },
    { href: "https://github.com/0x3e4/pflanzn", label: "Source on GitHub" },
];

export default function About() {
    return (
        <div className="container about-container">
            <header className="about-head">
                <h1>Pflanzn</h1>
                <p className="about-lead">
                    A self-hostable plant manager: what needs water today, the whole history of every plant, and an app
                    you install on your phone that keeps working offline.
                </p>
                <div className="about-meta">
                    <span className="about-version">Version {APP_VERSION}</span>
                    <ul className="about-links">
                        {LINKS.map(({ href, label }) => (
                            <li key={label}>
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={`${label} (opens in a new tab)`}
                                >
                                    {label}
                                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </header>

            <section className="about-name" aria-labelledby="about-name">
                <h2 id="about-name">The name</h2>
                <div className="about-name-grid">
                    <div>
                        <h3>How to say it</h3>
                        <p>
                            Pflanzn sounds like <em>pflahn-tsn</em>: a soft P that runs straight into the F, an A as in
                            "father", and a Z said like "ts". The E of the standard German word is swallowed, the way it
                            is in Austrian speech.
                        </p>
                    </div>
                    <div>
                        <h3>What it means</h3>
                        <p>
                            <em>Pflanzen</em> are plants. In Austria, <em>pflanzen</em> also means to tease someone
                            good-naturedly, which fits anyone who has ever been outwitted by a fern. Whether you have
                            gardened for years or bought your first plant last week, Pflanzn keeps track so you don't
                            have to.
                        </p>
                    </div>
                </div>
            </section>

            <section className="about-features" aria-labelledby="about-features">
                <h2 id="about-features">What it does</h2>
                <ul className="about-features-grid">
                    {FEATURES.map(({ icon, title, text }) => (
                        <li key={title} className="about-feature-card">
                            <h3 className="about-feature-header">
                                <FontAwesomeIcon icon={icon} className="about-feature-icon" aria-hidden="true" />
                                {title}
                            </h3>
                            <p>{text}</p>
                        </li>
                    ))}
                </ul>
            </section>

            <p className="about-made">Made in Austria.</p>
        </div>
    );
}
