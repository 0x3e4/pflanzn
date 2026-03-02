import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCompress, faExpand, faFingerprint, faPlus, faUpload } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import {
  createLocation,
  fetchLocations,
  identifyLocationFromImage,
  uploadLocationImage,
} from "../services/LocationService";
import { Location, SpotType } from "../types/Location";
import "../styles/locations.css";

const spotTypeLabels: Record<SpotType, string> = {
  field: "Field",
  public_spot: "Public Spot",
  forest: "Forest",
  meadow: "Meadow",
  other: "Other",
};

const buildMapEmbedUrl = (latitude: number, longitude: number) => {
  const delta = 0.01;
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta]
    .map((value) => value.toFixed(6))
    .join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
};

type LocationSortOption = "updatedDesc" | "updatedAsc" | "createdDesc" | "createdAsc" | "nameAsc" | "nameDesc";
type LocationIdentifyResult = { species: string; commonName: string; score: string; images: string[] };

export default function Locations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<LocationSortOption>("updatedDesc");
  const [isStretched, setIsStretched] = useState(false);
  const [selectedSpotType, setSelectedSpotType] = useState<SpotType | "all">("all");
  const [newLocationImage, setNewLocationImage] = useState<File | null>(null);
  const [modalIdentifyResults, setModalIdentifyResults] = useState<LocationIdentifyResult[] | null>(null);
  const [newLocation, setNewLocation] = useState({
    name: "",
    item_name: "",
    description: "",
    spot_type: "field" as SpotType,
    latitude: "",
    longitude: "",
  });

  const filteredLocations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = locations.filter((location) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        location.name.toLowerCase().includes(normalizedSearch) ||
        (location.item_name || "").toLowerCase().includes(normalizedSearch) ||
        (location.description || "").toLowerCase().includes(normalizedSearch);

      const matchesSpotType = selectedSpotType === "all" || location.spot_type === selectedSpotType;
      return matchesSearch && matchesSpotType;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "updatedAsc":
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        case "createdDesc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "createdAsc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "nameAsc":
          return a.name.localeCompare(b.name);
        case "nameDesc":
          return b.name.localeCompare(a.name);
        case "updatedDesc":
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return sorted;
  }, [locations, searchTerm, selectedSpotType, sortBy]);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const data = await fetchLocations();
      setLocations(data);
    } catch (error) {
      toast.error((error as Error).message || "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const resetModal = () => {
    setNewLocation({
      name: "",
      item_name: "",
      description: "",
      spot_type: "field",
      latitude: "",
      longitude: "",
    });
    setNewLocationImage(null);
    setModalIdentifyResults(null);
    setModalOpen(false);
  };

  const handleModalFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setNewLocationImage(selectedFile);
    setModalIdentifyResults(null);
  };

  const handleIdentifyLocationItem = async () => {
    if (!newLocationImage) {
      toast.error("Please select a photo first.");
      return;
    }

    setIdentifying(true);
    try {
      const result = await identifyLocationFromImage(newLocationImage);

      if (result.identified_species.length === 0) {
        toast.warning("No species identified.");
        return;
      }

      setModalIdentifyResults(
        result.identified_species.map((identified) => ({
          species: identified.scientific_name || "Unknown",
          commonName: identified.common_name || "No common name",
          score: identified.score.toString(),
          images: identified.images || [],
        })),
      );
    } catch (error) {
      toast.error((error as Error).message || "Failed to identify species.");
    } finally {
      setIdentifying(false);
    }
  };

  const handleSelectIdentifiedItem = (species: string, commonName: string) => {
    const nextItemName = commonName && commonName !== "No common name" && commonName !== "Unknown" ? commonName : species;
    setNewLocation((prev) => ({
      ...prev,
      item_name: nextItemName,
    }));
    setModalIdentifyResults(null);
    toast.success(`Item set to "${nextItemName}".`);
  };

  const handleCreateLocation = async () => {
    if (!newLocation.name.trim()) {
      toast.error("Location name is required.");
      return;
    }

    const latitude = newLocation.latitude.trim() === "" ? undefined : Number(newLocation.latitude);
    const longitude = newLocation.longitude.trim() === "" ? undefined : Number(newLocation.longitude);

    if ((latitude !== undefined && Number.isNaN(latitude)) || (longitude !== undefined && Number.isNaN(longitude))) {
      toast.error("Coordinates must be valid numbers.");
      return;
    }

    setSaving(true);
    try {
      const createdLocation = await createLocation({
        name: newLocation.name.trim(),
        item_name: newLocation.item_name.trim() || undefined,
        description: newLocation.description.trim() || undefined,
        spot_type: newLocation.spot_type,
        latitude,
        longitude,
      });

      if (newLocationImage) {
        try {
          const uploadResponse = await uploadLocationImage(createdLocation.id, newLocationImage);
          if (uploadResponse.exif_latitude !== null && uploadResponse.exif_longitude !== null) {
            toast.success("Location created and image uploaded. Coordinates extracted from photo metadata.");
          } else {
            toast.success("Location created and image uploaded.");
          }
        } catch (uploadError) {
          toast.warning(`Location created, but image upload failed: ${(uploadError as Error).message}`);
        }
      } else {
        toast.success("Location created.");
      }

      resetModal();
      await loadLocations();
    } catch (error) {
      toast.error((error as Error).message || "Failed to create location.");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (locationId: number, file: File) => {
    try {
      const response = await uploadLocationImage(locationId, file);
      if (response.exif_latitude !== null && response.exif_longitude !== null) {
        toast.success("Image uploaded. Coordinates extracted from photo metadata.");
      } else {
        toast.success("Image uploaded.");
      }
      await loadLocations();
    } catch (error) {
      toast.error((error as Error).message || "Failed to upload image.");
    }
  };

  return (
    <div className={`container plants-container locations-container${isStretched ? " locations-container--stretched" : ""}`}>
      <div className="locations-header">
        <h1>Locations</h1>
        <div className="locations-header-actions">
          <button
            className="toggle-stretch-btn"
            title={isStretched ? "Collapse container" : "Expand container"}
            onClick={() => setIsStretched(!isStretched)}
          >
            <FontAwesomeIcon icon={isStretched ? faCompress : faExpand} />
          </button>
          <button className="add-location-btn" onClick={() => setModalOpen(true)}>
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="add-location-modal" onClick={resetModal}>
          <div className="add-location-modal-content" onClick={(event) => event.stopPropagation()}>
            <span className="close" onClick={resetModal}>&times;</span>
            <h2>Add Location</h2>
            <p className="modal-subtitle">Use this for herbs, fruits, spices, wild plants, or any field spot.</p>
            <input
              type="text"
              placeholder="Location name"
              value={newLocation.name}
              onChange={(e) => setNewLocation((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Item (optional): e.g. Chamomile, Apple, Rosemary"
              value={newLocation.item_name}
              onChange={(e) => setNewLocation((prev) => ({ ...prev, item_name: e.target.value }))}
            />
            <div className="location-select-grid">
              <select
                value={newLocation.spot_type}
                onChange={(e) => setNewLocation((prev) => ({ ...prev, spot_type: e.target.value as SpotType }))}
              >
                {Object.entries(spotTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <input type="file" accept="image/*" onChange={handleModalFileChange} />
            {newLocationImage && (
              <button className="location-identify-button" onClick={handleIdentifyLocationItem} disabled={identifying || saving}>
                <FontAwesomeIcon icon={faFingerprint} /> {identifying ? "Identifying..." : "Identify Item (Pl@ntNet)"}
              </button>
            )}
            {modalIdentifyResults && (
              <ul className="location-identify-results-list">
                {[...modalIdentifyResults]
                  .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
                  .map((result, index) => (
                    <li
                      key={`${result.species}-${index}`}
                      className="location-identify-item"
                      onClick={() => handleSelectIdentifiedItem(result.species, result.commonName)}
                    >
                      <strong>{result.species}</strong> | {result.commonName} ({parseFloat(result.score).toFixed(2)}%)
                    </li>
                  ))}
              </ul>
            )}
            <div className="location-coord-grid">
              <input
                type="text"
                placeholder="Latitude (optional)"
                value={newLocation.latitude}
                onChange={(e) => setNewLocation((prev) => ({ ...prev, latitude: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Longitude (optional)"
                value={newLocation.longitude}
                onChange={(e) => setNewLocation((prev) => ({ ...prev, longitude: e.target.value }))}
              />
            </div>
            <textarea
              placeholder="Description / notes"
              value={newLocation.description}
              onChange={(e) => setNewLocation((prev) => ({ ...prev, description: e.target.value }))}
            />
            <button onClick={handleCreateLocation} disabled={saving}>
              {saving ? "Saving..." : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="location-filter-sort-bar">
        <div className="location-tag-filter">
          <span
            className={`hashtag ${selectedSpotType === "all" ? "active" : ""}`}
            onClick={() => setSelectedSpotType("all")}
          >
            #all_spots
          </span>
          {Object.entries(spotTypeLabels).map(([value, label]) => (
            <span
              key={value}
              className={`hashtag ${selectedSpotType === value ? "active" : ""}`}
              onClick={() => setSelectedSpotType(value as SpotType)}
            >
              #{label.toLowerCase().replace(/\s+/g, "_")}
            </span>
          ))}
        </div>

        <div className="location-search-container">
          <input
            type="text"
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="location-search-input"
          />
        </div>

        <div className="location-sort-container">
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as LocationSortOption)}
          >
            <option value="updatedDesc">Updated (newest)</option>
            <option value="updatedAsc">Updated (oldest)</option>
            <option value="createdDesc">Created (newest)</option>
            <option value="createdAsc">Created (oldest)</option>
            <option value="nameAsc">Name (A-Z)</option>
            <option value="nameDesc">Name (Z-A)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="locations-empty">Loading locations...</div>
      ) : filteredLocations.length === 0 ? (
        <div className="locations-empty">
          {locations.length === 0
            ? "No locations yet. Add your first one with the + button."
            : "No locations match the current filters."}
        </div>
      ) : (
        <div className="locations-list">
          {filteredLocations.map((location) => {
            const hasCoordinates = location.latitude !== null && location.longitude !== null;
            const coverImage = location.images[0] ? `/api/uploads/${location.images[0].image_path}` : "/placeholder-plant.webp";

            return (
              <article className="location-card" key={location.id}>
                <div className="location-image-container">
                  <img src={coverImage} alt={location.name} className="location-image" loading="lazy" />
                </div>
                <div className="location-card-text">
                  <h3>{location.name}</h3>
                  <p><strong>Field:</strong> {spotTypeLabels[location.spot_type]}</p>
                  {location.item_name ? <p><strong>Item:</strong> {location.item_name}</p> : null}
                  {location.description ? <p className="location-description"><strong>Description:</strong> {location.description}</p> : null}

                  {hasCoordinates && (
                    <div className="location-map-wrap">
                      <iframe
                        title={`Map for ${location.name}`}
                        src={buildMapEmbedUrl(location.latitude as number, location.longitude as number)}
                        className="location-map-frame"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  )}
                </div>
                <div className="location-buttons">
                  <label className="upload-location-btn">
                    <FontAwesomeIcon icon={faUpload} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const selected = e.target.files?.[0];
                        if (selected) {
                          handleUploadImage(location.id, selected);
                        }
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
