import { useOnlineStatus } from "../hooks/useOnlineStatus";
import "../styles/offlineBanner.css";

export default function OfflineBanner() {
    const isOnline = useOnlineStatus();

    if (isOnline) return null;

    return (
        <div className="offline-banner" role="alert">
            You're offline — viewing cached data
        </div>
    );
}
