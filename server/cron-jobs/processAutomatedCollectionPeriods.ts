/*
    This cron job merges the functionality of "Mark Auto Activity As Last Step", "Update Automated Collection Periods", and "Update Collection Category To Agent".
    
    MERGE INFORMATION:
    - Original jobs: markAutoActivityAsLastStep.ts, updateAutomatedCollectionPeriods.ts, updateCollectionCategoryToAgent.ts
    - Merge date: December 2024
    - Reason: Improve efficiency, reduce database operations, and ensure atomic processing
    - The original jobs are kept in the database but filtered out from the admin UI and execution
    
    IMPORTANT FIX:
    - The is_last_automated_step_delivered flag is reset to false when new automated activities are created
    - This prevents premature transition to Agent category when there are pending automated activities
    - See activityWorkflowManager.ts for the implementation of this fix
    
    Algorithm:
    Phase 1: Mark Last Steps
    1. Get all activities that are not marked as last step, have status 17, 
       belong to automated collection periods, and are the last category step
    2. Update these activities to mark them as last step
    3. Update the corresponding collection periods to mark last automated step as delivered
    
    Phase 2: Prepare Next Activities
    4. Get all collection periods with current category "Automated" that need next activity creation
    5. Find the latest activity for each collection period
    6. Filter collection periods where the latest activity has status 17 (delivered) or 21 (cancelled)
    7. Calculate next activity times for eligible collection periods
    8. Update collection periods to mark them ready for next activity creation
    
    Phase 3: Transition to Agent
    9. Get all collection periods with current category "Automated" that have completed automated steps
    10. Find the latest activity for each collection period
    11. Filter collection periods where the latest activity has status 17 (delivered)
    12. Check if wait_days_after_automated period has elapsed since activity delivery
    13. Update eligible collection periods to transition from "Automated" to "Agent"
    
    IMPORTANT: This phase only processes collection periods where next_category is NULL (edge cases).
    Normal flow: ActivityService sets next_category="Agent" and next_category_date when last step is delivered,
    then MoveCollectionToNextCategory handles the transition after wait_days_after_automated period.
*/
import { prismaCron } from "@/lib/prisma";
import { ActivityStatus, LogLevel } from "@/types/enums";
import { excludeCreditOnlyCustomerWhere } from "@/shared/utils/accountProducts";
const prisma = prismaCron();

import { CustomerService } from "../services/CustomerService";
import { LogService } from "../services/LogService";

// Helper function to serialize BigInt values recursively
function serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === "bigint") {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(serializeBigInt);
    }
    if (typeof obj === "object") {
        const serialized: any = {};
        for (const [key, value] of Object.entries(obj)) {
            serialized[key] = serializeBigInt(value);
        }
        return serialized;
    }
    return obj;
}

// Helper function to extract account IDs from collection periods
function extractAccountIds(
    collectionPeriods: Array<{ Customer?: { account_id?: number | null } }>
): number[] {
    return Array.from(
        new Set(
            collectionPeriods
                .map((cp) => cp.Customer?.account_id)
                .filter((id): id is number => typeof id === "number")
        )
    );
}

// Helper function to create max step map from groupBy results
function createMaxStepMap(
    maxSteps: Array<{
        account_id: number;
        sequence_container_id: number | null;
        _max: { step: number | null };
    }>
): Map<string, number> {
    const map = new Map<string, number>();
    maxSteps.forEach((record) => {
        if (record._max.step) {
            const key = `${record.account_id}_${record.sequence_container_id || "null"}`;
            map.set(key, record._max.step);
        }
    });
    return map;
}

// Unified logging helper
function logStep(
    step: string,
    message: string,
    level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
    parameters?: any,
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
    logCallback?: (
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
        parameters?: any,
        results?: any
    ) => void
) {
    if (stepCollector) {
        stepCollector.addStep(step, message, level, parameters);
    }
    if (logCallback) {
        logCallback(message, level, parameters);
    }
}

