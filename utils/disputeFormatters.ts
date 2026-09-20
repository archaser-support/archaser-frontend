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
        'Accepted - Settled partly': 'Accepted - Settled Partly',
        'Accepted_Settled_in_full': 'Accepted - Settled in Full',
        'Accepted -  Settled in full': 'Accepted - Settled in Full',
        'Accepted': 'Accepted',
        'Cancelled': 'Cancelled',
        'Admin_Fixed_Balance_Unchanged': 'Admin Fixed – Balance Unchanged',
        'Admin Fixed – Balance Unchanged': 'Admin Fixed – Balance Unchanged',
    };
    return resolutionMap[resolution] || resolution;
}

const DISPUTE_RESOLUTION_I18N_KEY: Record<string, string> = {
    Denied: "disputes.values.status_denied",
    Accepted_Settled_partly: "disputes.values.status_accepted_settled_partly",
    "Accepted - Settled partly": "disputes.values.status_accepted_settled_partly",
    Accepted_Settled_in_full: "disputes.values.status_accepted_settled_in_full",
    "Accepted -  Settled in full": "disputes.values.status_accepted_settled_in_full",
    Accepted: "disputes.values.status_accepted",
    Cancelled: "disputes.values.status_cancelled",
    Admin_Fixed_Balance_Unchanged:
        "disputes.values.status_admin_fixed_balance_unchanged",
    "Admin Fixed – Balance Unchanged":
        "disputes.values.status_admin_fixed_balance_unchanged",
};

export function toDisputeResolutionI18nPlaceholder(value: string): string {
    const key = DISPUTE_RESOLUTION_I18N_KEY[value.trim()];
    return key ? `{{${key}}}` : value;
}

export function formatDisputeResolutionLabel(
    value: string,
    t: (key: string, options?: Record<string, unknown>) => string
): string {
    const key = DISPUTE_RESOLUTION_I18N_KEY[value.trim()];
    if (!key) {
        return formatDisputeResolution(value);
    }
    const leaf = key.replace(/^disputes\./, "");
    const translated = t(leaf, {
        ns: "disputes",
        defaultValue: formatDisputeResolution(value),
    });
    return translated || formatDisputeResolution(value);
}

/** Wrap raw resolution enums stored in timeline activity-value spans. */
export function wrapDisputeResolutionActivityValues(html: string): string {
    if (!html || !html.includes("activity-value")) {
        return html;
    }
    return html.replace(
        /(<span class="activity-value">)([^<]*)(<\/span>)/g,
        (_match, open: string, value: string, close: string) =>
            `${open}${toDisputeResolutionI18nPlaceholder(value.trim())}${close}`
    );
}
