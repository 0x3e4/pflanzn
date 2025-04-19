import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import Plants from "./pages/Plants";
import PlantDetails from "./pages/PlantDetails";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import OidcCallback from "./pages/OidcCallback";
import ScrollToTopButton from './components/ScrollToTopButton';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from "./context/AuthContext";

export default function App() {
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";

    const [startY, setStartY] = useState<number | null>(null);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            // Only trigger if at top of scroll
            if (window.scrollY === 0) {
                setStartY(e.touches[0].clientY);
            }
        };
    
        const handleTouchMove = (e: TouchEvent) => {
            if (startY === null) return;
    
            const currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
    
            // Trigger refresh only if swiped down 100px and still at top
            if (deltaY > 100 && window.scrollY === 0) {
                window.location.reload();
                setStartY(null);
            }
        };
    
        const handleTouchEnd = () => {
            setStartY(null); // Reset on end
        };
    
        document.addEventListener("touchstart", handleTouchStart);
        document.addEventListener("touchmove", handleTouchMove);
        document.addEventListener("touchend", handleTouchEnd);
    
        return () => {
            document.removeEventListener("touchstart", handleTouchStart);
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleTouchEnd);
        };
    }, [startY]);

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
                <main>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/plants" element={<Plants />} />
                        <Route path="/plant/:plantId" element={<PlantDetails />} />
                        {authMode === "local" && <Route path="/login" element={<Login />} />}
                        {authMode === "oidc" && <Route path="/callback" element={<OidcCallback />} />}
                        <Route path="/profile" element={<Profile />} />
                    </Routes>
                    <ScrollToTopButton />
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
            </Router>
        </AuthProvider>
    );
}