import { useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faHouse,
    faLeaf,
    faCamera,
    faMapMarkerAlt,
    faGear,
    faRightToBracket,
    faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthContext";
import { useShare } from "../context/ShareContext";
import { useConfig } from "../context/ConfigContext";
import { identifyPlantFromImage } from "../services/PlantService";
import { extractErrorMessage } from "../services/apiClient";
import IdentifyResults from "./IdentifyResults";
import { toast } from "react-toastify";
import { useState } from "react";
import "../styles/bottomNav.css";

export default function BottomNav() {
    const location = useLocation();
    const { isLoggedIn, loading } = useAuth();
    const { isShareAccess } = useShare();
    const { authMode, enableLocations: showLocations } = useConfig();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loadingIdentification, setLoadingIdentification] = useState(false);
    const [identifyResults, setIdentifyResults] = useState<
        { species: string; commonName: string; score: string; images: string[] }[] | null
    >(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const navigate = useNavigate();

    const handleAddPlantFromIdentification = (commonName: string, species: string) => {
        const file = pendingFile;
        setIdentifyResults(null);
        setPendingFile(null);
        navigate("/plants", {
            state: { prefillNewPlant: { name: commonName, species, file } },
        });
    };

    const closeIdentifyResults = () => {
        setIdentifyResults(null);
        setPendingFile(null);
    };

    if (isShareAccess) return null;

    const isActive = (path: string) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    const handleIdentifyClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setPendingFile(file);
        setLoadingIdentification(true);
        try {
            const result = await identifyPlantFromImage(file);
            if (!result || result.identified_species.length === 0) {
                toast.warning("No species identified.");
                setPendingFile(null);
                return;
            }
            setIdentifyResults(
                result.identified_species.map((r: any) => ({
                    species: r.scientific_name || "Unknown",
                    commonName: r.common_name || "No common name",
                    score: r.score.toString(),
                    images: r.images,
                })),
            );
        } catch (error) {
            toast.error(extractErrorMessage(error, "Error identifying plant. Please try again."));
            setPendingFile(null);
        } finally {
            setLoadingIdentification(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const showManage = authMode === "no" || isLoggedIn;
    const showLogin = authMode !== "no" && !isLoggedIn && !loading;

    return (
        <>
            <nav className="bottom-nav" aria-label="Bottom navigation">
                <Link to="/" className={`bottom-nav-item ${isActive("/") ? "active" : ""}`} aria-label="Home">
                    <FontAwesomeIcon icon={faHouse} />
                    <span>Home</span>
                </Link>

                <Link
                    to="/plants"
                    className={`bottom-nav-item ${isActive("/plant") ? "active" : ""}`}
                    aria-label="Plants"
                >
                    <FontAwesomeIcon icon={faLeaf} />
                    <span>Plants</span>
                </Link>

                <button
                    className="bottom-nav-item bottom-nav-identify"
                    onClick={handleIdentifyClick}
                    disabled={loadingIdentification}
                    aria-label="Identify a plant from photo"
                >
                    <div className="bottom-nav-identify-circle">
                        <FontAwesomeIcon
                            icon={loadingIdentification ? faSpinner : faCamera}
                            spin={loadingIdentification}
                        />
                    </div>
                </button>

                {showLocations ? (
                    <Link
                        to="/locations"
                        className={`bottom-nav-item ${isActive("/location") ? "active" : ""}`}
                        aria-label="Locations"
                    >
                        <FontAwesomeIcon icon={faMapMarkerAlt} />
                        <span>Locations</span>
                    </Link>
                ) : (
                    <div className="bottom-nav-item bottom-nav-spacer" />
                )}

                {showManage && (
                    <Link
                        to="/manage"
                        className={`bottom-nav-item ${isActive("/manage") ? "active" : ""}`}
                        aria-label="Settings"
                    >
                        <FontAwesomeIcon icon={faGear} />
                        <span>Settings</span>
                    </Link>
                )}
                {showLogin && (
                    <Link
                        to="/login"
                        className={`bottom-nav-item ${isActive("/login") ? "active" : ""}`}
                        aria-label="Login"
                    >
                        <FontAwesomeIcon icon={faRightToBracket} />
                        <span>Login</span>
                    </Link>
                )}
            </nav>

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="image/*"
                onChange={handleFileChange}
            />

            {identifyResults && (
                <IdentifyResults
                    plantId={0}
                    results={identifyResults}
                    onSelectSpecies={closeIdentifyResults}
                    onAddPlant={handleAddPlantFromIdentification}
                    onClose={closeIdentifyResults}
                />
            )}
        </>
    );
}
