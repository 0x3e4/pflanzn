import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp } from "@fortawesome/free-solid-svg-icons";
import '../styles/scrollToTopButton.css';

export default function ScrollToTopButton() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setVisible(window.scrollY > 100);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <button
            className={`scroll-to-top-btn ${visible ? 'visible' : 'hidden'}`}
            onClick={scrollToTop}
            title="Scroll back to top"
        >
            <FontAwesomeIcon icon={faArrowUp} />
        </button>
    );
}