/*
    This cron job is used to move collections to the next category.
    Algorithm:
    Phase 1: Handle expired promises to pay (merged from handleExpiredPromiseToPay)
    Phase 2: Process collections with next_category_date <= now and next_category is not null
    3. Handle individual collection failures gracefully
*/
import { category } from "@prisma/client";
import moment from "moment";

import { prismaCron } from "@/lib/prisma";
import { CustomerService } from "@/server/services/CustomerService";
import { excludeCreditOnlyCustomerWhere } from "@/shared/utils/accountProducts";
const prisma = prismaCron();

import { LogService } from "../services/LogService";

export interface MoveCollectionToNextCategoryOptions {
    /** When true (testing), bypass wait_days_after_automated so Automated→Agent transition happens immediately */
    fastForwardScheduledActivities?: boolean;
}

export async function MoveCollectionToNextCategory(
    customerId?: number,
    logCallback?: (
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
        parameters?: any,
        results?: any
    ) => void,
    stepCollector?: {
        addStep: (
            step: string,
            message: string,
            level?: "INFO" | "ERROR" | "WARNING" | "DEBUG",
            parameters?: any,
            results?: any,
            duration?: number
        ) => void;
    },
    options?: MoveCollectionToNextCategoryOptions
) {
    const startTime = new Date();
    const logService = LogService.getInstance();

    // Create a job-specific logging wrapper that routes to step collector
    const jobLogger = {
        logMessage: async (
            level: string,
            message: string,
            source: string,
            details?: any,
            accountId?: number,
            userId?: number,
            jobId?: number,
            correlationId?: string
        ): Promise<void> => {
            if (stepCollector) {
                // Extract step information from details if available
                const step = details?.step || "PROCESS";
                const stepNumber = details?.stepNumber || 1;
                const parameters = details ? { ...details } : undefined;

                // Add to step collector ONLY - do not create individual log records
                stepCollector.addStep(
                    step,
                    message,
                    level as "INFO" | "ERROR" | "WARNING" | "DEBUG",
                    parameters
                );
            } else {
                // Fallback to original logService if no step collector
                return jobLogger.logMessage(
                    level,
                    message,
                    source,
                    details,
                    accountId,
                    userId,
                    jobId,
                    correlationId
                );
            }
        },
    };

    // Initialize process tracking for merged functionality
    const processStats = {
        // Phase 1: Expired promises stats
        totalExpiredPromises: 0,
        promisesUpdated: 0,
        // Phase 2: Category processing stats
        totalCollectionsFound: 0,
        collectionsProcessed: 0,
        collectionsFailed: 0,
        errors: [] as string[],
    };

    try {
        // Add process start message to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "START",
                "Starting MoveCollectionToNextCategory process (merged with expired promise handling)",
                "INFO",
                {
                    processName: "MoveCollectionToNextCategory",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                }
            );
        }
        // Call logCallback if provided (for real-time frontend logging)
        if (logCallback) {
            logCallback(
                "Starting MoveCollectionToNextCategory process (merged with expired promise handling)",
                "INFO",
                {
                    processName: "MoveCollectionToNextCategory",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    step: "START",
                    stepNumber: 1,
                }
            );
        }

        const customerService = new CustomerService();

        // PHASE 1: Handle expired promises to pay
        const phase1Start = Date.now();
        if (logCallback) {
            logCallback(
                "Starting Phase 1: Handle expired promises to pay",
                "INFO",
                {
                    processName: "MoveCollectionToNextCategory",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    step: "PHASE1_START",
                    stepNumber: 1,
                }
            );
        }

        const now = new Date();
        const last24Hours = moment(now).subtract(24, "hours").toDate();

        // Get collection periods with expired promise to pay
        const getExpiredPromisesStart = Date.now();
        const expiredCollections =
            await prisma.customerCollectionPeriod.findMany({
                where: {
                    current_category: "Promise_to_pay",
                    promise_to_pay_date: { lte: last24Hours },
                    Customer: excludeCreditOnlyCustomerWhere(),
                    ...(customerId && { customer_id: customerId }),
                },
                select: {
                    id: true,
                    previous_category: true,
                },
            });
        const getExpiredPromisesDuration = Date.now() - getExpiredPromisesStart;
        processStats.totalExpiredPromises = expiredCollections.length;

        if (stepCollector) {
            stepCollector.addStep(
                "PHASE1_EXPIRED_PROMISES",
                `Phase 1: Found ${expiredCollections.length} expired promise-to-pay collection(s)`,
                "INFO",
                {
                    expiredPromisesCount: expiredCollections.length,
                    queryDurationMs: getExpiredPromisesDuration,
                }
            );
        }
        if (logCallback) {
            logCallback(
                "Retrieved expired promise to pay collection periods",
                "INFO",
                {
                    processName: "MoveCollectionToNextCategory",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    step: "GET_EXPIRED_PROMISES",
                    stepNumber: 1,
                    expiredPromisesCount: expiredCollections.length,
                    queryDuration: getExpiredPromisesDuration,
                    queryFilter: {
                        current_category: "Promise_to_pay",
                        promise_to_pay_date: { lte: last24Hours.toISOString() },
                        ...(customerId && { customer_id: customerId }),
                    },
                }
            );
        }

        if (expiredCollections.length > 0) {
            if (logCallback) {
                logCallback(
                    "Found expired promises to pay - processing updates",
                    "INFO",
                    {
                        processName: "MoveCollectionToNextCategory",
                        startTime: startTime.toISOString(),
                        customerId: customerId || "ALL",
                        step: "PROCESS_EXPIRED_PROMISES",
                        stepNumber: 1,
                        expiredPromisesCount: expiredCollections.length,
                        collectionsToProcess: expiredCollections.map((c) => ({
                            id: c.id,
                            previous_category: c.previous_category,
                        })),
                    }
                );
            }

            // Update collection periods to set next category
            const updatePromisesStart = Date.now();

            // Process each expired collection individually to set appropriate next_category
            for (const collection of expiredCollections) {
                try {
                    // Use previous_category if available, otherwise fallback to "Automated"
                    const nextCategory =
                        collection.previous_category || "Automated";

                    await prisma.customerCollectionPeriod.update({
                        where: { id: collection.id },
                        data: {
                            next_category: nextCategory,
                            next_category_date: new Date(),
                        },
                    });

                    processStats.promisesUpdated++;
                } catch (error) {
                    const errorMsg = `Failed to update expired promise collection ${collection.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
                    processStats.errors.push(errorMsg);
                }
            }

            const updatePromisesDuration = Date.now() - updatePromisesStart;
        }

        const phase1Duration = Date.now() - phase1Start;
        if (logCallback) {
            logCallback("Phase 1 completed: Expired promise handling", "INFO", {
                processName: "MoveCollectionToNextCategory",
                startTime: startTime.toISOString(),
                customerId: customerId || "ALL",
                step: "PHASE1_COMPLETE",
                stepNumber: 1,
                phase1Duration: phase1Duration,
                processStats: {
                    totalExpiredPromises: processStats.totalExpiredPromises,
                    promisesUpdated: processStats.promisesUpdated,
                    errors: processStats.errors.length,
                },
            });
        }

        // PHASE 2: Process collections with next_category_date <= now
        const phase2Start = Date.now();
        if (stepCollector) {
            stepCollector.addStep(
                "PHASE2_START",
                "Starting Phase 2: Process category changes",
                "INFO",
                {
                    customerId: customerId ?? "ALL",
                }
            );
        }
        if (logCallback) {
            logCallback("Starting Phase 2: Process category changes", "INFO", {
                processName: "MoveCollectionToNextCategory",
                startTime: startTime.toISOString(),
                customerId: customerId || "ALL",
                step: "PHASE2_START",
                stepNumber: 2,
            });
        }

        // Fetch collections with next_category_step <= now
        const fetchCollectionsStart = Date.now();
        const collections = await prisma.customerCollectionPeriod.findMany({
            where: {
                period_end_date: null, // only collections that are not ended
                next_category_date: {
                    lte: new Date(),
                },
                next_category: {
                    not: null,
                },
                Customer: excludeCreditOnlyCustomerWhere(),
                ...(customerId && { customer_id: customerId }),
            },
            select: {
                id: true,
                customer_id: true,
                current_category: true,
                next_category: true,
                next_category_date: true,
                Customer: {
                    select: {
                        account_id: true,
                        // Note: Account removed from Customer select since Customer doesn't have Account relation
                        // Fetch Account separately using customer.account_id if needed
                    },
                },
            },
        });
        const fetchCollectionsDuration = Date.now() - fetchCollectionsStart;
        processStats.totalCollectionsFound = collections.length;

        if (stepCollector) {
            stepCollector.addStep(
                "PHASE2_FETCH_COLLECTIONS",
                `Retrieved ${collections.length} collection(s) due for category change (next_category_date <= now)`,
                "INFO",
                {
                    collectionsFound: collections.length,
                    queryDurationMs: fetchCollectionsDuration,
                    collectionIds: collections.map((c) => c.id),
                    collectionDetails: collections.map((c) => ({
                        id: c.id,
                        customer_id: c.customer_id,
                        current_category: c.current_category,
                        next_category: c.next_category,
                        next_category_date: c.next_category_date?.toISOString?.() ?? c.next_category_date,
                    })),
                }
            );
        }
        if (logCallback) {
            logCallback(
                "Retrieved collections due for category change",
                "INFO",
                {
                    processName: "MoveCollectionToNextCategory",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    step: "FETCH_COLLECTIONS",
                    stepNumber: 2,
                    collectionsFound: collections.length,
                    queryDuration: fetchCollectionsDuration,
                    collections: collections.map((c) => ({
                        id: c.id,
                        customer_id: c.customer_id,
                        current_category: c.current_category,
                        next_category: c.next_category,
                        next_category_date: c.next_category_date,
                    })),
                }
            );
        }

        // Filter collections based on wait_days_after_automated for Automated -> Agent transitions
        const currentTime = new Date();

        // Fetch Account data separately for collections that need wait_days_after_automated
        const accountIds = Array.from(
            new Set(
                collections
                    .filter(
                        (c) =>
                            c.current_category === "Automated" &&
                            c.next_category === "Agent" &&
                            c.Customer?.account_id
                    )
                    .map((c) => c.Customer!.account_id!)
            )
        );

        const accountsMap = new Map<
            number,
            { wait_days_after_automated: number | null }
        >();
        if (accountIds.length > 0) {
            const accounts = await prisma.account.findMany({
                where: { id: { in: accountIds } },
                select: { id: true, wait_days_after_automated: true },
            });
            accounts.forEach((acc) => {
                accountsMap.set(acc.id, {
                    wait_days_after_automated: acc.wait_days_after_automated,
                });
            });
        }

        const filteredOutReasons: Array<{
            collectionId: number;
            customer_id: number;
            current_category: string;
            next_category: string | null;
            reason: string;
            wait_days_after_automated: number;
            timeSinceNextCategoryDateMs: number;
            requiredWaitTimeMs: number;
            next_category_date: string | null;
        }> = [];

        const fastForwardCategoryTransition =
            options?.fastForwardScheduledActivities === true;
        if (stepCollector && fastForwardCategoryTransition) {
            stepCollector.addStep(
                "PHASE2_FAST_FORWARD",
                "Fast-forward for testing: bypassing wait_days_after_automated (Automated→Agent transitions will run immediately)",
                "INFO",
                {}
            );
        }

        const filteredCollections = collections.filter((collection) => {
            // If transitioning from Automated to Agent, check wait_days_after_automated (unless fast-forward for testing)
            if (
                collection.current_category === "Automated" &&
                collection.next_category === "Agent"
            ) {
                const accountId = collection.Customer?.account_id;
                const account = accountId ? accountsMap.get(accountId) : null;
                const waitDays = account?.wait_days_after_automated || 0;
                const requiredWaitTime = fastForwardCategoryTransition
                    ? 0
                    : waitDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds; 0 when fast-forward
                const timeSinceNextCategoryDate =
                    currentTime.getTime() -
                    (collection.next_category_date?.getTime() || 0);

                const passes = timeSinceNextCategoryDate >= requiredWaitTime;
                if (!passes) {
                    filteredOutReasons.push({
                        collectionId: collection.id,
                        customer_id: collection.customer_id,
                        current_category: collection.current_category ?? "",
                        next_category: collection.next_category,
                        reason: `wait_days_after_automated not yet elapsed (need ${requiredWaitTime}ms, have ${timeSinceNextCategoryDate}ms since next_category_date)`,
                        wait_days_after_automated: waitDays,
                        timeSinceNextCategoryDateMs: timeSinceNextCategoryDate,
                        requiredWaitTimeMs: requiredWaitTime,
                        next_category_date: collection.next_category_date?.toISOString?.() ?? null,
                    });
                }
                return passes;
            }

            // For all other category transitions, process immediately
            return true;
        });

        if (stepCollector) {
            stepCollector.addStep(
                "PHASE2_FILTER_RESULT",
                collections.length === 0
                    ? "No collections found (query returned 0)"
                    : filteredCollections.length === 0
                        ? `All ${collections.length} collection(s) filtered out (e.g. wait_days_after_automated not yet elapsed)`
                        : `After filter: ${filteredCollections.length} collection(s) to process${collections.length > filteredCollections.length ? `, ${collections.length - filteredCollections.length} filtered out` : ""}`,
                "INFO",
                {
                    totalFromQuery: collections.length,
                    afterFilter: filteredCollections.length,
                    filteredOutCount: collections.length - filteredCollections.length,
                    filteredOutReasons:
                        filteredOutReasons.length > 0
                            ? filteredOutReasons
                            : undefined,
                }
            );
        }

        if (filteredCollections.length === 0) {
            const phase2Duration = Date.now() - phase2Start;
            const totalDuration = Date.now() - startTime.getTime();
            if (stepCollector) {
                stepCollector.addStep(
                    "PHASE2_NO_COLLECTIONS",
                    "No collections found or no collections due for category change, process completed",
                    "INFO",
                    {
                        reason:
                            collections.length === 0
                                ? "Query returned 0 collections (no period with next_category_date <= now and next_category set)"
                                : "All collections filtered out by wait_days_after_automated or other criteria",
                        totalFromQuery: collections.length,
                        phase2DurationMs: phase2Duration,
                        totalDurationMs: totalDuration,
                        processStats: {
                            totalExpiredPromises:
                                processStats.totalExpiredPromises,
                            promisesUpdated: processStats.promisesUpdated,
                            totalCollectionsFound:
                                processStats.totalCollectionsFound,
                            collectionsProcessed:
                                processStats.collectionsProcessed,
                            errorsCount: processStats.errors.length,
                        },
                        filteredOutReasons:
                            filteredOutReasons.length > 0
                                ? filteredOutReasons
                                : undefined,
                    }
                );
            }
            if (logCallback) {
                logCallback(
                    "No collections found or no collections due for category change, process completed",
                    "INFO",
                    {
                        processName: "MoveCollectionToNextCategory",
                        startTime: startTime.toISOString(),
                        customerId: customerId || "ALL",
                        step: "NO_COLLECTIONS",
                        stepNumber: 2,
                        phase2Duration: phase2Duration,
                        totalDuration: totalDuration,
                        processStats: {
                            totalExpiredPromises:
                                processStats.totalExpiredPromises,
                            promisesUpdated: processStats.promisesUpdated,
                            totalCollectionsFound:
                                processStats.totalCollectionsFound,
                            collectionsProcessed:
                                processStats.collectionsProcessed,
                            errors: processStats.errors.length,
                        },
                    }
                );
            }
            return;
        }

        // Process collections independently
        const processCollectionsStart = Date.now();
        const collectionResults = [];

        for (const collection of filteredCollections) {
            const collectionStartTime = Date.now();
            try {
                // Update collection and create activity using AccountService
                await customerService.updateCollectionPeriodCategory(
                    collection.id,
                    collection.next_category as category,
                    collection.current_category as category,
                    collection.Customer.account_id,
                    collection.customer_id,
                    {
                        userId: "system",
                        isManualCategoryChange: false,
                        translate: (key: string) => key, // Simple fallback - translation should be handled at display time
                    }
                );

                const collectionDuration = Date.now() - collectionStartTime;
                collectionResults.push({
                    success: true,
                    collectionId: collection.id,
                    duration: collectionDuration,
                });
                processStats.collectionsProcessed++;
            } catch (error) {
                const errorMsg = `Failed to process collection ${collection.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
                processStats.errors.push(errorMsg);
                processStats.collectionsFailed++;

                const collectionDuration = Date.now() - collectionStartTime;
                collectionResults.push({
                    success: false,
                    collectionId: collection.id,
                    duration: collectionDuration,
                    error: errorMsg,
                });

                // Continue with next collection instead of throwing
                continue;
            }
        }
        const processCollectionsDuration = Date.now() - processCollectionsStart;
        const phase2Duration = Date.now() - phase2Start;

        if (stepCollector) {
            stepCollector.addStep(
                "PHASE2_COLLECTIONS_PROCESSED",
                `Phase 2 complete: ${processStats.collectionsProcessed} collection(s) updated, ${processStats.collectionsFailed} failed`,
                "INFO",
                {
                    collectionsProcessed: processStats.collectionsProcessed,
                    collectionsFailed: processStats.collectionsFailed,
                    processDurationMs: processCollectionsDuration,
                    phase2DurationMs: phase2Duration,
                    errors:
                        processStats.errors.length > 0
                            ? processStats.errors
                            : undefined,
                    results: collectionResults,
                }
            );
        }

        // Invalidate dashboard cache for affected accounts
        try {
            // Get unique account IDs from processed collections
            const accountIds = Array.from(
                new Set(
                    filteredCollections
                        .map((c) => c.Customer?.account_id)
                        .filter((id): id is number => typeof id === "number")
                )
            );

            if (accountIds.length > 0) {
                const { invalidateDashboardCacheForAccounts } = await import(
                    "@/server/utils/cacheInvalidationHelper"
                );
                await invalidateDashboardCacheForAccounts(accountIds);
            }
        } catch (cacheError) {
            // Cache invalidation failure should not break the cron job
            console.error("Failed to invalidate dashboard cache:", cacheError);
        }

        // Add process completion message to step collector
        const totalDuration = Date.now() - startTime.getTime();
        if (stepCollector) {
            stepCollector.addStep(
                "COMPLETE",
                "MoveCollectionToNextCategory process completed successfully",
                "INFO",
                {
                    totalDuration,
                    finalStats: processStats,
                }
            );
        }
    } catch (err) {
        const error = err as Error;
        const totalDuration = Date.now() - startTime.getTime();

        // Add error to step collector if available
        if (stepCollector) {
            stepCollector.addStep(
                "ERROR",
                `MoveCollectionToNextCategory process failed: ${error.message}`,
                "ERROR",
                {
                    error: error.message,
                    stack: error.stack,
                    finalStats: processStats,
                    duration: totalDuration,
                }
            );
        }
        throw error;
    } finally {
        // Connection cleanup removed - Prisma manages its own connections
        // Manual disconnection was causing "Engine is not yet connected" errors in serverless
    }
}
