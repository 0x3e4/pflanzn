import "../styles/footer.css";
import { SiGithub, SiMastodon, SiDocker, SiLemmy, SiReddit } from '@icons-pack/react-simple-icons';

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
                <a href="#">Changelog - latest</a>
            </div>

            <div className="footer-column">
                <h3>Community</h3>
                <a href="https://wien.rocks/@pflanzn"><SiMastodon className='si-icon' /> Mastodon</a>
                <a href="https://github.com/pflanzn"><SiGithub className='si-icon' /> GitHub</a>
                <a href="https://hub.docker.com/u/pflanzn"><SiDocker className='si-icon' /> Docker Hub</a>
                <a href="https://www.reddit.com/search/?q=%23pflanznapp"><SiReddit className='si-icon' /> Reddit</a>
                <a href="https://lemmy.world/search?q=%23pflanznapp&type=All&listingType=All&page=1&sort=TopAll"><SiLemmy className='si-icon' /> Lemmy</a>
            </div>
        </div>
    </footer>
  );
}