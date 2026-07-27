import { prisma } from "@/lib/prisma";
import { getCustomersWithInvalidContactsWhereClause, getInvalidContactWhereClause } from "@/shared/services/invalidContactService";
import { getCustomersWithoutContactWhereClause } from "@/shared/services/noContactService";

// Base query logic for invoices without customer (shared between count and list functions)
export const getInvoicesWithoutCustomerBaseQuery = (accountId: number, query?: string) => {
    let where: any = {
        account_id: accountId,
        customer_id: null, // Find invoices without customers
    };

    // Add search functionality if query is provided
    if (query && typeof query === "string" && query.trim()) {
        const searchTerm = query.trim();
        const searchConditions: any[] = [
            // Search in invoice number (since these invoices have no customer)
            {
                invoice_number: { contains: searchTerm, mode: "insensitive" }
            }
        ];

        // Add numeric field searches for amounts (including negative numbers)
        if (!isNaN(parseFloat(searchTerm))) {
            const parsedAmount = parseFloat(searchTerm);
            searchConditions.push(
                {
                    amount: {
                        gte: parsedAmount,
                        lt: parsedAmount + 1,
                    },
                },
                {
                    customer_amount: {
                        gte: parsedAmount,
                        lt: parsedAmount + 1,
                    },
                },
                {
                    customer_outstanding_debt: {
                        gte: parsedAmount,
                        lt: parsedAmount + 1,
                    },
                },
                {
                    customer_net_amount: {
                        gte: parsedAmount,
                        lt: parsedAmount + 1,
                    },
                }
            );
        }

        where = {
            ...where,
            AND: [
                ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
                {
                    OR: searchConditions
                }
            ]
        };
    }

    return where;
};

// Unified function for counting invoices without customer
export const getInvoicesWithoutCustomerCount = async (accountId: number): Promise<{ active: number; inactive: number }> => {
    const whereClause = getInvoicesWithoutCustomerBaseQuery(accountId);

    // Count all invoices without customer (same logic as the working table function)
    const totalCount = await prisma.invoice.count({
        where: whereClause,
    });

    // For now, we'll return the same count for both active and inactive
    // since invoices without customer don't have a customer to check collection_status
    return {
        active: totalCount,
        inactive: 0, // Invoices without customer are considered "active" for this metric
    };
};

// Base query logic for orphan credit invoices (shared between count and list functions)
export const getOrphanCreditInvoicesBaseQuery = (accountId: number, ownerFilter: any = {}) => {
    return {
        account_id: accountId,
        // Only include credit invoices
        amount: { lt: 0 },
        // Exclude invoices that have already been assigned to other invoices
        credit_for_invoice_id: null,
        // Only include invoices with active customers
        Customer: {
            collection_status: "Active",
            ...ownerFilter,
        },
    };
};

// Unified function for counting orphan credit invoices
export const getOrphanCreditInvoicesCount = async (accountId: number, ownerFilter: any = {}): Promise<{ active: number; inactive: number }> => {
    const whereClause = getOrphanCreditInvoicesBaseQuery(accountId, ownerFilter);

    // Count active orphan credit invoices
    const activeCount = await prisma.invoice.count({
        where: whereClause,
    });

    // Count inactive orphan credit invoices
    const inactiveCount = await prisma.invoice.count({
        where: {
            ...whereClause,
            Customer: {
                ...whereClause.Customer,
                collection_status: "Inactive",
            },
        },
    });

    return {
        active: activeCount,
        inactive: inactiveCount,
    };
};

export interface ControlCenterUpdate {
    type: "control-center-update";
    data: {
        noContacts: { active: number; inactive: number };
        invalidContacts: { active: number; inactive: number };
        invoicesWithoutCustomer: { active: number; inactive: number };
        orphanCreditInvoices: { active: number; inactive: number };
    };
    timestamp: number;
    reason?: string;
    userId?: string; // User who should receive this update
    excludeFromNotifications?: boolean; // Whether to exclude from notification dropdown
    source?: "manual" | "automated" | "user-action"; // Source of the update
}

