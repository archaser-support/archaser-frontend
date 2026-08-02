/**
 * Utility functions for formatting dispute-related values for display
 */

/**
 * Format a dispute id for display (e.g. 726 → "DIS-000726").
 */
export function formatDisputeNumber(id: number | string | null | undefined): string {
    if (id == null || id === "") {
        return "";
    }
    const numeric = typeof id === "number" ? id : Number(id);
    if (Number.isFinite(numeric)) {
        return `DIS-${String(numeric).padStart(6, "0")}`;
    }
    return `DIS-${String(id)}`;
}

/**
 * Format dispute status enum values to user-friendly display names
 * @param status - Raw database enum value (e.g., "Under_Review")
 * @returns Formatted display name (e.g., "Under Review")
 */
export function formatDisputeStatus(status: string): string {
    const statusMap: Record<string, string> = {
        'New': 'New',
        'Under_Review': 'Under Review',
        'Awaiting_Update': 'Awaiting Update',
        'Resolved': 'Resolved',
        'Cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
}

/**
 * Format dispute resolution enum values to user-friendly display names
 * @param resolution - Raw database enum value (e.g., "Accepted_Settled_partly")
 * @returns Formatted display name (e.g., "Accepted - Settled Partly")
 */
export function formatDisputeResolution(resolution: string): string {
    const resolutionMap: Record<string, string> = {
        'Denied': 'Denied',
        'Accepted_Settled_partly': 'Accepted - Settled Partly',
        'Accepted_Settled_in_full': 'Accepted - Settled in Full',
        'Accepted': 'Accepted',
        'Cancelled': 'Cancelled',
        'Admin_Fixed_Balance_Unchanged': 'Admin Fixed – Balance Unchanged'
    };
    return resolutionMap[resolution] || resolution;
}
