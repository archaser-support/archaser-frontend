import { apiFetch } from "@/utils/apiFetch";
/**
 * Utility functions for triggering real-time Control Center updates
 */

/**
 * Trigger a real-time Control Center update
 * @param reason - The reason for the update (will be logged)
 * @param options - Update options including user filtering and notification settings
 * @returns Promise<boolean> - True if successful, false if failed
 */
export async function triggerControlCenterUpdate(
    reason: string,
    options: {
        userId?: string;
        excludeFromNotifications?: boolean;
        source?: "manual" | "automated" | "user-action";
    } = {}
): Promise<boolean> {
    try {
        const response = await apiFetch(
            "/api/system/control-center/trigger-update",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ reason, ...options }),
            }
        );

        if (!response.ok) {
            console.error(
                "Failed to trigger Control Center update:",
                response.statusText
            );
            return false;
        }

        const result = await response.json();
        // Debug logging removed for production
        return true;
    } catch (error) {
        console.error("Error triggering Control Center update:", error);
        return false;
    }
}

/**
 * Trigger real-time update for dispute creation (user-specific)
 * @param customerId - The customer ID
 * @param userName - The user who created the dispute
 * @returns Promise<boolean>
 */
export async function triggerDisputeCreatedUpdate(
    customerId: number,
    userName: string
): Promise<boolean> {
    return triggerControlCenterUpdate(
        `Dispute created for customer ${customerId} by ${userName}`,
        {
            userId: userName,
            source: "user-action",
        }
    );
}

/**
 * Trigger real-time update for dispute resolution (user-specific)
 * @param disputeId - The dispute ID
 * @param customerId - The customer ID
 * @param status - The new dispute status
 * @param userId - The user who resolved the dispute
 * @returns Promise<boolean>
 */
export async function triggerDisputeResolvedUpdate(
    disputeId: number,
    customerId: number,
    status: string,
    userId: string
): Promise<boolean> {
    return triggerControlCenterUpdate(
        `Dispute ${disputeId} resolved for customer ${customerId} with status ${status}`,
        {
            userId,
            source: "user-action",
        }
    );
}

/**
 * Trigger real-time update for orphan credit invoice assignment (user-specific)
 * @param creditInvoiceId - The credit invoice ID
 * @param targetInvoiceId - The target invoice ID
 * @param userId - The user who performed the assignment
 * @returns Promise<boolean>
 */
export async function triggerOrphanCreditInvoiceUpdate(
    creditInvoiceId: number,
    targetInvoiceId: number,
    userId: string
): Promise<boolean> {
    return triggerControlCenterUpdate(
        `Orphan credit invoice ${creditInvoiceId} assigned to invoice ${targetInvoiceId}`,
        {
            userId,
            source: "user-action",
        }
    );
}

/**
 * Trigger real-time update for activity creation (automated - excluded from notifications)
 * @param activityCount - Number of activities created
 * @param collectionPeriodsUpdated - Number of collection periods updated
 * @returns Promise<boolean>
 */
export async function triggerActivityCreationUpdate(
    activityCount: number,
    collectionPeriodsUpdated: number
): Promise<boolean> {
    return triggerControlCenterUpdate(
        `Created ${activityCount} activities, updated ${collectionPeriodsUpdated} collection periods`,
        {
            excludeFromNotifications: true,
            source: "automated",
        }
    );
}

/**
 * Trigger real-time update for invoice status change (user-specific)
 * @param invoiceId - The invoice ID
 * @param oldStatus - The old status
 * @param newStatus - The new status
 * @param userId - The user who changed the status
 * @returns Promise<boolean>
 */
export async function triggerInvoiceStatusUpdate(
    invoiceId: number,
    oldStatus: string,
    newStatus: string,
    userId: string
): Promise<boolean> {
    return triggerControlCenterUpdate(
        `Invoice ${invoiceId} status changed from ${oldStatus} to ${newStatus}`,
        {
            userId,
            source: "user-action",
        }
    );
}

/**
 * Trigger real-time update for customer assignment (user-specific)
 * @param customerId - The customer ID
 * @param assigneeName - The assignee name
 * @param assignedBy - The user who performed the assignment
 * @returns Promise<boolean>
 */
export async function triggerCustomerAssignmentUpdate(
    customerId: number,
    assigneeName: string,
    assignedBy: string
): Promise<boolean> {
    return triggerControlCenterUpdate(
        `Customer ${customerId} assigned to ${assigneeName}`,
        {
            userId: assignedBy,
            source: "user-action",
        }
    );
}

/**
 * Trigger automated process update (excluded from notifications)
 * @param reason - The reason for the update
 * @returns Promise<boolean>
 */
export async function triggerAutomatedProcessUpdate(
    reason: string
): Promise<boolean> {
    return triggerControlCenterUpdate(reason, {
        excludeFromNotifications: true,
        source: "automated",
    });
}

/**
 * Trigger manual update (for admin/account manager actions)
 * @param reason - The reason for the update
 * @param userId - The user who performed the action
 * @returns Promise<boolean>
 */
export async function triggerManualUpdate(
    reason: string,
    userId: string
): Promise<boolean> {
    return triggerControlCenterUpdate(reason, {
        userId,
        source: "manual",
    });
}
