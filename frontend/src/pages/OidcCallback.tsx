import React, { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const OidcCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const code = searchParams.get("code");
    const navigate = useNavigate();
    const { fetchProfile } = useAuth();

    useEffect(() => {
        const finishLogin = async () => {
            if (!code) {
                toast.error("Missing authorization code.");
                navigate("/login");
                return;
            }

            try {
                // Send code to backend
                await axios.post("/api/auth/oidc/code", { code });

                toast.success("Login successful!");
                await fetchProfile();
                navigate("/plants");
            } catch (error) {
                toast.error("Login failed.");
                navigate("/login");
            }
        };

        finishLogin();
    }, [code, fetchProfile, navigate]);

    return (
        <div className="login-container">
            <div className="login-form">
                <h2>Finishing login…</h2>
                <p>Please wait while we finalize your authentication.</p>
            </div>
        </div>
    );
};

export default OidcCallback;