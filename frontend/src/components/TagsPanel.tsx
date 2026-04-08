import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchTagsDetailed, createTag, updateTag, deleteTag, TagDetailed } from "../services/TagService";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faTrash,
    faSave,
    faPlus,
    faChevronLeft,
    faChevronRight,
    faCircleXmark,
} from "@fortawesome/free-solid-svg-icons";
import { setOverlayOpen } from "../services/overlayControl";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

type SortField = "id" | "name" | "plant_count";

export default function TagsPanel() {
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const { user, isLoggedIn } = useAuth();
    const [tags, setTags] = useState<TagDetailed[]>([]);
    const [editedTags, setEditedTags] = useState<{ [tagId: number]: { name: string } }>({});
    const [deleteModalOpen, setDeleteModalOpen] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [newTagName, setNewTagName] = useState("");
    const [showAddRow, setShowAddRow] = useState(false);
    const itemsPerPage = 20;

    const [sortField, setSortField] = useState<SortField>("id");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    const totalPages = Math.ceil(tags.length / itemsPerPage);

    useEffect(() => {
        loadTags();
    }, [user, authMode]);

    const loadTags = async () => {
        setLoading(true);
        try {
            const data = await fetchTagsDetailed();
            setTags(data);
        } catch {
            toast.error("Failed to load tags.");
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    const sortedTags = [...tags].sort((a, b) => {
        const av = a[sortField];
        const bv = b[sortField];
        if (typeof av === "string" && typeof bv === "string") {
            return sortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortDirection === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    const indexOfLast = currentPage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    const currentTags = sortedTags.slice(indexOfFirst, indexOfLast);

    const handlePageChange = (direction: "prev" | "next") => {
        setCurrentPage((prev) => (direction === "next" ? Math.min(prev + 1, totalPages) : Math.max(prev - 1, 1)));
    };

    const getCurrentValue = (tagId: number, original: string) => {
        return editedTags[tagId]?.name ?? original;
    };

    const updateTagField = (tagId: number, value: string) => {
        setEditedTags((prev) => ({ ...prev, [tagId]: { name: value } }));
    };

    const handleUpdateTag = async (tagId: number) => {
        const changes = editedTags[tagId];
        if (!changes || !changes.name.trim()) {
            toast.info("No changes to save.");
            return;
        }
        try {
            await updateTag(tagId, { name: changes.name.trim() });
            toast.success("Tag updated.");
            setEditedTags((prev) => {
                const next = { ...prev };
                delete next[tagId];
                return next;
            });
            loadTags();
        } catch {
            toast.error("Failed to update tag.");
        }
    };

    const handleConfirmDelete = async (tagId: number) => {
        try {
            await deleteTag(tagId);
            toast.success("Tag deleted.");
            loadTags();
        } catch (err: unknown) {
            const message =
                err && typeof err === "object" && "response" in err
                    ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : undefined;
            toast.error(message || "Cannot delete tag — it may be assigned to plants.");
        } finally {
            setDeleteModalOpen(null);
        }
    };

    const handleCreateTag = async () => {
        const name = newTagName.trim();
        if (!name) return;
        try {
            await createTag(name);
            toast.success(`Tag "#${name}" created.`);
            setNewTagName("");
            setShowAddRow(false);
            loadTags();
        } catch {
            toast.error("Failed to create tag. It may already exist.");
        }
    };

    useEffect(() => {
        setOverlayOpen(!!deleteModalOpen);
    }, [deleteModalOpen]);

    if (!isLoggedIn && authMode !== "no") {
        return <p>Access denied</p>;
    }

    return (
        <div className="plants-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                    <h2>Tag Management</h2>
                    <p>Manage hashtags used across plants. Location tags (spot type, visibility) are derived automatically.</p>
                </div>
                <button
                    className="add-btn"
                    onClick={() => setShowAddRow(true)}
                    title="Add tag"
                    style={{ flexShrink: 0 }}
                >
                    <FontAwesomeIcon icon={faPlus} />
                </button>
            </div>

            <div className="table-container">
                <div className="table-scroll-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort("id")} style={{ width: 60 }}>
                                ID {sortField === "id" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                            </th>
                            <th onClick={() => handleSort("name")}>
                                Name {sortField === "name" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                            </th>
                            <th onClick={() => handleSort("plant_count")} style={{ width: 100 }}>
                                Plants {sortField === "plant_count" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                            </th>
                            <th style={{ width: 180 }}>Used By</th>
                            <th style={{ width: 120 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {showAddRow && (
                            <tr>
                                <td>-</td>
                                <td>
                                    <input
                                        type="text"
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                                        placeholder="New tag name..."
                                        autoFocus
                                    />
                                </td>
                                <td>-</td>
                                <td>-</td>
                                <td className="action-buttons">
                                    <button className="update-btn" onClick={handleCreateTag}>
                                        <FontAwesomeIcon icon={faSave} />
                                    </button>
                                    <button
                                        className="delete-btn"
                                        onClick={() => {
                                            setShowAddRow(false);
                                            setNewTagName("");
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faCircleXmark} />
                                    </button>
                                </td>
                            </tr>
                        )}
                        {loading
                            ? [...Array(6)].map((_, index) => (
                                  <tr key={`tag-skeleton-${index}`}>
                                      <td><Skeleton width={24} /></td>
                                      <td><Skeleton /></td>
                                      <td><Skeleton width={30} /></td>
                                      <td><Skeleton /></td>
                                      <td className="action-buttons">
                                          <Skeleton circle width={30} height={30} />
                                          <Skeleton circle width={30} height={30} />
                                      </td>
                                  </tr>
                              ))
                            : currentTags.map((tag) => (
                                  <tr key={tag.id}>
                                      <td>{tag.id}</td>
                                      <td>
                                          <input
                                              className="editable-input"
                                              type="text"
                                              value={getCurrentValue(tag.id, tag.name)}
                                              onChange={(e) => updateTagField(tag.id, e.target.value)}
                                          />
                                      </td>
                                      <td>{tag.plant_count}</td>
                                      <td>
                                          <span className="tags-panel-used-by" title={tag.plant_names.join(", ")}>
                                              {tag.plant_names.length > 0
                                                  ? tag.plant_names.slice(0, 3).join(", ") +
                                                    (tag.plant_names.length > 3 ? ` +${tag.plant_names.length - 3}` : "")
                                                  : "-"}
                                          </span>
                                      </td>
                                      <td className="action-buttons">
                                          <button className="update-btn" onClick={() => handleUpdateTag(tag.id)}>
                                              <FontAwesomeIcon icon={faSave} />
                                          </button>
                                          <button className="delete-btn" onClick={() => setDeleteModalOpen(tag.id)}>
                                              <FontAwesomeIcon icon={faTrash} />
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                    </tbody>
                </table>
                </div>

                {!loading && totalPages > 1 && (
                    <div className="pagination">
                        <button onClick={() => handlePageChange("prev")} disabled={currentPage === 1}>
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <span>
                            {currentPage} of {totalPages}
                        </span>
                        <button onClick={() => handlePageChange("next")} disabled={currentPage === totalPages}>
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>
                )}

                {deleteModalOpen && (
                    <div className="delete-plant-modal-overlay">
                        <div className="delete-plant-modal">
                            <div className="delete-modal-header">
                                <span>
                                    Are you sure you want to delete this tag?
                                    {(() => {
                                        const tag = tags.find((t) => t.id === deleteModalOpen);
                                        return tag && tag.plant_count > 0
                                            ? ` It is used by ${tag.plant_count} plant(s) and will be removed from them.`
                                            : "";
                                    })()}
                                </span>
                            </div>
                            <div className="delete-plant-modal-buttons">
                                <button
                                    className="delete-plant-confirm"
                                    onClick={() => handleConfirmDelete(deleteModalOpen)}
                                >
                                    <FontAwesomeIcon icon={faTrash} /> Delete
                                </button>
                                <button className="delete-plant-cancel" onClick={() => setDeleteModalOpen(null)}>
                                    <FontAwesomeIcon icon={faCircleXmark} /> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
