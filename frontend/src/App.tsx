import { useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import Plants from "./pages/Plants";
import Locations from "./pages/Locations";
import PlantDetails from "./pages/PlantDetails";
import Login from "./pages/Login";
import Manage from "./pages/Manage";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTopButton from './components/ScrollToTopButton';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from "./context/AuthContext";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { ProtectedRoute } from "./components/Protection";
import AuthSplash from "./components/AuthSplash";

const isTruthyEnv = (value: string | undefined, defaultValue = true) => {
    if (!value) {
        return defaultValue;
    }
    return !["false", "0", "no", "off"].includes(value.trim().toLowerCase());
};

function AppLayout() {
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";
    const showProtectedView = isTruthyEnv(import.meta.env.VITE_SHOW_PROTECTED_VIEW, true);
    const showLocations = isTruthyEnv(
        import.meta.env.VITE_ENABLE_LOCATIONS || import.meta.env.VITE_ENABLE_HERBALIST_LOCATIONS,
        false
    );
    const { loading, isLoggedIn } = useAuth();
    const location = useLocation();
    const ref = useRef<HTMLDivElement>(null);
    const isAuthEnabled = authMode === "oidc" || authMode === "local";
    const isManageRoute = location.pathname.startsWith("/manage");
    const protectCurrentRoute = (showProtectedView || isManageRoute) && location.pathname !== "/login";
    const shouldShowProtectedSplash =
        isAuthEnabled &&
        protectCurrentRoute &&
        (loading || !isLoggedIn);

    const { refreshing, setRefreshing } = usePullToRefresh(ref, () => {
        setTimeout(() => {
          window.location.reload();
          setRefreshing(false);
        }, 1500); 
    });

    usePullToRefresh(ref, () => {
        window.location.reload();
    });

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW registered:', reg))
                .catch(err => console.error('SW registration failed:', err));
            });
        }
    }, []);

    if (shouldShowProtectedSplash) {
        return <AuthSplash />;
    }
    
    return (
        <>
            <Navbar />
            <div ref={ref} style={{ position: "relative" }}>
                <div id="pull-indicator" className="pull-indicator" style={{ transform: "translateY(-100%)" }}>
                    {!refreshing ? (
                        <div className="arrow">↓</div>
                    ) : (
                        <div className="spinner" />
                    )}
                </div>
                <main>
                    <Routes>
                        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                        <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
                        <Route path="/plants" element={<ProtectedRoute><Plants /></ProtectedRoute>} />
                        {showLocations && <Route path="/locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />}
                        <Route path="/plant/:plantId" element={<ProtectedRoute><PlantDetails /></ProtectedRoute>} />
                        {authMode !== "no" && <Route path="/login" element={<Login />} />}
                        <Route path="/manage" element={<ProtectedRoute enforceAuth><Manage /></ProtectedRoute>} />
                    </Routes>
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
        <AuthProvider>
            <AppShell />
        </AuthProvider>
    );
}
