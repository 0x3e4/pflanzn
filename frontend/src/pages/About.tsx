import { } from "react";
import "../styles/about.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSeedling, faCamera, faTint, faKey, faMobileAlt, faRobot } from "@fortawesome/free-solid-svg-icons";

export default function About() {
  return (
    <div className="container about-container">
      {/* Main Content */}
      <div className="about-content">
        <h1>Pflanzn</h1>
        <p>A simple and efficient plant management system.</p>

        <h2>Pronunciation & Meaning</h2>
        <p>
          "Pflanzn" is pronounced as "flahn-tsən" similar to how you would say "plants" 
          but with a unique twist. The "Pfl" at the beginning is pronounced with a soft "P" 
          followed by an "f" sound, almost like saying "flants" but with a slight emphasis on the "P." 
          The "a" is pronounced like the "a" in "father" and the "z" is pronounced like a "ts" sound.
        </p>
        <p>
          The name is derived from the Austrian German word "Pflanzen", which means "plants" in English. 
          Interestingly, the verb "pflanzen" can also mean "to tease" or "to annoy" someone in Austrian German, adding a playful layer to the name. 
          By dropping the final "e", we create a catchy and memorable name that resonates with plant enthusiasts while hinting at the lighthearted nature of caring for plants.
        </p>
        <p>
          With Pflanzn, you can effortlessly track your plants' needs, monitor their growth 
          and ensure they thrive in your care. Whether you're a seasoned gardener or just starting 
          your plant journey, Pflanzn is here to help you cultivate your green thumb!
        </p>
      </div>
      
      <hr />

      {/* Features Section */}
      <section className="about-features">
        <h2>Features</h2>
        <div className="about-features-grid">
          <div className="about-feature-card">
            <div className="about-feature-header">
              <FontAwesomeIcon icon={faSeedling} className="about-feature-icon" />
              <strong>Inventory Plants</strong>
            </div>
            <p>Keep track of all your plants, including names, species and images.</p>
          </div>

          <div className="about-feature-card">
            <div className="about-feature-header">
              <FontAwesomeIcon icon={faCamera} className="about-feature-icon" />
              <strong>Identify Plants</strong>
            </div>
            <p>Use the powerful Pl@ntNet integration to identify plants directly from photos.</p>
          </div>

          <div className="about-feature-card">
            <div className="about-feature-header">
              <FontAwesomeIcon icon={faTint} className="about-feature-icon" />
              <strong>Image & Watering</strong>
            </div>
            <p>Track the history of images and watering events for each plant.</p>
          </div>

          <div className="about-feature-card">
            <div className="about-feature-header">
              <FontAwesomeIcon icon={faKey} className="about-feature-icon" />
              <strong>Flexible Authentication</strong>
            </div>
            <p>Supports no authentication, basic authentication or OIDC login.</p>
          </div>

          <div className="about-feature-card">
            <div className="about-feature-header">
              <FontAwesomeIcon icon={faMobileAlt} className="about-feature-icon" />
              <strong>Progressive Web App (PWA)</strong>
            </div>
            <p>Install the app directly on your phone or desktop and use it offline with caching support.</p>
          </div>

          <div className="about-feature-card">
            <div className="about-feature-header">
              <FontAwesomeIcon icon={faRobot} className="about-feature-icon" />
              <strong>AI-Powered Assistance</strong>
            </div>
            <p>
              Integrate with Hugging Face, Mistral AI, OpenAI or even your local Ollama instance 
              to generate descriptions and care instructions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}