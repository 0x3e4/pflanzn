import { Link, useLocation } from "react-router-dom";
import { useConfig } from "../context/ConfigContext";

// One line in place of the actions a signed-out visitor can't use, instead of buttons that
// only answer "you must be logged in". Without auth everyone is signed in, so it never shows.
export default function LoginHint({ to }: { to: string }) {
    const { authMode } = useConfig();
    const { pathname, search } = useLocation();
    if (authMode === "no") return null;
    return (
        <p className="login-hint">
            <Link to={`/login?next=${encodeURIComponent(pathname + search)}`}>Sign in</Link> to {to}.
        </p>
    );
}
