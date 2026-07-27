import { apiFetch } from "@/utils/apiFetch";
/**
 * Shared notification service for frontend components
 */

/**
 * Clear dispute notifications for the current user
 */
export const clearDisputeNotifications = async (): Promise<void> => {
    try {
        const response = await apiFetch("/api/operations/notifications", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "deleteByType",
                type: "Primary", // Dispute notifications use "Primary" type
            }),
        });

        if (response.ok) {
            // Trigger a custom event to notify the notification center to refresh
            window.dispatchEvent(new CustomEvent('notificationsCleared', { 
                detail: { type: 'Primary' } 
            }));
        } else {
            console.error("Failed to clear dispute notifications:", response.status, response.statusText);
        }
    } catch (error) {
        console.error("Error clearing dispute notifications:", error);
    }
};

/**
 * Clear all notifications for the current user
 */
export const clearAllNotifications = async (): Promise<void> => {
    try {
        const response = await apiFetch("/api/operations/notifications", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "deleteAll",
            }),
        });

        if (!response.ok) {
            console.error("Failed to clear all notifications:", response.status, response.statusText);
        }
    } catch (error) {
        console.error("Error clearing all notifications:", error);
    }
};

/** Mark a single notification as read via Nest REST. */
export const markNotificationRead = async (
    notificationId: string
): Promise<boolean> => {
    try {
        const response = await apiFetch(
            `/api/operations/notifications/${notificationId}`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "markRead", read: true }),
            }
        );
        return response.ok;
    } catch (error) {
        console.error("Error marking notification read:", error);
        return false;
    }
};
