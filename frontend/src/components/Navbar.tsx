import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/navbar.css";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`navbar ${isScrolled ? "shrink" : ""}`}>
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <img src="/logo_transparent.png" alt="Logo" />
          Pflanzn
        </Link>
        <button
          className={`nav-toggle ${menuOpen ? "active" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="hamburger"></span>
        </button>
        <div className={`nav-links ${menuOpen ? "active" : ""}`}>
          <Link to="/plants">Plants</Link>
        </div>
      </div>
    </nav>
  );
}