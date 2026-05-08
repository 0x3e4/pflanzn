import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronLeft,
    faChevronRight,
    faTrash,
    faCircleXmark,
    faRotate,
} from "@fortawesome/free-solid-svg-icons";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
    bulkDeleteWaterings,
    fetchAllWaterings,
    WateringListItem,
} from "../services/PlantService";
import { useConfig } from "../context/ConfigContext";
import { useModalA11y } from "../hooks/useModalA11y";
import "../styles/wateringsPanel.css";

const PAGE_SIZE = 25;

export default function WateringsPanel() {
    const { locale, tz: timezone } = useConfig();
    const [items, setItems] = useState<WateringListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const loadPage = useCallback(async (targetPage: number) => {
        setLoading(true);
        try {
            const data = await fetchAllWaterings(PAGE_SIZE, targetPage * PAGE_SIZE);
            setItems(data.items);
            setTotal(data.total);
            setPage(targetPage);
            setSelectedIds(new Set());
        } catch {
            toast.error("Failed to load waterings.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPage(0);
    }, [loadPage]);

    const toggleOne = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allOnPageSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
    const togglePage = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allOnPageSelected) {
                items.forEach((i) => next.delete(i.id));
            } else {
                items.forEach((i) => next.add(i.id));
            }
            return next;
        });
    };

    const closeConfirm = useCallback(() => {
        if (deleting) return;
        setConfirmingDelete(false);
    }, [deleting]);

    const { modalRef } = useModalA11y({ isOpen: confirmingDelete, onClose: closeConfirm });

    const confirmDelete = async () => {
        if (deleting || selectedIds.size === 0) return;
        setDeleting(true);
        try {
            const ids = [...selectedIds];
            const result = await bulkDeleteWaterings(ids);
            toast.success(`Deleted ${result.deleted} watering${result.deleted === 1 ? "" : "s"}.`);
            setConfirmingDelete(false);
            // Reload — clamp page if it became out of range
            const remaining = total - result.deleted;
            const newTotalPages = Math.max(1, Math.ceil(remaining / PAGE_SIZE));
            const targetPage = Math.min(page, newTotalPages - 1);
            await loadPage(Math.max(0, targetPage));
        } catch {
            toast.error("Failed to delete waterings.");
        } finally {
            setDeleting(false);
        }
    };

    const formatTime = (iso: string) => {
        const dt = new Date(iso);
        return dt.toLocaleString(locale, {
            timeZone: timezone,
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="statistics-panel waterings-panel">
            <h2>Waterings</h2>
            <p>Browse the newest waterings and remove them in batches. Includes both manual and rain-triggered (auto) entries.</p>

            <div className="waterings-toolbar">
                <button
                    className="waterings-delete-btn"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={selectedIds.size === 0 || loading}
                >
                    <FontAwesomeIcon icon={faTrash} /> Delete selected ({selectedIds.size})
                </button>
                <button
                    className="waterings-refresh-btn"
                    onClick={() => loadPage(page)}
                    disabled={loading}
                    title="Refresh"
                >
                    <FontAwesomeIcon icon={faRotate} />
                </button>
                <span className="waterings-total">{total.toLocaleString(locale)} total</span>
            </div>

            <div className="waterings-table-scroll">
                <table className="waterings-table">
                    <thead>
                        <tr>
                            <th className="waterings-col-check">
                                <input
                                    type="checkbox"
                                    aria-label="Select all on this page"
                                    checked={allOnPageSelected}
                                    onChange={togglePage}
                                    disabled={loading || items.length === 0}
                                />
                            </th>
                            <th>Watered at</th>
                            <th>Plant</th>
                            <th>Tags</th>
                            <th>Rain</th>
                            <th>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(8)].map((_, i) => (
                                <tr key={`sk-${i}`}>
                                    <td><Skeleton width={16} /></td>
                                    <td><Skeleton width={140} /></td>
                                    <td><Skeleton width={160} /></td>
                                    <td><Skeleton width={120} /></td>
                                    <td><Skeleton width={50} /></td>
                                    <td><Skeleton width={90} /></td>
                                </tr>
                            ))
                        ) : items.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="waterings-empty">No waterings recorded.</td>
                            </tr>
                        ) : (
                            items.map((w) => {
                                const isAuto = w.user_id === null;
                                const sourceLabel = isAuto
                                    ? w.weather_config_name
                                        ? `auto · ${w.weather_config_name}`
                                        : "auto"
                                    : "manual";
                                return (
                                    <tr
                                        key={w.id}
                                        className={`waterings-row${selectedIds.has(w.id) ? " selected" : ""}`}
                                        onClick={() => toggleOne(w.id)}
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={selectedIds.has(w.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === " " || e.key === "Enter") {
                                                e.preventDefault();
                                                toggleOne(w.id);
                                            }
                                        }}
                                    >
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                aria-label={`Select watering ${w.id}`}
                                                checked={selectedIds.has(w.id)}
                                                onChange={() => toggleOne(w.id)}
                                            />
                                        </td>
                                        <td>{formatTime(w.watered_at)}</td>
                                        <td>
                                            <Link
                                                to={`/plant/${w.plant_id}`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {w.plant_name}
                                            </Link>
                                        </td>
                                        <td>
                                            {w.tags.length > 0 ? (
                                                <span className="waterings-tag-list">
                                                    {w.tags.map((tag) => (
                                                        <span key={tag} className="waterings-tag-chip">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </span>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                        <td>
                                            {w.rainfall_mm !== null && w.rainfall_mm !== undefined
                                                ? `${w.rainfall_mm.toFixed(1)} mm`
                                                : "—"}
                                        </td>
                                        <td>{sourceLabel}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="waterings-pagination">
                    <button
                        disabled={page === 0 || loading}
                        onClick={() => loadPage(page - 1)}
                        title="Previous page"
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <span>{page + 1} / {totalPages}</span>
                    <button
                        disabled={page >= totalPages - 1 || loading}
                        onClick={() => loadPage(page + 1)}
                        title="Next page"
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                </div>
            )}

            {confirmingDelete && (
                <div className="identification-delete-modal-overlay" onClick={closeConfirm}>
                    <div
                        className="identification-delete-modal"
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Confirm deletion"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="delete-modal-header">
                            <span>
                                Delete {selectedIds.size} watering{selectedIds.size === 1 ? "" : "s"}? This cannot be undone.
                            </span>
                        </div>
                        <div className="identification-delete-modal-buttons">
                            <button
                                className="identification-delete-confirm"
                                onClick={confirmDelete}
                                disabled={deleting}
                            >
                                <FontAwesomeIcon icon={faTrash} /> Delete
                            </button>
                            <button
                                className="identification-delete-cancel"
                                onClick={closeConfirm}
                                disabled={deleting}
                            >
                                <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
