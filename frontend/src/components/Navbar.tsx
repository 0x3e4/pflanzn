import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import "../styles/navbar.css";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const navRef = useRef<HTMLElement | null>(null);

    const { user, logout } = useAuth();

    const authMode = import.meta.env.VITE_AUTH_MODE;

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };

        if (menuOpen) {
            document.addEventListener("click", handleClickOutside);
        } else {
            document.removeEventListener("click", handleClickOutside);
        }

        return () => document.removeEventListener("click", handleClickOutside);
    }, [menuOpen]);

    const handleLogout = () => {
        logout();
    };

    return (
        <nav className={`navbar ${isScrolled ? "shrink" : ""}`} ref={navRef}>
            <div className="nav-container">
                <Link to="/" className="nav-logo" onClick={() => setMenuOpen(false)}>
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
                    <Link to="/plants" onClick={() => setMenuOpen(false)}>Plants</Link>

                    {authMode !== "no" && (
                        user ? (
                            <>
                                <Link to="/profile" onClick={() => setMenuOpen(false)}>
                                    Profile
                                </Link>
                                <button className="nav-logout" onClick={handleLogout}>Logout</button>
                            </>
                        ) : (
                            <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
                        )
                    )}
                </div>
            </div>
        </nav>
    );
}