import { Fragment, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { fetchAuditLogs } from "../services/AuditService";
import { AuditLog, AuditLogPage } from "../types/AuditLog";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const PER_PAGE = 50;
const COLUMN_COUNT = 8;

// Hardcoded filter options (no distinct-values endpoint for v1)
const ACTION_OPTIONS = [
    "login",
    "login_failed",
    "logout",
    "create",
    "update",
    "delete",
    "user.create",
    "user.update",
    "user.delete",
    "user.password_change",
];
const ENTITY_OPTIONS = ["plant", "user", "tag", "location", "weather", "share", "auth"];

const emptyPage: AuditLogPage = { items: [], total: 0, page: 1, per_page: PER_PAGE };

function statusClass(status: number | null): string {
    if (status == null) return "";
    if (status >= 500) return "status-5xx";
    if (status >= 400) return "status-4xx";
    return "status-2xx";
}

export default function AuditPanel() {
    const { authMode } = useConfig();
    const { user, isLoggedIn } = useAuth();

    const [data, setData] = useState<AuditLogPage>(emptyPage);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [action, setAction] = useState("");
    const [entityType, setEntityType] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [q, setQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Debounce free-text search so we don't fire a request per keystroke
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q), 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        let isActive = true;

        const load = async () => {
            setLoading(true);
            try {
                const result = await fetchAuditLogs({
                    page,
                    per_page: PER_PAGE,
                    action: action || undefined,
                    entity_type: entityType || undefined,
                    date_from: dateFrom ? `${dateFrom}T00:00:00` : undefined,
                    date_to: dateTo ? `${dateTo}T23:59:59` : undefined,
                    q: debouncedQ || undefined,
                });
                if (isActive) {
                    setData(result);
                }
            } catch {
                if (isActive) {
                    toast.error("Failed to load audit log.");
                }
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        load();
        return () => {
            isActive = false;
        };
    }, [page, action, entityType, dateFrom, dateTo, debouncedQ]);

    const totalPages = Math.max(1, Math.ceil(data.total / PER_PAGE));

    const handlePageChange = (direction: "prev" | "next") => {
        setPage((prev) => (direction === "next" ? Math.min(prev + 1, totalPages) : Math.max(prev - 1, 1)));
    };

    const toggleDetails = (id: number) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const renderEntity = (log: AuditLog) => {
        if (!log.entity_type) return "—";
        return log.entity_id != null ? `${log.entity_type} #${log.entity_id}` : log.entity_type;
    };

    if (!isLoggedIn && authMode !== "no") {
        return <p>Access denied</p>;
    }
    if (authMode !== "no" && user?.role !== "admin") {
        return <p>Audit log not available</p>;
    }

    return (
        <div className="users-panel audit-panel">
            <h2>Audit Log</h2>
            <p>A record of all write actions and authentication events.</p>

            <div className="audit-filters">
                <select
                    value={action}
                    onChange={(e) => {
                        setAction(e.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">All actions</option>
                    {ACTION_OPTIONS.map((a) => (
                        <option key={a} value={a}>
                            {a}
                        </option>
                    ))}
                </select>

                <select
                    value={entityType}
                    onChange={(e) => {
                        setEntityType(e.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">All entities</option>
                    {ENTITY_OPTIONS.map((ent) => (
                        <option key={ent} value={ent}>
                            {ent}
                        </option>
                    ))}
                </select>

                <input
                    type="date"
                    value={dateFrom}
                    aria-label="From date"
                    onChange={(e) => {
                        setDateFrom(e.target.value);
                        setPage(1);
                    }}
                />
                <input
                    type="date"
                    value={dateTo}
                    aria-label="To date"
                    onChange={(e) => {
                        setDateTo(e.target.value);
                        setPage(1);
                    }}
                />

                <input
                    type="text"
                    placeholder="Search path or user…"
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setPage(1);
                    }}
                />
            </div>

            <div className="table-container">
                <div className="table-scroll-wrapper">
                    <table className="data-table audit-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Entity</th>
                                <th>Method</th>
                                <th>Status</th>
                                <th>IP</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(8)].map((_, index) => (
                                    <tr key={`audit-skeleton-${index}`}>
                                        {[...Array(COLUMN_COUNT)].map((__, cell) => (
                                            <td key={cell}>
                                                <Skeleton />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : data.items.length === 0 ? (
                                <tr>
                                    <td colSpan={COLUMN_COUNT} className="audit-empty">
                                        No audit entries found.
                                    </td>
                                </tr>
                            ) : (
                                data.items.map((log) => (
                                    <Fragment key={log.id}>
                                        <tr>
                                            <td>{new Date(log.created_at).toLocaleString()}</td>
                                            <td>{log.username ?? "—"}</td>
                                            <td>
                                                <span className="audit-badge action">{log.action}</span>
                                            </td>
                                            <td>{renderEntity(log)}</td>
                                            <td>{log.method ? <span className="audit-badge method">{log.method}</span> : "—"}</td>
                                            <td>
                                                {log.status_code != null ? (
                                                    <span className={`audit-badge ${statusClass(log.status_code)}`}>
                                                        {log.status_code}
                                                    </span>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td>{log.ip_address ?? "—"}</td>
                                            <td>
                                                {log.details ? (
                                                    <button
                                                        className="view-btn"
                                                        aria-label="Toggle details"
                                                        onClick={() => toggleDetails(log.id)}
                                                    >
                                                        <FontAwesomeIcon icon={faChevronDown} />
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                        {expandedId === log.id && log.details && (
                                            <tr className="audit-details-row">
                                                <td colSpan={COLUMN_COUNT}>
                                                    <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && totalPages > 1 && (
                    <div className="pagination">
                        <button onClick={() => handlePageChange("prev")} disabled={page === 1}>
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span>
                            {page} of {totalPages}
                        </span>
                        <button onClick={() => handlePageChange("next")} disabled={page === totalPages}>
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
