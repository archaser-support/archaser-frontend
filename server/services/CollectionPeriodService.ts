import { DbClient, prisma } from "@/lib/prisma";
import { LogLevel, ActivityStatus } from "@/types/enums";
import { genericTimelineContentFormatter } from "@/utils/stringFormatters";
import {
    accountProductsFromRecord,
    isCreditOnlyAccount,
} from "@/shared/utils/accountProducts";

import { syncCustomerInsuranceFields } from "./creditInsurance/syncCustomerInsuranceFields";
import { ActivityService } from "./ActivityService";
import { LogService } from "./LogService";

export interface CollectionPeriodClosureOptions {
    reason?: string;
    userName?: string;
    translate?: (key: string) => string;
    locale?: string;
    logContext?: {
        processName?: string;
        startTime?: Date;
        processStats?: any;
        step?: string;
        stepNumber?: number;
        customerId?: number;
    };
}

export interface CollectionPeriodClosureResult {
    success: boolean;
    disputesClosed: number;
    activitiesCancelled: number;
    customerDeactivated: boolean;
    closureActivityCreated: boolean;
    errors: string[];
}

export class CollectionPeriodService {
    private logService: LogService;
    private activityService: ActivityService;

    constructor() {
        this.logService = LogService.getInstance();
        this.activityService = new ActivityService();
    }

