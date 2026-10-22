import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faCopy, faTrash, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { checkOAuthDiscovery, fetchOAuthGrants, revokeOAuthGrant } from "../services/McpService";
import { MCP_SCOPE_WRITE, OAuthGrant } from "../types/Mcp";
import "../styles/oauthAuthorize.css";

export default function McpPanel() {
    const { domain, locale, mcpAuth } = useConfig();
    const { user } = useAuth();
    const serverUrl = `${domain || window.location.origin}/api/mcp`;
    const builtin = mcpAuth === "builtin";
    const isAdmin = user?.role === "admin";

    const [grants, setGrants] = useState<OAuthGrant[]>([]);
    const [loading, setLoading] = useState(builtin);
    const [discoveryOk, setDiscoveryOk] = useState<boolean | null>(null);

    const loadGrants = async () => {
        try {
            setGrants(await fetchOAuthGrants());
        } catch {
            toast.error("Failed to load connected apps.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mcpAuth === "none") return;
        checkOAuthDiscovery().then(setDiscoveryOk);
        if (builtin) loadGrants();
    }, [mcpAuth, builtin]);

    const copyUrl = () => {
        navigator.clipboard.writeText(serverUrl);
        toast.success("MCP server URL copied.");
    };

    const handleRevoke = async (grant: OAuthGrant) => {
        if (!window.confirm(`Revoke access for "${grant.client_name}"?`)) return;
        try {
            await revokeOAuthGrant(grant.id);
            toast.success("Access revoked.");
            loadGrants();
        } catch {
            toast.error("Failed to revoke access.");
        }
    };

    const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString(locale) : "Never");

    return (
        <div className="users-panel">
            <h2>MCP</h2>
            <p>Add this URL as a custom connector in Claude or another MCP client.</p>

            <div className="mcp-url-row">
                <code>{serverUrl}</code>
                <button className="update-btn" onClick={copyUrl} title="Copy URL" aria-label="Copy MCP server URL">
                    <FontAwesomeIcon icon={faCopy} />
                </button>
            </div>

            {mcpAuth === "none" && (
                <p className="mcp-check warn">
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                    <span>No sign-in required (AUTH_MODE=no).</span>
                </p>
            )}
            {mcpAuth === "external" && <p>Sign-in is handled by your external OAuth server.</p>}
            {discoveryOk === false && (
                <p className="mcp-check warn">
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                    <span>
                        <code>/.well-known/oauth-protected-resource</code> doesn't reach the backend — check your
                        reverse proxy.
                    </span>
                </p>
            )}
            {discoveryOk && (
                <p className="mcp-check ok">
                    <FontAwesomeIcon icon={faCircleCheck} />
                    <span>OAuth discovery reachable.</span>
                </p>
            )}

            {builtin && (
                <>
                    <h3>Connected apps</h3>
                    <div className="table-container">
                        <div className="table-scroll-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>App</th>
                                        {isAdmin && <th>User</th>}
                                        <th>Access</th>
                                        <th>Connected</th>
                                        <th>Last used</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        [...Array(2)].map((_, index) => (
                                            <tr key={`mcp-skeleton-${index}`}>
                                                <td colSpan={isAdmin ? 6 : 5}>
                                                    <Skeleton />
                                                </td>
                                            </tr>
                                        ))
                                    ) : grants.length === 0 ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: "center", opacity: 0.6 }}>
                                                No apps connected yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        grants.map((grant) => (
                                            <tr key={grant.id}>
                                                <td>{grant.client_name}</td>
                                                {isAdmin && <td>{grant.username}</td>}
                                                <td>
                                                    {grant.scopes.includes(MCP_SCOPE_WRITE)
                                                        ? "Read & write"
                                                        : "Read only"}
                                                </td>
                                                <td>{formatDate(grant.created_at)}</td>
                                                <td>{formatDate(grant.last_used_at)}</td>
                                                <td className="action-buttons">
                                                    <button
                                                        className="delete-btn"
                                                        onClick={() => handleRevoke(grant)}
                                                        title="Revoke"
                                                        aria-label={`Revoke ${grant.client_name}`}
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
                </>
            )}
        </div>
    );
}
