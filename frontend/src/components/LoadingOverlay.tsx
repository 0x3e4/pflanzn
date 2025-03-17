import "../styles/loadingOverlay.css";

export default function LoadingOverlay() {
    return (
        <div className="loading-overlay">
            <div className="loading-content">
                <img src="/loading.gif" alt="Loading..." className="loading-gif" />
            </div>
        </div>
    );
}