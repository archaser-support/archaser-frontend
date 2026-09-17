/** Job statuses that warrant auto-opening the Portfolio Health Generate modal. */
export type GenerateModalJobStatus =
    | "idle"
    | "running"
    | "paused"
    | "failed"
    | "complete";

export type GenerateModalAttentionStatus = "running" | "paused" | "failed";

export function isGenerateModalAttentionStatus(
    status: GenerateModalJobStatus | null | undefined
): status is GenerateModalAttentionStatus {
    return (
        status === "running" || status === "paused" || status === "failed"
    );
}

export type GenerateModalAutoOpenInput = {
    /** Current backfill job status (idle when unknown). */
    status: GenerateModalJobStatus;
    /**
     * Previous status from the last evaluation this visit.
     * `null` means first evaluation (land / mount).
     */
    previousStatus: GenerateModalJobStatus | null;
    /** True after the user closes the modal during the current attention episode. */
    dismissed: boolean;
};

export type GenerateModalAutoOpenResult = {
    shouldOpen: boolean;
    /** Dismiss flag to keep for the next evaluation. */
    nextDismissed: boolean;
};

/**
 * Decides whether the Generate modal should auto-open for attention states.
 *
 * - Opens on land when status is running/paused/failed.
 * - After dismiss, stays closed while the same attention status continues (polling).
 * - Re-opens on a new attention transition (e.g. idle→running, running→failed).
 * - Clears dismiss when leaving attention so the next episode can auto-open.
 */
export function resolveGenerateModalAutoOpen(
    input: GenerateModalAutoOpenInput
): GenerateModalAutoOpenResult {
    const { status, previousStatus, dismissed } = input;

    if (!isGenerateModalAttentionStatus(status)) {
        return { shouldOpen: false, nextDismissed: false };
    }

    const enteredAttention =
        previousStatus == null ||
        !isGenerateModalAttentionStatus(previousStatus);
    const changedAttentionState =
        previousStatus != null &&
        isGenerateModalAttentionStatus(previousStatus) &&
        previousStatus !== status;

    if (enteredAttention || changedAttentionState) {
        return { shouldOpen: true, nextDismissed: false };
    }

    // Same attention status continuing (e.g. poll): do not re-force open.
    return { shouldOpen: false, nextDismissed: dismissed };
}
