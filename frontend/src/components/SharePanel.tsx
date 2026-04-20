import { useCallback, useEffect, useState } from "react";
import { useModalA11y } from "../hooks/useModalA11y";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPlus, faCopy } from "@fortawesome/free-solid-svg-icons";
import { ShareLink } from "../types/ShareLink";
import { fetchShareLinks, createShareLink, deleteShareLink } from "../services/ShareService";
import { useConfig } from "../context/ConfigContext";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const EXPIRY_OPTIONS = [
    { label: "1 hour", value: 1 },
    { label: "6 hours", value: 6 },
    { label: "24 hours", value: 24 },
    { label: "7 days", value: 168 },
    { label: "30 days", value: 720 },
    { label: "Never", value: null },
];

export default function SharePanel() {
    const [links, setLinks] = useState<ShareLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const closeModal = useCallback(() => setModalOpen(false), []);
    const { modalRef } = useModalA11y({ isOpen: modalOpen, onClose: closeModal });
    const [newAlias, setNewAlias] = useState("");
    const [newExpiry, setNewExpiry] = useState<number | null>(null);
    const { domain: configDomain } = useConfig();
    const domain = configDomain || window.location.origin;

    const loadLinks = async () => {
        try {
            const data = await fetchShareLinks();
            setLinks(data);
        } catch {
            toast.error("Failed to load share links.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLinks();
    }, []);

    const handleCreate = async () => {
        if (!newAlias.trim()) {
            toast.error("Alias is required.");
            return;
        }

        try {
            const created = await createShareLink({ alias: newAlias.trim(), expires_in_hours: newExpiry });
            const url = `${domain}/?share=${created.token}`;
            navigator.clipboard.writeText(url);
            toast.success("Share link created and copied to clipboard.");
            setNewAlias("");
            setNewExpiry(null);
            setModalOpen(false);
            loadLinks();
        } catch (err: any) {
            if (err.response?.status === 409) {
                toast.error("A link with this alias already exists.");
            } else {
                toast.error("Failed to create share link.");
            }
        }
    };

    const handleDelete = async (link: ShareLink) => {
        if (!window.confirm(`Delete share link "${link.alias}"?`)) return;
        try {
            await deleteShareLink(link.id);
            toast.success("Share link deleted.");
            loadLinks();
        } catch {
            toast.error("Failed to delete share link.");
        }
    };

    const getShareUrl = (link: ShareLink) => `${domain}/?share=${link.token}`;

    const copyToClipboard = (link: ShareLink) => {
        navigator.clipboard.writeText(getShareUrl(link));
        toast.success("Link copied to clipboard.");
    };

    const formatExpiry = (expiresAt: string | null) => {
        if (!expiresAt) return "Never";
        const date = new Date(expiresAt);
        const now = new Date();
        if (date < now) return "Expired";
        return date.toLocaleString();
    };

    const isExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    return (
        <div className="users-panel">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>Share Links</h2>
                <button className="add-btn" onClick={() => setModalOpen(true)}>
                    <FontAwesomeIcon icon={faPlus} />
                </button>
            </div>
            <p>Create read-only links to share your site without requiring login.</p>

            <div className="table-container">
                <div className="table-scroll-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Alias</th>
                            <th>Link</th>
                            <th>Expires</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(3)].map((_, index) => (
                                <tr key={`share-skeleton-${index}`}>
                                    <td>
                                        <Skeleton />
                                    </td>
                                    <td>
                                        <Skeleton />
                                    </td>
                                    <td>
                                        <Skeleton width={100} />
                                    </td>
                                    <td className="action-buttons">
                                        <Skeleton circle width={30} height={30} />
                                        <Skeleton circle width={30} height={30} />
                                    </td>
                                </tr>
                            ))
                        ) : links.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ textAlign: "center", opacity: 0.6 }}>
                                    No share links yet. Create one to get started.
                                </td>
                            </tr>
                        ) : (
                            links.map((link) => (
                                <tr key={link.id} style={{ opacity: isExpired(link.expires_at) ? 0.5 : 1 }}>
                                    <td>{link.alias}</td>
                                    <td
                                        style={{
                                            maxWidth: "300px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {getShareUrl(link)}
                                    </td>
                                    <td>{formatExpiry(link.expires_at)}</td>
                                    <td className="action-buttons">
                                        <button
                                            className="update-btn"
                                            onClick={() => copyToClipboard(link)}
                                            title="Copy link"
                                        >
                                            <FontAwesomeIcon icon={faCopy} />
                                        </button>
                                        <button
                                            className="delete-btn"
                                            onClick={() => handleDelete(link)}
                                            title="Delete"
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {modalOpen && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" ref={modalRef} role="dialog" aria-modal="true" aria-label="Create share link" onClick={(e) => e.stopPropagation()}>
                        <span className="close" onClick={() => setModalOpen(false)}>
                            &times;
                        </span>
                        <h2>Create Share Link</h2>
                        <div className="input-row">
                            <input
                                type="text"
                                placeholder="Alias (e.g. family, friends)"
                                value={newAlias}
                                onChange={(e) => setNewAlias(e.target.value)}
                            />
                        </div>
                        <div className="input-row">
                            <select
                                value={newExpiry === null ? "null" : String(newExpiry)}
                                onChange={(e) =>
                                    setNewExpiry(e.target.value === "null" ? null : Number(e.target.value))
                                }
                            >
                                {EXPIRY_OPTIONS.map((opt) => (
                                    <option
                                        key={String(opt.value)}
                                        value={opt.value === null ? "null" : String(opt.value)}
                                    >
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleCreate}>Create Link</button>
                    </div>
                </div>
            )}
        </div>
    );
}
