import type { DbClient } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { CustomerService } from "@/server/services/CustomerService";

import {
    deserializeCheckpointRow,
    deserializeCheckpointRows,
} from "./deserializeCheckpointRow";
import {
    serializeCheckpointRow,
    serializeCheckpointRows,
} from "./serializeCheckpointRow";
import {
    CUSTOMER_CHECKPOINT_SCHEMA_VERSION,
    CustomerCheckpointNotFoundError,
    CustomerCheckpointInvalidBaselineError,
    checkpointHasArData,
    type CustomerCheckpointPayload,
    type CustomerCheckpointRestoreSummary,
    type CustomerCheckpointRowCounts,
    type CustomerCheckpointStatus,
} from "./types";

type CheckpointCreateManyDelegate = {
    createMany: (args: {
        data: Record<string, unknown>[];
    }) => Promise<unknown>;
};

function getRowCounts(
    payload: CustomerCheckpointPayload
): CustomerCheckpointRowCounts {
    const { tables } = payload;
    return {
        invoices: tables.invoices.length,
        invoicePayments: tables.invoicePayments.length,
        payments: tables.payments.length,
        collectionPeriods: tables.collectionPeriods.length,
        activities: tables.activities.length,
        activityContacts: tables.activityContacts.length,
        disputes: tables.disputes.length,
        disputeInvoices: tables.disputeInvoices.length,
        customerPolicies: tables.customerPolicies.length,
        customerTopUps: tables.customerTopUps.length,
        contacts: tables.contacts.length,
        customerBanks: tables.customerBanks.length,
        hasAggregatedData: tables.aggregatedData !== null,
    };
}

export class CustomerCheckpointService {
    static getInstance(): CustomerCheckpointService {
        return new CustomerCheckpointService();
    }

    async captureCustomerSubtree(
        customerId: number,
        dbClient: DbClient = prisma
    ): Promise<CustomerCheckpointPayload> {
        const customer = await dbClient.customer.findUnique({
            where: { id: customerId },
        });
        if (!customer) {
            throw new Error("Customer not found");
        }

        const [
            invoices,
            invoicePayments,
            payments,
            collectionPeriods,
            activities,
            disputes,
            aggregatedData,
            customerPolicies,
            customerTopUps,
            contacts,
            customerBanks,
        ] = await Promise.all([
            dbClient.invoice.findMany({
                where: { customer_id: customerId },
                orderBy: { id: "asc" },
            }),
            dbClient.invoicePayment.findMany({
                where: { customer_id: customerId },
                orderBy: { id: "asc" },
            }),
            dbClient.payment.findMany({
                where: { customer_id: customerId },
                orderBy: { id: "asc" },
            }),
            dbClient.customerCollectionPeriod.findMany({
                where: { customer_id: customerId },
                orderBy: { id: "asc" },
            }),
            dbClient.activity.findMany({
                where: { customer_id: customerId },
                orderBy: { id: "asc" },
            }),
            dbClient.customerDispute.findMany({
                where: { customer_id: customerId },
                orderBy: { id: "asc" },
            }),
            dbClient.customerAggregatedData.findUnique({
                where: { customer_id: customerId },
            }),
            dbClient.customerPolicy.findMany({
                where: { customer_id: customerId },
                orderBy: { id: "asc" },
            }),
            dbClient.customerTopUp.findMany({
                where: { customer_id: customerId },
                orderBy: { id: "asc" },
            }),
            dbClient.contact.findMany({
                where: { customer_id: customerId },
                orderBy: { id: "asc" },
            }),
            dbClient.customerBanks.findMany({
                where: { customer_id: customerId },
                orderBy: { id: "asc" },
            }),
        ]);

        const activityIds = activities.map((a) => a.id);
        const disputeIds = disputes.map((d) => d.id);

        const [activityContacts, disputeInvoices] = await Promise.all([
            activityIds.length > 0
                ? dbClient.activityContact.findMany({
                      where: { activity_id: { in: activityIds } },
                      orderBy: { id: "asc" },
                  })
                : Promise.resolve([]),
            disputeIds.length > 0
                ? dbClient.disputeInvoice.findMany({
                      where: { dispute_id: { in: disputeIds } },
                      orderBy: { id: "asc" },
                  })
                : Promise.resolve([]),
        ]);

        const capturedAt = new Date().toISOString();

        return {
            schemaVersion: CUSTOMER_CHECKPOINT_SCHEMA_VERSION,
            capturedAt,
            tables: {
                customer: serializeCheckpointRow(
                    customer as Record<string, unknown>
                ),
                invoices: serializeCheckpointRows(
                    invoices as Record<string, unknown>[]
                ),
                invoicePayments: serializeCheckpointRows(
                    invoicePayments as Record<string, unknown>[]
                ),
                payments: serializeCheckpointRows(
                    payments as Record<string, unknown>[]
                ),
                collectionPeriods: serializeCheckpointRows(
                    collectionPeriods as Record<string, unknown>[]
                ),
                activities: serializeCheckpointRows(
                    activities as Record<string, unknown>[]
                ),
                activityContacts: serializeCheckpointRows(
                    activityContacts as Record<string, unknown>[]
                ),
                disputes: serializeCheckpointRows(
                    disputes as Record<string, unknown>[]
                ),
                disputeInvoices: serializeCheckpointRows(
                    disputeInvoices as Record<string, unknown>[]
                ),
                aggregatedData: aggregatedData
                    ? serializeCheckpointRow(
                          aggregatedData as Record<string, unknown>
                      )
                    : null,
                customerPolicies: serializeCheckpointRows(
                    customerPolicies as Record<string, unknown>[]
                ),
                customerTopUps: serializeCheckpointRows(
                    customerTopUps as Record<string, unknown>[]
                ),
                contacts: serializeCheckpointRows(
                    contacts as Record<string, unknown>[]
                ),
                customerBanks: serializeCheckpointRows(
                    customerBanks as Record<string, unknown>[]
                ),
            },
        };
    }