export async function processAutomatedCollectionPeriods(
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
    }
) {
    const startTime = new Date();
    const logService = LogService.getInstance();
    const customerService = new CustomerService();

    // Unified logging wrapper
    const log = (
        step: string,
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
        parameters?: any
    ) => {
        logStep(step, message, level, parameters, stepCollector, logCallback);
    };

    // Initialize process tracking
    const processStats = {
        phase1: {
            totalActivitiesFound: 0,
            activitiesUpdated: 0,
            collectionPeriodsUpdated: 0,
        },
        phase2: {
            totalCollectionPeriods: 0,
            eligibleCollectionPeriods: 0,
            collectionPeriodsUpdated: 0,
        },
        phase3: {
            totalCollectionPeriods: 0,
            eligibleCollectionPeriods: 0,
            collectionPeriodsUpdated: 0,
        },
        errors: [] as string[],
    };

    try {
        // Add process start message to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "START",
                "Starting processAutomatedCollectionPeriods process",
                "INFO",
                {
                    processName: "processAutomatedCollectionPeriods",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                }
            );
        }
        // Call logCallback if provided (for real-time frontend logging)
        if (logCallback) {
            logCallback(
                "Starting processAutomatedCollectionPeriods process",
                "INFO",
                {
                    processName: "processAutomatedCollectionPeriods",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    step: "START",
                    stepNumber: 1,
                }
            );
        }
        // ===== DIAGNOSTIC: Check customer's current state =====
        if (customerId) {
            const diagnosticStart = Date.now();

            // Get collection period details - only current active collection period
            const customerCollectionPeriod =
                await prisma.customerCollectionPeriod.findFirst({
                    where: {
                        customer_id: customerId,
                        period_end_date: null, // Only current active collection period
                    },
                    select: {
                        id: true,
                        customer_id: true,
                        current_category: true,
                        is_last_automated_step_delivered: true,
                        next_category: true,
                        last_automated_step: true,
                        previous_category: true,
                        next_category_date: true,
                        created_at: true,
                        modified_at: true,
                        Customer: {
                            select: {
                                account_id: true,
                            },
                        },
                    },
                });

            // Get all activities for this customer - only from current active collection period
            const customerActivities = await prisma.activity.findMany({
                where: {
                    customer_id: customerId,
                    CustomerCollectionPeriod: {
                        period_end_date: null, // Only activities from current active collection period
                    },
                },
                select: {
                    id: true,
                    customer_id: true,
                    status: true,
                    is_last_step: true,
                    type: true,
                    created_at: true,
                    actual_delivery_time: true,
                    collection_period_id: true,
                    ActivitiesSequence: {
                        select: {
                            id: true,
                            step: true,
                            category: true,
                            last_category_step: true,
                        },
                    },
                },
                orderBy: { created_at: "desc" },
                take: 10, // Get last 10 activities
            });

            const diagnosticDuration = Date.now() - diagnosticStart;

            // Also send to logCallback for real-time frontend display
            if (logCallback) {
                logCallback(
                    `Diagnostic: Current state for customer ${customerId}`,
                    "INFO",
                    {
                        processName: "processAutomatedCollectionPeriods",
                        startTime: startTime.toISOString(),
                        customerId: customerId,
                        step: "DIAGNOSTIC_CUSTOMER_STATE",
                        stepNumber: 1.5,
                        collectionPeriod: customerCollectionPeriod
                            ? {
                                id: customerCollectionPeriod.id,
                                customerId:
                                    customerCollectionPeriod.customer_id,
                                currentCategory:
                                    customerCollectionPeriod.current_category,
                                isLastAutomatedStepDelivered:
                                    customerCollectionPeriod.is_last_automated_step_delivered,
                                nextCategory:
                                    customerCollectionPeriod.next_category,
                                lastAutomatedStep:
                                    customerCollectionPeriod.last_automated_step,
                                previousCategory:
                                    customerCollectionPeriod.previous_category,
                                nextCategoryDate:
                                    customerCollectionPeriod.next_category_date,
                                created_at:
                                    customerCollectionPeriod.created_at,
                                modifiedAt:
                                    customerCollectionPeriod.modified_at,
                                accountId:
                                    customerCollectionPeriod.Customer
                                        .account_id,
                            }
                            : null,
                        recentActivities: customerActivities.map((a) => ({
                            id: a.id,
                            customerId: a.customer_id,
                            status: a.status,
                            isLastStep: a.is_last_step,
                            type: a.type,
                            created_at: a.created_at,
                            actualDeliveryTime: a.actual_delivery_time,
                            collectionPeriodId: a.collection_period_id,
                            activitiesSequence: a.ActivitiesSequence
                                ? {
                                    id: a.ActivitiesSequence.id,
                                    step: a.ActivitiesSequence.step,
                                    category: a.ActivitiesSequence.category,
                                    lastCategoryStep:
                                        a.ActivitiesSequence
                                            .last_category_step,
                                }
                                : null,
                        })),
                        performanceMetrics: {
                            diagnostic: diagnosticDuration,
                        },
                    }
                );
            }
        }
        // ===== SEQUENCE RESET: Handle manual changes from Agent to Automated =====
        const sequenceResetStart = Date.now();
        if (logCallback) {
            logCallback(
                "Starting Sequence Reset: Handle manual changes from Agent to Automated",
                "INFO",
                {
                    processName: "processAutomatedCollectionPeriods",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    step: "SEQUENCE_RESET_START",
                    stepNumber: 1.5,
                }
            );
        }
        // Find collection periods that were manually changed from Agent to Automated
        // CRITICAL FIX: Only reset if last_automated_step is 0 (fresh transition)
        // If last_automated_step > 0, the automated workflow has already progressed and should NOT be reset
        const manuallyChangedCollectionPeriods =
            await prisma.customerCollectionPeriod.findMany({
                where: {
                    current_category: "Automated",
                    previous_category: "Agent",
                    last_automated_step: 0, // ONLY fresh transitions that haven't progressed yet
                    period_end_date: null,
                    Customer: excludeCreditOnlyCustomerWhere({
                        automation_stuck_no_contacts: { not: true },
                    }), // Skip customers that are stuck due to no contacts
                    ...(customerId && { customer_id: customerId }),
                },
                select: {
                    id: true,
                    customer_id: true,
                    current_category: true,
                    previous_category: true,
                    last_automated_step: true,
                    create_next_activity: true,
                    is_last_automated_step_delivered: true,
                    modified_at: true,
                },
            });

        if (manuallyChangedCollectionPeriods.length > 0) {
            if (logCallback) {
                logCallback(
                    `Found ${manuallyChangedCollectionPeriods.length} collection periods manually changed from Agent to Automated`,
                    "INFO",
                    {
                        processName: "processAutomatedCollectionPeriods",
                        startTime: startTime.toISOString(),
                        customerId: customerId || "ALL",
                        step: "SEQUENCE_RESET_FOUND",
                        stepNumber: 1.6,
                        count: manuallyChangedCollectionPeriods.length,
                    }
                );
            }
            // Fetch all customers and max steps in batch to avoid N+1 queries
            const customerIds = manuallyChangedCollectionPeriods.map(
                (cp) => cp.customer_id
            );
            const customers = await prisma.customer.findMany({
                where: { id: { in: customerIds } },
                select: { id: true, account_id: true },
            });
            const customerMap = new Map(customers.map((c) => [c.id, c]));

            const accountIds = Array.from(
                new Set(
                    customers
                        .map((c) => c.account_id)
                        .filter(Boolean) as number[]
                )
            );

            // CRITICAL FIX: Also need to get sequence_container_ids from customers
            const customersWithContainers = await prisma.customer.findMany({
                where: { id: { in: customerIds } },
                select: {
                    id: true,
                    account_id: true,
                    sequence_container_id: true,
                },
            });
            const customerContainerMap = new Map(
                customersWithContainers.map((c) => [c.id, c])
            );

            const maxSteps =
                accountIds.length > 0
                    ? await prisma.activitiesSequence.groupBy({
                        by: ["account_id", "sequence_container_id"],
                        where: {
                            account_id: { in: accountIds },
                            category: "Automated",
                            active: true,
                            OR: [
                                { step_type: null },
                                { step_type: "overdue" },
                            ],
                        },
                        _max: {
                            step: true,
                        },
                    })
                    : [];

            // CRITICAL FIX: Create map with account_id_sequence_container_id key
            const maxStepMap = createMaxStepMap(maxSteps);

            // Check each collection period to determine if it needs sequence reset
            for (const collectionPeriod of manuallyChangedCollectionPeriods) {
                try {
                    // Get max automated step for this customer (from batch-fetched data)
                    const customer = customerContainerMap.get(
                        collectionPeriod.customer_id
                    );

                    // CRITICAL FIX: Use sequence_container_id in the key
                    const sequenceContainerId = customer?.sequence_container_id;
                    const maxStepKey = `${customer?.account_id}_${sequenceContainerId || "null"}`;
                    const maxStepValue = maxStepMap.get(maxStepKey);

                    // CRITICAL FIX: If no sequences exist (maxStepValue is null), revert category to Agent
                    // This prevents collection periods from being stuck in Automated category with no way to proceed
                    if (maxStepValue === null || maxStepValue === undefined) {
                        if (logCallback) {
                            logCallback(
                                `No automated sequences found for customer ${collectionPeriod.customer_id} - reverting to Agent category`,
                                "WARNING",
                                {
                                    processName:
                                        "processAutomatedCollectionPeriods",
                                    startTime: startTime.toISOString(),
                                    customerId: collectionPeriod.customer_id,
                                    step: "SEQUENCE_RESET_NO_SEQUENCES",
                                    stepNumber: 1.65,
                                    collectionPeriodId: collectionPeriod.id,
                                    reason: "no_automated_sequences_found",
                                    accountId: customer?.account_id,
                                }
                            );
                        }

                        // Revert category to Agent
                        await customerService.updateCollectionPeriodCategory(
                            collectionPeriod.id,
                            "Agent",
                            collectionPeriod.current_category as any,
                            customer?.account_id || 0,
                            collectionPeriod.customer_id,
                            {
                                reason: "No automated sequences found - reverting to Agent category",
                                userId: "system",
                                isManualCategoryChange: false,
                                translate: (key: string) => key,
                            }
                        );
                        continue; // Skip to next collection period
                    }

                    const isAtLastStep =
                        collectionPeriod.last_automated_step === maxStepValue;

                    // FIXED LOGIC: Since we now only query for last_automated_step = 0 in the WHERE clause,
                    // we know these are truly fresh transitions that need to be reset
                    // We still check if at last step as a safety measure, but this should rarely happen
                    if (isAtLastStep) {
                        // Safety check - if somehow at last step with last_automated_step = 0, something is wrong
                        // This should not happen with the new query logic, but keeping as safety
                        if (logCallback) {
                            logCallback(
                                `ANOMALY: Collection period has last_automated_step = 0 but is at max step ${maxStepValue} - skipping reset`,
                                "WARNING",
                                {
                                    processName:
                                        "processAutomatedCollectionPeriods",
                                    startTime: startTime.toISOString(),
                                    customerId: collectionPeriod.customer_id,
                                    step: "SEQUENCE_RESET_ANOMALY",
                                    stepNumber: 1.7,
                                    collectionPeriodId: collectionPeriod.id,
                                    reason: "anomaly_last_step_with_zero",
                                    lastAutomatedStep:
                                        collectionPeriod.last_automated_step,
                                    maxStep: maxStepValue,
                                }
                            );
                        }
                    } else {
                        // Fresh transition from Agent to Automated - reset to enable step 1 creation
                        // Since last_automated_step is already 0, we mainly need to set flags
                        await prisma.customerCollectionPeriod.update({
                            where: { id: collectionPeriod.id },
                            data: {
                                create_next_activity: true, // Enable activity creation
                                is_last_automated_step_delivered: false, // Reset flag
                                modified_at: new Date(),
                                // Note: last_automated_step is already 0, no need to change it
                                // Note: automation_stuck_no_contacts flag is NOT reset here
                                // It should only be cleared when contacts are added/updated
                            },
                        });

                        if (logCallback) {
                            logCallback(
                                `Enabled activity creation for customer ${collectionPeriod.customer_id} - fresh transition from Agent to Automated (last_automated_step: ${collectionPeriod.last_automated_step}), will start from step 1`,
                                "INFO",
                                {
                                    processName:
                                        "processAutomatedCollectionPeriods",
                                    startTime: startTime.toISOString(),
                                    customerId: collectionPeriod.customer_id,
                                    step: "SEQUENCE_RESET_SUCCESS",
                                    stepNumber: 1.8,
                                    collectionPeriodId: collectionPeriod.id,
                                    reason: "fresh_agent_to_automated_transition",
                                    lastAutomatedStep:
                                        collectionPeriod.last_automated_step,
                                    maxStep: maxStepValue,
                                }
                            );
                        }
                    }
                } catch (error: any) {
                    if (logCallback) {
                        logCallback(
                            `Failed to process sequence reset for customer ${collectionPeriod.customer_id}: ${error.message}`,
                            "ERROR",
                            {
                                processName:
                                    "processAutomatedCollectionPeriods",
                                startTime: startTime.toISOString(),
                                customerId: collectionPeriod.customer_id,
                                step: "SEQUENCE_RESET_ERROR",
                                stepNumber: 1.9,
                                collectionPeriodId: collectionPeriod.id,
                                error: error.message,
                            }
                        );
                    }
                }
            }
        }
        const sequenceResetDuration = Date.now() - sequenceResetStart;
        if (logCallback) {
            logCallback(
                `Sequence reset completed in ${sequenceResetDuration}ms`,
                "INFO",
                {
                    processName: "processAutomatedCollectionPeriods",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    step: "SEQUENCE_RESET_COMPLETE",
                    stepNumber: 1.9,
                    duration: sequenceResetDuration,
                }
            );
        }
        // ===== PHASE 1: Mark Last Steps =====
        const phase1Start = Date.now();
        if (logCallback) {
            logCallback("Starting Phase 1: Mark Last Steps", "INFO", {
                processName: "processAutomatedCollectionPeriods",
                startTime: startTime.toISOString(),
                customerId: customerId || "ALL",
                step: "PHASE1_START",
                stepNumber: 2,
            });
        }
        // Step 1: Get activities that need to be marked as last step
        const fetchActivitiesStart = Date.now();
        const activities = await prisma.activity.findMany({
            where: {
                // FIXED: Get all delivered automated activities, we'll filter by step number later
                status: ActivityStatus.DELIVERED, // Only delivered activities
                CustomerCollectionPeriod: {
                    current_category: "Automated",
                    is_last_automated_step_delivered: false,
                    period_end_date: null, // Only current active collection periods
                    Customer: excludeCreditOnlyCustomerWhere(),
                    ...(customerId && { customer_id: customerId }),
                },
                ActivitiesSequence: {
                    category: "Automated",
                },
            },
            select: {
                id: true,
                customer_id: true,
                status: true,
                is_last_step: true,
                type: true,
                created_at: true,
                activity_sequence_id: true,
                CustomerCollectionPeriod: {
                    select: {
                        id: true,
                        customer_id: true,
                        current_category: true,
                        previous_category: true,
                        is_last_automated_step_delivered: true,
                        next_category: true,
                        last_automated_step: true,
                        modified_at: true,
                        Customer: {
                            select: {
                                account_id: true,
                                sequence_container_id: true,
                            },
                        },
                    },
                },
                ActivitiesSequence: {
                    select: {
                        id: true,
                        step: true,
                        category: true,
                        last_category_step: true,
                        account_id: true,
                        sequence_container_id: true,
                    },
                },
            },
        });
        const fetchActivitiesDuration = Date.now() - fetchActivitiesStart;

        // Get unique account IDs to fetch max automated steps
        const accountIds = Array.from(
            new Set(
                activities
                    .map(
                        (a) =>
                            (a as any).CustomerCollectionPeriod?.Customer
                                ?.account_id
                    )
                    .filter((id): id is number => typeof id === "number")
            )
        );

        // Fetch max automated step for each account and sequence container combination (overdue steps only)
        const maxAutomatedSteps = await prisma.activitiesSequence.groupBy({
            by: ["account_id", "sequence_container_id"],
            where: {
                account_id: { in: accountIds },
                category: "Automated",
                active: true,
                OR: [{ step_type: null }, { step_type: "overdue" }],
            },
            _max: {
                step: true,
            },
        });

        // Create a map of account_id + sequence_container_id => max_step
        const maxStepMap = createMaxStepMap(maxAutomatedSteps);

        if (stepCollector) {
            const maxStepMapEntries = Array.from(maxStepMap.entries()).map(
                ([key, maxStep]) => {
                    const [accountId, sequenceContainerId] = key.split("_");
                    return {
                        key,
                        accountId,
                        sequenceContainerId:
                            sequenceContainerId === "null"
                                ? null
                                : sequenceContainerId,
                        maxStep,
                    };
                }
            );
            stepCollector.addStep(
                "PHASE1_MAX_STEP_MAP",
                `Max automated step per account+container (used to determine last step): ${maxStepMapEntries.length} entries`,
                "INFO",
                {
                    rawGroupByCount: maxAutomatedSteps.length,
                    maxStepMapEntries,
                }
            );
        }

        // *** CRITICAL FIX: Filter activities to only include those at the FINAL automated step ***
        // Use the CUSTOMER's current sequence container (not the activity's) so that if the customer
        // was moved to a new container (e.g. after cloning), we don't treat an old step-4 activity
        // from the previous container as "last step" when the new container has 5 steps.
        const validActivities = activities.filter((activity) => {
            const collectionPeriod = (activity as any).CustomerCollectionPeriod;
            if (!collectionPeriod) return false;

            const activitySequence = (activity as any).ActivitiesSequence;
            if (!activitySequence) return false;

            const actAccountId =
                (collectionPeriod as any).Customer?.account_id || 0;
            // Use customer's current container for last-step and previous-cycle checks
            const customerContainerId =
                (collectionPeriod as any).Customer?.sequence_container_id ??
                activitySequence.sequence_container_id;
            const maxStepKeyForCustomer = `${actAccountId}_${customerContainerId ?? "null"}`;
            const maxStepForContainer =
                maxStepMap.get(maxStepKeyForCustomer) || 0;

            // CRITICAL FIX: Filter out activities from previous cycles
            const currentStep = collectionPeriod.last_automated_step || 0;
            const actStep = activitySequence.step;

            // Skip activities from previous cycles:
            // If activity step is MORE than 1 ahead of current step AND current step is not near max,
            // it's likely from a previous cycle that completed
            if (
                actStep > currentStep + 1 &&
                currentStep < maxStepForContainer - 1
            ) {
                // Activity is from a previous cycle - skip it

                return false;
            }

            // Handle manual changes from Agent to Automated by resetting the sequence
            const wasManuallyChangedToAutomated =
                collectionPeriod.current_category === "Automated" &&
                collectionPeriod[
                "previous_category" as keyof typeof collectionPeriod
                ] === "Agent";

            if (wasManuallyChangedToAutomated) {
                // Check if this is a natural progression or manual change scenario (use customer's container)
                const maxStep = maxStepMap.get(maxStepKeyForCustomer);
                const activityStep = activitySequence.step;
                const isAtLastStep = activityStep === maxStep;

                if (isAtLastStep) {
                    // If at the last step, this could be natural progression
                    // Check if the customer was already at step 6 before the manual change
                    const wasAlreadyAtLastStep =
                        collectionPeriod.last_automated_step === maxStep;

                    if (wasAlreadyAtLastStep) {
                        // Account was already at step 6 - this is natural progression
                        // Allow the activity to enable Agent transition
                        if (logCallback) {
                            logCallback(
                                `Allowing last step activity for natural progression - customer ${collectionPeriod.customer_id}, activity ID: ${activity.id}, step: ${activityStep}`,
                                "INFO",
                                {
                                    processName:
                                        "processAutomatedCollectionPeriods",
                                    startTime: startTime.toISOString(),
                                    customerId: collectionPeriod.customer_id,
                                    step: "PHASE1_NATURAL_PROGRESSION",
                                    stepNumber: 4.5,
                                    activityId: activity.id,
                                    activityStep: activityStep,
                                    maxStep: maxStep,
                                    reason: "natural_progression_to_agent",
                                }
                            );
                        }
                    } else {
                        // Account was not at step 6 - this is a manual change
                        // Filter out old activities to allow sequence reset
                        const activitycreated_at = new Date(activity.created_at);
                        const collectionPeriodModifiedAt = new Date(
                            collectionPeriod.modified_at
                        );

                        if (activitycreated_at <= collectionPeriodModifiedAt) {
                            return false; // Activity is from before the manual change
                        }
                    }
                } else {
                    // For non-last steps, filter out ALL old activities
                    // This prevents immediate reversion to Agent and allows proper sequence reset
                    const activitycreated_at = new Date(activity.created_at);
                    const collectionPeriodModifiedAt = new Date(
                        collectionPeriod.modified_at
                    );

                    // Only process activities created AFTER the manual change to Automated
                    if (activitycreated_at <= collectionPeriodModifiedAt) {
                        return false; // Activity is from before the manual change to Automated
                    }
                }
            }
            const maxStep = maxStepMap.get(maxStepKeyForCustomer);
            const activityStep = activitySequence.step;

            // CRITICAL: Only process activities where the step number equals the maximum automated step (customer's container)
            // This ensures we don't prematurely mark collection periods as complete
            if (!maxStep || !activityStep) {
                return false; // Can't determine if this is the last step
            }
            if (activityStep !== maxStep) {
                return false; // This is NOT the final automated step
            }
            // Additional check: activity must be delivered
            if (activity.status !== ActivityStatus.DELIVERED) {
                return false;
            }
            // If we reach here, this activity is at the final automated step AND delivered
            return true;
        });

        // *** NEW IMPROVEMENT: Handle duplicate activities by grouping by customer and finding the latest ***
        const activitiesByAccount = new Map<
            number,
            (typeof validActivities)[0]
        >();

        validActivities.forEach((activity) => {
            const customerId = activity.customer_id;
            const existingActivity = activitiesByAccount.get(customerId);

            if (!existingActivity) {
                // First activity for this customer
                activitiesByAccount.set(customerId, activity);
            } else {
                // Compare creation dates - keep the latest one
                const existingDate = new Date(existingActivity.created_at);
                const currentDate = new Date(activity.created_at);

                if (currentDate > existingDate) {
                    activitiesByAccount.set(customerId, activity);
                }
            }
        });

        // Convert back to array - now we have only the latest delivered activity per customer
        const latestActivities = Array.from(activitiesByAccount.values());

        processStats.phase1.totalActivitiesFound = latestActivities.length; // Use latestActivities (after deduplication)

        if (stepCollector) {
            const validActivitiesDetail = validActivities.map((activity) => {
                const collectionPeriod = (activity as any)
                    .CustomerCollectionPeriod;
                const activitySequence = (activity as any).ActivitiesSequence;
                const actAccountId =
                    (collectionPeriod as any)?.Customer?.account_id ?? 0;
                const customerContainerId =
                    (collectionPeriod as any)?.Customer?.sequence_container_id ??
                    activitySequence?.sequence_container_id;
                const actMaxStepKey = `${actAccountId}_${customerContainerId ?? "null"}`;
                const maxStepForContainer =
                    maxStepMap.get(actMaxStepKey) ?? 0;
                return {
                    activityId: activity.id,
                    customerId: activity.customer_id,
                    activityStep: activitySequence?.step,
                    maxStepForContainer,
                    key: actMaxStepKey,
                    collectionPeriodId: collectionPeriod?.id,
                    isLastStepInSequence:
                        activitySequence?.step === maxStepForContainer,
                };
            });
            stepCollector.addStep(
                "PHASE1_VALID_ACTIVITIES",
                `Activities at final automated step (after filter): ${validActivities.length} (deduped to ${latestActivities.length} latest per customer)`,
                "INFO",
                {
                    validCount: validActivities.length,
                    latestCount: latestActivities.length,
                    validActivitiesDetail,
                }
            );
        }

        // Enhanced logging with all relevant fields
        if (logCallback) {
            logCallback(
                "Phase 1: Retrieved activities to mark as last step",
                "INFO",
                {
                    processName: "processAutomatedCollectionPeriods",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    step: "PHASE1_FETCH_ACTIVITIES",
                    stepNumber: 3,
                    activitiesFound: latestActivities.length,
                    totalActivitiesBeforeFilter: activities.length,
                    validActivitiesAfterFilter: validActivities.length,
                    duplicatesRemoved:
                        validActivities.length - latestActivities.length,
                    maxAutomatedSteps: Array.from(maxStepMap.entries()).map(
                        ([key, maxStep]) => {
                            const [accountId, sequenceContainerId] =
                                key.split("_");
                            return {
                                accountId: parseInt(accountId),
                                sequenceContainerId:
                                    sequenceContainerId === "null"
                                        ? null
                                        : parseInt(sequenceContainerId),
                                maxStep,
                            };
                        }
                    ),
                    performanceMetrics: {
                        fetchActivities: fetchActivitiesDuration,
                    },
                }
            );
        }
        if (latestActivities.length > 0) {
            // Step 2: Update activities to mark them as last step (only if not already marked)
            const updateActivitiesStart = Date.now();
            const activitiesToUpdate = latestActivities.filter(
                (a) => !a.is_last_step
            );
            const updateActivitiesResult = await prisma.activity.updateMany({
                where: {
                    id: { in: activitiesToUpdate.map((a) => a.id) },
                },
                data: {
                    is_last_step: true,
                },
            });
            const updateActivitiesDuration = Date.now() - updateActivitiesStart;
            processStats.phase1.activitiesUpdated =
                updateActivitiesResult.count;

            // Step 3: Update collection periods to mark last automated step as delivered
            const updateCollectionPeriodsStart = Date.now();
            const updateCollectionPeriodsResult =
                await prisma.customerCollectionPeriod.updateMany({
                    where: {
                        id: {
                            in: latestActivities
                                .map(
                                    (a) =>
                                        (a as any).CustomerCollectionPeriod?.id
                                )
                                .filter((id) => id !== undefined) as number[],
                        },
                    },
                    data: {
                        is_last_automated_step_delivered: true,
                    },
                });
            const updateCollectionPeriodsDuration =
                Date.now() - updateCollectionPeriodsStart;
            processStats.phase1.collectionPeriodsUpdated =
                updateCollectionPeriodsResult.count;

            if (stepCollector) {
                const markedActivityIds = activitiesToUpdate.map((a) => a.id);
                const markedPeriodIds = latestActivities
                    .map(
                        (a) =>
                            (a as any).CustomerCollectionPeriod?.id as
                                | number
                                | undefined
                    )
                    .filter((id): id is number => id !== undefined);
                stepCollector.addStep(
                    "PHASE1_MARKED_LAST",
                    `Marked ${markedActivityIds.length} activities as is_last_step and ${markedPeriodIds.length} collection periods as is_last_automated_step_delivered`,
                    "INFO",
                    {
                        markedActivityIds,
                        markedCollectionPeriodIds: markedPeriodIds,
                    }
                );
            }
        }
        const phase1Duration = Date.now() - phase1Start;

        // ===== PHASE 2: Prepare Next Activities =====
        const phase2Start = Date.now();
        const fetchCollectionPeriodsStart = Date.now();

        // Get collection periods that are eligible for next activity creation
        const eligibleCollectionPeriods =
            await prisma.customerCollectionPeriod.findMany({
                where: {
                    current_category: "Automated",
                    create_next_activity: false,
                    is_last_automated_step_delivered: false,
                    period_end_date: null,
                    Customer: excludeCreditOnlyCustomerWhere({
                        automation_stuck_no_contacts: { not: true },
                    }), // Skip customers that are stuck due to no contacts
                    ...(customerId && { customer_id: customerId }),
                },
                include: {
                    Customer: {
                        select: {
                            account_id: true,
                        },
                    },
                },
            });

        // Filter out collection periods that already have pending activities
        const collectionPeriodsWithPendingActivities =
            await prisma.activity.findMany({
                where: {
                    collection_period_id: {
                        in: eligibleCollectionPeriods.map((cp) => cp.id),
                    },
                    status: {
                        in: [ActivityStatus.SCHEDULED],
                    },
                    ActivitiesSequence: {
                        category: "Automated",
                    },
                },
                select: {
                    collection_period_id: true,
                },
            });

        const pendingCollectionPeriodIds = new Set(
            collectionPeriodsWithPendingActivities.map(
                (a) => a.collection_period_id
            )
        );

        const collectionPeriods = eligibleCollectionPeriods.filter(
            (cp) => !pendingCollectionPeriodIds.has(cp.id)
        );

        const fetchCollectionPeriodsDuration =
            Date.now() - fetchCollectionPeriodsStart;
        processStats.phase2.totalCollectionPeriods = collectionPeriods.length;

        // Enhanced logging for customer-specific execution - diagnose why periods weren't found
        if (customerId) {
            const allPeriodsForCustomer =
                await prisma.customerCollectionPeriod.findMany({
                    where: {
                        customer_id: customerId,
                    },
                    select: {
                        id: true,
                        customer_id: true,
                        period_end_date: true,
                        create_next_activity: true,
                        current_category: true,
                        is_last_automated_step_delivered: true,
                        last_automated_step: true,
                        period_start_date: true,
                    },
                });

            if (allPeriodsForCustomer.length > 0) {
                // Get latest activity status for each collection period
                const periodIds = allPeriodsForCustomer.map((p) => p.id);
                const latestActivities = await prisma.activity.findMany({
                    where: {
                        collection_period_id: { in: periodIds },
                        ActivitiesSequence: {
                            category: "Automated",
                        },
                    },
                    select: {
                        id: true,
                        collection_period_id: true,
                        status: true,
                        created_at: true,
                        ActivitiesSequence: {
                            select: {
                                step: true,
                            },
                        },
                    },
                    orderBy: {
                        created_at: "desc",
                    },
                });

                // Group by collection_period_id to get the latest activity for each
                const latestActivityByPeriod = new Map<
                    number,
                    (typeof latestActivities)[0]
                >();
                for (const activity of latestActivities) {
                    if (
                        !latestActivityByPeriod.has(
                            activity.collection_period_id!
                        )
                    ) {
                        latestActivityByPeriod.set(
                            activity.collection_period_id!,
                            activity
                        );
                    }
                }
                // Check for pending activities
                const pendingActivities = await prisma.activity.findMany({
                    where: {
                        collection_period_id: { in: periodIds },
                        status: ActivityStatus.SCHEDULED,
                        ActivitiesSequence: {
                            category: "Automated",
                        },
                    },
                    select: {
                        collection_period_id: true,
                    },
                });

                const pendingPeriodIds = new Set(
                    pendingActivities
                        .map((a) => a.collection_period_id)
                        .filter((id): id is number => id !== null)
                );

                // Analyze why periods don't match the query criteria
                const analysis = {
                    totalPeriods: allPeriodsForCustomer.length,
                    periodsWithPeriodEndDate: allPeriodsForCustomer.filter(
                        (p) => p.period_end_date !== null
                    ).length,
                    periodsWithCreateNextActivityFalse:
                        allPeriodsForCustomer.filter(
                            (p) => p.create_next_activity === false
                        ).length,
                    periodsWithIsLastStepDeliveredFalse:
                        allPeriodsForCustomer.filter(
                            (p) => p.is_last_automated_step_delivered === false
                        ).length,
                    periodsWithAutomatedCategory: allPeriodsForCustomer.filter(
                        (p) => p.current_category === "Automated"
                    ).length,
                    periodsMatchingPhase2Criteria: allPeriodsForCustomer.filter(
                        (p) =>
                            p.period_end_date === null &&
                            p.create_next_activity === false &&
                            p.is_last_automated_step_delivered === false &&
                            p.current_category === "Automated"
                    ).length,
                    periodsWithPendingActivities: allPeriodsForCustomer.filter(
                        (p) => pendingPeriodIds.has(p.id)
                    ).length,
                    periodDetails: allPeriodsForCustomer.map((p) => {
                        const latestActivity = latestActivityByPeriod.get(p.id);
                        const hasPendingActivity = pendingPeriodIds.has(p.id);
                        const matchesPhase2Criteria =
                            p.period_end_date === null &&
                            p.create_next_activity === false &&
                            p.is_last_automated_step_delivered === false &&
                            p.current_category === "Automated";
                        const eligibleAfterPendingFilter =
                            matchesPhase2Criteria && !hasPendingActivity;
                        const eligibleAfterActivityStatusCheck =
                            eligibleAfterPendingFilter &&
                            (!latestActivity ||
                                latestActivity.status === "DELIVERED" ||
                                latestActivity.status === "CANCELLED");

                        return {
                            id:
                                typeof p.id === "bigint"
                                    ? (p.id as bigint).toString()
                                    : (p.id as number),
                            period_end_date:
                                p.period_end_date?.toISOString() || null,
                            create_next_activity: p.create_next_activity,
                            is_last_automated_step_delivered:
                                p.is_last_automated_step_delivered,
                            current_category: p.current_category,
                            last_automated_step: p.last_automated_step,
                            period_start_date:
                                p.period_start_date?.toISOString() || null,
                            latestActivity: latestActivity
                                ? {
                                    id:
                                        typeof latestActivity.id === "bigint"
                                            ? latestActivity.id.toString()
                                            : latestActivity.id,
                                    status: latestActivity.status,
                                    step: latestActivity.ActivitiesSequence
                                        ?.step,
                                    created_at:
                                        latestActivity.created_at?.toISOString(),
                                }
                                : null,
                            hasPendingActivity: hasPendingActivity,
                            matchesPhase2Criteria: matchesPhase2Criteria,
                            eligibleAfterPendingFilter:
                                eligibleAfterPendingFilter,
                            eligibleAfterActivityStatusCheck:
                                eligibleAfterActivityStatusCheck,
                        };
                    }),
                };

                const serializedAnalysis = serializeBigInt(analysis);

                // Log to step collector (primary logging mechanism)
                if (stepCollector) {
                    stepCollector.addStep(
                        "PHASE2_COLLECTION_PERIOD_ANALYSIS",
                        `Collection period analysis for customer ${customerId}`,
                        "INFO",
                        {
                            customer_id: customerId,
                            phase: "Phase 2: Prepare Next Activities",
                            analysis: serializedAnalysis,
                        }
                    );
                }
                // Also log to callback if provided
                if (logCallback) {
                    logCallback(
                        `Collection period analysis for customer ${customerId}`,
                        "INFO",
                        {
                            step: "PHASE2_COLLECTION_PERIOD_ANALYSIS",
                            customer_id: customerId,
                            phase: "Phase 2: Prepare Next Activities",
                            analysis: serializedAnalysis,
                        }
                    );
                }
            } else {
                // Log to step collector (primary logging mechanism)
                if (stepCollector) {
                    stepCollector.addStep(
                        "PHASE2_NO_COLLECTION_PERIODS",
                        `No collection periods found for customer ${customerId} at all`,
                        "WARNING",
                        {
                            customer_id: customerId,
                            phase: "Phase 2: Prepare Next Activities",
                        }
                    );
                }
                // Also log to callback if provided
                if (logCallback) {
                    logCallback(
                        `No collection periods found for customer ${customerId} at all`,
                        "WARNING",
                        {
                            step: "PHASE2_NO_COLLECTION_PERIODS",
                            customer_id: customerId,
                            phase: "Phase 2: Prepare Next Activities",
                        }
                    );
                }
            }
        }
        if (collectionPeriods.length > 0) {
            // Find the latest activity for each collection period
            const fetchLatestActivitiesStart = Date.now();

            // Batch fetch all activities for collection periods to avoid N+1 queries
            const collectionPeriodIds = collectionPeriods.map((cp) => cp.id);

            // Fetch all activities for these collection periods in a single query
            const allActivities = await prisma.activity.findMany({
                where: {
                    collection_period_id: { in: collectionPeriodIds },
                    ActivitiesSequence: {
                        category: "Automated",
                    },
                },
                select: {
                    collection_period_id: true,
                    status: true,
                    created_at: true,
                },
                orderBy: {
                    created_at: "desc",
                },
            });

            // Group by collection_period_id and keep only the latest (first) activity for each
            const latestActivitiesMap = new Map<
                number,
                { collection_period_id: number; status: string }
            >();
            for (const activity of allActivities) {
                if (
                    activity.collection_period_id &&
                    !latestActivitiesMap.has(activity.collection_period_id)
                ) {
                    latestActivitiesMap.set(activity.collection_period_id, {
                        collection_period_id: activity.collection_period_id,
                        status: activity.status,
                    });
                }
            }
            const fetchLatestActivitiesDuration =
                Date.now() - fetchLatestActivitiesStart;

            // Filter collection periods where the latest activity has status DELIVERED or CANCELLED
            const filterEligibleStart = Date.now();
            const eligibleCollectionPeriods = collectionPeriods.filter((cp) => {
                const latestActivity = latestActivitiesMap.get(cp.id);

                // Case 1: Has delivered/cancelled activities
                if (
                    latestActivity &&
                    (latestActivity.status === "DELIVERED" ||
                        latestActivity.status === "CANCELLED")
                ) {
                    return true;
                }
                // Case 2: No activities at all (first activity case)
                if (!latestActivity) {
                    return true;
                }
                return false;
            });
            const filterEligibleDuration = Date.now() - filterEligibleStart;
            processStats.phase2.eligibleCollectionPeriods =
                eligibleCollectionPeriods.length;

            if (eligibleCollectionPeriods.length > 0) {
                // Calculate next activity times for eligible collection periods
                const calculateNextActivityTimeStart = Date.now();
                const calculatedNextActivityTimeInput = new Map<
                    number,
                    {
                        account_id: number;
                        last_automated_step: number;
                        period_start_date: Date;
                    }
                >();

                for (const cp of eligibleCollectionPeriods) {
                    calculatedNextActivityTimeInput.set(cp.customer_id, {
                        account_id: cp.Customer?.account_id || 0,
                        last_automated_step: cp.last_automated_step ?? 0,
                        period_start_date: cp.period_start_date,
                    });
                }
                const calculatedNextActivityTime =
                    await customerService.calculateNextAutomatedActivityTime(
                        calculatedNextActivityTimeInput
                    );
                const calculateNextActivityTimeDuration =
                    Date.now() - calculateNextActivityTimeStart;

                // Update collection periods with new activity dates
                const updateCollectionPeriodsStart = Date.now();
                // Use the already declared customerService from line 55

                // Update collection periods with next activity date
                // We need to update each one individually to set the calculated next_activity_date
                const collectionPeriodUpdatePromises: Array<Promise<any>> = [];
                for (const cp of eligibleCollectionPeriods) {
                    const calculatedTime = calculatedNextActivityTime.get(
                        cp.customer_id
                    );
                    if (calculatedTime) {
                        collectionPeriodUpdatePromises.push(
                            prisma.customerCollectionPeriod.update({
                                where: { id: cp.id },
                                data: {
                                    create_next_activity: true,
                                    next_activity_date:
                                        calculatedTime.schedule_time, // Store the calculated date
                                    modified_at: new Date(),
                                },
                            })
                        );
                    } else {
                        // Fallback: set create_next_activity without date if calculation failed
                        collectionPeriodUpdatePromises.push(
                            prisma.customerCollectionPeriod.update({
                                where: { id: cp.id },
                                data: {
                                    create_next_activity: true,
                                    modified_at: new Date(),
                                },
                            })
                        );
                    }
                }

                // Execute updates
                const updateResults = await Promise.allSettled(
                    collectionPeriodUpdatePromises
                );
                const successfulUpdates = updateResults.filter(
                    (r) => r.status === "fulfilled"
                ).length;
                const failedUpdates =
                    eligibleCollectionPeriods.length - successfulUpdates;

                const updateCollectionPeriodsDuration =
                    Date.now() - updateCollectionPeriodsStart;
                processStats.phase2.collectionPeriodsUpdated =
                    successfulUpdates;

                // Log batch update results
                if (failedUpdates > 0) {
                    const errorMsg = `Batch update: ${successfulUpdates} successful, ${failedUpdates} failed out of ${eligibleCollectionPeriods.length} collection periods`;
                    processStats.errors.push(errorMsg);
                }
            }
        }
        const phase2Duration = Date.now() - phase2Start;

        // ===== PHASE 3: Transition to Agent =====
        const phase3Start = Date.now();
        const fetchAgentTransitionCollectionPeriodsStart = Date.now();

        const agentTransitionCollectionPeriods =
            await prisma.customerCollectionPeriod.findMany({
                where: {
                    current_category: "Automated",
                    is_last_automated_step_delivered: true,
                    next_category: null,
                    period_end_date: null,
                    Customer: excludeCreditOnlyCustomerWhere({
                        automation_stuck_no_contacts: { not: true },
                    }), // Skip customers that are stuck due to no contacts
                    ...(customerId && { customer_id: customerId }),
                },
                select: {
                    id: true,
                    customer_id: true,
                    current_category: true,
                    is_last_automated_step_delivered: true,
                    next_category: true,
                    last_automated_step: true,
                    previous_category: true,
                    next_category_date: true,
                    created_at: true,
                    modified_at: true,
                    Customer: {
                        select: {
                            account_id: true,
                            sequence_container_id: true,
                        },
                    },
                },
            });

        const fetchAgentTransitionCollectionPeriodsDuration =
            Date.now() - fetchAgentTransitionCollectionPeriodsStart;
        processStats.phase3.totalCollectionPeriods =
            agentTransitionCollectionPeriods.length;

        // Enhanced logging for customer-specific execution - diagnose why periods weren't found
        if (customerId) {
            const allPeriodsForCustomer =
                await prisma.customerCollectionPeriod.findMany({
                    where: {
                        customer_id: customerId,
                    },
                    select: {
                        id: true,
                        customer_id: true,
                        period_end_date: true,
                        current_category: true,
                        is_last_automated_step_delivered: true,
                        next_category: true,
                        last_automated_step: true,
                        period_start_date: true,
                    },
                });

            if (allPeriodsForCustomer.length > 0) {
                // Analyze why periods don't match Phase 3 criteria
                // Note: wait_days_after_automated is fetched later in the existing code
                const analysis = {
                    totalPeriods: allPeriodsForCustomer.length,
                    periodsWithPeriodEndDate: allPeriodsForCustomer.filter(
                        (p) => p.period_end_date !== null
                    ).length,
                    periodsWithAutomatedCategory: allPeriodsForCustomer.filter(
                        (p) => p.current_category === "Automated"
                    ).length,
                    periodsWithIsLastStepDeliveredTrue:
                        allPeriodsForCustomer.filter(
                            (p) => p.is_last_automated_step_delivered === true
                        ).length,
                    periodsWithNextCategoryNull: allPeriodsForCustomer.filter(
                        (p) => p.next_category === null
                    ).length,
                    periodsMatchingPhase3Criteria: allPeriodsForCustomer.filter(
                        (p) =>
                            p.current_category === "Automated" &&
                            p.is_last_automated_step_delivered === true &&
                            p.next_category === null &&
                            p.period_end_date === null
                    ).length,
                    periodDetails: allPeriodsForCustomer.map((p) => {
                        const accountId = (p as any).Customer?.account_id;
                        // Note: wait_days_after_automated will be fetched later in the existing code
                        const waitDaysAfterAutomated = 0; // Placeholder - will be populated by existing account fetch
                        const matchesPhase3Criteria =
                            p.current_category === "Automated" &&
                            p.is_last_automated_step_delivered === true &&
                            p.next_category === null &&
                            p.period_end_date === null;

                        return {
                            id:
                                typeof p.id === "bigint"
                                    ? (p.id as bigint).toString()
                                    : (p.id as number),
                            period_end_date:
                                p.period_end_date?.toISOString() || null,
                            current_category: p.current_category,
                            is_last_automated_step_delivered:
                                p.is_last_automated_step_delivered,
                            next_category: p.next_category,
                            last_automated_step: p.last_automated_step,
                            period_start_date:
                                p.period_start_date?.toISOString() || null,
                            account_id: accountId,
                            wait_days_after_automated: waitDaysAfterAutomated,
                            matchesPhase3Criteria: matchesPhase3Criteria,
                        };
                    }),
                };

                const serializedAnalysis = serializeBigInt(analysis);

                // Log to step collector (primary logging mechanism)
                if (stepCollector) {
                    stepCollector.addStep(
                        "PHASE3_COLLECTION_PERIOD_ANALYSIS",
                        `Collection period analysis for customer ${customerId}`,
                        "INFO",
                        {
                            customer_id: customerId,
                            phase: "Phase 3: Transition to Agent",
                            analysis: serializedAnalysis,
                        }
                    );
                }
                // Also log to callback if provided
                if (logCallback) {
                    logCallback(
                        `Collection period analysis for customer ${customerId}`,
                        "INFO",
                        {
                            step: "PHASE3_COLLECTION_PERIOD_ANALYSIS",
                            customer_id: customerId,
                            phase: "Phase 3: Transition to Agent",
                            analysis: serializedAnalysis,
                        }
                    );
                }
            }
        }
        // Fetch Account data separately for wait_days_after_automated checks
        const agentTransitionAccountIds = extractAccountIds(
            agentTransitionCollectionPeriods
        );

        const accountsMap = new Map<
            number,
            {
                wait_days_after_automated: number | null;
                category_after_automated: string | null;
            }
        >();
        if (agentTransitionAccountIds.length > 0) {
            const accounts = await prisma.account.findMany({
                where: { id: { in: agentTransitionAccountIds } },
                select: {
                    id: true,
                    wait_days_after_automated: true,
                    category_after_automated: true,
                },
            });
            accounts.forEach((acc) => {
                accountsMap.set(acc.id, {
                    wait_days_after_automated: acc.wait_days_after_automated,
                    category_after_automated: acc.category_after_automated,
                });
            });
        }

        // Also send to logCallback for real-time frontend display
        if (logCallback) {
            logCallback(
                "Phase 3: Retrieved collection periods ready for agent transition",
                "INFO",
                {
                    processName: "processAutomatedCollectionPeriods",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    processStats,
                    step: "PHASE3_FETCH_COLLECTION_PERIODS",
                    stepNumber: 16,
                    collectionPeriodsFound:
                        agentTransitionCollectionPeriods.length,
                    collectionPeriods: agentTransitionCollectionPeriods.map(
                        (cp) => ({
                            id: cp.id,
                            customerId: cp.customer_id,
                            currentCategory: cp.current_category,
                            isLastAutomatedStepDelivered:
                                cp.is_last_automated_step_delivered,
                            nextCategory: cp.next_category,
                            lastAutomatedStep: cp.last_automated_step,
                            previousCategory: cp.previous_category,
                            nextCategoryDate: cp.next_category_date,
                            created_at: cp.created_at,
                            modifiedAt: cp.modified_at,
                            accountId: (cp as any).Customer?.account_id || 0,
                            waitDaysAfterAutomated: (() => {
                                const accountId = cp.Customer?.account_id;
                                const account = accountId
                                    ? accountsMap.get(accountId)
                                    : null;
                                return account?.wait_days_after_automated || 0;
                            })(),
                        })
                    ),
                    performanceMetrics: {
                        fetchAgentTransitionCollectionPeriods:
                            fetchAgentTransitionCollectionPeriodsDuration,
                    },
                }
            );
        }
        if (agentTransitionCollectionPeriods.length > 0) {
            // Find ALL automated activities for eligible collection periods
            const fetchAgentTransitionLatestActivitiesStart = Date.now();
            const agentTransitionLatestActivities =
                await prisma.activity.findMany({
                    where: {
                        ActivitiesSequence: {
                            category: "Automated",
                            last_category_step: true,
                        },
                        collection_period_id: {
                            in: agentTransitionCollectionPeriods.map(
                                (cp) => cp.id
                            ),
                        },
                    },
                    select: {
                        id: true,
                        collection_period_id: true,
                        status: true,
                        type: true,
                        created_at: true,
                        actual_delivery_time: true,
                        is_last_step: true,
                        ActivitiesSequence: {
                            select: {
                                step: true,
                                category: true,
                                last_category_step: true,
                                account_id: true,
                                sequence_container_id: true,
                            },
                        },
                    },
                    orderBy: {
                        created_at: "desc",
                    },
                });

            const fetchAgentTransitionLatestActivitiesDuration =
                Date.now() - fetchAgentTransitionLatestActivitiesStart;

            // Fetch max automated step for validation
            const agentTransitionMaxSteps =
                await prisma.activitiesSequence.groupBy({
                    by: ["account_id", "sequence_container_id"],
                    where: {
                        account_id: { in: agentTransitionAccountIds },
                        category: "Automated",
                        active: true,
                        OR: [
                            { step_type: null },
                            { step_type: "overdue" },
                        ],
                    },
                    _max: {
                        step: true,
                    },
                });

            const agentTransitionMaxStepMap = createMaxStepMap(
                agentTransitionMaxSteps
            );

            if (stepCollector) {
                const phase3MaxStepMapEntries = Array.from(
                    agentTransitionMaxStepMap.entries()
                ).map(([key, maxStep]) => {
                    const [accountId, sequenceContainerId] = key.split("_");
                    return {
                        key,
                        accountId,
                        sequenceContainerId:
                            sequenceContainerId === "null"
                                ? null
                                : sequenceContainerId,
                        maxStep,
                    };
                });
                stepCollector.addStep(
                    "PHASE3_MAX_STEP_MAP",
                    `Max automated step per account+container for transition: ${phase3MaxStepMapEntries.length} entries`,
                    "INFO",
                    {
                        rawGroupByCount: agentTransitionMaxSteps.length,
                        maxStepMapEntries: phase3MaxStepMapEntries,
                    }
                );
            }

            // Validate that max steps exist for all account/sequence combinations
            // This ensures we never have a situation where a sequence doesn't have a max step
            if (
                agentTransitionAccountIds.length > 0 &&
                agentTransitionMaxSteps.length === 0
            ) {
                const errorMessage = `No automated sequences found for accounts: ${agentTransitionAccountIds.join(", ")}. Cannot determine max step for transition.`;
                if (logCallback) {
                    logCallback(errorMessage, "ERROR", {
                        processName: "processAutomatedCollectionPeriods",
                        startTime: startTime.toISOString(),
                        customerId: customerId || "ALL",
                        step: "PHASE3_MAX_STEP_VALIDATION",
                        stepNumber: 17.1,
                        accountIds: agentTransitionAccountIds,
                    });
                }
                await logService.logMessage(
                    LogLevel.ERROR,
                    errorMessage,
                    "processAutomatedCollectionPeriods",
                    {
                        accountIds: agentTransitionAccountIds,
                        step: "PHASE3_MAX_STEP_VALIDATION",
                    }
                );
                // Continue processing but skip activities that can't be validated
            }

            // Filter activities to only include those at max step and delivered
            const filterAgentTransitionEligibleStart = Date.now();
            const currentTime = new Date();
            const agentTransitionDeliveredActivities =
                agentTransitionLatestActivities.filter((activity) => {
                    if (activity.status !== "DELIVERED") {
                        if (logCallback) {
                            logCallback(
                                `PHASE3: Skipping activity ${activity.id} - status is ${activity.status}, not DELIVERED`,
                                "INFO",
                                {
                                    processName:
                                        "processAutomatedCollectionPeriods",
                                    startTime: startTime.toISOString(),
                                    step: "PHASE3_ACTIVITY_FILTER",
                                    stepNumber: 17.2,
                                    activityId: activity.id,
                                    collectionPeriodId:
                                        activity.collection_period_id,
                                    status: activity.status,
                                    reason: "status_not_delivered",
                                }
                            );
                        }
                        return false;
                    }
                    if (!activity.ActivitiesSequence) {
                        if (logCallback) {
                            logCallback(
                                `PHASE3: Skipping activity ${activity.id} - no ActivitiesSequence`,
                                "INFO",
                                {
                                    processName:
                                        "processAutomatedCollectionPeriods",
                                    startTime: startTime.toISOString(),
                                    step: "PHASE3_ACTIVITY_FILTER",
                                    stepNumber: 17.2,
                                    activityId: activity.id,
                                    reason: "no_activities_sequence",
                                }
                            );
                        }
                        return false;
                    }

                    const collectionPeriod =
                        agentTransitionCollectionPeriods.find(
                            (cp) => cp.id === activity.collection_period_id
                        );
                    if (!collectionPeriod) {
                        if (logCallback) {
                            logCallback(
                                `PHASE3: Skipping activity ${activity.id} - no collection period found for id ${activity.collection_period_id}`,
                                "INFO",
                                {
                                    processName:
                                        "processAutomatedCollectionPeriods",
                                    startTime: startTime.toISOString(),
                                    step: "PHASE3_ACTIVITY_FILTER",
                                    stepNumber: 17.2,
                                    activityId: activity.id,
                                    collectionPeriodId:
                                        activity.collection_period_id,
                                    reason: "no_collection_period",
                                }
                            );
                        }
                        return false;
                    }

                    // *** CRITICAL FIX: Check if enough time has passed since delivery ***
                    // This prevents premature transition to category_after_automated before wait_days_after_automated period
                    const accountId = collectionPeriod.Customer?.account_id;
                    const account = accountId
                        ? accountsMap.get(accountId)
                        : null;
                    const waitDays = account?.wait_days_after_automated || 0;
                    const deliveryTime =
                        activity.actual_delivery_time || activity.created_at;
                    const requiredWaitTime = waitDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
                    const timeSinceDelivery =
                        currentTime.getTime() -
                        new Date(deliveryTime).getTime();

                    if (timeSinceDelivery < requiredWaitTime) {
                        if (logCallback) {
                            logCallback(
                                `Skipping category transition for customer ${collectionPeriod.customer_id} - wait period not met (${Math.floor(timeSinceDelivery / (24 * 60 * 60 * 1000))} of ${waitDays} days elapsed)`,
                                "INFO",
                                {
                                    processName:
                                        "processAutomatedCollectionPeriods",
                                    startTime: startTime.toISOString(),
                                    customerId: collectionPeriod.customer_id,
                                    step: "PHASE3_WAIT_PERIOD_CHECK",
                                    stepNumber: 17.3,
                                    activityId: activity.id,
                                    deliveryTime: deliveryTime,
                                    waitDaysRequired: waitDays,
                                    daysElapsed: Math.floor(
                                        timeSinceDelivery /
                                        (24 * 60 * 60 * 1000)
                                    ),
                                    hoursRemaining: Math.ceil(
                                        (requiredWaitTime - timeSinceDelivery) /
                                        (60 * 60 * 1000)
                                    ),
                                }
                            );
                        }
                        return false; // Not enough time has passed
                    }
                    // Handle manual changes from Agent to Automated by resetting the sequence
                    const wasManuallyChangedToAutomated =
                        collectionPeriod.current_category === "Automated" &&
                        collectionPeriod.previous_category === "Agent";

                    if (wasManuallyChangedToAutomated) {
                        // Check if this is a natural progression or manual change scenario (use customer's container)
                        const accountIdForTransition =
                            collectionPeriod.Customer?.account_id || 0;
                        const customerContainerId =
                            collectionPeriod.Customer?.sequence_container_id ??
                            activity.ActivitiesSequence.sequence_container_id;
                        const maxStepKey = `${accountIdForTransition}_${customerContainerId ?? "null"}`;
                        const maxStep =
                            agentTransitionMaxStepMap.get(maxStepKey);
                        const activityStep = activity.ActivitiesSequence.step;
                        const activityStepNum = Number(activityStep);
                        const maxStepNum = Number(maxStep);
                        const isAtLastStep = activityStepNum === maxStepNum;

                        if (isAtLastStep) {
                            // If at the last step, this could be natural progression
                            // Check if the customer was already at step 6 before the manual change
                            const wasAlreadyAtLastStep =
                                Number(collectionPeriod.last_automated_step) ===
                                maxStepNum;

                            if (wasAlreadyAtLastStep) {
                                // Account was already at step 6 - this is natural progression
                                // Allow the activity to enable Agent transition
                                if (logCallback) {
                                    logCallback(
                                        `Allowing last step activity for natural progression - customer ${collectionPeriod.customer_id}, activity ID: ${activity.id}, step: ${activityStep}`,
                                        "INFO",
                                        {
                                            processName:
                                                "processAutomatedCollectionPeriods",
                                            startTime: startTime.toISOString(),
                                            customerId:
                                                collectionPeriod.customer_id,
                                            step: "PHASE3_NATURAL_PROGRESSION",
                                            stepNumber: 17.5,
                                            activityId: activity.id,
                                            activityStep: activityStep,
                                            maxStep: maxStep,
                                            reason: "natural_progression_to_agent",
                                        }
                                    );
                                }
                            } else {
                                // Account was not at step 6 - this is a manual change
                                // Filter out old activities to allow sequence reset
                                const activitycreated_at = new Date(
                                    activity.created_at
                                );
                                const collectionPeriodModifiedAt = new Date(
                                    collectionPeriod.modified_at
                                );

                                if (
                                    activitycreated_at <=
                                    collectionPeriodModifiedAt
                                ) {
                                    return false; // Activity is from before the manual change
                                }
                            }
                        } else {
                            // For non-last steps, filter out ALL old activities
                            // This prevents immediate reversion to Agent and allows proper sequence reset
                            const activitycreated_at = new Date(
                                activity.created_at
                            );
                            const collectionPeriodModifiedAt = new Date(
                                collectionPeriod.modified_at
                            );

                            // Only process activities created AFTER the manual change to Automated
                            if (
                                activitycreated_at <= collectionPeriodModifiedAt
                            ) {
                                return false; // Activity is from before the manual change to Automated
                            }
                        }
                    }
                    // Only consider activities at the maximum automated step (use customer's container)
                    const finalAccountId =
                        collectionPeriod.Customer?.account_id || 0;
                    const customerContainerId =
                        collectionPeriod.Customer?.sequence_container_id ??
                        activity.ActivitiesSequence.sequence_container_id;
                    const maxStepKey = `${finalAccountId}_${customerContainerId ?? "null"}`;
                    const maxStep = agentTransitionMaxStepMap.get(maxStepKey);
                    const activityStep = Number(
                        activity.ActivitiesSequence.step
                    );
                    const maxStepNum = maxStep !== undefined ? Number(maxStep) : undefined;

                    if (logCallback) {
                        logCallback(
                            `PHASE3: Last-step check for activity ${activity.id}`,
                            "INFO",
                            {
                                processName:
                                    "processAutomatedCollectionPeriods",
                                startTime: startTime.toISOString(),
                                customerId: collectionPeriod.customer_id,
                                step: "PHASE3_LAST_STEP_CHECK_VALUES",
                                stepNumber: 17.38,
                                activityId: activity.id,
                                finalAccountId,
                                customerContainerId,
                                activitySequenceContainerId:
                                    activity.ActivitiesSequence.sequence_container_id,
                                maxStepKey,
                                maxStepFromMap: maxStep ?? null,
                                activityStep,
                                isAtLastStep:
                                    maxStepNum !== undefined &&
                                    activityStep === maxStepNum,
                            }
                        );
                    }

                    // CRITICAL: Ensure max step exists - cannot have a situation where sequence doesn't have max step
                    if (!maxStep) {
                        if (logCallback) {
                            logCallback(
                                `Skipping activity ${activity.id} - no max step found for account ${finalAccountId}, sequence_container ${customerContainerId}`,
                                "WARNING",
                                {
                                    processName:
                                        "processAutomatedCollectionPeriods",
                                    startTime: startTime.toISOString(),
                                    customerId: collectionPeriod.customer_id,
                                    step: "PHASE3_MAX_STEP_CHECK",
                                    stepNumber: 17.4,
                                    activityId: activity.id,
                                    accountId: finalAccountId,
                                    sequenceContainerId: customerContainerId,
                                    maxStepKey: maxStepKey,
                                    reason: "no_max_step_for_key",
                                    mapSize: agentTransitionMaxStepMap.size,
                                    mapKeys: Array.from(
                                        agentTransitionMaxStepMap.keys()
                                    ),
                                }
                            );
                        }
                        return false;
                    }

                    if (
                        !Number.isFinite(activityStep) ||
                        activityStep !== maxStepNum
                    ) {
                        if (logCallback) {
                            logCallback(
                                `PHASE3: Skipping activity ${activity.id} - activity step (${activityStep}) does not equal max step (${maxStepNum}) for customer's container`,
                                "INFO",
                                {
                                    processName:
                                        "processAutomatedCollectionPeriods",
                                    startTime: startTime.toISOString(),
                                    customerId: collectionPeriod.customer_id,
                                    step: "PHASE3_MAX_STEP_CHECK",
                                    stepNumber: 17.4,
                                    activityId: activity.id,
                                    accountId: finalAccountId,
                                    customerContainerId,
                                    maxStepKey: maxStepKey,
                                    activityStep,
                                    maxStep,
                                    reason: "activity_step_ne_max_step",
                                }
                            );
                        }
                        return false;
                    }
                    if (logCallback) {
                        logCallback(
                            `PHASE3: Activity ${activity.id} passed - at last step (${activityStep}) for customer ${collectionPeriod.customer_id}`,
                            "INFO",
                            {
                                processName:
                                    "processAutomatedCollectionPeriods",
                                startTime: startTime.toISOString(),
                                customerId: collectionPeriod.customer_id,
                                step: "PHASE3_ACTIVITY_PASSED",
                                stepNumber: 17.45,
                                activityId: activity.id,
                                maxStepKey: maxStepKey,
                                activityStep,
                                maxStep,
                            }
                        );
                    }
                    return true;
                });

            const agentTransitionEligibleCollectionPeriods =
                agentTransitionCollectionPeriods.filter((cp) =>
                    agentTransitionDeliveredActivities.find(
                        (la) => la.collection_period_id === cp.id
                    )
                );

            const filterAgentTransitionEligibleDuration =
                Date.now() - filterAgentTransitionEligibleStart;
            processStats.phase3.eligibleCollectionPeriods =
                agentTransitionEligibleCollectionPeriods.length;

            if (stepCollector) {
                stepCollector.addStep(
                    "PHASE3_FILTER_RESULT",
                    `Phase 3 activity filter: ${agentTransitionLatestActivities.length} activities considered, ${agentTransitionDeliveredActivities.length} passed (at last step), ${agentTransitionEligibleCollectionPeriods.length} collection periods eligible for transition`,
                    "INFO",
                    {
                        totalActivitiesConsidered:
                            agentTransitionLatestActivities.length,
                        activitiesPassedFilter:
                            agentTransitionDeliveredActivities.length,
                        eligibleCollectionPeriods:
                            agentTransitionEligibleCollectionPeriods.length,
                        passedActivityIds:
                            agentTransitionDeliveredActivities.map((a) => a.id),
                    }
                );
            }

            if (agentTransitionEligibleCollectionPeriods.length > 0) {
                // Update eligible collection periods to transition from "Automated" to category_after_automated
                const updateAgentTransitionCollectionPeriodsStart = Date.now();

                // Use the already declared customerService from line 55

                // Log eligible collection periods before processing
                if (logCallback) {
                    logCallback(
                        `Found ${agentTransitionEligibleCollectionPeriods.length} collection period(s) eligible for category transition after wait period`,
                        "INFO",
                        {
                            processName: "processAutomatedCollectionPeriods",
                            startTime: startTime.toISOString(),
                            customerId: customerId || "ALL",
                            step: "PHASE3_ELIGIBLE_COLLECTIONS",
                            stepNumber: 17.5,
                            eligibleCount:
                                agentTransitionEligibleCollectionPeriods.length,
                            eligibleAccountIds:
                                agentTransitionEligibleCollectionPeriods.map(
                                    (cp) => cp.customer_id
                                ),
                        }
                    );
                }
                // Update each collection period using the centralized service
                for (const collectionPeriod of agentTransitionEligibleCollectionPeriods) {
                    try {
                        const accountId =
                            (collectionPeriod as any).Customer?.account_id || 0;
                        const account = accountId
                            ? accountsMap.get(accountId)
                            : null;
                        const targetCategory =
                            account?.category_after_automated;

                        // Validate that category_after_automated is set
                        if (!targetCategory) {
                            const errorMessage = `Cannot transition customer ${collectionPeriod.customer_id} - account ${accountId} has no category_after_automated configured`;
                            if (logCallback) {
                                logCallback(errorMessage, "ERROR", {
                                    customerId: collectionPeriod.customer_id,
                                    collectionPeriodId: collectionPeriod.id,
                                    accountId: accountId,
                                    step: "PHASE3_TRANSITION_VALIDATION",
                                    stepNumber: 17.6,
                                });
                            }
                            await logService.logMessage(
                                LogLevel.ERROR,
                                errorMessage,
                                "processAutomatedCollectionPeriods",
                                {
                                    customerId: collectionPeriod.customer_id,
                                    collectionPeriodId: collectionPeriod.id,
                                    accountId: accountId,
                                    step: "PHASE3_TRANSITION_VALIDATION",
                                }
                            );
                            continue; // Skip this collection period
                        }

                        await customerService.updateCollectionPeriodCategory(
                            collectionPeriod.id,
                            targetCategory as any,
                            collectionPeriod.current_category as any,
                            accountId,
                            collectionPeriod.customer_id,
                            {
                                reason: `Automated transition from Automated to ${targetCategory} after wait period`,
                                userId: "system",
                                isManualCategoryChange: false,
                                translate: (key: string) => key,
                            }
                        );

                        // Log successful transition
                        if (logCallback) {
                            logCallback(
                                `Successfully transitioned customer ${collectionPeriod.customer_id} to ${targetCategory} category after wait period`,
                                "INFO",
                                {
                                    customerId: collectionPeriod.customer_id,
                                    collectionPeriodId: collectionPeriod.id,
                                    step: "PHASE3_TRANSITION_SUCCESS",
                                    stepNumber: 18,
                                    targetCategory: targetCategory,
                                    waitDaysAfterAutomated:
                                        account?.wait_days_after_automated || 0,
                                }
                            );
                        }
                    } catch (error: any) {
                        // Log the error instead of silently continuing
                        const accountId =
                            (collectionPeriod as any).Customer?.account_id || 0;
                        const account = accountId
                            ? accountsMap.get(accountId)
                            : null;
                        const targetCategory =
                            account?.category_after_automated || "unknown";
                        if (logCallback) {
                            logCallback(
                                `Failed to transition customer ${collectionPeriod.customer_id} to ${targetCategory} category: ${error.message}`,
                                "ERROR",
                                {
                                    customerId: collectionPeriod.customer_id,
                                    collectionPeriodId: collectionPeriod.id,
                                    error: error.message,
                                    stack: error.stack,
                                    step: "PHASE3_TRANSITION_ERROR",
                                    stepNumber: 18,
                                }
                            );
                        }
                        // Also log to the main log service
                        await logService.logMessage(
                            LogLevel.ERROR,
                            `Failed to transition customer ${collectionPeriod.customer_id} to ${targetCategory} category`,
                            "processAutomatedCollectionPeriods",
                            {
                                customerId: collectionPeriod.customer_id,
                                collectionPeriodId: collectionPeriod.id,
                                error: error.message,
                                stack: error.stack,
                                step: "PHASE3_TRANSITION_ERROR",
                            }
                        );

                        // Continue with other collection periods even if one fails
                    }
                }
                const updateAgentTransitionCollectionPeriodsDuration =
                    Date.now() - updateAgentTransitionCollectionPeriodsStart;
                processStats.phase3.collectionPeriodsUpdated =
                    agentTransitionEligibleCollectionPeriods.length;
            }
        }
        const phase3Duration = Date.now() - phase3Start;
        const totalDuration = Date.now() - startTime.getTime();

        // Invalidate dashboard cache for affected accounts
        try {
            // Get unique account IDs from collection periods that were updated
            // Query collection periods that were modified recently (within last minute) to get account IDs
            const recentCollectionPeriods =
                await prisma.customerCollectionPeriod.findMany({
                    where: {
                        modified_at: {
                            gte: new Date(Date.now() - 60000), // Last minute
                        },
                    },
                    include: { Customer: { select: { account_id: true } } },
                    take: 1000, // Limit to avoid too many results
                });

            if (recentCollectionPeriods.length > 0) {
                const accountIds = Array.from(
                    new Set(
                        recentCollectionPeriods
                            .map((cp) => cp.Customer?.account_id)
                            .filter(
                                (id): id is number => typeof id === "number"
                            )
                    )
                );

                if (accountIds.length > 0) {
                    const { invalidateDashboardCacheForAccounts } =
                        await import("@/server/utils/cacheInvalidationHelper");
                    await invalidateDashboardCacheForAccounts(accountIds);
                }
            }
        } catch (cacheError) {
            // Cache invalidation failure should not break the cron job
            console.error("Failed to invalidate dashboard cache:", cacheError);
        }

        // Add process completion message to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "COMPLETE",
                "processAutomatedCollectionPeriods process completed successfully",
                "INFO",
                {
                    totalDuration,
                    finalStats: processStats,
                }
            );
        }
        if (logCallback) {
            logCallback(
                "processAutomatedCollectionPeriods process completed successfully",
                "INFO",
                {
                    processName: "processAutomatedCollectionPeriods",
                    startTime: startTime.toISOString(),
                    customerId: customerId || "ALL",
                    step: "COMPLETE",
                    stepNumber: 21,
                    duration: totalDuration,
                    processStats: {
                        phase1: processStats.phase1,
                        phase2: processStats.phase2,
                        phase3: processStats.phase3,
                        errors: processStats.errors.length,
                    },
                    performanceMetrics: {
                        phase1Duration,
                        phase2Duration,
                        phase3Duration,
                        totalExecution: totalDuration,
                    },
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
                `processAutomatedCollectionPeriods process failed: ${error.message}`,
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
    }
}
