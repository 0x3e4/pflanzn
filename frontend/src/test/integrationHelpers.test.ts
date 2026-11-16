import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-toastify", () => ({ toast: { info: vi.fn() } }));

import { toast } from "react-toastify";
import { orderProviders } from "../components/LlmProviderPicker";
import { isImageFile } from "../hooks/usePhotoDrop";
import { noteRemainingIdentifications } from "../services/identificationQuota";

const providers = [
    { id: "claude", label: "Claude", model: "claude-opus-5-5" },
    { id: "openai", label: "OpenAI", model: "" },
    { id: "ollama", label: "Ollama", model: "llama" },
];

describe("orderProviders", () => {
    it("puts the last choice first and keeps the rest in server order", () => {
        expect(orderProviders(providers, "ollama").map((p) => p.id)).toEqual(["ollama", "claude", "openai"]);
    });

    it("keeps the server order without a known last choice", () => {
        expect(orderProviders(providers, null)).toBe(providers);
        expect(orderProviders(providers, "gone")).toBe(providers);
    });
});

describe("isImageFile", () => {
    it("accepts images by type, and HEIC without a type by name", () => {
        expect(isImageFile(new File(["x"], "a.jpg", { type: "image/jpeg" }))).toBe(true);
        expect(isImageFile(new File(["x"], "IMG_0001.HEIC", { type: "" }))).toBe(true);
        expect(isImageFile(new File(["x"], "notes.pdf", { type: "application/pdf" }))).toBe(false);
    });
});

describe("noteRemainingIdentifications", () => {
    beforeEach(() => vi.clearAllMocks());

    it("says nothing while plenty are left or Pl@ntNet didn't say", () => {
        noteRemainingIdentifications({ remaining_identifications: 300 });
        noteRemainingIdentifications({ remaining_identifications: null });
        noteRemainingIdentifications({});
        expect(toast.info).not.toHaveBeenCalled();
    });

    it("tells how many are left when it runs low, and when it is the last", () => {
        const data = { remaining_identifications: 12 };
        expect(noteRemainingIdentifications(data)).toBe(data);
        expect(toast.info).toHaveBeenLastCalledWith("12 Pl@ntNet identifications left today.", expect.anything());
        noteRemainingIdentifications({ remaining_identifications: 0 });
        expect(vi.mocked(toast.info).mock.lastCall?.[0]).toMatch(/last Pl@ntNet identification/);
    });
});
