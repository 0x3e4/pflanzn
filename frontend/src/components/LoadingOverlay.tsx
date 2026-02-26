import "../styles/loadingOverlay.css";

interface LoadingOverlayProps {
    title?: string;
    message?: string;
    details?: string[];
}

export default function LoadingOverlay({ title, message, details }: LoadingOverlayProps) {
    return (
        <div className="loading-overlay">
            <div className="loading-content">
                <img src="/loading.gif" alt="Loading..." className="loading-gif" />
                {(title || message || (details && details.length > 0)) && (
                    <div className="loading-text">
                        {title && <h3>{title}</h3>}
                        {message && <p>{message}</p>}
                        {details && details.length > 0 && (
                            <ul>
                                {details.map((detail) => (
                                    <li key={detail}>{detail}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
