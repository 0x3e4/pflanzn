import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import "../styles/navbar.css";
import { useAuth } from "../context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera } from "@fortawesome/free-solid-svg-icons";
import { identifyPlantFromImage } from "../services/PlantService";
import IdentifyResults from "./IdentifyResults";
import { toast } from "react-toastify";

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [identifyResults, setIdentifyResults] = useState<{ species: string; commonName: string; score: string; images: string[] }[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navRef = useRef<HTMLElement | null>(null);
    const { isLoggedIn, loading } = useAuth();
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

    const handleIdentifyClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        await processPlantIdentification(selectedFile);
    };

    const processPlantIdentification = async (file: File) => {
        try {
            // Identify plant directly from uploaded image without saving
            const result = await identifyPlantFromImage(file);

            if (!result || result.identified_species.length === 0) {
                toast.warning("No species identified.");
                return;
            }

            setIdentifyResults(result.identified_species.map((r: any) => ({
                species: r.scientific_name || "Unknown",
                commonName: r.common_name || "No common name",
                score: r.score.toString(),
                images: r.images
            })));
        } catch (error) {
            toast.error("Error identifying plant. Please try again.");
        }
    };

    return (
        <nav className={`navbar ${isScrolled ? "shrink" : ""}`} ref={navRef}>
            <div className="nav-container">
                <Link to="/" className="nav-logo" onClick={() => setMenuOpen(false)}>
                    <img src="/logo_transparent.png" alt="Logo" />
                    Pflanzn
                </Link>

                {/* Identify Button - Left of Hamburger */}
                <button className="identify-btn" onClick={handleIdentifyClick}>
                    <FontAwesomeIcon icon={faCamera} />
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept="image/*"
                    onChange={handleFileChange}
                />

                {/* Hamburger Menu */}
                <button
                    className={`nav-toggle ${menuOpen ? "active" : ""}`}
                    onClick={() => setMenuOpen(!menuOpen)}
                >
                    <span className="hamburger"></span>
                </button>

                <div className={`nav-links ${menuOpen ? "active" : ""}`}>
                    <Link to="/plants" onClick={() => setMenuOpen(false)}>Plants</Link>

                    {!loading && authMode === "local" && (
                        isLoggedIn ? (
                            <Link to="/profile" onClick={() => setMenuOpen(false)}>
                                Profile
                            </Link>
                        ) : (
                            <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
                        )
                    )}
                </div>
            </div>

            {/* Display Identify Results */}
            {identifyResults && (
                <IdentifyResults
                    plantId={0} // No plant ID, just a quick scan
                    results={identifyResults}
                    onSelectSpecies={() => setIdentifyResults(null)} // Just close when selecting
                    onClose={() => setIdentifyResults(null)}
                />
            )}
        </nav>
    );
}