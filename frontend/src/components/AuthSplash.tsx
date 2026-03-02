import "../styles/authSplash.css";

export default function AuthSplash() {
    return (
        <div className="auth-splash" role="status" aria-live="polite" aria-label="Loading">
            <div className="auth-splash-content">
                <img src="/logo_transparent.png" alt="Pflanzn logo" className="auth-splash-logo" />
                <h1>Pflanzn</h1>
                <img src="/loading.gif" alt="Loading" className="auth-splash-loader" />
            </div>
        </div>
    );
}
