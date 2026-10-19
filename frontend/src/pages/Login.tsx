import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { toast } from "react-toastify";
import { useNavigate, useSearchParams } from "react-router-dom";
import { extractErrorMessage } from "../services/apiClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightToBracket, faSeedling } from "@fortawesome/free-solid-svg-icons";
import "../styles/login.css";

const OIDC_ERROR_MESSAGES: Record<string, string> = {
    auth_failed: "Sign-in failed. Please try again.",
    email_unverified:
        "Your email address is not verified by your identity provider. Ask an administrator to verify it.",
};

const Login: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const { authMode, oidcName: configOidcName } = useConfig();
    const oidcName = configOidcName || "SSO";

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [searchParams] = useSearchParams();

    // The OIDC callback redirects here with ?error=<code> when sign-in is refused.
    useEffect(() => {
        const error = searchParams.get("error");
        if (!error) return;
        const message = OIDC_ERROR_MESSAGES[error] ?? OIDC_ERROR_MESSAGES.auth_failed;
        toast.error(message, { toastId: `login-error-${error}` });
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(username, password);
            toast.success("Login successful!");
            navigate("/plants");
        } catch (error) {
            // Surfaces the lockout message (429) as well as plain bad credentials.
            toast.error(extractErrorMessage(error, "Invalid credentials or login failed."));
        }
    };

    if (authMode !== "no") {
        return (
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <FontAwesomeIcon icon={faSeedling} className="login-logo" />
                        <h2>Welcome Back</h2>
                        <p className="login-subtitle">Sign in to continue</p>
                    </div>

                    {authMode === "local" && (
                        <form className="login-form" onSubmit={handleSubmit}>
                            <input
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                            <input
                                placeholder="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button type="submit">
                                <FontAwesomeIcon icon={faRightToBracket} /> Login
                            </button>
                        </form>
                    )}

                    {authMode === "oidc" && (
                        <button onClick={() => (window.location.href = "/api/auth/oidc-login")} className="oidc-btn">
                            <FontAwesomeIcon icon={faRightToBracket} /> Continue with {oidcName}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return null;
};

export default Login;