    async getCheckpointStatus(
        customerId: number,
        dbClient: DbClient = prisma
    ): Promise<CustomerCheckpointStatus | null> {
        const checkpoint = await dbClient.customerCheckpoint.findUnique({
            where: { customer_id: customerId },
            select: {
                saved_at: true,
                saved_by: true,
                payload: true,
            },
        });

        if (!checkpoint) {
            return null;
        }

        const payload = checkpoint.payload as CustomerCheckpointPayload;

        return {
            exists: true,
            savedAt: checkpoint.saved_at.toISOString(),
            savedBy: checkpoint.saved_by,
            rowCounts: getRowCounts(payload),
        };
    }

    async saveCustomerCheckpoint(
        customerId: number,
        accountId: number,
        savedByUserId: string,
        dbClient: DbClient = prisma,
        options?: { requireEmptyArBaseline?: boolean }
    ): Promise<CustomerCheckpointStatus> {
        const payload = await this.captureCustomerSubtree(customerId, dbClient);
        const rowCounts = getRowCounts(payload);

        if (
            options?.requireEmptyArBaseline &&
            checkpointHasArData(rowCounts)
        ) {
            throw new CustomerCheckpointInvalidBaselineError(
                `Checkpoint baseline must not include invoices or invoice payments (found ${rowCounts.invoices} invoices, ${rowCounts.invoicePayments} invoice payments)`
            );
        }

        const savedAt = new Date();

        const checkpoint = await dbClient.customerCheckpoint.upsert({
            where: { customer_id: customerId },
            create: {
                customer_id: customerId,
                account_id: accountId,
                payload,
                saved_at: savedAt,
                saved_by: savedByUserId,
            },
            update: {
                account_id: accountId,
                payload,
                saved_at: savedAt,
                saved_by: savedByUserId,
            },
            select: {
                saved_at: true,
                saved_by: true,
            },
        });

        return {
            exists: true,
            savedAt: checkpoint.saved_at.toISOString(),
            savedBy: checkpoint.saved_by,
            rowCounts: getRowCounts(payload),
        };
    }

    async restoreCustomerCheckpoint(
        customerId: number,
        accountId: number,
        dbClient: DbClient = prisma
    ): Promise<CustomerCheckpointRestoreSummary> {
        const checkpoint = await dbClient.customerCheckpoint.findUnique({
            where: { customer_id: customerId },
            select: { payload: true },
        });

        if (!checkpoint) {
            throw new CustomerCheckpointNotFoundError(customerId);
        }

        const payload = checkpoint.payload as CustomerCheckpointPayload;
        const savedCustomerId = payload.tables.customer.id;
        if (Number(savedCustomerId) !== customerId) {
            throw new Error(
                `Checkpoint customer id mismatch: expected ${customerId}, got ${savedCustomerId}`
            );
        }

        await prisma.$transaction(async (tx) => {
            const txClient = tx as DbClient;
            await this.deleteCustomerSubtree(txClient, customerId);
            await this.insertCustomerSubtreeFromPayload(
                txClient,
                customerId,
                payload
            );
        });

        await this.runPostRestoreSideEffects(customerId, accountId);

        return {
            restoredAt: new Date().toISOString(),
            rowCounts: getRowCounts(payload),
        };
    }

    async deleteCustomerCheckpoint(
        customerId: number,
        dbClient: DbClient = prisma
    ): Promise<void> {
        await dbClient.customerCheckpoint.deleteMany({
            where: { customer_id: customerId },
        });
    }

    /**
     * Removes invoice / payment AR rows while keeping customer, policy, and contacts.
     * Used when resetting a polluted golden harness baseline.
     */
    async clearCustomerArData(
        customerId: number,
        dbClient: DbClient = prisma
    ): Promise<void> {
        await dbClient.invoicePayment.deleteMany({
            where: { customer_id: customerId },
        });
        await dbClient.payment.deleteMany({ where: { customer_id: customerId } });
        await dbClient.invoice.deleteMany({ where: { customer_id: customerId } });
    }

