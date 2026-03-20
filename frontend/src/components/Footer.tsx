import "../styles/footer.css";
import { Link } from "react-router-dom";
import { SiGithub } from "@icons-pack/react-simple-icons";

export default function Footer() {
    return (
        <footer>
            <div className="footer-logo">
                <div className="footer-logo-container">
                    <img src="/logo_transparent.png" alt="Logo" />
                    <h1>Pflanzn</h1>
                </div>
            </div>

            <div className="footer-columns">
                <div className="footer-column">
                    <h3>Pflanzn</h3>
                    <Link to="/about">About</Link>
                </div>

                <div className="footer-column">
                    <h3>Community</h3>
                    <a href="https://github.com/0x3e4/pflanzn">
                        <SiGithub className="si-icon" /> GitHub
                    </a>
                </div>
            </div>
        </footer>
    );
}
