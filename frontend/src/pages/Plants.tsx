import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
    fetchPlants,
    createPlant,
    uploadPlantImage,
    identifyPlant,
    updatePlant,
    identifyPlantFromImage,
    waterPlant,
    archivePlant,
} from "../services/PlantService";
import { Plant } from "../types/Plant";
import { Tag } from "../types/Tag";
import { fetchTags } from "../services/TagService";
import { extractErrorMessage } from "../services/apiClient";
import "../styles/plants.css";
import { toast } from "react-toastify";
import { DateTime } from "luxon";
import IdentifyResults from "../components/IdentifyResults";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUpload,
    faPlus,
    faSeedling,
    faCircleXmark,
    faFingerprint,
    faDroplet,
    faTrashCanArrowUp,
    faLeaf,
    faFont,
    faExpand,
    faCompress,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { setOverlayOpen } from "../services/overlayControl";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { getUiPreferences } from "../config/uiPreferences";

export default function Plants() {
    const [plants, setPlants] = useState<Plant[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [newPlant, setNewPlant] = useState({ name: "", species: "" });
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
    const [archiveModalOpen, setArchiveModalOpen] = useState(false);
    const [unarchiveReason, setUnarchiveReason] = useState("");
    const [selectedPlantToUnarchive, setSelectedPlantToUnarchive] = useState<number | null>(null);
    const [isStretched, setIsStretched] = useState(() => getUiPreferences().defaultWidescreen);
    const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

    type FilterMode = "species" | "name";

    const [filterMode, setFilterMode] = useState<FilterMode>("species");
    const [selectedFilterValue, setSelectedFilterValue] = useState<string | null>(null);

    type SortOption =
        | "lastWateredDesc"
        | "lastWateredAsc"
        | "idDesc"
        | "idAsc"
        | "lastImageUploadedDesc"
        | "lastImageUploadedAsc";

    const [sortBy, setSortBy] = useState<SortOption>("idDesc");

    const [modalIdentifyResults, setModalIdentifyResults] = useState<
        { species: string; commonName: string; score: string; images: string[] }[] | null
    >(null);

    const [plantIdentifyResults, setPlantIdentifyResults] = useState<{
        plantId: number;
        results: { species: string; commonName: string; score: string; images: string[] }[];
    } | null>(null);

    const { isLoggedIn } = useAuth();
    const { tz: timezone, locale } = useConfig();

    const [selectedDateTime, setSelectedDateTime] = useState<string>(
        DateTime.now()
            .setZone(timezone)
            .toISO({ includeOffset: false }) ?? "",
    );

    const [searchTerm, setSearchTerm] = useState<string>("");
    const [searchParams] = useSearchParams();
    const speciesFilter = searchParams.get("species");
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        fetchPlantsFromService();
        fetchTagsFromService();
    }, []);

    useEffect(() => {
        if (speciesFilter) {
            setFilterMode("species");
            setSelectedFilterValue(speciesFilter);
            setSelectedTagId(null);
        }
    }, [speciesFilter]);

    // Open the add-plant modal pre-filled when navigated here from the camera-icon
    // identification flow (Navbar/BottomNav passes name+species via router state).
    useEffect(() => {
        const prefill = (
            location.state as {
                prefillNewPlant?: { name: string; species: string; file?: File | null };
            } | null
        )?.prefillNewPlant;
        if (prefill) {
            setNewPlant({ name: prefill.name || "", species: prefill.species || "" });
            setFile(prefill.file ?? null);
            setModalOpen(true);
            // Clear the state so a refresh / back-nav doesn't re-trigger.
            navigate(location.pathname + location.search, { replace: true, state: null });
        }
    }, [location.state]);

    useEffect(() => {
        if (plants.length === 0) {
            setLoadedImages(new Set());
        }
    }, [plants.length]);

    const handleImageLoad = (plantId: number) => {
        setLoadedImages((prev) => new Set(prev).add(plantId));
    };

    const handleImageError = (plantId: number) => {
        setLoadedImages((prev) => new Set(prev).add(plantId));
    };

    const fetchPlantsFromService = async () => {
        try {
            const data = await fetchPlants();
            setPlants(data);
        } catch (err) {
            toast.error((err as Error).message);
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTagsFromService = async () => {
        try {
            const tags = await fetchTags();
            setAllTags(tags);
        } catch (err) {
            toast.error((err as Error).message);
        }
    };

    const resetModal = () => {
        setNewPlant({ name: "", species: "" });
        setFile(null);
        setModalIdentifyResults(null);
        setModalOpen(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        setFile(selectedFile);
        setModalIdentifyResults(null);
    };

    const handleCreatePlant = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to add plants.");
            return;
        }

        try {
            const createdPlant = await createPlant(newPlant.name, newPlant.species);
            toast.success("Plant created!");

            if (file) {
                await uploadPlantImage(createdPlant.id, file);
                toast.success("Image uploaded!");
            }

            fetchPlantsFromService();
            resetModal();
        } catch (err) {
            toast.error((err as Error).message);
        }
    };

    const handleWaterPlant = async (plantId: number) => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to water plants.");
            return;
        }

        // Convert current local time to UTC before sending
        const currentDateTimeUTC = DateTime.now().toUTC().toISO({ includeOffset: false });

        try {
            await waterPlant(plantId, { watered_at: currentDateTimeUTC });

            const currentDateTimeLocale = DateTime.fromISO(currentDateTimeUTC, { zone: "utc" })
                .setZone(timezone)
                .toISO({ includeOffset: false });

            // Update only the specific plant's data without refetching everything
            setPlants((prevPlants) =>
                prevPlants.map((plant) =>
                    plant.id === plantId ? { ...plant, last_watered: currentDateTimeLocale } : plant,
                ),
            );

            toast.success(`Plant watered!`);
        } catch (err) {
            toast.error((err as Error).message);
        }
    };

    const handleUnarchivePlant = async () => {
        if (!isLoggedIn || selectedPlantToUnarchive === null) {
            toast.error("You must be logged in to restore plants.");
            return;
        }

        try {
            await archivePlant(selectedPlantToUnarchive, false, unarchiveReason);
            toast.success("Plant restored from archive!");
            fetchPlantsFromService();
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setArchiveModalOpen(false);
            setUnarchiveReason("");
            setSelectedPlantToUnarchive(null);
        }
    };

    const handleIdentifyExistingPlant = async (plantId: number) => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to identify plants.");
            return;
        }

        setLoading(true);

        try {
            const result = await identifyPlant(plantId);

            if (result.identified_species.length === 0) {
                toast.warning("No species found.");
                return;
            }

            setPlantIdentifyResults({
                plantId,
                results: result.identified_species.map((r: any) => ({
                    species: r.scientific_name || "Unknown",
                    commonName: r.common_name || "No common name",
                    score: r.score.toString(),
                    images: r.images,
                })),
            });
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    // Water the plant (log watering date)
    const handleWaterVisiblePlants = async () => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to water plants.");
            return;
        }

        if (filteredPlants.length === 0) {
            toast.warning("No plants to water.");
            return;
        }

        try {
            // Convert the user's selected local time to UTC for storage
            const wateringDateTimeUTC = DateTime.fromISO(selectedDateTime, { zone: timezone })
                .toUTC()
                .toISO({ includeOffset: false });

            for (const plant of filteredPlants) {
                await waterPlant(plant.id, { watered_at: wateringDateTimeUTC });
            }
            toast.success(`Watered ${filteredPlants.length} plants!`);
            fetchPlantsFromService();
        } catch (error) {
            toast.error((error as Error).message || "Failed to water plants.");
        }
    };

    const handleUploadImageForPlant = async (plantId: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isLoggedIn) {
            toast.error("You must be logged in to add images to plants.");
            return;
        }

        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await uploadPlantImage(plantId, file);
            toast.success("Image uploaded!");
            fetchPlantsFromService();
        } catch (err) {
            toast.error((err as Error).message);
        }
    };

    const handleIdentifyPlant = async () => {
        if (!file) return toast.error("Please select a file first.");

        try {
            const result = await identifyPlantFromImage(file);

            if (result.identified_species.length === 0) {
                toast.warning("No species identified.");
                return;
            }

            setModalIdentifyResults(
                result.identified_species.map((r: any) => ({
                    species: r.scientific_name || "Unknown",
                    commonName: r.common_name || "No common name",
                    score: r.score.toString(),
                    images: r.images,
                })),
            );
        } catch (err) {
            toast.error(extractErrorMessage(err, "Error identifying plant. Please try again."));
        }
    };

    const handleSelectSpecies = (species: string, commonName: string) => {
        setNewPlant({ name: commonName, species: species });
        setModalIdentifyResults(null);
    };

    const handleSelectSpeciesForExistingPlant = async (plantId: number, name: string, species: string) => {
        await updatePlant(plantId, { name, species });
        fetchPlantsFromService();
        setPlantIdentifyResults(null);
        toast.success(`Plant updated to ${name} (${species})`);
    };

    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const filteredPlants = plants
        .filter((p) => {
            const matchesTag =
                selectedTagId === -1
                    ? p.is_archived
                    : selectedTagId === -2
                      ? !p.is_archived && (!p.tags || p.tags.length === 0)
                      : selectedTagId === null
                        ? !p.is_archived
                        : !p.is_archived && p.tags?.some((t) => t.id === selectedTagId);

            const filterValue = filterMode === "species" ? p.species : p.name;
            const matchesFilterValue = !selectedFilterValue || filterValue === selectedFilterValue;

            const matchesSearch =
                !searchTerm ||
                p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.species?.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesTag && matchesFilterValue && matchesSearch;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case "idAsc":
                    return a.id - b.id;
                case "idDesc":
                    return b.id - a.id;
                case "lastWateredDesc":
                    return new Date(b.last_watered || 0).getTime() - new Date(a.last_watered || 0).getTime();
                case "lastWateredAsc":
                    return new Date(a.last_watered || 0).getTime() - new Date(b.last_watered || 0).getTime();
                case "lastImageUploadedDesc":
                    return (
                        new Date(
                            (b.images.length > 0
                                ? b.images.reduce((latest, img) =>
                                      new Date(img.uploaded_at) > new Date(latest.uploaded_at) ? img : latest,
                                  )
                                : { uploaded_at: 0 }
                            ).uploaded_at,
                        ).getTime() -
                        new Date(
                            (a.images.length > 0
                                ? a.images.reduce((latest, img) =>
                                      new Date(img.uploaded_at) > new Date(latest.uploaded_at) ? img : latest,
                                  )
                                : { uploaded_at: 0 }
                            ).uploaded_at,
                        ).getTime()
                    );
                case "lastImageUploadedAsc":
                    return (
                        new Date(
                            (a.images.length > 0
                                ? a.images.reduce((latest, img) =>
                                      new Date(img.uploaded_at) > new Date(latest.uploaded_at) ? img : latest,
                                  )
                                : { uploaded_at: 0 }
                            ).uploaded_at,
                        ).getTime() -
                        new Date(
                            (b.images.length > 0
                                ? b.images.reduce((latest, img) =>
                                      new Date(img.uploaded_at) > new Date(latest.uploaded_at) ? img : latest,
                                  )
                                : { uploaded_at: 0 }
                            ).uploaded_at,
                        ).getTime()
                    );
                default:
                    return 0;
            }
        });

    useEffect(() => {
        if (modalOpen || plantIdentifyResults || selectedImage || archiveModalOpen) {
            setOverlayOpen(true);
        } else {
            setOverlayOpen(false);
        }
    }, [modalOpen, plantIdentifyResults, selectedImage, archiveModalOpen]);

    if (error) return <p style={{ color: "red" }}>{error}</p>;

    return (
        <div className={`container plants-container${isStretched ? " plants-container--stretched" : ""}`}>
            <div className="plants-header">
                <h1>Plants</h1>
                <button
                    className="toggle-stretch-btn"
                    title={isStretched ? "Collapse container" : "Expand container"}
                    onClick={() => setIsStretched(!isStretched)}
                >
                    <FontAwesomeIcon icon={isStretched ? faCompress : faExpand} />
                </button>
                {isLoggedIn ? (
                    <button className="add-plant-btn" onClick={() => setModalOpen(true)}>
                        <FontAwesomeIcon icon={faPlus} />
                    </button>
                ) : (
                    <button
                        className="add-plant-btn"
                        onClick={() => toast.warning("You must be logged in to add plants.")}
                    >
                        <FontAwesomeIcon icon={faPlus} />
                    </button>
                )}
            </div>

            <div className="plant-filter-sort-bar">
                <div className="plant-tag-filter">
                    {loading ? (
                        [...Array(6)].map((_, index) => (
                            <Skeleton key={index} width={80} height={28} borderRadius={999} />
                        ))
                    ) : (
                        <>
                            <span
                                className={`hashtag ${selectedTagId === null ? "active" : ""}`}
                                onClick={() => setSelectedTagId(null)}
                            >
                                #all
                            </span>
                            {allTags.map((tag) => (
                                <span
                                    key={tag.id}
                                    className={`hashtag ${selectedTagId === tag.id ? "active" : ""}`}
                                    onClick={() => setSelectedTagId(tag.id)}
                                >
                                    #{tag.name}
                                </span>
                            ))}
                            {plants.some((p) => !p.is_archived && (!p.tags || p.tags.length === 0)) && (
                                <span
                                    className={`hashtag ${selectedTagId === -2 ? "active" : ""}`}
                                    onClick={() => setSelectedTagId(-2)}
                                >
                                    #untagged
                                </span>
                            )}
                            <span
                                className={`hashtag hashtag-archive ${selectedTagId === -1 ? "active" : ""}`}
                                onClick={() => setSelectedTagId(-1)}
                            >
                                #archive
                            </span>
                        </>
                    )}
                </div>

                <div className="water-plant-input-container">
                    {isLoggedIn ? (
                        <>
                            <button className="water-plant-btn" onClick={handleWaterVisiblePlants}>
                                <FontAwesomeIcon icon={faDroplet} /> Water Plants
                            </button>
                        </>
                    ) : (
                        <button
                            className="water-plant-btn"
                            onClick={() => toast.warning("You must be logged in to water plants.")}
                        >
                            <FontAwesomeIcon icon={faDroplet} /> Water Plants
                        </button>
                    )}
                    <div className="water-plant-datetime">
                        <input
                            type="datetime-local"
                            value={selectedDateTime.slice(0, 16)}
                            onChange={(e) => setSelectedDateTime(e.target.value)}
                        />
                    </div>
                </div>

                <div className="plant-search-container">
                    <input
                        type="text"
                        placeholder="Search plants..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="plant-search-input"
                    />
                </div>

                <div className="filter-specie-name-container">
                    <div className="plant-filter-toggle">
                        <FontAwesomeIcon
                            icon={filterMode === "species" ? faFont : faLeaf}
                            title={`Filter by ${filterMode === "species" ? "name" : "species"}`}
                            onClick={() => setFilterMode(filterMode === "species" ? "name" : "species")}
                            className="filter-toggle-icon"
                        />
                    </div>

                    <div className="plant-filter-dropdown">
                        <select
                            value={selectedFilterValue || ""}
                            onChange={(e) => setSelectedFilterValue(e.target.value || null)}
                        >
                            <option value="">All {filterMode === "species" ? "Species" : "Names"}</option>
                            {[
                                ...new Set(
                                    plants
                                        .filter((p) => selectedTagId === -1 || !p.is_archived) // Only show options if not archived unless archive is active
                                        .map((p) => (filterMode === "species" ? p.species : p.name))
                                        .filter(Boolean),
                                ),
                            ]
                                .sort()
                                .map((value, idx) => (
                                    <option key={idx} value={value}>
                                        {value}
                                    </option>
                                ))}
                        </select>
                    </div>
                </div>

                <div className="plant-sort-container">
                    <select id="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
                        <option value="idDesc">Newest</option>
                        <option value="idAsc">Oldest</option>
                        <option value="lastWateredDesc">Newest Watering ↓</option>
                        <option value="lastWateredAsc">Oldest Watering ↑</option>
                        <option value="lastImageUploadedDesc">Newest Image ↓</option>
                        <option value="lastImageUploadedAsc">Oldest Image ↑</option>
                    </select>
                </div>
            </div>

            <div className="plants-list">
                {loading
                    ? [...Array(8)].map((_, index) => (
                          <div key={`plant-card-skeleton-${index}`} className="plant-card">
                              <div className="plant-image-container all-plants">
                                  <Skeleton height="100%" width="100%" className="plant-image-skeleton" />
                              </div>
                              <div className="plant-card-text">
                                  <h3>
                                      <Skeleton width="70%" />
                                  </h3>
                                  <small>
                                      <Skeleton width={40} />
                                  </small>
                                  <p>
                                      <Skeleton width="80%" />
                                  </p>
                                  <p>
                                      <Skeleton width="90%" />
                                  </p>
                              </div>
                          </div>
                      ))
                    : filteredPlants.map((plant) => {
                          const sortedImages = [...(plant.images || [])].sort(
                              (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
                          );
                          const latestImage = sortedImages[0] || null;
                          const imageLoaded = loadedImages.has(plant.id);

                          const lastWateredText = plant.last_watered
                              ? new Date(plant.last_watered).toLocaleString(locale, {
                                    timeZone: timezone,
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })
                              : "Not watered yet";
                          return (
                              <div key={plant.id} className={`plant-card ${plant.is_archived ? "archived" : ""}`}>
                                  <Link to={`/plant/${plant.id}`}>
                                      <div className="plant-image-container all-plants">
                                          {!imageLoaded && (
                                              <Skeleton
                                                  height="100%"
                                                  width="100%"
                                                  baseColor="#444"
                                                  highlightColor="#666"
                                                  className="plant-image-skeleton"
                                              />
                                          )}
                                          <img
                                              src={
                                                  latestImage
                                                      ? `/api/uploads/${latestImage.image_path}?size=thumb`
                                                      : "/placeholder-plant.webp"
                                              }
                                              alt={plant.name}
                                              className="plant-image"
                                              loading="lazy"
                                              style={{ visibility: imageLoaded ? "visible" : "hidden", opacity: imageLoaded ? 1 : 0 }}
                                              onLoad={() => handleImageLoad(plant.id)}
                                              onError={() => handleImageError(plant.id)}
                                          />
                                      </div>
                                      <div className="plant-card-text">
                                          <h3>{plant.name || "Unknown"}</h3>
                                          <small>#{plant.id}</small>
                                          <p>
                                              <strong>Species:</strong> {plant.species || "Unknown"}
                                          </p>
                                          <p>
                                              <strong>Last Watered:</strong> {lastWateredText}
                                          </p>
                                      </div>
                                  </Link>
                                  {!plant.is_archived ? (
                                      <div className="plant-buttons">
                                          {isLoggedIn ? (
                                              <>
                                                  <button
                                                      className="water-plant-btn"
                                                      onClick={() => handleWaterPlant(plant.id)}
                                                  >
                                                      <FontAwesomeIcon icon={faDroplet} />
                                                  </button>
                                                  <input
                                                      type="file"
                                                      id={`file-upload-${plant.id}`}
                                                      className="file-input"
                                                      onChange={(e) => handleUploadImageForPlant(plant.id, e)}
                                                  />
                                                  <button
                                                      className="file-input-plant-btn"
                                                      onClick={() =>
                                                          document.getElementById(`file-upload-${plant.id}`)?.click()
                                                      }
                                                  >
                                                      <FontAwesomeIcon icon={faUpload} />
                                                  </button>
                                                  <button onClick={() => handleIdentifyExistingPlant(plant.id)}>
                                                      <FontAwesomeIcon icon={faFingerprint} />
                                                  </button>
                                              </>
                                          ) : (
                                              <>
                                                  <button
                                                      className="water-plant-btn"
                                                      onClick={() =>
                                                          toast.warning("You must be logged in to water plants.")
                                                      }
                                                  >
                                                      <FontAwesomeIcon icon={faDroplet} />
                                                  </button>
                                                  <button
                                                      className="file-input-plant-btn"
                                                      onClick={() =>
                                                          toast.warning("You must be logged in to upload images.")
                                                      }
                                                  >
                                                      <FontAwesomeIcon icon={faUpload} />
                                                  </button>
                                                  <button
                                                      onClick={() =>
                                                          toast.warning("You must be logged in to identify plants.")
                                                      }
                                                  >
                                                      <FontAwesomeIcon icon={faFingerprint} />
                                                  </button>
                                              </>
                                          )}
                                      </div>
                                  ) : (
                                      <div className="plant-buttons">
                                          {isLoggedIn ? (
                                              <button
                                                  className="archive-plant-btn"
                                                  onClick={() => {
                                                      setSelectedPlantToUnarchive(plant.id);
                                                      setArchiveModalOpen(true);
                                                  }}
                                              >
                                                  <FontAwesomeIcon icon={faTrashCanArrowUp} />
                                              </button>
                                          ) : (
                                              <button
                                                  className="archive-plant-btn"
                                                  onClick={() =>
                                                      toast.warning("You must be logged in to restore plants.")
                                                  }
                                              >
                                                  <FontAwesomeIcon icon={faTrashCanArrowUp} />
                                              </button>
                                          )}
                                      </div>
                                  )}
                              </div>
                          );
                      })}
            </div>

            {modalOpen && (
                <div className="add-plant-modal" onClick={resetModal}>
                    <div className="add-plant-modal-content" onClick={(e) => e.stopPropagation()}>
                        <span className="close" onClick={resetModal}>
                            &times;
                        </span>
                        <h2>Add Plant</h2>
                        <input
                            type="text"
                            placeholder="Name"
                            value={newPlant.name}
                            onChange={(e) => setNewPlant({ ...newPlant, name: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Species"
                            value={newPlant.species}
                            onChange={(e) => setNewPlant({ ...newPlant, species: e.target.value })}
                        />
                        <div
                            className="file-input-row"
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                        >
                            <span className="file-input-button">Browse…</span>
                            <span className={`file-input-name ${file ? "" : "is-empty"}`}>
                                {file ? file.name : "No file selected"}
                            </span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileChange}
                                style={{ display: "none" }}
                            />
                        </div>
                        {file && (
                            <button className="modal-identify-button" onClick={handleIdentifyPlant}>
                                <FontAwesomeIcon icon={faFingerprint} /> Identify Plant
                            </button>
                        )}
                        {modalIdentifyResults && (
                            <ul className="identify-results-list">
                                {modalIdentifyResults.map((r, i) => (
                                    <li
                                        key={i}
                                        className="species-item"
                                        onClick={() => handleSelectSpecies(r.species, r.commonName)}
                                    >
                                        {/* Name & Percentage in the Same Row */}
                                        <div className="species-header">
                                            <div className="species-name">
                                                <strong>{r.species}</strong>
                                                <br />
                                                <span>{r.commonName || "No common name"}</span>
                                            </div>
                                            <div className="species-percentage">
                                                <span>{parseFloat(r.score).toFixed(2)}%</span>
                                            </div>
                                        </div>

                                        {/* Display related images below */}
                                        {Array.isArray(r.images) && r.images.length > 0 && (
                                            <div className="species-images">
                                                {r.images.map((imageUrl, i) => (
                                                    <div key={i} className="image-container">
                                                        <img
                                                            src={imageUrl}
                                                            alt={`Related ${r.species}`}
                                                            className="species-image"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedImage(imageUrl);
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="modal-buttons modal-plant-buttons">
                            <button className="modal-create-button" onClick={handleCreatePlant}>
                                <FontAwesomeIcon icon={faSeedling} /> Add Plant
                            </button>
                            <button className="modal-cancel-button" onClick={resetModal}>
                                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {plantIdentifyResults && (
                <IdentifyResults
                    plantId={plantIdentifyResults.plantId}
                    results={plantIdentifyResults.results}
                    onSelectSpecies={handleSelectSpeciesForExistingPlant}
                    onClose={() => setPlantIdentifyResults(null)}
                />
            )}

            {/* Large image preview modal */}
            {selectedImage && (
                <div className="image-modal" onClick={() => setSelectedImage(null)}>
                    <div className="image-modal-content">
                        <img src={selectedImage} alt="Full-sized" />
                    </div>
                </div>
            )}

            {/* Archive Confirmation Modal */}
            {archiveModalOpen && (
                <div className="archive-plant-modal-overlay">
                    <div className="archive-plant-modal">
                        <p>Are you sure you want to restore this plant?</p>

                        <div
                            className="editable-div"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(e) => setUnarchiveReason((e.target as HTMLDivElement).innerText)}
                            dangerouslySetInnerHTML={{
                                __html: unarchiveReason || "e.g. Reason for restoration (optional)",
                            }}
                            onFocus={(e) => {
                                if (e.currentTarget.innerText === "e.g. Reason for restoration (optional)") {
                                    e.currentTarget.innerText = "";
                                }
                            }}
                        />

                        <div className="archive-plant-modal-buttons">
                            <button className="archive-plant-confirm" onClick={handleUnarchivePlant}>
                                <FontAwesomeIcon icon={faTrashCanArrowUp} /> Restore
                            </button>
                            <button className="archive-plant-cancel" onClick={() => setArchiveModalOpen(false)}>
                                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
