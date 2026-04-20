import { useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import Plants from "./pages/Plants";
import Locations from "./pages/Locations";
import LocationDetails from "./pages/LocationDetails";
import PlantDetails from "./pages/PlantDetails";
import Login from "./pages/Login";
import Manage from "./pages/Manage";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTopButton from "./components/ScrollToTopButton";
import BottomNav from "./components/BottomNav";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ShareProvider, useShare } from "./context/ShareContext";
import { ConfigProvider, useConfig } from "./context/ConfigContext";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { ProtectedRoute } from "./components/Protection";
import AuthSplash from "./components/AuthSplash";
import ErrorBoundary from "./components/ErrorBoundary";
import OfflineBanner from "./components/OfflineBanner";

function AppLayout() {
    const config = useConfig();
    const authMode = config.authMode;
    const showProtectedView = config.showProtectedView;
    const showLocations = config.enableLocations;
    const { loading, isLoggedIn } = useAuth();
    const { isShareAccess, shareLoading } = useShare();
    const location = useLocation();
    const ref = useRef<HTMLDivElement>(null);
    const isAuthEnabled = authMode === "oidc" || authMode === "local";
    const isManageRoute = location.pathname.startsWith("/manage");
    const protectCurrentRoute = (showProtectedView || isManageRoute) && location.pathname !== "/login";
    const shouldShowProtectedSplash =
        isAuthEnabled && protectCurrentRoute && !isShareAccess && (loading || shareLoading || !isLoggedIn);

    const { refreshing, setRefreshing } = usePullToRefresh(ref, () => {
        setTimeout(() => {
            window.location.reload();
            setRefreshing(false);
        }, 1500);
    });

    usePullToRefresh(ref, () => {
        window.location.reload();
    });

    // Move focus to main content on route change for keyboard/screen reader users
    useEffect(() => {
        const mainContent = document.getElementById("main-content");
        if (mainContent) {
            mainContent.focus({ preventScroll: true });
        }
    }, [location.pathname]);

    if (shouldShowProtectedSplash) {
        return <AuthSplash />;
    }

    return (
        <>
            <OfflineBanner />
            <a href="#main-content" className="skip-to-content">
                Skip to content
            </a>
            <Navbar />
            <div ref={ref} style={{ position: "relative" }}>
                <div id="pull-indicator" className="pull-indicator" style={{ transform: "translateY(-100%)" }}>
                    {!refreshing ? <div className="arrow">↓</div> : <div className="spinner" />}
                </div>
                <main id="main-content" tabIndex={-1}>
                    <ErrorBoundary>
                        <Routes>
                            <Route
                                path="/"
                                element={
                                    <ProtectedRoute>
                                        <Home />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/about"
                                element={
                                    <ProtectedRoute>
                                        <About />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/plants"
                                element={
                                    <ProtectedRoute>
                                        <Plants />
                                    </ProtectedRoute>
                                }
                            />
                            {showLocations && (
                                <Route
                                    path="/locations"
                                    element={
                                        <ProtectedRoute>
                                            <Locations />
                                        </ProtectedRoute>
                                    }
                                />
                            )}
                            {showLocations && (
                                <Route
                                    path="/location/:locationId"
                                    element={
                                        <ProtectedRoute>
                                            <LocationDetails />
                                        </ProtectedRoute>
                                    }
                                />
                            )}
                            <Route
                                path="/plant/:plantId"
                                element={
                                    <ProtectedRoute>
                                        <PlantDetails />
                                    </ProtectedRoute>
                                }
                            />
                            {authMode !== "no" && <Route path="/login" element={<Login />} />}
                            <Route
                                path="/manage"
                                element={
                                    <ProtectedRoute enforceAuth>
                                        <Manage />
                                    </ProtectedRoute>
                                }
                            />
                        </Routes>
                    </ErrorBoundary>
                    <ToastContainer
                        position="bottom-right"
                        autoClose={3000}
                        hideProgressBar={false}
                        newestOnTop={false}
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                    />
                </main>
                <Footer />
            </div>
            <ScrollToTopButton />
            <BottomNav />
        </>
    );
}

function AppShell() {
    return (
        <Router>
            <AppLayout />
        </Router>
    );
}

export default function App() {
    return (
        <ConfigProvider>
            <AuthProvider>
                <ShareProvider>
                    <AppShell />
                </ShareProvider>
            </AuthProvider>
        </ConfigProvider>
    );
}
