import { useAuth } from "../context/AuthContext";
import { useShare } from "../context/ShareContext";
import { useConfig } from "../context/ConfigContext";
import AuthSplash from "./AuthSplash";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean;
    enforceAuth?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requireAuth = true,
    enforceAuth = false,
}) => {
    const { isLoggedIn, loading } = useAuth();
    const { isShareAccess } = useShare();
    const { authMode, showProtectedView } = useConfig();
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
