import "../styles/footer.css";
import { SiGithub, SiMastodon } from '@icons-pack/react-simple-icons';

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
                <h3>Resources</h3>
                <a href="#">Documentation</a>
            </div>

            <div className="footer-column">
                <h3>Pflanzn</h3>
                <a href="/about">About</a>
                <a href="#">Changelog - v1.0.0</a>
            </div>

            <div className="footer-column">
                <h3>Community</h3>
                <a href="#"><SiGithub className='si-icon' /> GitHub</a>
                <a href="#"><SiMastodon className='si-icon' /> Mastodon</a>
            </div>
        </div>
    </footer>
  );
}