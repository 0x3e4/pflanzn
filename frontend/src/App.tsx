import { useRef } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import Plants from "./pages/Plants";
import PlantDetails from "./pages/PlantDetails";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import OidcCallback from "./pages/OidcCallback";
import ScrollToTopButton from './components/ScrollToTopButton';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from "./context/AuthContext";
import { usePullToRefresh } from "./hooks/usePullToRefresh";

export default function App() {
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";

    const ref = useRef<HTMLDivElement>(null);

    const { refreshing, setRefreshing } = usePullToRefresh(ref, () => {
        setTimeout(() => {
          window.location.reload();
          setRefreshing(false);
        }, 1500); 
    });

    usePullToRefresh(ref, () => {
        window.location.reload();
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW registered:', reg))
            .catch(err => console.error('SW registration failed:', err));
        });
    }      
    
    return (
        <AuthProvider>
            <Router>
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
                            <Route path="/" element={<Home />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/plants" element={<Plants />} />
                            <Route path="/plant/:plantId" element={<PlantDetails />} />
                            {authMode === "local" && <Route path="/login" element={<Login />} />}
                            {authMode === "oidc" && <Route path="/callback" element={<OidcCallback />} />}
                            <Route path="/admin" element={<Admin />} />
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
            </Router>
        </AuthProvider>
    );
}