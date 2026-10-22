import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCircleCheck,
    faEye,
    faPenToSquare,
    faPlug,
    faRightToBracket,
    faSpinner,
    faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { extractErrorMessage } from "../services/apiClient";
import { currentPath, oidcLoginUrl } from "../services/authRedirect";
import {
    approveAuthorizationRequest,
    denyAuthorizationRequest,
    fetchAuthorizationRequest,
} from "../services/McpService";
import { MCP_SCOPE_WRITE, OAuthRequestInfo } from "../types/Mcp";
import "../styles/login.css";
import "../styles/oauthAuthorize.css";

// A consent page inside someone else's frame could be clickjacked into approving.
const isFramed = (() => {
    try {
        return window.top !== window.self;
    } catch {
        return true;
    }
})();

/**
 * Consent screen for MCP clients (Claude, …). /api/oauth/authorize validates the
 * request and redirects here with a request_id; approving returns the client's
 * redirect URL carrying the authorization code.
 */
// Set by /api/oauth/login/callback when the MCP login provider sign-in fails.
const LOGIN_ERRORS: Record<string, string> = {
    no_account: "No Pflanzn account uses this email address.",
    email_unverified: "Your email address is not verified by the login provider.",
    login_failed: "Sign-in failed. Please try again.",
};

const OAuthAuthorize: React.FC = () => {
    const [searchParams] = useSearchParams();
    const requestId = searchParams.get("request_id") || "";
    const navigate = useNavigate();
    const { isLoggedIn, loading: authLoading, user } = useAuth();
    const { authMode, oidcName } = useConfig();

    const [info, setInfo] = useState<OAuthRequestInfo | null>(null);
    const [fetchError, setError] = useState<string | null>(null);
    const loginError = LOGIN_ERRORS[searchParams.get("error") || ""];
    const error = requestId
        ? fetchError
        : "This link is missing its authorization request. Start the connection again from your app.";
    const [allowWrite, setAllowWrite] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const wantsWrite = !!info?.scopes.includes(MCP_SCOPE_WRITE);

    useEffect(() => {
        if (!requestId) return;
        fetchAuthorizationRequest(requestId)
            .then(setInfo)
            .catch((err) => setError(extractErrorMessage(err, "This authorization request is no longer valid.")));
    }, [requestId]);

    // With MCP_LOGIN_PROVIDER set, the consent page signs in there instead of the app login.
    const providerLogin = info && info.login !== "app";
    const signedIn = providerLogin ? !!info?.username : isLoggedIn;
    const username = providerLogin ? info?.username : user?.username;

    const signIn = () => {
        if (providerLogin) {
            window.location.href = `/api/oauth/login/start?request_id=${encodeURIComponent(requestId)}`;
        } else if (authMode === "oidc") {
            window.location.href = oidcLoginUrl(currentPath());
        } else {
            navigate(`/login?next=${encodeURIComponent(currentPath())}`);
        }
    };

    const decide = async (approve: boolean) => {
        setSubmitting(true);
        try {
            const redirectUrl = approve
                ? await approveAuthorizationRequest(requestId, allowWrite && wantsWrite)
                : await denyAuthorizationRequest(requestId);
            window.location.assign(redirectUrl);
        } catch (err) {
            setSubmitting(false);
            toast.error(extractErrorMessage(err, "Could not complete the authorization."));
        }
    };

    const renderBody = () => {
        if (isFramed) {
            return <p className="oauth-message">For your security this page can't be shown inside another site.</p>;
        }
        if (error) {
            return (
                <p className="oauth-message oauth-error">
                    <FontAwesomeIcon icon={faTriangleExclamation} /> {error}
                </p>
            );
        }
        if (!info || (!providerLogin && authLoading)) {
            return (
                <p className="oauth-message">
                    <FontAwesomeIcon icon={faSpinner} spin /> Loading…
                </p>
            );
        }
        if (!signedIn) {
            const label = providerLogin
                ? `Continue with ${info.login_name}`
                : authMode === "oidc"
                  ? `Continue with ${oidcName || "SSO"}`
                  : "Sign in";
            return (
                <>
                    {loginError && <p className="oauth-message oauth-error">{loginError}</p>}
                    <p className="oauth-message">Sign in to continue.</p>
                    <button className="oidc-btn" onClick={signIn}>
                        <FontAwesomeIcon icon={faRightToBracket} /> {label}
                    </button>
                </>
            );
        }
        return (
            <>
                <ul className="oauth-permissions">
                    <li>
                        <FontAwesomeIcon icon={faEye} />
                        <span>View your plants, photos, tags, notes, care advice and watering history</span>
                    </li>
                    {wantsWrite && (
                        <li>
                            <label className="oauth-write-toggle">
                                <input
                                    type="checkbox"
                                    checked={allowWrite}
                                    onChange={(e) => setAllowWrite(e.target.checked)}
                                />
                                <FontAwesomeIcon icon={faPenToSquare} />
                                <span>
                                    Make changes: log waterings and fertilizing, add notes and care advice, create and
                                    edit plants. Nothing can be deleted.
                                </span>
                            </label>
                        </li>
                    )}
                </ul>
                <p className="oauth-fineprint">
                    Signed in as <strong>{username}</strong>. After approving you'll be sent back to{" "}
                    <strong>{info.redirect_host}</strong>. You can revoke access any time under Manage → MCP.
                </p>
                <div className="oauth-actions">
                    <button className="oauth-deny" onClick={() => decide(false)} disabled={submitting}>
                        Deny
                    </button>
                    <button className="oidc-btn" onClick={() => decide(true)} disabled={submitting}>
                        <FontAwesomeIcon icon={submitting ? faSpinner : faCircleCheck} spin={submitting} /> Allow
                    </button>
                </div>
            </>
        );
    };

    return (
        <div className="login-container">
            <div className="login-card oauth-card">
                <div className="login-header">
                    <FontAwesomeIcon icon={faPlug} className="login-logo" />
                    <h2>{info ? `Connect ${info.client_name}` : "Connect an app"}</h2>
                    <p className="login-subtitle">
                        {info ? `${info.client_name} wants to access your Pflanzn collection` : "Pflanzn MCP access"}
                    </p>
                </div>
                {renderBody()}
            </div>
        </div>
    );
};

export default OAuthAuthorize;
