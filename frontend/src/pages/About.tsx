import { } from "react";
import "../styles/about.css";

export default function About() {
  return (
    <div className="container about-container">
      {/* Main Content */}
      <div className="about-content">
        <h1>Pflanzn</h1>
        <p>A simple and efficient plant management system.</p>
      </div>
      <hr />
      {/* Features Section */}
      <section className="about-features">
        <h2>Features</h2>
        <ul>
          <li><strong>🌱 Inventory Plants:</strong> Keep track of all your plants, including names, species and images.</li>
          <li><strong>📸 Identify Plants:</strong> Use the powerful Pl@ntNet integration to identify plants directly from photos.</li>
          <li><strong>📅 Image & Watering Timeline:</strong> Track the history of images and watering events for each plant.</li>
          <li><strong>🔒 Flexible Authentication:</strong> Supports no authentication, basic authentication or OIDC login.</li>
        </ul>
      </section>
    </div>
  );
}