    async countCustomerArRows(
        customerId: number,
        dbClient: DbClient = prisma
    ): Promise<{ invoices: number; invoicePayments: number }> {
        const [invoices, invoicePayments] = await Promise.all([
            dbClient.invoice.count({ where: { customer_id: customerId } }),
            dbClient.invoicePayment.count({
                where: { customer_id: customerId },
            }),
        ]);
        return { invoices, invoicePayments };
    }

    private async deleteCustomerSubtree(
        tx: DbClient,
        customerId: number
    ): Promise<void> {
        await tx.activityAttachment.deleteMany({
            where: { Activity: { customer_id: customerId } },
        });
        await tx.activityContact.deleteMany({
            where: { Activity: { customer_id: customerId } },
        });
        await tx.communicationLearningData.deleteMany({
            where: { customer_id: customerId },
        });
        await tx.activity.deleteMany({ where: { customer_id: customerId } });
        await tx.disputeInvoice.deleteMany({
            where: { CustomerDispute: { customer_id: customerId } },
        });
        await tx.customerDispute.deleteMany({
            where: { customer_id: customerId },
        });
        await tx.invoicePayment.deleteMany({ where: { customer_id: customerId } });
        await tx.payment.deleteMany({ where: { customer_id: customerId } });
        await tx.invoice.deleteMany({ where: { customer_id: customerId } });
        await tx.customerCollectionPeriod.deleteMany({
            where: { customer_id: customerId },
        });
        await tx.customerTopUp.deleteMany({ where: { customer_id: customerId } });
        await tx.customerPolicy.deleteMany({ where: { customer_id: customerId } });
        await tx.customerAggregatedData.deleteMany({
            where: { customer_id: customerId },
        });
        await tx.customerBanks.deleteMany({ where: { customer_id: customerId } });
        await tx.contact.deleteMany({ where: { customer_id: customerId } });
    }

    private async insertCustomerSubtreeFromPayload(
        tx: DbClient,
        customerId: number,
        payload: CustomerCheckpointPayload
    ): Promise<void> {
        const { tables } = payload;

        await this.createManyIfNotEmpty(
            tx.contact,
            deserializeCheckpointRows(tables.contacts)
        );
        await this.createManyIfNotEmpty(
            tx.customerBanks,
            deserializeCheckpointRows(tables.customerBanks)
        );
        if (tables.aggregatedData) {
            await tx.customerAggregatedData.create({
                data: deserializeCheckpointRow(
                    tables.aggregatedData
                ) as Parameters<
                    DbClient["customerAggregatedData"]["create"]
                >[0]["data"],
            });
        }
        await this.createManyIfNotEmpty(
            tx.customerPolicy,
            deserializeCheckpointRows(tables.customerPolicies)
        );
        await this.createManyIfNotEmpty(
            tx.customerTopUp,
            deserializeCheckpointRows(tables.customerTopUps)
        );
        await this.createManyIfNotEmpty(
            tx.customerCollectionPeriod,
            deserializeCheckpointRows(tables.collectionPeriods)
        );
        await this.createManyIfNotEmpty(
            tx.invoice,
            deserializeCheckpointRows(tables.invoices)
        );
        await this.createManyIfNotEmpty(
            tx.payment,
            deserializeCheckpointRows(tables.payments)
        );
        await this.createManyIfNotEmpty(
            tx.invoicePayment,
            deserializeCheckpointRows(tables.invoicePayments)
        );
        await this.createManyIfNotEmpty(
            tx.customerDispute,
            deserializeCheckpointRows(tables.disputes)
        );
        await this.createManyIfNotEmpty(
            tx.disputeInvoice,
            deserializeCheckpointRows(tables.disputeInvoices)
        );
        await this.createManyIfNotEmpty(
            tx.activity,
            deserializeCheckpointRows(tables.activities, {
                bigintPrimaryKey: true,
            })
        );
        await this.createManyIfNotEmpty(
            tx.activityContact,
            deserializeCheckpointRows(tables.activityContacts)
        );

        const customerData = deserializeCheckpointRow(tables.customer);
        const { id: _id, ...updateData } = customerData;
        await tx.customer.update({
            where: { id: customerId },
            data: updateData,
        });
    }

    private async createManyIfNotEmpty(
        model: unknown,
        rows: Record<string, unknown>[]
    ): Promise<void> {
        if (rows.length === 0) {
            return;
        }
        await (model as CheckpointCreateManyDelegate).createMany({ data: rows });
    }

    private async runPostRestoreSideEffects(
        customerId: number,
        accountId: number
    ): Promise<void> {
        await CustomerService.recalculateAllAmountsForCustomers([customerId]);

        const { syncCustomerInsuranceFields } = await import(
            "@/server/services/creditInsurance/syncCustomerInsuranceFields"
        );
        await syncCustomerInsuranceFields(customerId);

        try {
            const { invalidateDashboardCacheForAccount } = await import(
                "@/server/utils/cacheInvalidationHelper"
            );
            await invalidateDashboardCacheForAccount(accountId);
        } catch (error) {
            console.error(
                "[CustomerCheckpointService] Failed to invalidate dashboard cache:",
                error
            );
        }
    }
}
