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
import ScrollToTopButton from './components/ScrollToTopButton';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from "./context/AuthContext";

export default function App() {
    const authMode = import.meta.env.VITE_AUTH_MODE || "no";

    const [startY, setStartY] = useState<number | null>(null);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            setStartY(e.touches[0].clientY);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!startY) return;
            const currentY = e.touches[0].clientY;

            if (currentY - startY > 100) {
                window.location.reload();
                setStartY(null);
            }
        };

        document.addEventListener("touchstart", handleTouchStart);
        document.addEventListener("touchmove", handleTouchMove);

        return () => {
            document.removeEventListener("touchstart", handleTouchStart);
            document.removeEventListener("touchmove", handleTouchMove);
        };
    }, [startY]);

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