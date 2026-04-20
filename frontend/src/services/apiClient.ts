import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getConfig } from "./config";

const apiClient = axios.create({
    baseURL: "/api",
    timeout: 60000,
    withCredentials: true,
});

type RetriableRequestConfig = InternalAxiosRequestConfig & {
    _retry?: boolean;
};

const nonRetryAuthPaths = ["/auth/login", "/auth/refresh", "/auth/logout", "/auth/oidc-login", "/auth/oidc/callback"];
let refreshPromise: Promise<void> | null = null;
let redirectInProgress = false;

const isAuthEnabled = () => {
    const mode = getConfig().authMode;
    return mode === "oidc" || mode === "local";
};

const shouldHandleUnauthorized = (url: string | undefined) => {
    if (!url || !isAuthEnabled()) {
        return false;
    }
    // Don't try to refresh/redirect when using share token
    if (sessionStorage.getItem("share_token")) {
        return false;
    }
    return !nonRetryAuthPaths.some((path) => url.includes(path));
};

const shouldRedirectToLogin = () => {
    if (!isAuthEnabled()) {
        return false;
    }

    const pathname = window.location.pathname;
    const isManageRoute = pathname.startsWith("/manage");
    return getConfig().showProtectedView || isManageRoute;
};

const redirectToLogin = async () => {
    if (redirectInProgress || !shouldRedirectToLogin()) {
        return;
    }
    redirectInProgress = true;
    try {
        await axios.post("/api/auth/logout", {}, { withCredentials: true });
    } catch {
        // Ignore logout errors; redirect is what matters.
    } finally {
        if (!window.location.pathname.startsWith("/login")) {
            window.location.href = "/login?reason=session_expired";
        }
    }
};

// Attach share token header when in share mode
apiClient.interceptors.request.use((config) => {
    const shareToken = sessionStorage.getItem("share_token");
    if (shareToken) {
        config.headers["X-Share-Token"] = shareToken;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as RetriableRequestConfig | undefined;
        const status = error.response?.status;

        if (
            !originalRequest ||
            status !== 401 ||
            !shouldHandleUnauthorized(originalRequest.url) ||
            originalRequest._retry
        ) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            if (!refreshPromise) {
                refreshPromise = apiClient
                    .post("/auth/refresh")
                    .then(() => undefined)
                    .finally(() => {
                        refreshPromise = null;
                    });
            }

            await refreshPromise;
            return apiClient(originalRequest);
        } catch (refreshError) {
            const refreshStatus = (refreshError as AxiosError)?.response?.status;
            if (refreshStatus === 409) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                try {
                    return apiClient(originalRequest);
                } catch (retryError) {
                    await redirectToLogin();
                    return Promise.reject(retryError);
                }
            }
            await redirectToLogin();
            return Promise.reject(error);
        }
    },
);

export default apiClient;
