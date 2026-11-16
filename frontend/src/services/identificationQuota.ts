import { toast } from "react-toastify";

// Below this many identifications left today, every identification says how many remain.
export const LOW_QUOTA = 50;

/** Tells the user when the daily Pl@ntNet allowance runs low. Identify responses carry
 *  `remaining_identifications` (null when Pl@ntNet didn't say). Returns the response. */
export function noteRemainingIdentifications<T>(data: T): T {
    const remaining = (data as { remaining_identifications?: number | null } | null)?.remaining_identifications;
    if (typeof remaining === "number" && remaining <= LOW_QUOTA) {
        const message =
            remaining === 0
                ? "That was the last Pl@ntNet identification for today. It resets tomorrow."
                : `${remaining} Pl@ntNet identification${remaining === 1 ? "" : "s"} left today.`;
        toast.info(message, { toastId: "plantnet-quota" });
    }
    return data;
}