class ControlCenterRealtimeService {
    private static instance: ControlCenterRealtimeService;
    private connectedClients: Map<
        string,
        { client: any; userId: string; hasViewAsPermission: boolean }
    > = new Map();

    private constructor() { }

    public static getInstance(): ControlCenterRealtimeService {
        if (!ControlCenterRealtimeService.instance) {
            ControlCenterRealtimeService.instance =
                new ControlCenterRealtimeService();
        }
        return ControlCenterRealtimeService.instance;
    }

    // Add a client to receive updates
    public addClient(
        client: any,
        userId: string,
        hasViewAsPermission: boolean = false
    ) {
        this.connectedClients.set(client.id || Date.now().toString(), {
            client,
            userId,
            hasViewAsPermission,
        });
    }

    // Remove a client
    public removeClient(client: any) {
        const entries = Array.from(this.connectedClients.entries());
        for (const [key, value] of entries) {
            if (value.client === client) {
                this.connectedClients.delete(key);
                break;
            }
        }
    }

    // Broadcast update to relevant clients based on user assignment
    public broadcastUpdate(update: ControlCenterUpdate) {
        const message = JSON.stringify(update);

        this.connectedClients.forEach(
            ({ client, userId, hasViewAsPermission }) => {
                try {
                    // Skip if client is not ready
                    if (client.readyState !== 1) {
                        // WebSocket.OPEN
                        return;
                    }

                    // Determine if this user should receive this update
                    const shouldReceiveUpdate = this.shouldUserReceiveUpdate(
                        update,
                        userId,
                        hasViewAsPermission
                    );

                    if (shouldReceiveUpdate) {
                        client.send(message);
                    }
                } catch (error) {
                    console.error("Error sending update to client:", error);
                    this.removeClient(client);
                }
            }
        );
    }

    // Determine if a user should receive a specific update
    private shouldUserReceiveUpdate(
        update: ControlCenterUpdate,
        userId: string,
        hasViewAsPermission: boolean
    ): boolean {
        // If update is specifically for a user, only send to that user
        if (update.userId && update.userId !== userId) {
            return false;
        }

        // If update is from automated process and should be excluded from notifications,
        // only send to users with use_view_as permission or if it's a general stats update
        if (update.excludeFromNotifications && update.source === "automated") {
            return hasViewAsPermission; // Only users with use_view_as permission get automated process updates
        }

        // For user-specific actions, send to the user who performed the action and users with use_view_as permission
        if (update.source === "user-action" && update.userId) {
            return userId === update.userId || hasViewAsPermission;
        }

        // For general updates, send to all users
        return true;
    }

    // Fetch current Control Center stats for a specific user
    public async getCurrentStatsForUser(
        userId: string,
        hasViewAsPermission: boolean = false
    ): Promise<ControlCenterUpdate["data"]> {
        const accountId = 10013; // Default account ID, should be configurable

        // Build owner filter based on permissions
        const ownerFilter = hasViewAsPermission
            ? {}
            : {
                OR: [{ owner_id: userId }, { owner_id: null }],
            };

        const [
            noContactsActive,
            noContactsInactive,
            invalidContactsActive,
            invalidContactsInactive,
            invoicesWithoutCustomerCounts,
            orphanCreditInvoicesCounts,
        ] = await Promise.all([
            // Customers with no contacts (through company) - filtered by user assignment
            prisma.customer.count({
                where: getCustomersWithoutContactWhereClause({
                    accountId,
                    ownerFilter,
                    collectionStatus: "Active",
                }),
            }),
            prisma.customer.count({
                where: getCustomersWithoutContactWhereClause({
                    accountId,
                    ownerFilter,
                    collectionStatus: "Inactive",
                }),
            }),
            // Contacts with invalid details - use standardized function
            prisma.contact.count({
                where: getInvalidContactWhereClause({
                    accountId,
                    ownerFilter,
                    collectionStatus: "Active",
                }),
            }),
            prisma.contact.count({
                where: getInvalidContactWhereClause({
                    accountId,
                    ownerFilter,
                    collectionStatus: "Inactive",
                }),
            }),
            // Invoices without customer - use unified function
            getInvoicesWithoutCustomerCount(accountId),
            // Orphan credit invoices - use unified function with owner filter
            getOrphanCreditInvoicesCount(accountId, ownerFilter),
        ]);

        return {
            noContacts: {
                active: noContactsActive,
                inactive: noContactsInactive,
            },
            invalidContacts: {
                active: invalidContactsActive,
                inactive: invalidContactsInactive,
            },
            invoicesWithoutCustomer: invoicesWithoutCustomerCounts,
            orphanCreditInvoices: orphanCreditInvoicesCounts,
        };
    }

