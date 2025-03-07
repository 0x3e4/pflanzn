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
          <li><strong>Inventory Plants:</strong> Keep track of all your plants, including names, species and images.</li>
          <li><strong>Identify Plants:</strong> Use the powerful Pl@ntNet integration to identify plants directly from photos.</li>
          <li><strong>Image & Watering:</strong> Track the history of images and watering events for each plant.</li>
          <li><strong>Flexible Authentication:</strong> Supports no authentication, basic authentication or OIDC login.</li>
          <li><strong>Progressive Web App (PWA):</strong> Install the app directly on your phone or desktop and use it offline with caching support.</li>
          <li><strong>AI-Powered Assistance:</strong> Integrate with Hugging Face, Mistral AI, OpenAI or even your local Ollama instance to generate descriptions and care instructions.</li>
        </ul>
      </section>
    </div>
  );
}