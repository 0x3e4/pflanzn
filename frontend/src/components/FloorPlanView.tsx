import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowUpRightFromSquare,
    faCheck,
    faDroplet,
    faMagnifyingGlassMinus,
    faMagnifyingGlassPlus,
    faPen,
    faTrash,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FloorPlan } from "../types/FloorPlan";
import { Plant } from "../types/Plant";
import { usePanZoom } from "../hooks/usePanZoom";
import { useModalA11y } from "../hooks/useModalA11y";
import { placePlant, unplacePlant } from "../services/FloorPlanService";
import { extractErrorMessage } from "../services/apiClient";
import {
    formatLastWateredShort,
    formatWateringDue,
    getWateringStatus,
    wateringBadgeVariant,
} from "../services/wateringSchedule";
import "../styles/floorPlan.css";

type MarkerStatus = "due" | "soon" | "ok" | "none";

const LONG_PRESS_MS = 350;
const DRAG_SLOP_PX = 8;

interface FloorPlanViewProps {
    plans: FloorPlan[];
    // Plants that pass the page filters — these get markers.
    plants: Plant[];
    // Every plant, for the placement tray and lookups.
    allPlants: Plant[];
    timezone: string;
    canEdit: boolean;
    canManage: boolean;
    selectedPlanId: number | null;
    onSelectPlan: (planId: number) => void;
    onPlansChange: (plans: FloorPlan[]) => void;
    onWater: (plantIds: number[]) => Promise<void>;
    // Opened from a plant page: start placing / highlight this plant.
    placePlantId?: number | null;
    focusPlantId?: number | null;
}

