import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("ErrorBoundary caught:", error, info.componentStack);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: "60vh",
                        padding: "2rem",
                        textAlign: "center",
                        color: "var(--text-color)",
                    }}
                >
                    <h2 style={{ marginBottom: "0.5rem" }}>Something went wrong</h2>
                    <p style={{ color: "var(--quinary-color)", marginBottom: "1.5rem" }}>
                        An unexpected error occurred. Please try reloading the page.
                    </p>
                    <button
                        onClick={this.handleReload}
                        style={{
                            padding: "10px 24px",
                            borderRadius: "6px",
                            fontSize: "1rem",
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
