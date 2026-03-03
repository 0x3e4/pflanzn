import "../styles/footer.css";
import { Link } from "react-router-dom";
import { SiGithub, SiMastodon, SiDocker } from "@icons-pack/react-simple-icons";

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
                <a href="https://wien.rocks/@pflanzn"><SiMastodon className='si-icon' /> Mastodon</a>
                <a href="https://github.com/pflanzn"><SiGithub className='si-icon' /> GitHub</a>
                <a href="https://hub.docker.com/u/pflanzn"><SiDocker className='si-icon' /> Docker Hub</a>
            </div>
        </div>
    </footer>
  );
}
