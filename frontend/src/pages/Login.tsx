import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightToBracket, faSeedling } from "@fortawesome/free-solid-svg-icons";
import "../styles/login.css";

const Login: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const oidcName = import.meta.env.VITE_OIDC_NAME || "SSO";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(username, password);
            toast.success("Login successful!");
            navigate("/plants");
        } catch (error) {
            toast.error("Invalid credentials or login failed.");
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