const latestThumb = (plant: Plant): string | null => {
    const latest = [...(plant.images || [])].sort(
        (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
    )[0];
    return latest ? `/api/uploads/${latest.image_path}?size=thumb` : null;
};

export default function FloorPlanView({
    plans,
    plants,
    allPlants,
    timezone,
    canEdit,
    canManage,
    selectedPlanId,
    onSelectPlan,
    onPlansChange,
    onWater,
    placePlantId = null,
    focusPlantId = null,
}: FloorPlanViewProps) {
    const plan = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null;
    const viewportRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const { state: view, zoomBy, reset, wasGesture, releasePointer, handlers } = usePanZoom(viewportRef);

    const [editMode, setEditMode] = useState(Boolean(placePlantId) && canEdit);
    const [placingPlantId, setPlacingPlantId] = useState<number | null>(canEdit ? placePlantId : null);
    const [sheetPlantId, setSheetPlantId] = useState<number | null>(focusPlantId);
    const [trayFilter, setTrayFilter] = useState("");
    const [drag, setDrag] = useState<{ plantId: number; x: number; y: number } | null>(null);
    const [watering, setWatering] = useState(false);
    const longPress = useRef<{ timer: number; pointerId: number; start: { x: number; y: number } } | null>(null);

    const closeSheet = useCallback(() => setSheetPlantId(null), []);
    const { modalRef } = useModalA11y({ isOpen: sheetPlantId !== null, onClose: closeSheet });

    useEffect(() => reset(), [plan?.id, reset]);

    const plantsById = useMemo(() => new Map(allPlants.map((p) => [p.id, p])), [allPlants]);
    const visibleIds = useMemo(() => new Set(plants.map((p) => p.id)), [plants]);
    const placedIds = useMemo(() => new Set(plans.flatMap((p) => p.placements.map((pl) => pl.plant_id))), [plans]);

    const markers = useMemo(
        () =>
            (plan?.placements ?? [])
                .filter((pl) => visibleIds.has(pl.plant_id) || pl.plant_id === focusPlantId)
                .map((pl) => {
                    const plant = plantsById.get(pl.plant_id);
                    if (!plant) return null;
                    const status = getWateringStatus(plant, timezone);
                    const variant: MarkerStatus = status ? wateringBadgeVariant(status) : "none";
                    return { placement: pl, plant, status, variant };
                })
                .filter((m): m is NonNullable<typeof m> => m !== null),
        [plan, visibleIds, plantsById, timezone, focusPlantId],
    );

    const dueOnPlan = markers.filter((m) => m.status?.needsWater).map((m) => m.plant.id);
    const trayPlants = allPlants.filter(
        (p) =>
            !p.is_archived &&
            !placedIds.has(p.id) &&
            (!trayFilter || p.name.toLowerCase().includes(trayFilter.toLowerCase())),
    );

    const setPlacement = (plantId: number, x: number, y: number | null) => {
        onPlansChange(
            plans.map((p) => {
                const others = p.placements.filter((pl) => pl.plant_id !== plantId);
                return p.id === plan?.id && y !== null
                    ? { ...p, placements: [...others, { plant_id: plantId, x, y }] }
                    : { ...p, placements: others };
            }),
        );
    };

    const pointToPlan = (clientX: number, clientY: number) => {
        const rect = contentRef.current?.getBoundingClientRect();
        if (!rect) return null;
        return {
            x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
        };
    };

    const savePlacement = async (plantId: number, x: number, y: number) => {
        if (!plan) return;
        const previous = plans;
        setPlacement(plantId, x, y);
        try {
            await placePlant(plan.id, plantId, x, y);
        } catch (error) {
            onPlansChange(previous);
            toast.error(extractErrorMessage(error, "Could not save the position."));
        }
    };

    const handlePlanClick = (e: React.MouseEvent) => {
        if (wasGesture() || !editMode || placingPlantId === null) return;
        const point = pointToPlan(e.clientX, e.clientY);
        if (!point) return;
        const plantId = placingPlantId;
        setPlacingPlantId(null);
        savePlacement(plantId, point.x, point.y);
    };

    const handleRemove = async (plantId: number) => {
        const previous = plans;
        setPlacement(plantId, 0, null);
        setSheetPlantId(null);
        try {
            await unplacePlant(plantId);
        } catch (error) {
            onPlansChange(previous);
            toast.error(extractErrorMessage(error, "Could not remove the plant from the plan."));
        }
    };

    const handleWater = async (plantIds: number[]) => {
        setWatering(true);
        try {
            await onWater(plantIds);
        } finally {
            setWatering(false);
        }
    };

    // Edit mode: long-press a marker, then drag it. A quick move is a pan instead.
    const onMarkerPointerDown = (e: React.PointerEvent<HTMLButtonElement>, plantId: number) => {
        if (!editMode) return;
        const target = e.currentTarget;
        const pointerId = e.pointerId;
        const timer = window.setTimeout(() => {
            longPress.current = null;
            releasePointer(pointerId);
            target.setPointerCapture?.(pointerId);
            navigator.vibrate?.(10);
            const pl = plan?.placements.find((p) => p.plant_id === plantId);
            if (pl) setDrag({ plantId, x: pl.x, y: pl.y });
        }, LONG_PRESS_MS);
        longPress.current = { timer, pointerId, start: { x: e.clientX, y: e.clientY } };
    };

    const onMarkerPointerMove = (e: React.PointerEvent) => {
        const pending = longPress.current;
        if (pending && Math.hypot(e.clientX - pending.start.x, e.clientY - pending.start.y) > DRAG_SLOP_PX) {
            window.clearTimeout(pending.timer);
            longPress.current = null;
        }
        if (drag) {
            e.stopPropagation();
            const point = pointToPlan(e.clientX, e.clientY);
            if (point) setDrag({ ...drag, ...point });
        }
    };

    const onMarkerPointerUp = (e: React.PointerEvent) => {
        if (longPress.current) {
            window.clearTimeout(longPress.current.timer);
            longPress.current = null;
        }
        if (drag) {
            e.stopPropagation();
            savePlacement(drag.plantId, drag.x, drag.y);
            setDrag(null);
        }
    };

    if (!plan) {
        return (
            <div className="floor-plan-empty">
                <p>No floor plans yet.</p>
                {canManage && (
                    <p>
                        Upload one under <Link to="/manage?section=floorplans">Manage → Floor plans</Link>.
                    </p>
                )}
            </div>
        );
    }

    const sheetPlant = sheetPlantId !== null ? plantsById.get(sheetPlantId) : undefined;
    const sheetStatus = sheetPlant ? getWateringStatus(sheetPlant, timezone) : null;
    const placingPlant = placingPlantId !== null ? plantsById.get(placingPlantId) : undefined;
    const ratio = plan.width / plan.height;
    const showLabels = view.scale >= 1.5 || editMode;

    return (
        <div className="floor-plan">
            <div className="floor-plan-toolbar">
                {plans.length > 1 && (
                    <div className="floor-plan-tabs" role="tablist" aria-label="Floor plans">
                        {plans.map((p) => (
                            <button
                                key={p.id}
                                role="tab"
                                aria-selected={p.id === plan.id}
                                className={p.id === plan.id ? "active" : ""}
                                onClick={() => onSelectPlan(p.id)}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                )}
                <div className="floor-plan-actions">
                    {!editMode && dueOnPlan.length > 0 && canEdit && (
                        <button
                            className="floor-plan-water-due"
                            onClick={() => handleWater(dueOnPlan)}
                            disabled={watering}
                        >
                            <FontAwesomeIcon icon={faDroplet} /> Water {dueOnPlan.length} due
                        </button>
                    )}
                    {canEdit && (
                        <button
                            className={`floor-plan-edit${editMode ? " active" : ""}`}
                            onClick={() => {
                                setEditMode(!editMode);
                                setPlacingPlantId(null);
                            }}
                            aria-pressed={editMode}
                        >
                            <FontAwesomeIcon icon={editMode ? faCheck : faPen} /> {editMode ? "Done" : "Edit"}
                        </button>
                    )}
                </div>
            </div>
            {plan.address && <p className="floor-plan-address">{plan.address}</p>}

            <div
                ref={viewportRef}
                className={`floor-plan-viewport${placingPlant ? " placing" : ""}`}
                style={{
                    aspectRatio: `${plan.width} / ${plan.height}`,
                    width: `min(100%, calc((100dvh - 260px) * ${ratio}))`,
                }}
                {...handlers}
            >
                <div
                    ref={contentRef}
                    className="floor-plan-content"
                    style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
                    onClick={handlePlanClick}
                >
                    <img
                        src={`/api/uploads/${plan.image_path}?size=${view.scale > 1.5 ? "original" : "medium"}`}
                        alt={`Floor plan: ${plan.name}`}
                        draggable={false}
                    />
                    {markers.map(({ placement, plant, status, variant }) => {
                        const position = drag?.plantId === plant.id ? drag : placement;
                        const thumb = latestThumb(plant);
                        return (
                            <button
                                key={plant.id}
                                type="button"
                                className={`plan-marker plan-marker--${variant}${drag?.plantId === plant.id ? " dragging" : ""}${
                                    plant.id === focusPlantId ? " focused" : ""
                                }`}
                                style={{
                                    left: `${position.x * 100}%`,
                                    top: `${position.y * 100}%`,
                                    transform: `translate(-50%, -50%) scale(${1 / view.scale})`,
                                }}
                                aria-label={`${plant.name}: ${status ? formatWateringDue(status) : "no watering schedule"}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!wasGesture() && !drag) setSheetPlantId(plant.id);
                                }}
                                onPointerDown={(e) => onMarkerPointerDown(e, plant.id)}
                                onPointerMove={onMarkerPointerMove}
                                onPointerUp={onMarkerPointerUp}
                                onPointerCancel={onMarkerPointerUp}
                            >
                                {thumb ? (
                                    <img src={thumb} alt="" draggable={false} />
                                ) : (
                                    <span>{plant.name.charAt(0)}</span>
                                )}
                                {showLabels && <span className="plan-marker-label">{plant.name}</span>}
                            </button>
                        );
                    })}
                </div>
                <div className="floor-plan-zoom">
                    <button type="button" onClick={() => zoomBy(1.5)} aria-label="Zoom in">
                        <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                    </button>
                    <button
                        type="button"
                        onClick={() => zoomBy(1 / 1.5)}
                        aria-label="Zoom out"
                        disabled={view.scale <= 1}
                    >
                        <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
                    </button>
                </div>
            </div>

            <ul className="floor-plan-legend" aria-label="Legend">
                <li>
                    <span className="dot dot--due" /> Needs water
                </li>
                <li>
                    <span className="dot dot--soon" /> Tomorrow
                </li>
                <li>
                    <span className="dot dot--ok" /> OK
                </li>
                <li>
                    <span className="dot dot--none" /> No schedule
                </li>
            </ul>

            {editMode && (
                <div className="floor-plan-tray">
                    <p className="floor-plan-hint">
                        {placingPlant
                            ? `Tap the plan to place ${placingPlant.name}.`
                            : "Pick a plant, then tap the plan. Long-press a placed plant to move it."}
                    </p>
                    <input
                        type="search"
                        placeholder="Find a plant…"
                        value={trayFilter}
                        onChange={(e) => setTrayFilter(e.target.value)}
                        aria-label="Filter unplaced plants"
                    />
                    <div className="floor-plan-tray-list" role="listbox" aria-label="Plants not on a plan yet">
                        {trayPlants.length === 0 && (
                            <span className="floor-plan-tray-empty">Every plant is placed.</span>
                        )}
                        {trayPlants.map((p) => {
                            const thumb = latestThumb(p);
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    role="option"
                                    aria-selected={placingPlantId === p.id}
                                    className={`floor-plan-tray-item${placingPlantId === p.id ? " selected" : ""}`}
                                    onClick={() => setPlacingPlantId(placingPlantId === p.id ? null : p.id)}
                                >
                                    {thumb ? (
                                        <img src={thumb} alt="" />
                                    ) : (
                                        <span className="initial">{p.name.charAt(0)}</span>
                                    )}
                                    <span className="name">{p.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {sheetPlant && (
                <div className="plan-sheet-overlay" onClick={closeSheet}>
                    <div
                        className="plan-sheet"
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={sheetPlant.name}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className="plan-sheet-close" onClick={closeSheet} aria-label="Close">
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                        <div className="plan-sheet-head">
                            {latestThumb(sheetPlant) ? (
                                <img src={latestThumb(sheetPlant)!} alt="" />
                            ) : (
                                <span className="initial">{sheetPlant.name.charAt(0)}</span>
                            )}
                            <div>
                                <h3>{sheetPlant.name}</h3>
                                {sheetPlant.species && <p className="species">{sheetPlant.species}</p>}
                            </div>
                        </div>
                        <p
                            className={`plan-sheet-status plan-sheet-status--${sheetStatus ? wateringBadgeVariant(sheetStatus) : "none"}`}
                        >
                            {sheetStatus ? formatWateringDue(sheetStatus) : "No watering schedule"} · Watered{" "}
                            {formatLastWateredShort(sheetPlant.last_watered ?? null, timezone)}
                        </p>
                        <div className="plan-sheet-actions">
                            {canEdit && (
                                <button
                                    className="plan-sheet-water"
                                    onClick={() => handleWater([sheetPlant.id])}
                                    disabled={watering}
                                >
                                    <FontAwesomeIcon icon={faDroplet} /> Water
                                </button>
                            )}
                            <Link to={`/plant/${sheetPlant.id}`} className="plan-sheet-open">
                                <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> Open
                            </Link>
                            {editMode && (
                                <button className="plan-sheet-remove" onClick={() => handleRemove(sheetPlant.id)}>
                                    <FontAwesomeIcon icon={faTrash} /> Remove from plan
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
