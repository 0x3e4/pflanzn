import { useAuth } from "../context/AuthContext";
import { useShare } from "../context/ShareContext";
import AuthSplash from "./AuthSplash";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean;
    enforceAuth?: boolean;
}

const isTruthyEnv = (value: string | undefined, defaultValue = true) => {
    if (!value) {
        return defaultValue;
    }
    return !["false", "0", "no", "off"].includes(value.trim().toLowerCase());
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requireAuth = true,
    enforceAuth = false,
}) => {
    const { isLoggedIn, loading } = useAuth();
    const { isShareAccess } = useShare();
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const showProtectedView = isTruthyEnv(import.meta.env.VITE_SHOW_PROTECTED_VIEW, true);
    const isAuthEnabled = authMode === "oidc" || authMode === "local";
    const shouldProtectView = isAuthEnabled && (showProtectedView || enforceAuth);

    if (!shouldProtectView) {
        return <>{children}</>;
    }

    // Share access bypasses auth for read-only view (but not /manage)
    if (isShareAccess && !enforceAuth) {
        return <>{children}</>;
    }

    if (loading || (requireAuth && !isLoggedIn)) {
        return <AuthSplash />;
    }

    return <>{children}</>;
};