    /**
     * Centralized method to close a collection period and perform all necessary cleanup
     * This is the single source of truth for collection period closure logic
     */
    public async closeCollectionPeriod(
        collectionPeriodId: number,
        options: CollectionPeriodClosureOptions = {},
        dbClient?: DbClient
    ): Promise<CollectionPeriodClosureResult> {
        try {
            const runClosure = async (client: DbClient) => {
                const transactionalResult: CollectionPeriodClosureResult = {
                    success: false,
                    disputesClosed: 0,
                    activitiesCancelled: 0,
                    customerDeactivated: false,
                    closureActivityCreated: false,
                    errors: [],
                };

                const collectionPeriod =
                    await client.customerCollectionPeriod.findUnique({
                        where: { id: collectionPeriodId },
                        include: {
                            Customer: {
                                select: {
                                    id: true,
                                    collection_status: true,
                                    account_id: true,
                                },
                            },
                        },
                    });

                if (!collectionPeriod) {
                    transactionalResult.errors.push(
                        `Collection period ${collectionPeriodId} not found`
                    );
                    return transactionalResult;
                }

                if (collectionPeriod.period_end_date) {
                    transactionalResult.errors.push(
                        `Collection period ${collectionPeriodId} is already closed`
                    );
                    return transactionalResult;
                }

                const disputesResult = await this.closeOpenDisputes(
                    collectionPeriodId,
                    options,
                    client
                );
                transactionalResult.disputesClosed = disputesResult.disputesClosed;
                transactionalResult.errors.push(...disputesResult.errors);

                const activitiesResult = await this.cancelScheduledActivities(
                    collectionPeriodId,
                    options,
                    client
                );
                transactionalResult.activitiesCancelled =
                    activitiesResult.activitiesCancelled;
                transactionalResult.errors.push(...activitiesResult.errors);

                const closureResult = await this.closeCollectionPeriodRecord(
                    collectionPeriodId,
                    options,
                    client
                );
                transactionalResult.errors.push(...closureResult.errors);

                const customerResult = await this.deactivateCustomerIfNeeded(
                    collectionPeriod.Customer.id,
                    options,
                    client
                );
                transactionalResult.customerDeactivated =
                    customerResult.customerDeactivated;
                transactionalResult.errors.push(...customerResult.errors);

                try {
                    await this.activityService.createActivityWithFormattedDescription(
                        {
                            customer_id: collectionPeriod.customer_id,
                            collection_period_id: collectionPeriod.id,
                            type: "Internal",
                            title: "{{activities.fields.collection_period_closed_title}}",
                            content: genericTimelineContentFormatter([
                                {
                                    label: "Status",
                                    value: "Collection period closed",
                                },
                                {
                                    label: "Reason",
                                    value:
                                        options.reason ||
                                        "activities.fields.collection_period_closure_comment_all_resolved",
                                },
                                {
                                    label: "Total Outstanding",
                                    value: (
                                        collectionPeriod.total_outstanding_amount ??
                                        0
                                    ).toString(),
                                },
                                {
                                    label: "Overdue Invoices",
                                    value: (
                                        collectionPeriod.no_of_overdue_invoices ??
                                        0
                                    ).toString(),
                                },
                            ]),
                            account_id: collectionPeriod.Customer.account_id,
                            schedule_time: new Date(),
                            actual_delivery_time: new Date(),
                            status: ActivityStatus.DISPUTE,
                            systemGenerated: true,
                            translate: options.translate,
                            locale: options.locale,
                            dbClient: client,
                            runPostCommitEffects: false,
                            titleParams: {
                                userId: options.userName || "System",
                                reason:
                                    options.reason ||
                                    "activities.fields.collection_period_closure_comment_all_resolved",
                            },
                        }
                    );

                    transactionalResult.closureActivityCreated = true;
                } catch (error: any) {
                    transactionalResult.errors.push(
                        `Failed to create closure activity: ${error.message}`
                    );
                }

                transactionalResult.success =
                    transactionalResult.errors.length === 0;
                return transactionalResult;
            };

            const result = dbClient
                ? await runClosure(dbClient)
                : await prisma.$transaction(async (tx) =>
                      runClosure(tx as DbClient)
                  );

            await this.logClosureResult(collectionPeriodId, result, options);
            return result;
        } catch (error: any) {
            const result: CollectionPeriodClosureResult = {
                success: false,
                disputesClosed: 0,
                activitiesCancelled: 0,
                customerDeactivated: false,
                closureActivityCreated: false,
                errors: [`Unexpected error: ${error.message}`],
            };
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Failed to close collection period",
                options.logContext?.processName || "CollectionPeriodService",
                {
                    ...options.logContext,
                    collectionPeriodId,
                    error: error.message,
                }
            );
            return result;
        }
    }

    /**
     * Close all open disputes for a collection period
     */
    private async closeOpenDisputes(
        collectionPeriodId: number,
        options: CollectionPeriodClosureOptions,
        dbClient: DbClient = prisma
    ): Promise<{ disputesClosed: number; errors: string[] }> {
        const result = { disputesClosed: 0, errors: [] as string[] };

        try {
            const openDisputes = await dbClient.customerDispute.findMany({
                where: {
                    customer_collection_period_id: collectionPeriodId,
                    dispute_status: { not: "Resolved" },
                },
                select: { id: true },
            });

            if (openDisputes.length > 0) {
                await dbClient.customerDispute.updateMany({
                    where: {
                        customer_collection_period_id: collectionPeriodId,
                        dispute_status: { not: "Resolved" },
                    },
                    data: {
                        dispute_status: "Resolved",
                        resolution_comment:
                            options.reason ||
                            "Resolved automatically upon collection period closure.",
                        modified_at: new Date(),
                    },
                });

                result.disputesClosed = openDisputes.length;
            }
        } catch (error: any) {
            result.errors.push(`Failed to close disputes: ${error.message}`);
        }

        return result;
    }

    /**
     * Cancel all scheduled activities for a collection period
     */
    private async cancelScheduledActivities(
        collectionPeriodId: number,
        options: CollectionPeriodClosureOptions,
        dbClient: DbClient = prisma
    ): Promise<{ activitiesCancelled: number; errors: string[] }> {
        const result = { activitiesCancelled: 0, errors: [] as string[] };

        try {
            await this.activityService.cancelScheduledActivities(
                collectionPeriodId,
                options.reason || "Collection period closed",
                undefined,
                dbClient
            );

            // Count cancelled activities
            const cancelledActivities = await dbClient.activity.count({
                where: {
                    collection_period_id: collectionPeriodId,
                    status: ActivityStatus.CANCELLED, // Cancelled status
                },
            });

            result.activitiesCancelled = cancelledActivities;
        } catch (error: any) {
            result.errors.push(`Failed to cancel activities: ${error.message}`);
        }

        return result;
    }

    /**
     * Close the collection period record
     */
    private async closeCollectionPeriodRecord(
        collectionPeriodId: number,
        options: CollectionPeriodClosureOptions,
        dbClient: DbClient = prisma
    ): Promise<{ errors: string[] }> {
        const result = { errors: [] as string[] };

        try {
            await dbClient.customerCollectionPeriod.update({
                where: { id: collectionPeriodId },
                data: {
                    period_end_date: new Date(),
                },
            });
        } catch (error: any) {
            result.errors.push(
                `Failed to close collection period record: ${error.message}`
            );
        }

        return result;
    }

    /**
     * Deactivate customer if no other open collection periods exist
     */
    private async deactivateCustomerIfNeeded(
        customerId: number,
        options: CollectionPeriodClosureOptions,
        dbClient: DbClient = prisma
    ): Promise<{ customerDeactivated: boolean; errors: string[] }> {
        const result = { customerDeactivated: false, errors: [] as string[] };

        try {
            // Check if there are any other open collection periods for this customer
            const openPeriods = await dbClient.customerCollectionPeriod.findFirst(
                {
                    where: {
                        customer_id: customerId,
                        period_end_date: null,
                    },
                }
            );

            if (!openPeriods) {
                // Also check if there are any due invoices before deactivating
                // Overdue invoices are already checked by the fact that no open periods exist
                const customer = await dbClient.customer.findUnique({
                    where: { id: customerId },
                    select: { no_of_due_invoices: true },
                });

                if (customer && (customer.no_of_due_invoices ?? 0) <= 0) {
                    await dbClient.customer.update({
                        where: { id: customerId },
                        data: { collection_status: "Inactive" },
                    });
                    result.customerDeactivated = true;
                }
            }
        } catch (error: any) {
            result.errors.push(
                `Failed to deactivate customer: ${error.message}`
            );
        }

        return result;
    }

    /**
     * Log the closure result
     */
    private async logClosureResult(
        collectionPeriodId: number,
        result: CollectionPeriodClosureResult,
        options: CollectionPeriodClosureOptions
    ): Promise<void> {
        const logLevel = result.success ? LogLevel.INFO : LogLevel.WARNING;
        const message = result.success
            ? "Collection period closed successfully"
            : "Collection period closure completed with errors";

        await this.logService.logMessage(
            logLevel,
            message,
            options.logContext?.processName || "CollectionPeriodService",
            {
                ...options.logContext,
                collectionPeriodId,
                result,
            }
        );
    }

    /**
     * Close collection periods for multiple customers (bulk operation)
     */
    public async closeCollectionPeriodsForCustomers(
        customerIds: number[],
        options: CollectionPeriodClosureOptions = {}
    ): Promise<Map<number, CollectionPeriodClosureResult>> {
        const results = new Map<number, CollectionPeriodClosureResult>();

        for (const customerId of customerIds) {
            // Find open collection period for this customer
            const collectionPeriod =
                await prisma.customerCollectionPeriod.findFirst({
                    where: {
                        customer_id: customerId,
                        period_end_date: null,
                    },
                    select: { id: true },
                });

            if (collectionPeriod) {
                const closureResult = await this.closeCollectionPeriod(
                    collectionPeriod.id,
                    {
                        ...options,
                        logContext: {
                            ...options.logContext,
                            customerId,
                        },
                    }
                );
                results.set(customerId, closureResult);
            } else {
                // No open collection period, but still deactivate customer if needed
                const customerResult = await this.deactivateCustomerIfNeeded(
                    customerId,
                    options
                );
                results.set(customerId, {
                    success: true,
                    disputesClosed: 0,
                    activitiesCancelled: 0,
                    customerDeactivated: customerResult.customerDeactivated,
                    closureActivityCreated: false,
                    errors: customerResult.errors,
                });
            }
        }

        return results;
    }

    /**
     * Create or update collection periods for customers with overdue invoices
     */
    public async createOrUpdateCollectionPeriods(
        customerData: Array<{
            customerId: number;
            amounts: any;
            customerInfo: any;
            oldestOverdueDate?: Date;
        }>,
        options: CollectionPeriodClosureOptions = {},
        dbClient?: DbClient
    ): Promise<
        Map<
            number,
            { collectionPeriodId: number; isNew: boolean; errors: string[] }
        >
    > {
        if (!dbClient) {
            const results = await prisma.$transaction(async (tx) =>
                this.createOrUpdateCollectionPeriods(
                    customerData,
                    options,
                    tx as DbClient
                )
            );

            try {
                const accountIds = Array.from(
                    new Set(
                        customerData
                            .map((item) => item.customerInfo?.account_id)
                            .filter(
                                (accountId): accountId is number =>
                                    typeof accountId === "number"
                            )
                    )
                );

                if (accountIds.length > 0) {
                    const { invalidateDashboardCacheForAccounts } = await import(
                        "@/server/utils/cacheInvalidationHelper"
                    );
                    await invalidateDashboardCacheForAccounts(accountIds);
                }
            } catch (error) {
                console.error(
                    "Failed to invalidate dashboard cache after collection-period upsert:",
                    error
                );
            }

            return results;
        }

        const client = dbClient ?? prisma;
        const runPostCommitEffects = false;
        const results = new Map<
            number,
            { collectionPeriodId: number; isNew: boolean; errors: string[] }
        >();

        for (const data of customerData) {
            const { customerId, amounts, customerInfo } = data;
            const result = {
                collectionPeriodId: 0,
                isNew: false,
                errors: [] as string[],
            };

            try {
                // Check if customer already has an open collection period
                const existingCollectionPeriod =
                    await client.customerCollectionPeriod.findFirst({
                        where: {
                            customer_id: customerId,
                            period_end_date: null,
                        },
                        select: { id: true },
                    });

                if (existingCollectionPeriod) {
                    // Update existing collection period
                    await client.customerCollectionPeriod.update({
                        where: { id: existingCollectionPeriod.id },
                        data: {
                            no_of_overdue_invoices:
                                amounts?.no_of_overdue_invoices || 0,
                            currency: customerInfo?.Account?.currency,
                            customer_currency1:
                                amounts?.customer_currency1 || "",
                            customer_currency2:
                                amounts?.customer_currency2 || "",
                            total_outstanding_amount:
                                amounts?.total_outstanding_amount || 0,
                            customer_outstanding_amount1:
                                amounts?.customer_outstanding_amount1 || 0,
                            customer_outstanding_amount2:
                                amounts?.customer_outstanding_amount2 || 0,
                        },
                    });

                    await syncCustomerInsuranceFields(customerId, dbClient
                        ? {
                              dbClient,
                              runFollowUpEffects: false,
                          }
                        : undefined);

                    result.collectionPeriodId = existingCollectionPeriod.id;
                    result.isNew = false;
                } else {
                    let accountProducts = accountProductsFromRecord(
                        customerInfo?.Account
                    );
                    if (!accountProducts && customerInfo?.account_id) {
                        const account = await client.account.findUnique({
                            where: { id: customerInfo.account_id },
                            select: {
                                has_collection: true,
                                has_credit_insurance: true,
                            },
                        });
                        accountProducts = accountProductsFromRecord(account);
                    }

                    if (isCreditOnlyAccount(accountProducts)) {
                        results.set(customerId, result);
                        continue;
                    }

                    // Create new collection period
                    // Determine category: use customer's category_for_new_collection, fallback to customer's, then default to "Automated"
                    let categoryToUse = "Automated";
                    if (customerInfo?.category_for_new_collection) {
                        categoryToUse =
                            customerInfo.category_for_new_collection;
                    } else if (
                        customerInfo?.Account?.category_for_new_collection
                    ) {
                        categoryToUse =
                            customerInfo.Account.category_for_new_collection;
                    }

                    const newCollectionPeriod =
                        await client.customerCollectionPeriod.create({
                            data: {
                                customer_id: customerId,
                                period_end_date: null,
                                period_start_date: new Date(),
                                no_of_overdue_invoices:
                                    amounts?.no_of_overdue_invoices || 0,
                                currency: customerInfo?.Account?.currency,
                                customer_currency1:
                                    amounts?.customer_currency1 || "",
                                customer_currency2:
                                    amounts?.customer_currency2 || "",
                                total_outstanding_amount:
                                    amounts?.total_outstanding_amount || 0,
                                customer_outstanding_amount1:
                                    amounts?.customer_outstanding_amount1 || 0,
                                customer_outstanding_amount2:
                                    amounts?.customer_outstanding_amount2 || 0,
                                current_category: categoryToUse as any,
                                last_automated_step: 0,
                                create_next_activity: true,
                            },
                        });

                    await syncCustomerInsuranceFields(customerId, dbClient
                        ? {
                              dbClient,
                              runFollowUpEffects: false,
                          }
                        : undefined);

                    result.collectionPeriodId = newCollectionPeriod.id;
                    result.isNew = true;
                }
            } catch (error: any) {
                result.errors.push(
                    `Failed to create/update collection period: ${error.message}`
                );
            }

            results.set(customerId, result);
        }

        // Invalidate dashboard cache for affected accounts
        if (runPostCommitEffects) {
            try {
                // Get unique account IDs from customer data
                const accountIds = Array.from(
                    new Set(
                        customerData
                            .map(
                                (data) =>
                                    data.customerInfo?.Account?.id ||
                                    data.customerInfo?.account_id
                            )
                            .filter(Boolean)
                    )
                ) as number[];

                if (accountIds.length > 0) {
                    const { invalidateDashboardCacheForAccounts } = await import(
                        "@/server/utils/cacheInvalidationHelper"
                    );
                    await invalidateDashboardCacheForAccounts(accountIds);
                }
            } catch (error) {
                // Cache invalidation failure should not break collection period creation/update
                console.error("Failed to invalidate dashboard cache:", error);
            }
        }

        return results;
    }
}
