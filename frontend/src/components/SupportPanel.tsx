import "../styles/support-panel.css";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faHeart, faSeedling, faStar } from "@fortawesome/free-solid-svg-icons";
import { SiGithub, SiKofi } from "@icons-pack/react-simple-icons";
import { APP_VERSION } from "../config/appInfo";

export default function SupportPanel() {
    return (
        <div className="profile-info support-panel">
            <div className="support-header">
                <h2>
                    <FontAwesomeIcon icon={faHeart} className="support-header-icon" /> Support
                </h2>
                <p className="support-subtitle">
                    Pflanzn is built and maintained as a labour of love. Help keep it growing.
                </p>
            </div>

            {/* About, docs, source and version: they used to sit at the foot of the Manage
                sidebar, which on a phone is squeezed into the scrolling tab strip. */}
            <section className="support-about" aria-labelledby="support-about-heading">
                <div className="support-card-header">
                    <FontAwesomeIcon icon={faSeedling} className="support-card-icon support-card-icon--about" />
                    <strong id="support-about-heading">Pflanzn {APP_VERSION}</strong>
                </div>
                <ul className="support-about-links">
                    <li>
                        <Link to="/about">About Pflanzn</Link>
                    </li>
                    <li>
                        {/* /docs is forwarded to the docs container, or to the docs on GitHub. */}
                        <a
                            href="/docs/"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Documentation (opens in a new tab)"
                        >
                            Documentation
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://github.com/0x3e4/pflanzn/blob/main/CHANGELOG.md"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="What's new (opens in a new tab)"
                        >
                            What&apos;s new
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://github.com/0x3e4/pflanzn"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Source on GitHub (opens in a new tab)"
                        >
                            Source on GitHub
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                        </a>
                    </li>
                </ul>
            </section>

            <div className="support-cards">
                <div className="support-card">
                    <div className="support-card-header">
                        <FontAwesomeIcon icon={faStar} className="support-card-icon support-card-icon--github" />
                        <strong>Star on GitHub</strong>
                    </div>
                    <p>
                        If Pflanzn is useful to you, a star on the repository helps others discover it. Bug reports and
                        pull requests are very welcome too.
                    </p>
                    <a
                        className="support-card-btn support-card-btn--github"
                        href="https://github.com/0x3e4/pflanzn"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <SiGithub className="si-icon" /> Open on GitHub
                    </a>
                </div>

                <div className="support-card">
                    <div className="support-card-header">
                        <FontAwesomeIcon icon={faHeart} className="support-card-icon support-card-icon--kofi" />
                        <strong>Buy a coffee</strong>
                    </div>
                    <p>
                        Pflanzn is free and self-hostable. If it makes your plant-care routine easier, a small tip keeps
                        the lights on and development going.
                    </p>
                    <a
                        className="support-card-btn support-card-btn--kofi"
                        href="https://ko-fi.com/0x3e4"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <SiKofi className="si-icon" /> Buy me a coffee on Ko-fi
                    </a>
                </div>
            </div>
        </div>
    );
}
