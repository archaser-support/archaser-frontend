import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";

import { LogService } from "./LogService";
import { NotificationStats } from "./NotificationService";

export interface NotificationUpdate {
    type: "notification-update";
    data: NotificationStats;
    timestamp: number;
    userId?: string;
    reason?: string;
}

interface ConnectedClient {
    id: string;
    userId: string;
    accountId: number;
    readyState: number;
    send: (message: string) => void;
}

class NotificationRealtimeService {
    private static instance: NotificationRealtimeService;
    private connectedClients: Map<string, ConnectedClient> = new Map();
    private logService: LogService;

    private constructor() {
        this.logService = LogService.getInstance();
    }

    public static getInstance(): NotificationRealtimeService {
        if (!NotificationRealtimeService.instance) {
            NotificationRealtimeService.instance =
                new NotificationRealtimeService();
        }
        return NotificationRealtimeService.instance;
    }

    // Add a client to the service
    public async addClient(
        client: ConnectedClient,
        userId: string,
        accountId: number
    ) {
        this.connectedClients.set(client.id, { ...client, userId, accountId });

        // Fetch user name and account name for logging
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    name: true,
                    email: true,
                    account_id: true,
                },
            });

            const userName = user?.name || user?.email || userId;

            // Fetch account name
            let accountName: string | null = null;
            if (accountId) {
                try {
                    const account = await prisma.account.findUnique({
                        where: { id: accountId },
                        select: { name: true },
                    });
                    accountName = account?.name || null;
                } catch (accountError) {
                    // Account fetch failed, continue without account name
                }
            }

            this.logService.logMessage(
                LogLevel.INFO,
                `Notification client connected: ${userName}${accountName ? ` (${accountName})` : ""}`,
                "NotificationRealtimeService",
                {
                    userId,
                    userName,
                    accountId,
                    accountName,
                    totalClients: this.connectedClients.size,
                }
            );
        } catch (error) {
            // Fallback to userId if database query fails
            this.logService.logMessage(
                LogLevel.INFO,
                `Notification client connected: ${userId}`,
                "NotificationRealtimeService",
                { userId, accountId, totalClients: this.connectedClients.size }
            );
        }
    }

    // Remove a client from the service
    public removeClient(clientId: string) {
        const client = this.connectedClients.get(clientId);
        if (client) {
            this.connectedClients.delete(clientId);

            this.logService.logMessage(
                LogLevel.INFO,
                `Notification client disconnected: ${clientId}`,
                "NotificationRealtimeService",
                {
                    userId: client.userId,
                    totalClients: this.connectedClients.size,
                }
            );
        }
    }

    // Broadcast notification update to relevant clients
    public broadcastNotificationUpdate(update: NotificationUpdate) {
        const message = JSON.stringify(update);
        // Broadcasting notification update to clients

        let sentCount = 0;
        this.connectedClients.forEach((client) => {
            try {
                // Skip if client is not ready
                if (client.readyState !== 1) {
                    // WebSocket.OPEN
                    // Skipping client - not ready
                    return;
                }

                // Determine if this user should receive this update
                const shouldReceiveUpdate = this.shouldUserReceiveUpdate(
                    update,
                    client.userId
                );
                // Client should receive update

                if (shouldReceiveUpdate) {
                    client.send(message);
                    sentCount++;
                    // Sent notification update to client
                    this.logService.logMessage(
                        LogLevel.INFO,
                        `Sent notification update to user ${client.userId}`,
                        "NotificationRealtimeService",
                        { reason: update.reason, totalCount: update.data.total }
                    );
                }
            } catch (error) {
                // Error sending notification update to client
                this.logService.logMessage(
                    LogLevel.ERROR,
                    `Error sending notification update to client: ${error}`,
                    "NotificationRealtimeService",
                    { clientId: client.id, userId: client.userId }
                );
                this.removeClient(client.id);
            }
        });

        // Broadcasted notification update to clients
        this.logService.logMessage(
            LogLevel.INFO,
            `Broadcasted notification update to relevant clients`,
            "NotificationRealtimeService",
            { reason: update.reason, totalClients: this.connectedClients.size }
        );
    }

    // Determine if a user should receive a specific update
    private shouldUserReceiveUpdate(
        update: NotificationUpdate,
        userId: string
    ): boolean {
        // If update is specifically for a user, only send to that user
        if (update.userId && update.userId !== userId) {
            return false;
        }

        // For broadcast updates (empty userId), send to all users
        if (!update.userId || update.userId === "") {
            return true;
        }

        // For general updates, send to all users
        return true;
    }

    // Trigger a notification update
    public async triggerNotificationUpdate(
        userId: string,
        accountId: number,
        reason: string,
        stats: NotificationUpdate["data"]
    ) {
        try {
            // NotificationRealtimeService.triggerNotificationUpdate called

            const update: NotificationUpdate = {
                type: "notification-update",
                data: stats,
                timestamp: Date.now(),
                userId,
                reason,
            };

            this.broadcastNotificationUpdate(update);
            // Notification update broadcasted successfully
            return update;
        } catch (error) {
            // Error triggering notification update
            this.logService.logMessage(
                LogLevel.ERROR,
                `Error triggering notification update: ${error}`,
                "NotificationRealtimeService",
                { userId, reason }
            );
            throw error;
        }
    }

    // Get connected clients count
    public getConnectedClientsCount(): number {
        return this.connectedClients.size;
    }

    // Get connected clients for a specific user
    public getConnectedClientsForUser(userId: string): ConnectedClient[] {
        return Array.from(this.connectedClients.values()).filter(
            (client) => client.userId === userId
        );
    }
}

export default NotificationRealtimeService;
