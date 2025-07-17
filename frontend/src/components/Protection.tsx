import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAuth = true }) => {
    const { isLoggedIn } = useAuth();
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";

    // If auth is disabled, always show content
    if (authMode !== "oidc") {
        return <>{children}</>;
    }

    // If auth is required but user is not logged in, show login prompt
    if (requireAuth && !isLoggedIn) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
                    <p className="mb-4">Please log in to access this page.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};