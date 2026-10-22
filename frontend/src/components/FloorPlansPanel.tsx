import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp, faImage, faPlus, faSpinner, faTrash } from "@fortawesome/free-solid-svg-icons";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useAuth } from "../context/AuthContext";
import { useConfig, useUpdateConfig } from "../context/ConfigContext";
import { extractErrorMessage } from "../services/apiClient";
import {
    createFloorPlan,
    deleteFloorPlan,
    fetchFloorPlans,
    replaceFloorPlanImage,
    updateAppSettings,
    updateFloorPlan,
} from "../services/FloorPlanService";
import { FloorPlan } from "../types/FloorPlan";
import "../styles/floorPlan.css";

const ACCEPTED = "image/png,image/jpeg,image/webp,image/heic,image/heif";

export default function FloorPlansPanel() {
    const { floorPlansEnabled, authMode } = useConfig();
    const updateConfig = useUpdateConfig();
    const { user } = useAuth();
    const isAdmin = authMode === "no" || user?.role === "admin";

    const [plans, setPlans] = useState<FloorPlan[]>([]);
    const [loading, setLoading] = useState(floorPlansEnabled);
    const [toggling, setToggling] = useState(false);
    const [newName, setNewName] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [newFile, setNewFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const newFileRef = useRef<HTMLInputElement>(null);
    const replaceRef = useRef<HTMLInputElement>(null);
    const [replaceTarget, setReplaceTarget] = useState<number | null>(null);

    useEffect(() => {
        if (!floorPlansEnabled) return;
        fetchFloorPlans()
            .then(setPlans)
            .catch((error) => toast.error(extractErrorMessage(error, "Failed to load floor plans.")))
            .finally(() => setLoading(false));
    }, [floorPlansEnabled]);

    const handleToggle = async (enabled: boolean) => {
        setToggling(true);
        try {
            const saved = await updateAppSettings({ floor_plans_enabled: enabled });
            if (saved.floor_plans_enabled) setLoading(true);
            updateConfig({ floorPlansEnabled: saved.floor_plans_enabled });
            toast.success(`Floor plans ${saved.floor_plans_enabled ? "enabled" : "disabled"}.`);
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to change the setting."));
        } finally {
            setToggling(false);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim() || !newFile) {
            toast.error("Name and image are required.");
            return;
        }
        setUploading(true);
        try {
            const created = await createFloorPlan(newName.trim(), newAddress.trim(), newFile);
            setPlans([...plans, created]);
            setNewName("");
            setNewAddress("");
            setNewFile(null);
            if (newFileRef.current) newFileRef.current.value = "";
            toast.success("Floor plan added.");
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to upload the floor plan."));
        } finally {
            setUploading(false);
        }
    };

    const saveField = async (plan: FloorPlan, field: "name" | "address", value: string) => {
        const trimmed = value.trim();
        if ((plan[field] ?? "") === trimmed) return;
        if (field === "name" && !trimmed) {
            toast.error("Name is required.");
            return;
        }
        try {
            const updated = await updateFloorPlan(plan.id, {
                [field]: field === "address" && !trimmed ? null : trimmed,
            });
            setPlans(plans.map((p) => (p.id === plan.id ? updated : p)));
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to save."));
        }
    };

    const move = async (index: number, direction: -1 | 1) => {
        const other = index + direction;
        if (other < 0 || other >= plans.length) return;
        const reordered = [...plans];
        [reordered[index], reordered[other]] = [reordered[other], reordered[index]];
        setPlans(reordered);
        try {
            await Promise.all(
                reordered.map((p, i) => (p.sort_order === i ? null : updateFloorPlan(p.id, { sort_order: i }))),
            );
            setPlans(reordered.map((p, i) => ({ ...p, sort_order: i })));
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to reorder."));
        }
    };

    const handleReplace = async (file: File | undefined) => {
        if (!file || replaceTarget === null) return;
        try {
            const updated = await replaceFloorPlanImage(replaceTarget, file);
            setPlans(plans.map((p) => (p.id === updated.id ? updated : p)));
            toast.success("Image replaced. Plant positions were kept.");
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to replace the image."));
        } finally {
            setReplaceTarget(null);
            if (replaceRef.current) replaceRef.current.value = "";
        }
    };

    const handleDelete = async (plan: FloorPlan) => {
        if (!window.confirm(`Delete "${plan.name}"? Its plants stay, but lose their position.`)) return;
        try {
            await deleteFloorPlan(plan.id);
            setPlans(plans.filter((p) => p.id !== plan.id));
            toast.success("Floor plan deleted.");
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to delete."));
        }
    };

    return (
        <div className="users-panel floor-plans-panel">
            <h2>Floor plans</h2>
            <p>Upload a plan of your home and place your plants on it. Only signed-in members can see plans.</p>

            {isAdmin && (
                <label className="manage-setting-row">
                    <input
                        type="checkbox"
                        checked={floorPlansEnabled}
                        disabled={toggling}
                        onChange={(e) => handleToggle(e.target.checked)}
                    />
                    <span>Enable floor plans for everyone</span>
                </label>
            )}

            {!floorPlansEnabled && !isAdmin && <p>An admin has not enabled floor plans.</p>}

            {floorPlansEnabled && (
                <>
                    <div className="floor-plan-new">
                        <h3>Add a floor plan</h3>
                        <input
                            className="profile-editable-input"
                            placeholder="Name (e.g. Ground floor, Balcony)"
                            maxLength={100}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                        <input
                            className="profile-editable-input"
                            placeholder="Address or place (optional)"
                            maxLength={255}
                            value={newAddress}
                            onChange={(e) => setNewAddress(e.target.value)}
                        />
                        <div className="floor-plan-new-actions">
                            <input
                                ref={newFileRef}
                                type="file"
                                accept={ACCEPTED}
                                style={{ display: "none" }}
                                onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                            />
                            <button
                                type="button"
                                className="floor-plan-file-button"
                                onClick={() => newFileRef.current?.click()}
                            >
                                <FontAwesomeIcon icon={faImage} />
                                <span className={newFile ? "" : "is-empty"}>
                                    {newFile ? newFile.name : "Choose image…"}
                                </span>
                            </button>
                            <button
                                type="button"
                                className="add-btn"
                                onClick={handleCreate}
                                disabled={uploading}
                                aria-label="Add floor plan"
                                title="Add floor plan"
                            >
                                <FontAwesomeIcon icon={uploading ? faSpinner : faPlus} spin={uploading} />
                            </button>
                        </div>
                    </div>

                    <input
                        ref={replaceRef}
                        type="file"
                        accept={ACCEPTED}
                        style={{ display: "none" }}
                        onChange={(e) => handleReplace(e.target.files?.[0])}
                    />

                    {loading ? (
                        <Skeleton height={96} count={2} style={{ marginBottom: 12 }} />
                    ) : plans.length === 0 ? (
                        <p>No floor plans yet.</p>
                    ) : (
                        plans.map((plan, index) => (
                            <div key={plan.id} className="floor-plan-card">
                                <img src={`/api/uploads/${plan.image_path}?size=thumb`} alt="" />
                                <div className="floor-plan-card-fields">
                                    <input
                                        className="profile-editable-input"
                                        defaultValue={plan.name}
                                        maxLength={100}
                                        aria-label="Name"
                                        onBlur={(e) => saveField(plan, "name", e.target.value)}
                                    />
                                    <input
                                        className="profile-editable-input"
                                        defaultValue={plan.address ?? ""}
                                        placeholder="Address or place"
                                        maxLength={255}
                                        aria-label="Address or place"
                                        onBlur={(e) => saveField(plan, "address", e.target.value)}
                                    />
                                    <span className="floor-plan-card-meta">
                                        {plan.placements.length} plant{plan.placements.length === 1 ? "" : "s"} placed
                                    </span>
                                    <div className="floor-plan-card-actions">
                                        <button
                                            className="update-btn"
                                            onClick={() => move(index, -1)}
                                            disabled={index === 0}
                                            aria-label="Move up"
                                        >
                                            <FontAwesomeIcon icon={faArrowUp} />
                                        </button>
                                        <button
                                            className="update-btn"
                                            onClick={() => move(index, 1)}
                                            disabled={index === plans.length - 1}
                                            aria-label="Move down"
                                        >
                                            <FontAwesomeIcon icon={faArrowDown} />
                                        </button>
                                        <button
                                            className="update-btn"
                                            onClick={() => {
                                                setReplaceTarget(plan.id);
                                                replaceRef.current?.click();
                                            }}
                                            aria-label="Replace image"
                                            title="Replace image"
                                        >
                                            <FontAwesomeIcon icon={faImage} />
                                        </button>
                                        <button
                                            className="delete-btn"
                                            onClick={() => handleDelete(plan)}
                                            aria-label={`Delete ${plan.name}`}
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </>
            )}
        </div>
    );
}
