import { describe, expect, it } from "vitest";
import { oidcLoginUrl, safeNextPath } from "../services/authRedirect";

describe("safeNextPath", () => {
    it("keeps same-origin paths", () => {
        expect(safeNextPath("/oauth/authorize?request_id=abc")).toBe("/oauth/authorize?request_id=abc");
    });

    it.each(["//evil.example", "/\\evil.example", "https://evil.example", "plants", "", null, undefined])(
        "rejects %s",
        (path) => {
            expect(safeNextPath(path)).toBeNull();
        },
    );
});

describe("oidcLoginUrl", () => {
    it("carries a safe next path", () => {
        expect(oidcLoginUrl("/oauth/authorize?request_id=a&b=1")).toBe(
            "/api/auth/oidc-login?next=%2Foauth%2Fauthorize%3Frequest_id%3Da%26b%3D1",
        );
    });

    it("drops unsafe next paths", () => {
        expect(oidcLoginUrl("//evil.example")).toBe("/api/auth/oidc-login");
    });
});