    // Trigger a real-time update with user filtering
    public async triggerUpdate(
        reason: string,
        options: {
            userId?: string;
            excludeFromNotifications?: boolean;
            source?: "manual" | "automated" | "user-action";
        } = {}
    ) {
        try {
            // For user-specific updates, get stats for that user
            if (options.userId) {
                const stats = await this.getCurrentStatsForUser(options.userId);
                const update: ControlCenterUpdate = {
                    type: "control-center-update",
                    data: stats,
                    timestamp: Date.now(),
                    reason,
                    userId: options.userId,
                    excludeFromNotifications: options.excludeFromNotifications,
                    source: options.source,
                };

                this.broadcastUpdate(update);
                return update;
            } else {
                // For general updates, get stats for all users (account manager view)
                const stats = await this.getCurrentStats();
                const update: ControlCenterUpdate = {
                    type: "control-center-update",
                    data: stats,
                    timestamp: Date.now(),
                    reason,
                    excludeFromNotifications: options.excludeFromNotifications,
                    source: options.source,
                };

                this.broadcastUpdate(update);
                return update;
            }
        } catch (error) {
            console.error("Error triggering Control Center update:", error);
            throw error;
        }
    }

    // Fetch current Control Center stats (general - for account managers)
    public async getCurrentStats(): Promise<ControlCenterUpdate["data"]> {
        const accountId = 10013; // Default customer ID, should be configurable

        const [
            noContactsActive,
            noContactsInactive,
            invalidContactsActive,
            invalidContactsInactive,
            invoicesWithoutCustomerCounts,
            orphanCreditInvoicesCounts,
        ] = await Promise.all([
            // Customers with no contacts - use standardized function
            prisma.customer.count({
                where: getCustomersWithoutContactWhereClause({
                    accountId,
                    ownerFilter: {},
                    collectionStatus: "Active",
                }),
            }),
            prisma.customer.count({
                where: getCustomersWithoutContactWhereClause({
                    accountId,
                    ownerFilter: {},
                    collectionStatus: "Inactive",
                }),
            }),
            // Contacts with invalid details - use standardized function
            prisma.contact.count({
                where: getInvalidContactWhereClause({
                    accountId,
                    ownerFilter: {},
                    collectionStatus: "Active",
                }),
            }),
            prisma.contact.count({
                where: getInvalidContactWhereClause({
                    accountId,
                    ownerFilter: {},
                    collectionStatus: "Inactive",
                }),
            }),
            // Invoices without customer - use unified function
            getInvoicesWithoutCustomerCount(accountId),
            // Orphan credit invoices - use unified function
            getOrphanCreditInvoicesCount(accountId, {}),
        ]);

        return {
            noContacts: {
                active: noContactsActive,
                inactive: noContactsInactive,
            },
            invalidContacts: {
                active: invalidContactsActive,
                inactive: invalidContactsInactive,
            },
            invoicesWithoutCustomer: invoicesWithoutCustomerCounts,
            orphanCreditInvoices: orphanCreditInvoicesCounts,
        };
    }

    // Get connected clients count
    public getConnectedClientsCount(): number {
        return this.connectedClients.size;
    }

    // Get connected users info
    public getConnectedUsersInfo(): Array<{
        userId: string;
        hasViewAsPermission: boolean;
    }> {
        return Array.from(this.connectedClients.values()).map(
            ({ userId, hasViewAsPermission }) => ({
                userId,
                hasViewAsPermission,
            })
        );
    }
}

export default ControlCenterRealtimeService;
