import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Plants from "./pages/Plants";
import PlantDetails from "./pages/PlantDetails";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

export default function App() {
  return (
    <Router>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plants" element={<Plants />} />
          <Route path="/plants/:plantId" element={<PlantDetails />} />
        </Routes>
      </main>
      <Footer />
    </Router>
  );
}
