import { renderHook, act } from "@testing-library/react";
import { waitFor } from "@testing-library/dom";
import React from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock("../services/apiClient", () => ({
    default: {
        post: (...args: unknown[]) => mockPost(...args),
        get: (...args: unknown[]) => mockGet(...args),
    },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthContext", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPost.mockResolvedValue({ data: {} });
        mockGet.mockRejectedValue({ response: { status: 401 } });
    });

    it("provides default auth state", async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.user).toBeNull();
    });

    it("login calls auth endpoint and fetches profile", async () => {
        mockPost.mockResolvedValue({ data: { message: "ok" } });
        mockGet.mockResolvedValue({
            data: { id: 1, username: "testuser", email: "test@example.com", role: "user" },
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.login("testuser", "password123");
        });

        expect(mockPost).toHaveBeenCalledWith("/auth/login", { username: "testuser", password: "password123" });

        await waitFor(() => {
            expect(result.current.user).toEqual({
                id: 1,
                username: "testuser",
                email: "test@example.com",
                role: "user",
            });
            expect(result.current.isLoggedIn).toBe(true);
        });
    });

    it("logout clears user state", async () => {
        mockPost.mockResolvedValue({ data: {} });
        mockGet.mockResolvedValue({
            data: { id: 1, username: "testuser", email: "test@example.com", role: "user" },
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.login("testuser", "pass");
        });

        await waitFor(() => {
            expect(result.current.isLoggedIn).toBe(true);
        });

        await act(async () => {
            await result.current.logout();
        });

        expect(result.current.user).toBeNull();
        expect(result.current.isLoggedIn).toBe(false);
    });

    it("useAuth returns defaults when used outside provider", () => {
        const { result } = renderHook(() => useAuth());

        expect(result.current.user).toBeNull();
        expect(result.current.isLoggedIn).toBe(false);
        expect(result.current.loading).toBe(true);
    });
});
