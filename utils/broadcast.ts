// Type definitions
interface BroadcastMessage {
    type: string;
    data: any;
    timestamp?: string;
}

// Broadcast message types
export const BROADCAST_TYPES = {
    REFRESH_TIMELINE: "REFRESH_TIMELINE",
    CONTROL_CENTER_STATS_UPDATED: "CONTROL_CENTER_STATS_UPDATED",
    CUSTOMER_UPDATED: "CUSTOMER_UPDATED",
    INVOICE_UPDATED: "INVOICE_UPDATED",
    CONTACT_UPDATED: "CONTACT_UPDATED",
} as const;

// Check if we're in a browser environment
const isBrowser = typeof window !== "undefined";

// Initialize the broadcast channel only in browser
// Use global to persist across hot reloads in development
let channel: BroadcastChannel | null = null;
const listeners: Set<(message: any) => void> = new Set();

if (isBrowser) {
    // Check if channel already exists in global scope (for hot reloading)
    if (typeof window !== "undefined") {
        (window as any).__archaserBroadcastChannel =
            (window as any).__archaserBroadcastChannel || null;
        channel = (window as any).__archaserBroadcastChannel;
    }

    // Only create channel if it doesn't exist
    if (!channel) {
        try {
            // Use native BroadcastChannel API
            channel = new BroadcastChannel(
                "archaser-timeline-broadcast-channel"
            );
            channel.onmessage = (event) => {
                // Notify all listeners
                listeners.forEach((listener) => {
                    try {
                        listener(event.data);
                    } catch (_error) {
                        // Silent fail
                    }
                });
            };

            // Store in global for hot reload persistence
            if (typeof window !== "undefined") {
                (window as any).__archaserBroadcastChannel = channel;
            }
        } catch (_error) {
            channel = null;
        }
    } else {
        // Reuse existing channel, but ensure onmessage handler is set
        channel.onmessage = (event) => {
            // Notify all listeners
            listeners.forEach((listener) => {
                try {
                    listener(event.data);
                } catch (_error) {
                    // Silent fail
                }
            });
        };
    }
}

// Export the broadcast function
export const broadcast = {
    postMessage: (message: BroadcastMessage): void => {
        if (typeof window === "undefined" || !channel) {
            return;
        }

        try {
            // Ensure the message is serializable by creating a clean copy
            const cleanMessage = {
                type: message.type,
                data: {
                    ...message.data,
                    // Ensure all properties are serializable
                    customerId: String(message.data.customerId),
                    timestamp: message.data.timestamp,
                    messageId: message.data.messageId,
                    timeline: message.data.timeline || [],
                    totalRecords: message.data.totalRecords || 0,
                },
            };

            channel.postMessage(cleanMessage);
        } catch (_error) {
            // Silent fail
        }
    },

    addListener: (listener: (message: any) => void): void => {
        listeners.add(listener);
    },

    removeListener: (listener: (message: any) => void): void => {
        listeners.delete(listener);
    },
};
