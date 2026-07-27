/**
 * Helper function to process individual collection period (optimized for batch processing)
 */
async function processCollectionPeriod(
    collectionPeriod: any,
    sequencesByAccount: Map<string, any[]>,
    defaultContainersByAccount: Map<number, number>,
    existingActivitiesByPeriod: Map<number, any[]>,
    collectionPeriodUpdates: Array<{ id: number; data: any }>,
    activitiesToCreate: any[],
    customerDetailsForCalculation: Map<number, any>,
    processStats: any,
    logCallback: any,
    ACTIVITY_Service: any,
    CustomerService: any,
    periodsToRevert: Array<{
        id: number;
        customerId: number;
        accountId: number;
        reason: string;
    }>
): Promise<void> {
    // Get activity sequences for this customer
    const sequenceContainerId =
        collectionPeriod.Customer.sequence_container_id ||
        defaultContainersByAccount.get(collectionPeriod.Customer.account_id) ||
        null;

    const sequenceKey = `${collectionPeriod.Customer.account_id}_${sequenceContainerId || "default"}`;
    const activitySequences = sequencesByAccount.get(sequenceKey) || [];

    if (activitySequences.length === 0) {
        // No sequences found - revert category to Agent since automated workflow cannot proceed
        // This handles cases where collection period was manually changed to Automated but no sequences exist
        collectionPeriodUpdates.push({
            id: collectionPeriod.id,
            data: {
                create_next_activity: false,
            },
        });

        // Mark for category reversion - will be handled after processing
        periodsToRevert.push({
            id: collectionPeriod.id,
            customerId: collectionPeriod.customer_id,
            accountId: collectionPeriod.Customer.account_id,
            reason: "No automated sequences found - reverting to Agent category",
        });

        if (logCallback) {
            logCallback(
                `No automated sequences found for collection period ${collectionPeriod.id} - will revert to Agent category`,
                "WARNING",
                {
                    collectionPeriodId: collectionPeriod.id,
                    customerId: collectionPeriod.customer_id,
                    accountId: collectionPeriod.Customer.account_id,
                    sequenceKey: sequenceKey,
                    customerSequenceContainerId:
                        collectionPeriod.Customer.sequence_container_id,
                    defaultContainerId: defaultContainersByAccount.get(
                        collectionPeriod.Customer.account_id
                    ),
                    availableSequenceKeys: Array.from(
                        sequencesByAccount.keys()
                    ),
                }
            );
        }
        return;
    }

    processStats.activitySequencesFound++;

    // Find the next activity step
    // CRITICAL FIX: Verify actual last step from latest activity to prevent recreating same step
    // This handles cases where last_automated_step might be stale or not updated yet
    let currentStep = collectionPeriod.last_automated_step || 0;
    const storedStep = currentStep;

    // Determine the precise "Reset Time" - the timestamp when category was switched from Agent to Automated
    // We look for the latest Internal activity logging this specific category change
    // If found, ANY activity before this time is "old history" and should be ignored
    // ANY activity after this time is "current run" and should be respected
    const collectionPeriodActivities =
        existingActivitiesByPeriod.get(collectionPeriod.id) || [];
    const resetActivity = collectionPeriodActivities
        .filter((a) => {
            if (
                a.type !== "Internal" ||
                a.title !== "{{activities.fields.category_change}}"
            ) {
                return false;
            }

            let params = a.title_params as any;
            if (typeof params === "string") {
                try {
                    params = JSON.parse(params);
                } catch (e) {
                    return false;
                }
            }

            return (
                params?.newCategory === "customers.values.category_automated" &&
                (params?.oldCategory === "customers.values.category_agent" ||
                    params?.oldCategory ===
                    "customers.values.category_promise_to_pay" ||
                    params?.oldCategory === "customers.values.category_dispute")
            );
        })
        .sort(
            (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
        )[0];

    const resetDate = resetActivity ? new Date(resetActivity.created_at) : null;

    // CRITICAL FIX: After manual reset (Agent/Promise_to_pay/Dispute -> Automated), ignore old activities from previous sequence
    // When previous_category is a non-Automated category, we should ONLY trust last_automated_step, not old activities
    // This prevents the system from jumping to step 8 when it should create step 2
    const isManualResetFromAgent =
        collectionPeriod.previous_category === "Agent" ||
        collectionPeriod.previous_category === "Promise_to_pay" ||
        collectionPeriod.previous_category === "Dispute";

    // Check existing activities to find the actual highest step that was created
    const existingActivitiesForStepCheck =
        existingActivitiesByPeriod.get(collectionPeriod.id) || [];

    // CRITICAL FIX: For manual resets, also check if last_automated_step is 0 but step 1 was actually sent
    // This handles cases where last_automated_step wasn't updated correctly
    if (isManualResetFromAgent && storedStep === 0) {
        // Find step 1 activities that were sent/delivered (indicating step 1 was completed)
        // We check for activities created recently (within last 30 days) AND AFTER the reset date
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const step1AfterReset = existingActivitiesForStepCheck.find(
            (activity) =>
                activity.ActivitiesSequence?.category === "Automated" &&
                activity.ActivitiesSequence?.step === 1 &&
                (activity.status === ActivityStatus.SENT ||
                    activity.status === ActivityStatus.DELIVERED) &&
                new Date(activity.created_at) > thirtyDaysAgo && // Recent activity
                (!resetDate || new Date(activity.created_at) > resetDate) // MUST be after reset
        );

        if (step1AfterReset) {
            // Step 1 was sent but last_automated_step wasn't updated - correct it
            currentStep = 1;
            if (logCallback) {
                logCallback(
                    `MANUAL RESET CORRECTION: Collection period ${collectionPeriod.id} - step 1 was sent but last_automated_step is 0. Correcting to 1.`,
                    "WARNING",
                    {
                        collectionPeriodId: collectionPeriod.id,
                        storedStep: storedStep,
                        correctedStep: 1,
                        step1ActivityId: step1AfterReset.id,
                        step1Status: step1AfterReset.status,
                        reason: "manual_reset_step1_correction",
                    }
                );
            }
        }
    }

    // Check if we have recent automated activities (post-reset)
    // If so, we should treat them as valid history even if isManualResetFromAgent is true
    const hasRecentAutomatedActivities =
        isManualResetFromAgent &&
        existingActivitiesForStepCheck.some(
            (activity) =>
                activity.ActivitiesSequence?.category === "Automated" &&
                (activity.status === ActivityStatus.SENT ||
                    activity.status === ActivityStatus.DELIVERED) &&
                // If we have a reset date, strictly check > resetDate
                // If no reset date found (shouldn't happen for manual reset), fallback to 30 days
                (resetDate
                    ? new Date(activity.created_at) > resetDate
                    : new Date(activity.created_at) >
                    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        );

    // Skip step correction for manual resets - trust last_automated_step only (or corrected value above)
    // UNLESS we have valid activities that happened AFTER the reset
    if (isManualResetFromAgent && logCallback) {
        logCallback(
            `MANUAL RESET DETECTED: Collection period ${collectionPeriod.id} - previous_category=${collectionPeriod.previous_category}${resetDate ? `, reset detected at ${resetDate.toISOString()}` : ", no reset log found"}, using currentStep=${currentStep}`,
            "INFO",
            {
                collectionPeriodId: collectionPeriod.id,
                storedStep: storedStep,
                currentStep: currentStep,
                previousCategory: collectionPeriod.previous_category,
                oldActivitiesCount: existingActivitiesForStepCheck.length,
                resetDate: resetDate?.toISOString(),
                reason: "manual_reset_ignore_old_activities",
            }
        );
    }

    if (
        existingActivitiesForStepCheck.length > 0 &&
        (!isManualResetFromAgent || hasRecentAutomatedActivities)
    ) {
        // Find the highest step from existing automated activities (excluding cancelled)
        // ONLY do this if NOT a manual reset from Agent (to avoid using old activities)
        const automatedActivities = existingActivitiesForStepCheck.filter(
            (activity) =>
                activity.ActivitiesSequence?.category === "Automated" &&
                activity.status !== ActivityStatus.CANCELLED &&
                activity.ActivitiesSequence?.step !== null &&
                // IMPORTANT: If manual reset, only consider activities AFTER the reset date
                // This prevents "old" steps from inflating the highestStep
                (!isManualResetFromAgent ||
                    !resetDate ||
                    new Date(activity.created_at) > resetDate)
        );

        if (automatedActivities.length > 0) {
            const highestStep = Math.max(
                ...automatedActivities.map(
                    (activity) => activity.ActivitiesSequence?.step || 0
                )
            );
            // Use the higher of: stored last_automated_step or actual highest step from activities
            // This ensures we don't recreate a step that was already created
            // Exception: For manual reset (Agent -> Automated), trust last_automated_step only
            const isManualResetToZero =
                storedStep === 0 &&
                collectionPeriod.previous_category === "Agent";

            // Correction Logic:
            // 1. Normal Case: Only correct UPWARDS (prevent race conditions/duplicates)
            // 2. Manual Reset Case: Correct BOTH ways (force sync with actual recent history)
            //    This fixes the issue where DB has old "Step 4", but we successfully sent "Step 3" recently.
            //    We must correct currentStep to 3 so next step logic sees 3 -> needs 4.
            const shouldCorrectStep =
                (hasRecentAutomatedActivities && highestStep !== currentStep) || // Manual reset: force sync
                (!isManualResetToZero && highestStep > currentStep); // Normal: only catch up

            if (shouldCorrectStep) {
                // Log when we detect a mismatch between stored step and actual step
                if (logCallback) {
                    logCallback(
                        `STEP CORRECTION: Collection period ${collectionPeriod.id} - stored last_automated_step=${storedStep}, but highest existing activity step=${highestStep}. Correcting to ${highestStep} to force sync.`,
                        "WARNING",
                        {
                            collectionPeriodId: collectionPeriod.id,
                            storedStep: storedStep,
                            highestStep: highestStep,
                            automatedActivitiesCount:
                                automatedActivities.length,
                            automatedActivities: automatedActivities.map(
                                (act) => ({
                                    id: act.id,
                                    step: act.ActivitiesSequence?.step,
                                    status: act.status,
                                    created_at: act.created_at,
                                })
                            ),
                            reason: "step_mismatch_correction",
                            isManualReset: isManualResetFromAgent,
                        }
                    );
                }
                currentStep = highestStep;
            } else if (
                logCallback &&
                existingActivitiesForStepCheck.length > 0
            ) {
                // Log when we have existing activities but no correction needed
                logCallback(
                    `STEP VERIFICATION: Collection period ${collectionPeriod.id} - stored step=${storedStep}, highest existing step=${automatedActivities.length > 0 ? Math.max(...automatedActivities.map((a) => a.ActivitiesSequence?.step || 0)) : "none"}, using=${currentStep}`,
                    "INFO",
                    {
                        collectionPeriodId: collectionPeriod.id,
                        storedStep: storedStep,
                        currentStep: currentStep,
                        existingActivitiesCount:
                            existingActivitiesForStepCheck.length,
                        automatedActivitiesCount: automatedActivities.length,
                        isManualReset: isManualResetToZero,
                        reason: "step_verification",
                    }
                );
            }
        }
    }

    const nextSequence = activitySequences.find((seq) => {
        return (seq.step || 0) > currentStep;
    });

    if (!nextSequence) {
        // No more sequences, mark as complete
        collectionPeriodUpdates.push({
            id: collectionPeriod.id,
            data: {
                create_next_activity: false,
                last_automated_step: currentStep,
            },
        });
        return;
    }

    // Additional safeguard: Ensure we're not creating a step that's already been completed
    // This handles edge cases where last_automated_step might be out of sync
    // CRITICAL FIX: Allow creating activities when last_automated_step is 0 after manual reset (previous_category === "Agent")
    // This allows restarting the sequence even if there are old activities
    const isManualResetToZero =
        currentStep === 0 && collectionPeriod.previous_category === "Agent";

    if (
        !isManualResetToZero &&
        nextSequence.step !== null &&
        nextSequence.step <= currentStep
    ) {
        // Step already completed, skip
        processStats.skippedDueToExistingActivities++;
        if (logCallback) {
            logCallback(
                `Skipping collection period ${collectionPeriod.id} - step ${nextSequence.step} already completed(currentStep: ${currentStep})`,
                "INFO",
                {
                    collectionPeriodId: collectionPeriod.id,
                    nextStep: nextSequence.step,
                    currentStep: currentStep,
                    isManualResetToZero: isManualResetToZero,
                }
            );
        }
        return;
    }

    // Check for existing activities - both scheduled future activities AND activities for the same step
    const existingActivities =
        existingActivitiesByPeriod.get(collectionPeriod.id) || [];

    // OBVIOUS DEBUG: This should definitely show up
    if (logCallback) {
        logCallback(
            `🔍 DEBUGGING COLLECTION PERIOD ${collectionPeriod.id}: Found ${existingActivities.length} existing activities`,
            "INFO",
            {
                collectionPeriodId: collectionPeriod.id,
                existingActivitiesCount: existingActivities.length,
                lastAutomatedStep: collectionPeriod.last_automated_step,
                previousCategory: collectionPeriod.previous_category,
                nextSequenceStep: nextSequence.step,
                step: "OBVIOUS_DEBUG_CHECK",
            }
        );
    }

    // Check if there's already an activity for this specific step (prevents duplicate step creation)
    // CRITICAL FIX: Check by both activity_sequence_id (most reliable) and step number (backup)
    // ENHANCED: Also check for SENT status to catch activities that were just sent
    // CRITICAL FIX: For manual resets, ignore old DELIVERED activities from previous sequence
    const hasActivityForThisStep = existingActivities.some((activity) => {
        // Primary check: same activity_sequence_id (most reliable)
        if (activity.activity_sequence_id === nextSequence.id) {
            // For manual resets, only consider SCHEDULED/SENT activities (current sequence)
            // AND recent DELIVERED activities that happened AFTER the reset
            if (isManualResetFromAgent) {
                // If the activity happened BEFORE the reset, ignore it (it's from the old run)
                if (resetDate && new Date(activity.created_at) <= resetDate) {
                    return false;
                }

                // If no reset date (fallback) or activity is AFTER reset:
                return (
                    activity.status === ActivityStatus.SCHEDULED ||
                    activity.status === ActivityStatus.SENT ||
                    activity.status === ActivityStatus.DELIVERED
                );
            }
            // Exclude only CANCELLED activities - all other statuses indicate the step exists
            return activity.status !== ActivityStatus.CANCELLED;
        }
        // Backup check: same step and category (in case activity_sequence_id is null)
        if (
            activity.ActivitiesSequence?.step === nextSequence.step &&
            activity.ActivitiesSequence?.category === "Automated"
        ) {
            // For manual resets, only consider SCHEDULED/SENT activities (current sequence)
            // AND recent DELIVERED activities that happened AFTER the reset
            if (isManualResetFromAgent) {
                // If the activity happened BEFORE the reset, ignore it (it's from the old run)
                if (resetDate && new Date(activity.created_at) <= resetDate) {
                    return false;
                }

                return (
                    activity.status === ActivityStatus.SCHEDULED ||
                    activity.status === ActivityStatus.SENT ||
                    activity.status === ActivityStatus.DELIVERED
                );
            }
            // Exclude only CANCELLED activities - all other statuses indicate the step exists
            return activity.status !== ActivityStatus.CANCELLED;
        }
        return false;
    });

    // CRITICAL FIX: Check for ALL scheduled activities (not just future ones)
    // This catches activities that are scheduled but haven't been sent yet, regardless of schedule_time
    // The query already fetches all SCHEDULED activities, so we should check for all of them
    // ENHANCED: Also check for SENT status to catch activities that were just sent
    const hasScheduledActivity = existingActivities.some(
        (activity) =>
            (activity.status === ActivityStatus.SCHEDULED ||
                activity.status === ActivityStatus.SENT) &&
            // CRITICAL FIX: For manual resets, ignore "old" scheduled/sent activities (before reset)
            (!isManualResetFromAgent ||
                !resetDate ||
                new Date(activity.created_at) > resetDate)
    );

    // Skip if there are existing scheduled/sent activities OR an activity for this step already exists
    // (unless this is a manual reset from Agent -> Automated)
    // CRITICAL FIX: When previous_category is "Agent", this indicates a manual reset
    // We should allow creating activities even if old activities exist, to restart the sequence
    // This works even after steps have been sent (last_automated_step > 0) because we're still in the new sequence
    const isManualReset = collectionPeriod.previous_category === "Agent";

    // ENHANCED DEBUG: Log manual reset detection details
    if (logCallback) {
        logCallback(
            `MANUAL RESET DEBUG: Collection period ${collectionPeriod.id} - last_automated_step=${collectionPeriod.last_automated_step}, previous_category = '${collectionPeriod.previous_category}', isManualReset = ${isManualReset}, hasScheduledActivity = ${hasScheduledActivity}, hasActivityForThisStep = ${hasActivityForThisStep} `,
            "INFO",
            {
                collectionPeriodId: collectionPeriod.id,
                lastAutomatedStep: collectionPeriod.last_automated_step,
                previousCategory: collectionPeriod.previous_category,
                currentCategory: collectionPeriod.current_category,
                isManualReset: isManualReset,
                hasScheduledActivity: hasScheduledActivity,
                hasActivityForThisStep: hasActivityForThisStep,
                willSkip:
                    (hasScheduledActivity || hasActivityForThisStep) &&
                    !isManualReset,
                nextSequenceStep: nextSequence.step,
                nextSequenceId: nextSequence.id,
                step: "MANUAL_RESET_DETECTION",
            }
        );
    }

    if (hasScheduledActivity || hasActivityForThisStep) {
        processStats.skippedDueToExistingActivities++;

        if (logCallback) {
            // Find the specific activities that caused the skip
            const conflictingActivities = existingActivities.filter(
                (activity) => {
                    if (activity.activity_sequence_id === nextSequence.id) {
                        return activity.status !== ActivityStatus.CANCELLED;
                    }
                    return (
                        activity.ActivitiesSequence?.step ===
                        nextSequence.step &&
                        activity.ActivitiesSequence?.category === "Automated" &&
                        activity.status !== ActivityStatus.CANCELLED
                    );
                }
            );

            logCallback(
                `DUPLICATE PREVENTED: Collection period ${collectionPeriod.id} - existing activity found for step ${nextSequence.step}.Found ${conflictingActivities.length} conflicting activities.`,
                "WARNING",
                {
                    collectionPeriodId: collectionPeriod.id,
                    nextStep: nextSequence.step,
                    currentStep: currentStep,
                    hasScheduledActivity,
                    hasActivityForThisStep,
                    lastAutomatedStep: collectionPeriod.last_automated_step,
                    previousCategory: collectionPeriod.previous_category,
                    isManualReset: isManualReset,
                    conflictingActivities: conflictingActivities.map((act) => ({
                        id: act.id,
                        status: act.status,
                        step: act.ActivitiesSequence?.step,
                        sequence_id: act.activity_sequence_id,
                        created_at: act.created_at,
                    })),
                    reason: "existing_activity_duplicate_prevention",
                }
            );
        }
        return;
    }

    // Log when allowing activity creation despite existing activities (manual reset case)
    if (isManualReset && (hasScheduledActivity || hasActivityForThisStep)) {
        if (logCallback) {
            logCallback(
                `Allowing activity creation for manually reset collection period ${collectionPeriod.id} - will create step ${nextSequence.step} despite existing activities`,
                "INFO",
                {
                    collectionPeriodId: collectionPeriod.id,
                    nextStep: nextSequence.step,
                    lastAutomatedStep: collectionPeriod.last_automated_step,
                    previousCategory: collectionPeriod.previous_category,
                    isManualReset: true,
                }
            );
        }
    }

    // CRITICAL FIX: Check if this activity is already queued for creation to prevent duplicates
    // This prevents the same collection period + step from being added multiple times when processing in parallel
    const alreadyQueued = activitiesToCreate.some(
        (queued) =>
            queued.collectionPeriod.id === collectionPeriod.id &&
            queued.sequence.step === nextSequence.step
    );

    if (alreadyQueued) {
        processStats.skippedDueToExistingActivities++;
        if (logCallback) {
            logCallback(
                `Skipping collection period ${collectionPeriod.id} - activity for step ${nextSequence.step} already queued for creation`,
                "INFO",
                {
                    collectionPeriodId: collectionPeriod.id,
                    nextStep: nextSequence.step,
                    reason: "already_queued_in_batch",
                }
            );
        }
        return;
    }

    // Add customer details for bulk calculation
    customerDetailsForCalculation.set(collectionPeriod.customer_id, {
        account_id: collectionPeriod.Customer.account_id,
        // CRITICAL FIX: Use the CORRECTED currentStep (which accounts for recent activity history)
        // instead of the potentially stale collectionPeriod.last_automated_step from the database.
        // This ensures CustomerService.calculateNextAutomatedActivityTime uses the correct delay logic.
        last_automated_step: currentStep,
        period_start_date: collectionPeriod.period_start_date,
        previous_category: collectionPeriod.previous_category,
    });

    // Prepare activity data for creation
    activitiesToCreate.push({
        collectionPeriod,
        sequence: nextSequence,
        customerId: collectionPeriod.customer_id,
    });

    // CRITICAL FIX: Do NOT set create_next_activity: false here!
    // The atomic lock will handle setting it to false when it successfully claims the lock.
    // Setting it to false here causes the atomic lock to fail because it requires create_next_activity: true.
    // Only update other fields if needed (e.g., is_last_automated_step_delivered)
    // Note: We intentionally leave create_next_activity as true so the atomic lock can work
}

/**
 * Process items with concurrency limit to prevent connection pool exhaustion
 * @param items - Array of items to process
 * @param limit - Maximum number of concurrent operations
 * @param processor - Async function to process each item
 */
async function processWithConcurrencyLimit<T>(
    items: T[],
    limit: number,
    processor: (item: T) => Promise<void>
): Promise<void> {
    for (let i = 0; i < items.length; i += limit) {
        const batch = items.slice(i, i + limit);
        await Promise.all(batch.map((item) => processor(item)));

        // Small delay between batches to allow connections to be released
        if (i + limit < items.length) {
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
    }
}

// Activity Workflow Manager
// Merges generateNextActivity and sentActivities into a single atomic job
import { Activity } from "@prisma/client";

import { prismaCron } from "@/lib/prisma";
import { EmailService } from "@/server/EmailService";
import { handleActivityEmailSendFailure } from "@/server/utils/activityEmailSendFailure";
import { sendEmailWithRetry } from "@/server/utils/sendEmailWithRetry";
import { ActivityStatus, LogLevel } from "@/types/enums";
import {
    excludeCreditOnlyCustomerWhere,
    isCreditOnlyAccount,
} from "@/shared/utils/accountProducts";
const prisma = prismaCron();

import { ActivityService } from "../services/ActivityService";
import { CommunicationIntelligenceService } from "../services/CommunicationIntelligenceService";
import ControlCenterRealtimeService from "../services/ControlCenterRealtimeService";
import { CustomerService } from "../services/CustomerService";
import { revalidateStuckCollectionPeriodsForSequence } from "../services/CollectionPeriodRevalidationService";
import { LogService } from "../services/LogService";
import { SMSVendorService } from "../services/SMSVendorService";

/**
 * When a due notification activity is moved to SENT/DELIVERED, set due_notification_state[step] = "sent"
 * for every invoice in the group (main invoice_id + title_params.invoiceNumber list).
 */
async function setDueNotificationSentOnInvoices(activity: {
    id: number | bigint;
    invoice_id: number | null;
    activity_sequence_id: number | null;
    customer_id: number;
    title_params: unknown;
    ActivitiesSequence?: { step_type: string | null } | null;
}): Promise<void> {
    if (
        activity.ActivitiesSequence?.step_type !== "due" ||
        activity.activity_sequence_id == null ||
        activity.invoice_id == null
    ) {
        return;
    }
    const stepKey = String(activity.activity_sequence_id);
    const params = activity.title_params as { invoiceNumber?: string } | null;
    const invoiceNumbersStr = params?.invoiceNumber;
    let invoiceIds: number[] = [activity.invoice_id];
    if (invoiceNumbersStr && typeof invoiceNumbersStr === "string") {
        const numbers = invoiceNumbersStr.split(",").map((s) => s.trim()).filter(Boolean);
        if (numbers.length > 0) {
            const found = await prisma.invoice.findMany({
                where: {
                    customer_id: activity.customer_id,
                    invoice_number: { in: numbers },
                },
                select: { id: true },
            });
            invoiceIds = Array.from(new Set([...invoiceIds, ...found.map((i) => i.id)]));
        }
    }
    for (const invId of invoiceIds) {
        const inv = await prisma.invoice.findUnique({
            where: { id: invId },
            select: { due_notification_state: true },
        });
        if (!inv) continue;
        const state = (inv.due_notification_state as Record<string, string> | null) ?? {};
        const next = { ...state, [stepKey]: "sent" };
        await prisma.invoice.update({
            where: { id: invId },
            data: { due_notification_state: next as object },
        });
    }
}

/**
 * Helper function to use the shared processTemplateContent from ActivityService
 * Converts activity/activityContact structure to the format expected by the shared function
 */
async function processTemplateContent(
    content: string,
    activity: any,
    activityContact: any,
    resolvedLanguage: string
): Promise<string> {
    if (!content) return "";

    const activityService = new ActivityService();
    // Use activity.Customer directly (always available) as CustomerCollectionPeriod can be null
    let customer = activity.Customer || activity.CustomerCollectionPeriod?.Customer;

    // Ensure we have the customer's current language - fetch fresh if missing
    let customerLanguage = customer?.language || null;
    if (!customerLanguage && activity.customer_id) {
        try {
            const freshCustomer = await prisma.customer.findUnique({
                where: { id: activity.customer_id },
                select: { language: true },
            });
            if (freshCustomer?.language) {
                customerLanguage = freshCustomer.language;
                // Update the customer object in activity for consistency
                if (customer) {
                    customer.language = freshCustomer.language;
                }
            }
        } catch (error) {
            // If fetch fails, continue with null language (will default to English in URL generation)
        }
    }

    // Always use portal home for template links (no nested paths)
    const portalPath: string | undefined = undefined;

    // Prepare invoice data for replacement if available
    let invoiceData: any = undefined;
    if (activity.Invoice || (activity.title_params as any)?.invoiceNumber) {
        invoiceData = {
            invoice_number:
                (activity.title_params as any)?.invoiceNumber ||
                activity.Invoice?.invoice_number,
            due_date: activity.Invoice?.due_date,
            outstanding_debt:
                (activity.title_params as any)?.totalAmount ||
                activity.Invoice?.outstanding_debt,
        };
    }

    // Use the shared processTemplateContent function from ActivityService
    return await activityService.processTemplateContent(
        content,
        activity.Account || {
            id: activity.account_id,
            name: null,
            logo: null,
            sub_domain: null,
        },
        {
            type: customer?.type || "Company",
            customer_uuid: customer?.customer_uuid || "",
            language: customerLanguage, // Use the current customer language
            Person: customer?.Person || null,
            Company: customer?.Company || null,
        },
        {
            first_name: activityContact.Contact?.first_name || null,
            last_name: activityContact.Contact?.last_name || null,
            email: activityContact.Contact?.email || null,
            phone: activityContact.Contact?.phone || null,
            mobile: activityContact.Contact?.mobile || null,
            role: activityContact.Contact?.role || null,
            company_wide_address:
                activityContact.Contact?.company_wide_address || null,
            id: activityContact.contact_id || activityContact.Contact?.id,
        },
        resolvedLanguage,
        invoiceData,
        portalPath
    );
}

// Utility to map activity type to its status
export function getActivityStatus(
    activityType: Activity["type"]
): ActivityStatus {
    switch (activityType) {
        case "SMS":
            return ActivityStatus.SCHEDULED;
        case "Email":
            return ActivityStatus.SCHEDULED;
        case "Dispute":
            return ActivityStatus.DISPUTE;
        case "Internal":
            return ActivityStatus.DISPUTE;
        case "Call":
            return ActivityStatus.SCHEDULED;
        case "Promise_to_pay":
            return ActivityStatus.SCHEDULED;
        default:
            return ActivityStatus.SCHEDULED;
    }
}

export async function activityWorkflowManager(
    jobId?: number,
    last_job_execution?: Date,
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
    skipSmsSend?: boolean,
    fastForwardScheduledActivities?: boolean
): Promise<void> {
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

    const customerService = new CustomerService();
    const ACTIVITY_Service = new ActivityService();
    const smsVendorService = new SMSVendorService(undefined, {
        dryRunSms: skipSmsSend === true,
    });
    const intelligenceService = new CommunicationIntelligenceService();

    // Initialize comprehensive process tracking
    const processStats = {
        // Phase 1 - Activity Generation
        totalCollectionPeriods: 0,
        activitySequencesFound: 0,
        activitiesCreated: 0,
        collectionPeriodsUpdated: 0,
        skippedDueToExistingActivities: 0,

        // Phase 2 - Activity Sending
        totalActivitiesFound: 0,
        activitiesWithContacts: 0,
        emailsSent: 0,
        emailsFailed: 0,
        emailsDeferred: 0,
        smsSent: 0,
        smsFailed: 0,
        activitiesCompleted: 0,

        // Overall
        errors: [] as string[],
        phase1Duration: 0,
        phase2Duration: 0,
    };

    try {
        // Process start - add to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "START",
                "Starting activityWorkflowManager process",
                "INFO",
                {
                    processName: "activityWorkflowManager",
                    startTime: startTime.toISOString(),
                    jobId,
                    lastJobExecution: last_job_execution?.toISOString(),
                    customerId: customerId || "ALL",
                }
            );
        }

        // Call logCallback if provided (for real-time frontend logging)
        if (logCallback) {
            logCallback("Starting activityWorkflowManager process", "INFO", {
                processName: "activityWorkflowManager",
                startTime: startTime.toISOString(),
                jobId,
                lastJobExecution: last_job_execution?.toISOString(),
                customerId: customerId || "ALL",
                step: "START",
                stepNumber: 1,
            });
        }

        if (skipSmsSend && stepCollector) {
            stepCollector.addStep(
                "SMS_DRY_RUN",
                "SMS dry run enabled - no actual SMS will be sent",
                "INFO",
                { skipSmsSend: true }
            );
        }

        // Helper: apply dry-run last-step update when skipSmsSend (used by per-activity path, batch SMS path, and fallback path).
        const applyDryRunLastStepIfNeeded = async (activity: any) => {
            if (
                !skipSmsSend ||
                activity.ActivitiesSequence?.category !== "Automated" ||
                !activity.collection_period_id ||
                activity.ActivitiesSequence?.step == null
            ) {
                return;
            }
            try {
                const periodWithCustomer =
                    await prisma.customerCollectionPeriod.findUnique({
                        where: { id: activity.collection_period_id },
                        select: {
                            Customer: {
                                select: {
                                    account_id: true,
                                    sequence_container_id: true,
                                },
                            },
                        },
                    });
                const accountId =
                    periodWithCustomer?.Customer?.account_id;
                const customerContainerId =
                    periodWithCustomer?.Customer?.sequence_container_id ??
                    null;
                const activityStep = Number(
                    activity.ActivitiesSequence.step
                );
                let isActuallyLastStep = false;
                let maxStep: number | null = null;
                if (accountId != null) {
                    const maxStepRow =
                        await prisma.activitiesSequence.findFirst({
                            where: {
                                account_id: accountId,
                                sequence_container_id: customerContainerId,
                                category: "Automated",
                                active: true,
                                OR: [
                                    { step_type: null },
                                    { step_type: "overdue" },
                                ],
                            },
                            orderBy: { step: "desc" },
                            select: { step: true },
                        });
                    maxStep = maxStepRow?.step ?? null;
                    isActuallyLastStep =
                        maxStep !== null &&
                        Number(activityStep) === Number(maxStep);
                }
                if (logCallback) {
                    logCallback(
                        `DRY_RUN: Last-step check for collection period ${activity.collection_period_id}`,
                        "INFO",
                        {
                            step: "DRY_RUN_LAST_STEP_CHECK",
                            collection_period_id:
                                activity.collection_period_id,
                            activityId: activity.id?.toString(),
                            periodWithCustomerNull:
                                periodWithCustomer == null,
                            accountId: accountId ?? null,
                            customerContainerId:
                                customerContainerId ?? null,
                            activityStep,
                            maxStep,
                            isActuallyLastStep,
                        }
                    );
                }
                if (stepCollector) {
                    stepCollector.addStep(
                        "DRY_RUN_LAST_STEP_CHECK",
                        `DRY_RUN: Last-step check for collection period ${activity.collection_period_id}`,
                        "INFO",
                        {
                            collection_period_id:
                                activity.collection_period_id,
                            activityId: activity.id?.toString(),
                            periodWithCustomerNull:
                                periodWithCustomer == null,
                            accountId: accountId ?? null,
                            customerContainerId:
                                customerContainerId ?? null,
                            activityStep,
                            maxStep,
                            isActuallyLastStep,
                        }
                    );
                }
                if (isActuallyLastStep) {
                    const account = activity.Account?.id
                        ? await prisma.account.findUnique({
                            where: { id: activity.Account.id },
                            select: {
                                wait_days_after_automated: true,
                            },
                        })
                        : null;
                    const nextCategoryDate = new Date();
                    if (fastForwardScheduledActivities) {
                        nextCategoryDate.setTime(
                            nextCategoryDate.getTime() -
                            60 * 60 * 1000
                        );
                    } else {
                        nextCategoryDate.setHours(
                            nextCategoryDate.getHours() +
                            24 *
                            (account?.wait_days_after_automated ?? 0)
                        );
                    }
                    await prisma.customerCollectionPeriod.update({
                        where: { id: activity.collection_period_id },
                        data: {
                            is_last_automated_step_delivered: true,
                            next_category: "Agent",
                            next_category_date: nextCategoryDate,
                        },
                    });
                    if (logCallback) {
                        logCallback(
                            `DRY_RUN: Set is_last_automated_step_delivered and next_category=Agent for collection period ${activity.collection_period_id} (last automated step delivered without webhook)`,
                            "INFO",
                            {
                                collection_period_id:
                                    activity.collection_period_id,
                                reason: "skip_sms_dry_run_last_step",
                                activityStep,
                                maxStep,
                            }
                        );
                    }
                }
            } catch (dryRunUpdateError: any) {
                if (logCallback) {
                    logCallback(
                        `DRY_RUN: Failed to set last-step fields for collection period ${activity.collection_period_id}: ${dryRunUpdateError?.message ?? String(dryRunUpdateError)}`,
                        "WARNING",
                        {
                            collection_period_id:
                                activity.collection_period_id,
                            error:
                                dryRunUpdateError?.message ??
                                String(dryRunUpdateError),
                        }
                    );
                }
            }
        };

        // ========================================
        // PHASE 1: Send Activities - START
        // ========================================
        const phase2Start = Date.now();
        // Phase 1 start - add to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "PHASE1_START",
                "Starting Phase 1: Activity Sending",
                "INFO",
                {
                    phase: "Activity Sending",
                    startTime: startTime.toISOString(),
                }
            );
        }

        const currentTime = new Date();

        // Debug: Get all activities for this customer to see what's available
        if (customerId) {
            const allActivities = await prisma.activity.findMany({
                where: {
                    customer_id: customerId,
                    CustomerCollectionPeriod: {
                        period_end_date: null,
                    },
                },
                select: {
                    id: true,
                    customer_id: true,
                    type: true,
                    status: true,
                    schedule_time: true,
                    collection_period_id: true,
                    created_at: true,
                    actual_delivery_time: true,
                    ActivitiesSequence: {
                        select: {
                            step: true,
                            category: true,
                        },
                    },
                },
                orderBy: { created_at: "desc" },
                take: 10,
            });
        }

        // Get activities scheduled for current time
        const activitiesToSend = await prisma.activity.findMany({
            include: {
                Account: {
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                        sub_domain: true,
                        sms_fallback_enabled: true,
                        sms_from_name: true,
                    },
                },
                ActivityContact: {
                    where: {
                        status: "Scheduled",
                    },
                    include: {
                        Contact: true,
                    },
                },
                Customer: {
                    select: {
                        id: true,
                        type: true,
                        customer_uuid: true,
                        language: true,
                        Person: {
                            select: {
                                first_name: true,
                                last_name: true,
                                mobile: true,
                            },
                        },
                        Company: {
                            select: {
                                name: true,
                                Contact: {
                                    select: {
                                        email: true,
                                        first_name: true,
                                        last_name: true,
                                    },
                                },
                            },
                        },
                    },
                },
                CustomerCollectionPeriod: {
                    select: {
                        id: true,
                        customer_id: true,
                        current_category: true,
                        previous_category: true,
                        Customer: {
                            select: {
                                type: true,
                                customer_uuid: true,
                                language: true,
                                Person: {
                                    select: {
                                        first_name: true,
                                        last_name: true,
                                        mobile: true,
                                    },
                                },
                                Company: {
                                    select: {
                                        name: true,
                                        Contact: {
                                            select: {
                                                email: true,
                                                first_name: true,
                                                last_name: true,
                                            },
                                        },
                                    },
                                },
                                Country: {
                                    select: {
                                        id: true,
                                        iso2: true,
                                    },
                                },
                            },
                        },
                    },
                },
                ActivitiesSequence: {
                    select: {
                        id: true,
                        step: true,
                        category: true,
                        activity_template_id: true,
                        activity_type: true,
                        step_type: true,
                    },
                },
                Invoice: {
                    select: {
                        id: true,
                        invoice_number: true,
                        due_date: true,
                        outstanding_debt: true,
                    },
                },
            },
            where: {
                schedule_time: {
                    lte: currentTime,
                },
                status: {
                    in: [ActivityStatus.SCHEDULED],
                },
                Customer: excludeCreditOnlyCustomerWhere(),
                ...(customerId && { customer_id: customerId }),
            },
            orderBy: {
                id: "desc",
            },
        });

        processStats.totalActivitiesFound = activitiesToSend.length;

        // Add activities found message to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "ACTIVITIES_FOUND",
                `Found ${activitiesToSend.length} activities to send`,
                "INFO",
                {
                    activitiesCount: activitiesToSend.length,
                    currentTime: currentTime.toISOString(),
                }
            );
        }
        // Enhanced logging for customer-specific execution
        if (logCallback) {
            logCallback(
                `Found ${activitiesToSend.length} activities to send`,
                "INFO",
                {
                    step: "PHASE1_ACTIVITIES_FOUND",
                    stepNumber: 2,
                    activitiesCount: activitiesToSend.length,
                    currentTime: currentTime.toISOString(),
                    activities: activitiesToSend.map((activity) => ({
                        id: activity.id,
                        customer_id: activity.customer_id,
                        type: activity.type,
                        status: activity.status,
                        schedule_time: activity.schedule_time,
                        collection_period_id: activity.collection_period_id,
                        activity_contacts_count:
                            activity.ActivityContact?.length || 0,
                        activity_contacts_statuses:
                            activity.ActivityContact?.map((ac) => ac.status) ||
                            [],
                    })),
                }
            );
        }

        // Collect all SMS messages for batch processing
        const smsMessages: Array<{
            to: string;
            from: string;
            body: string;
            countryId: number;
            accountId: number;
            activityId: number;
            activityContactId: number;
            activity: any;
            activityContact: any;
        }> = [];

        // Counter for activities with no contacts
        let activitiesWithNoContacts = 0;

        // Process each activity
        for (const activity of activitiesToSend) {
            try {
                if (activity.ActivityContact.length === 0) {
                    // Count activities with no contacts instead of logging each one
                    activitiesWithNoContacts++;
                    continue;
                }

                // Intelligent Channel Selection
                // For Promise_to_pay activities, use the activity_type from ActivitiesSequence
                // Otherwise, use the activity.type
                let selectedChannel = activity.type;

                // If this is a Promise_to_pay activity, check the ActivitiesSequence for the actual channel type
                if (
                    activity.type === "Promise_to_pay" &&
                    activity.ActivitiesSequence?.activity_type
                ) {
                    selectedChannel = activity.ActivitiesSequence.activity_type;
                }

                let selectionMetadata = null;

                try {
                    // Check if intelligent selection is enabled for this customer
                    const isIntelligentEnabled =
                        await intelligenceService.isIntelligentSelectionEnabled(
                            activity.Account.id
                        );

                    if (isIntelligentEnabled) {
                        // Build selection context
                        const context =
                            await intelligenceService.buildSelectionContext(
                                activity
                            );

                        // Select optimal channel
                        const selection =
                            await intelligenceService.selectOptimalChannel(
                                context
                            );

                        selectedChannel = selection.selected_channel;
                        selectionMetadata = {
                            selected_channel: selection.selected_channel,
                            confidence_score: selection.confidence_score,
                            selection_reason: selection.selection_reason,
                            alternative_channels:
                                selection.alternative_channels,
                            learning_data: selection.learning_data,
                        };

                        // Update activity with selected channel if different
                        if (selectedChannel !== activity.type) {
                            await prisma.activity.update({
                                where: { id: activity.id },
                                data: { type: selectedChannel },
                            });
                        }
                    }
                } catch (intelligenceError: any) {
                    // Fallback to original channel if intelligent selection fails
                    // For Promise_to_pay, keep the channel from ActivitiesSequence if available
                    if (
                        activity.type === "Promise_to_pay" &&
                        activity.ActivitiesSequence?.activity_type
                    ) {
                        selectedChannel =
                            activity.ActivitiesSequence.activity_type;
                    } else {
                        selectedChannel = activity.type;
                    }

                    // Log as warning to system log (non-critical but useful for monitoring)
                    const correlationId = LogService.getContext();
                    await logService.logMessage(
                        LogLevel.WARNING,
                        `Intelligent channel selection failed for activity ${activity.id}, using original channel: ${intelligenceError.message} `,
                        "activityWorkflowManager.intelligentChannelSelection",
                        {
                            step: "PHASE1_INTELLIGENT_SELECTION_FALLBACK",
                            activity_id: activity.id.toString(),
                            customer_id: activity.customer_id,
                            account_id: activity.Account?.id,
                            original_channel: activity.type,
                            error: intelligenceError.message,
                        },
                        activity.Account?.id,
                        undefined, // userId
                        jobId,
                        correlationId || undefined
                    );
                }

                processStats.activitiesWithContacts++;

                let activitySuccess = true;
                let sentCount = 0;
                let failedCount = 0;
                let hasSuccessfulContact = false;

                // Process each activity contact
                for (let i = 0; i < activity.ActivityContact.length; i++) {
                    const activityContact = activity.ActivityContact[i];

                    try {
                        if (selectedChannel === "Email") {
                            // Get email subject and content from activity template
                            let emailSubject =
                                activity.title || "Collection Notice";
                            // For system_generated activities, always re-process from template
                            // so contact-specific variables ({first_name} etc.) get replaced
                            // per-contact. For manual activities, use activity.content.
                            let emailContent = activity.content || "";
                            let emailContentNeedsContactProcessing = !activity.system_generated;

                            // If this is an automated activity, fetch the email subject and content from the template
                            // For Promise_to_pay activities, use activity_template if ActivitiesSequence is not available
                            const templateId =
                                activity.ActivitiesSequence
                                    ?.activity_template_id ||
                                (activity as any).activity_template;

                            if (activity.system_generated && templateId) {
                                // Get account's default language
                                const account = await prisma.account.findUnique(
                                    {
                                        where: { id: activity.Account.id },
                                        select: {
                                            default_language: true,
                                        } as any,
                                    }
                                );

                                const defaultLanguage =
                                    (account?.default_language as unknown as string) ||
                                    "English";

                                // Get customer's current language from Customer table, fallback to account's default language
                                // Always use the current customer language to ensure URLs are generated correctly
                                let customerLanguage =
                                    (activity.CustomerCollectionPeriod?.Customer
                                        ?.language as any) || defaultLanguage;

                                // If customer language is missing, fetch it fresh to ensure we use the current language
                                if (
                                    !customerLanguage ||
                                    customerLanguage === defaultLanguage
                                ) {
                                    try {
                                        const freshCustomer =
                                            await prisma.customer.findUnique({
                                                where: {
                                                    id: activity.customer_id,
                                                },
                                                select: { language: true },
                                            });
                                        if (freshCustomer?.language) {
                                            customerLanguage =
                                                freshCustomer.language;
                                        }
                                    } catch (error) {
                                        // If fetch fails, continue with defaultLanguage
                                    }
                                }

                                // Step 2: Find template in customer's language (fetch all content types)
                                let languageTemplate =
                                    await prisma.activityTemplateLanguage.findFirst(
                                        {
                                            where: {
                                                ActivitiesTemplate: {
                                                    id: templateId,
                                                },
                                                language:
                                                    customerLanguage as any,
                                            },
                                            select: {
                                                email_subject: true,
                                                email_content: true,
                                                sms_content: true,
                                                whatsapp_content: true,
                                            },
                                        }
                                    );

                                let usedLanguage: any = customerLanguage;

                                // Step 3: If not found, find template in account's default language
                                if (!languageTemplate && defaultLanguage) {
                                    languageTemplate =
                                        await prisma.activityTemplateLanguage.findFirst(
                                            {
                                                where: {
                                                    ActivitiesTemplate: {
                                                        id: templateId,
                                                    },
                                                    language:
                                                        defaultLanguage as any,
                                                },
                                                select: {
                                                    email_subject: true,
                                                    email_content: true,
                                                    sms_content: true,
                                                    whatsapp_content: true,
                                                },
                                            }
                                        );
                                    if (languageTemplate) {
                                        usedLanguage = defaultLanguage as any;
                                    }
                                }

                                // Step 4: If still not found, use English template
                                if (!languageTemplate) {
                                    const englishTemplate =
                                        await prisma.activityTemplateLanguage.findFirst(
                                            {
                                                where: {
                                                    ActivitiesTemplate: {
                                                        id: templateId,
                                                    },
                                                    language: "English",
                                                },
                                                select: {
                                                    email_subject: true,
                                                    email_content: true,
                                                    sms_content: true,
                                                    whatsapp_content: true,
                                                },
                                            }
                                        );
                                    if (englishTemplate) {
                                        languageTemplate = englishTemplate;
                                        usedLanguage = "English";
                                    }
                                }

                                // Step 5: Content now lives exclusively in ActivityTemplateLanguage.
                                // The main ActivitiesTemplate no longer stores content fields,
                                // so there is no useful main-template fallback for content.
                                const template = languageTemplate;

                                // Track if we used main template (vs language-specific template)
                                const usedMainTemplate =
                                    !languageTemplate && !!template;

                                // Check if template is missing for customer's language and notify
                                // Only notify if: customer language template is missing AND we successfully used a fallback
                                // AND customer language differs from default (meaning we wanted to use customer language but couldn't)
                                const customerLanguageTemplate =
                                    await prisma.activityTemplateLanguage.findFirst(
                                        {
                                            where: {
                                                ActivitiesTemplate: {
                                                    id: templateId,
                                                },
                                                language: customerLanguage,
                                            },
                                            select: {
                                                id: true,
                                            },
                                        }
                                    );

                                // Notify when: customer language template is missing AND customer language differs from default
                                // AND we successfully used a fallback template (not the customer language)
                                // BUT don't notify if we successfully used the default language template (that's acceptable)
                                // We DO notify if we used main template OR used a non-default language template
                                if (
                                    !customerLanguageTemplate &&
                                    customerLanguage &&
                                    customerLanguage !== defaultLanguage &&
                                    template && // We successfully found a fallback template (language-specific or main)
                                    (usedMainTemplate || // We used main template (always notify)
                                        (usedLanguage !== customerLanguage &&
                                            usedLanguage !== defaultLanguage))
                                ) {
                                    // OR we used a non-default language template
                                    // Only notify if customer's language template is missing (not default language fallback)
                                    const customer =
                                        activity.CustomerCollectionPeriod
                                            ?.Customer;
                                    let customerName = `Customer #${activity.customer_id} `;
                                    if (customer) {
                                        if (customer.Person?.first_name) {
                                            customerName =
                                                `${customer.Person.first_name} ${customer.Person.last_name || ""} `.trim();
                                        } else if (customer.Company?.name) {
                                            customerName =
                                                customer.Company.name;
                                        }
                                    }

                                    try {
                                        const NotificationService = (
                                            await import(
                                                "../services/NotificationService"
                                            )
                                        ).default;
                                        const notificationService =
                                            NotificationService.getInstance();
                                        await notificationService.createTemplateMissingNotification(
                                            activity.Account.id,
                                            activity.customer_id,
                                            customerName,
                                            customerLanguage,
                                            activity.type || "Email",
                                            "Email",
                                            activity.ActivitiesSequence
                                                ?.activity_template_id ??
                                            undefined
                                        );
                                    } catch (notificationError) {
                                        // Silently fail - notification errors are non-critical
                                    }
                                }

                                if (template?.email_subject) {
                                    // Use consolidated template processing for email subject
                                    emailSubject = await processTemplateContent(
                                        template.email_subject,
                                        activity,
                                        activityContact,
                                        usedLanguage || "English"
                                    );
                                }

                                if (template?.email_content) {
                                    // Always use the template content for system_generated activities
                                    // so per-contact variables ({first_name} etc.) are always replaced.
                                    // activity.content is stored with placeholders at creation time
                                    // and cannot substitute for per-send processing.
                                    emailContent = await processTemplateContent(
                                        template.email_content,
                                        activity,
                                        activityContact,
                                        usedLanguage || "English"
                                    );
                                    emailContentNeedsContactProcessing = false;
                                } else if (emailContent) {
                                    // Template exists but no email_content in template;
                                    // fall back to activity.content and process it
                                    emailContentNeedsContactProcessing = true;
                                }
                            }

                            // Process contact variables in activity.content if we didn't get content from template.
                            // This handles manual activities and edge cases where no template content exists.
                            if (emailContentNeedsContactProcessing && emailContent) {
                                emailContent = await processTemplateContent(
                                    emailContent,
                                    activity,
                                    activityContact,
                                    "English"
                                );
                            }

                            // Validate email content is not empty before sending
                            if (!emailContent || emailContent.trim() === "") {
                                await logService.logMessage(
                                    LogLevel.ERROR,
                                    `Cannot send email: content is empty for activity ${activity.id}, contact ${activityContact.id} `,
                                    "activityWorkflowManager.processActivity",
                                    {
                                        step: "PHASE1_EMAIL_VALIDATION",
                                        activity_id: activity.id.toString(),
                                        activity_contact_id:
                                            activityContact.id.toString(),
                                        customer_id: activity.customer_id,
                                        account_id: activity.Account?.id,
                                        activity_type: activity.type,
                                        system_generated:
                                            activity.system_generated,
                                        template_id:
                                            activity.ActivitiesSequence
                                                ?.activity_template_id,
                                    },
                                    activity.Account?.id,
                                    undefined, // userId
                                    jobId,
                                    LogService.getContext() || undefined
                                );

                                // Mark activity contact as failed
                                await prisma.activityContact.update({
                                    where: { id: activityContact.id },
                                    data: {
                                        status: "Failed",
                                    },
                                });

                                failedCount++;
                                activitySuccess = false;
                                continue; // Skip to next contact
                            }

                            // Create EmailService and configure it for this specific customer
                            const emailService = new EmailService();
                            await emailService.setCustomerSenderNameAndReplyToEmail(
                                activity.Account.id
                            );

                            // Generate a unique message ID for HTML tracking (opens/clicks)
                            const trackingMessageId = `${activity.id} -${activityContact.id} -${Date.now()} `;

                            // Add email tracking to the content using the custom tracking ID
                            const { addEmailTracking } = await import(
                                "@/utils/emailTrackingUtils"
                            );
                            const trackedEmailContent = addEmailTracking(
                                emailContent,
                                trackingMessageId
                            );

                            let emailPermanentFailure = false;
                            try {
                                const emailResult = await sendEmailWithRetry(
                                    emailService,
                                    activityContact.Contact.email!,
                                    emailSubject,
                                    trackedEmailContent,
                                    trackingMessageId
                                );

                                await prisma.activityContact.update({
                                    where: { id: activityContact.id },
                                    data: {
                                        status: "Sent",
                                        message_id: trackingMessageId,
                                        ses_message_id: emailResult.messageId,
                                        ...(selectionMetadata && {
                                            channel_selection_reason:
                                                selectionMetadata.selection_reason,
                                            predicted_success_rate:
                                                selectionMetadata.confidence_score,
                                            alternative_channels_considered:
                                                selectionMetadata.alternative_channels,
                                        }),
                                    },
                                });
                                processStats.emailsSent++;
                                sentCount++;
                                hasSuccessfulContact = true;
                            } catch (emailError) {
                                const failureResult =
                                    await handleActivityEmailSendFailure(
                                        activityContact.id,
                                        emailError,
                                        activityContact.retry_count ?? 0
                                    );

                                if (failureResult.action === "deferred") {
                                    processStats.emailsDeferred++;
                                    const correlationId =
                                        LogService.getContext();
                                    await logService.logMessage(
                                        LogLevel.WARNING,
                                        `Transient email failure; contact ${activityContact.id} remains Scheduled (retry ${(activityContact.retry_count ?? 0) + 1})`,
                                        "activityWorkflowManager.transientEmailRetry",
                                        {
                                            step: "PHASE2_EMAIL_TRANSIENT_DEFERRED",
                                            activity_id: activity.id.toString(),
                                            activity_contact_id:
                                                activityContact.id,
                                            customer_id: activity.customer_id,
                                            account_id: activity.Account?.id,
                                            retry_count:
                                                (activityContact.retry_count ??
                                                    0) + 1,
                                        },
                                        activity.Account?.id,
                                        undefined,
                                        jobId,
                                        correlationId || undefined
                                    );
                                    continue;
                                }

                                emailPermanentFailure = true;
                            }

                            if (emailPermanentFailure) {
                                // Email failed permanently - check if we can fallback to SMS
                                if (
                                    activityContact.Contact.mobile &&
                                    activity.Account.sms_fallback_enabled !==
                                    false
                                ) {
                                    // Fallback to SMS when email fails and SMS fallback is enabled
                                    // Get customer's country for SMS vendor selection
                                    const customer =
                                        await prisma.customer.findUnique({
                                            where: { id: activity.customer_id },
                                            select: { country_id: true },
                                        });

                                    if (customer?.country_id) {
                                        // Get SMS content from activity template
                                        let smsContent = activity.content || "";

                                        // If this is an automated activity, fetch the SMS content from the template
                                        if (
                                            activity.system_generated &&
                                            activity.ActivitiesSequence
                                                ?.activity_template_id
                                        ) {
                                            // Get account's default language
                                            const account =
                                                await prisma.account.findUnique(
                                                    {
                                                        where: {
                                                            id: activity.Account
                                                                .id,
                                                        },
                                                        select: {
                                                            default_language: true,
                                                        } as any,
                                                    }
                                                );

                                            const defaultLanguage =
                                                (account?.default_language as unknown as string) ||
                                                "English";

                                            // Get customer's language from Customer table, fallback to account's default language
                                            const customerLanguage =
                                                (activity
                                                    .CustomerCollectionPeriod
                                                    ?.Customer
                                                    ?.language as any) ||
                                                defaultLanguage;

                                            // Step 2: Find template in customer's language (fetch all content types)
                                            const templateId =
                                                activity.ActivitiesSequence!
                                                    .activity_template_id;
                                            let languageTemplate =
                                                await prisma.activityTemplateLanguage.findFirst(
                                                    {
                                                        where: {
                                                            ActivitiesTemplate:
                                                            {
                                                                id: templateId,
                                                            },
                                                            language:
                                                                customerLanguage as any,
                                                        },
                                                        select: {
                                                            email_subject: true,
                                                            email_content: true,
                                                            sms_content: true,
                                                            whatsapp_content: true,
                                                        },
                                                    }
                                                );

                                            let usedLanguage: any =
                                                customerLanguage;

                                            // Step 3: If not found, find template in account's default language
                                            if (
                                                !languageTemplate &&
                                                defaultLanguage
                                            ) {
                                                languageTemplate =
                                                    await prisma.activityTemplateLanguage.findFirst(
                                                        {
                                                            where: {
                                                                ActivitiesTemplate:
                                                                {
                                                                    id: templateId,
                                                                },
                                                                language:
                                                                    defaultLanguage as any,
                                                            },
                                                            select: {
                                                                email_subject: true,
                                                                email_content: true,
                                                                sms_content: true,
                                                                whatsapp_content: true,
                                                            },
                                                        }
                                                    );
                                                if (languageTemplate) {
                                                    usedLanguage =
                                                        defaultLanguage as any;
                                                }
                                            }

                                            // Step 4: If still not found, use English template
                                            if (!languageTemplate) {
                                                const englishTemplate =
                                                    await prisma.activityTemplateLanguage.findFirst(
                                                        {
                                                            where: {
                                                                ActivitiesTemplate:
                                                                {
                                                                    id: templateId,
                                                                },
                                                                language:
                                                                    "English",
                                                            },
                                                            select: {
                                                                email_subject: true,
                                                                email_content: true,
                                                                sms_content: true,
                                                                whatsapp_content: true,
                                                            },
                                                        }
                                                    );
                                                if (englishTemplate) {
                                                    languageTemplate =
                                                        englishTemplate;
                                                    usedLanguage = "English";
                                                }
                                            }

                                            // Step 5: Content now lives exclusively in ActivityTemplateLanguage.
                                            // The main ActivitiesTemplate no longer stores content fields.
                                            const template = languageTemplate;

                                            // Check if template is missing for customer's language and notify
                                            const customerLanguageTemplate =
                                                await prisma.activityTemplateLanguage.findFirst(
                                                    {
                                                        where: {
                                                            ActivitiesTemplate:
                                                            {
                                                                id: templateId,
                                                            },
                                                            language:
                                                                customerLanguage,
                                                        },
                                                        select: {
                                                            id: true,
                                                        },
                                                    }
                                                );

                                            // Check if template is missing for customer's language and notify
                                            // Only notify if customer's language template was NOT found AND customer language differs from default
                                            // AND we didn't successfully use a default language fallback template
                                            if (
                                                !customerLanguageTemplate &&
                                                customerLanguage &&
                                                customerLanguage !==
                                                defaultLanguage &&
                                                usedLanguage !== defaultLanguage
                                            ) {
                                                // Only notify if customer's language template is missing (not default language fallback)
                                                const customer =
                                                    activity
                                                        .CustomerCollectionPeriod
                                                        ?.Customer;
                                                let customerName = `Customer #${activity.customer_id} `;
                                                if (customer) {
                                                    if (
                                                        customer.Person
                                                            ?.first_name
                                                    ) {
                                                        customerName =
                                                            `${customer.Person.first_name} ${customer.Person.last_name || ""} `.trim();
                                                    } else if (
                                                        customer.Company?.name
                                                    ) {
                                                        customerName =
                                                            customer.Company
                                                                .name;
                                                    }
                                                }

                                                try {
                                                    const NotificationService =
                                                        (
                                                            await import(
                                                                "../services/NotificationService"
                                                            )
                                                        ).default;
                                                    const notificationService =
                                                        NotificationService.getInstance();
                                                    await notificationService.createTemplateMissingNotification(
                                                        activity.Account.id,
                                                        activity.customer_id,
                                                        customerName,
                                                        customerLanguage,
                                                        activity.type || "SMS",
                                                        "SMS",
                                                        activity
                                                            .ActivitiesSequence
                                                            ?.activity_template_id ??
                                                        undefined
                                                    );
                                                } catch (notificationError) {
                                                    // Silently fail - notification errors are non-critical
                                                }
                                            }

                                            if (template?.sms_content) {
                                                // Use consolidated template processing for SMS content
                                                smsContent =
                                                    await processTemplateContent(
                                                        template.sms_content,
                                                        activity,
                                                        activityContact,
                                                        usedLanguage ||
                                                        "English"
                                                    );
                                            }
                                        }

                                        // Use customer's SMS from name if available, otherwise fallback to "ARchaser"
                                        const senderName =
                                            activity.Account?.sms_from_name ||
                                            "ARchaser";

                                        const smsResult =
                                            await smsVendorService.sendSMS(
                                                activityContact.Contact.mobile,
                                                senderName,
                                                smsContent,
                                                customer.country_id,
                                                Number(activity.id),
                                                activity.Account.id
                                            );

                                        if (smsResult.success) {
                                            await prisma.activityContact.update(
                                                {
                                                    where: {
                                                        id: activityContact.id,
                                                    },
                                                    data: {
                                                        status: "Sent",
                                                        sent_at: new Date(),
                                                        communication_channel:
                                                            "SMS",
                                                        message_id:
                                                            smsResult.messageId ||
                                                            null, // Store message ID for status tracking
                                                        sms_vendor_id:
                                                            smsResult.vendorId ||
                                                            null, // Store vendor ID for status tracking
                                                        channel_selection_reason:
                                                            "{{activity.channel_fallback_email_to_sms}}",
                                                        predicted_success_rate: 0.8, // Lower confidence for fallback
                                                        alternative_channels_considered:
                                                            ["Email"],
                                                    },
                                                }
                                            );
                                            processStats.smsSent++;
                                            sentCount++;
                                            hasSuccessfulContact = true;
                                        } else {
                                            // SMS fallback also failed
                                            const smsFailureReason =
                                                smsResult.error ||
                                                "Email failed and SMS fallback failed";
                                            await prisma.activityContact.update(
                                                {
                                                    where: {
                                                        id: activityContact.id,
                                                    },
                                                    data: {
                                                        status: "Failed",
                                                        failed_at: new Date(),
                                                        failure_reason:
                                                            smsFailureReason,
                                                    },
                                                }
                                            );
                                            processStats.smsFailed++;
                                            failedCount++;
                                            activitySuccess = false;
                                            if (stepCollector) {
                                                stepCollector.addStep(
                                                    "SMS_FAILED",
                                                    smsFailureReason,
                                                    "ERROR",
                                                    {
                                                        activityContactId:
                                                            activityContact.id,
                                                        to: activityContact
                                                            .Contact?.mobile,
                                                        error: smsFailureReason,
                                                        context:
                                                            "email_fallback_sms",
                                                        vendorId: smsResult.vendorId,
                                                    }
                                                );
                                            }
                                        }
                                    } else {
                                        // No customer country - mark as failed
                                        await prisma.activityContact.update({
                                            where: { id: activityContact.id },
                                            data: {
                                                status: "Failed",
                                                failed_at: new Date(),
                                                failure_reason:
                                                    "Email failed and no customer country for SMS fallback",
                                            },
                                        });
                                        processStats.emailsFailed++;
                                        failedCount++;
                                        activitySuccess = false;
                                    }
                                } else {
                                    // No mobile number or SMS fallback disabled - mark as failed
                                    await prisma.activityContact.update({
                                        where: { id: activityContact.id },
                                        data: {
                                            status: "Failed",
                                            failed_at: new Date(),
                                            failure_reason: activityContact
                                                .Contact.mobile
                                                ? "Email failed and SMS fallback disabled"
                                                : "Email failed and no mobile number for SMS fallback",
                                        },
                                    });
                                    processStats.emailsFailed++;
                                    failedCount++;
                                    activitySuccess = false;
                                }
                            }
                        } else if (selectedChannel === "SMS") {
                            // Send SMS
                            // Get customer's country for SMS vendor selection
                            const customer = await prisma.customer.findUnique({
                                where: { id: activity.customer_id },
                                select: { country_id: true },
                            });

                            if (!customer?.country_id) {
                                throw new Error("Customer country not found");
                            }

                            if (!activityContact.Contact.mobile) {
                                // Fallback to email when SMS is not possible due to missing mobile
                                // SMS fallback to email is ALWAYS allowed
                                // Process as email instead
                                selectedChannel = "Email";

                                // Set fallback reason for this contact
                                selectionMetadata = {
                                    selected_channel: "Email",
                                    confidence_score: 1.0,
                                    selection_reason:
                                        "{{activity.channel_fallback_sms_to_email}}",
                                    alternative_channels: ["SMS"],
                                    learning_data: {},
                                };

                                // Continue to email processing below
                            } else {
                                // Get SMS content from activity template (EXACT same process as email)
                                let smsContent = activity.content || "";

                                // If this is an automated activity, fetch the SMS content from the template
                                if (
                                    activity.system_generated &&
                                    activity.ActivitiesSequence
                                        ?.activity_template_id
                                ) {
                                    // Get account's default language
                                    const account =
                                        await prisma.account.findUnique({
                                            where: { id: activity.Account.id },
                                            select: {
                                                default_language: true,
                                            } as any,
                                        });

                                    const defaultLanguage =
                                        (account?.default_language as unknown as string) ||
                                        "English";

                                    // Get customer's current language from Customer table, fallback to account's default language
                                    // Always use the current customer language to ensure URLs are generated correctly
                                    let customerLanguage =
                                        (activity.CustomerCollectionPeriod
                                            ?.Customer?.language as any) ||
                                        defaultLanguage;

                                    // If customer language is missing, fetch it fresh to ensure we use the current language
                                    if (
                                        !customerLanguage ||
                                        customerLanguage === defaultLanguage
                                    ) {
                                        try {
                                            const freshCustomer =
                                                await prisma.customer.findUnique(
                                                    {
                                                        where: {
                                                            id: activity.customer_id,
                                                        },
                                                        select: {
                                                            language: true,
                                                        },
                                                    }
                                                );
                                            if (freshCustomer?.language) {
                                                customerLanguage =
                                                    freshCustomer.language;
                                            }
                                        } catch (error) {
                                            // If fetch fails, continue with defaultLanguage
                                        }
                                    }

                                    // Step 2: Find template in customer's language (fetch all content types)
                                    const templateId =
                                        activity.ActivitiesSequence!
                                            .activity_template_id;
                                    let languageTemplate =
                                        await prisma.activityTemplateLanguage.findFirst(
                                            {
                                                where: {
                                                    ActivitiesTemplate: {
                                                        id: templateId,
                                                    },
                                                    language:
                                                        customerLanguage as any,
                                                },
                                                select: {
                                                    email_subject: true,
                                                    email_content: true,
                                                    sms_content: true,
                                                    whatsapp_content: true,
                                                },
                                            }
                                        );

                                    let usedLanguage: any = customerLanguage;

                                    // Step 3: If not found, find template in account's default language
                                    if (!languageTemplate && defaultLanguage) {
                                        languageTemplate =
                                            await prisma.activityTemplateLanguage.findFirst(
                                                {
                                                    where: {
                                                        ActivitiesTemplate: {
                                                            id: templateId,
                                                        },
                                                        language:
                                                            defaultLanguage as any,
                                                    },
                                                    select: {
                                                        email_subject: true,
                                                        email_content: true,
                                                        sms_content: true,
                                                        whatsapp_content: true,
                                                    },
                                                }
                                            );
                                        if (languageTemplate) {
                                            usedLanguage =
                                                defaultLanguage as any;
                                        }
                                    }

                                    // Step 4: If still not found, use English template
                                    if (!languageTemplate) {
                                        const englishTemplate =
                                            await prisma.activityTemplateLanguage.findFirst(
                                                {
                                                    where: {
                                                        ActivitiesTemplate: {
                                                            id: templateId,
                                                        },
                                                        language: "English",
                                                    },
                                                    select: {
                                                        email_subject: true,
                                                        email_content: true,
                                                        sms_content: true,
                                                        whatsapp_content: true,
                                                    },
                                                }
                                            );
                                        if (englishTemplate) {
                                            languageTemplate = englishTemplate;
                                            usedLanguage = "English";
                                        }
                                    }

                                    // Step 5: Content now lives exclusively in ActivityTemplateLanguage.
                                    // The main ActivitiesTemplate no longer stores content fields.
                                    const template = languageTemplate;

                                    // Check if template is missing for customer's language and notify
                                    const customerLanguageTemplate =
                                        await prisma.activityTemplateLanguage.findFirst(
                                            {
                                                where: {
                                                    ActivitiesTemplate: {
                                                        id: templateId,
                                                    },
                                                    language: customerLanguage,
                                                },
                                                select: {
                                                    id: true,
                                                },
                                            }
                                        );

                                    // Check if template is missing for customer's language and notify
                                    // Only notify if customer's language template was NOT found AND customer language differs from default
                                    // AND we didn't successfully use a default language fallback template
                                    if (
                                        !customerLanguageTemplate &&
                                        customerLanguage &&
                                        customerLanguage !== defaultLanguage &&
                                        usedLanguage !== defaultLanguage
                                    ) {
                                        // Only notify if customer's language template is missing (not default language fallback)
                                        const customer =
                                            activity.CustomerCollectionPeriod
                                                ?.Customer;
                                        let customerName = `Customer #${activity.customer_id} `;
                                        if (customer) {
                                            if (customer.Person?.first_name) {
                                                customerName =
                                                    `${customer.Person.first_name} ${customer.Person.last_name || ""} `.trim();
                                            } else if (customer.Company?.name) {
                                                customerName =
                                                    customer.Company.name;
                                            }
                                        }

                                        try {
                                            const NotificationService = (
                                                await import(
                                                    "../services/NotificationService"
                                                )
                                            ).default;
                                            const notificationService =
                                                NotificationService.getInstance();
                                            await notificationService.createTemplateMissingNotification(
                                                activity.Account.id,
                                                activity.customer_id,
                                                customerName,
                                                customerLanguage,
                                                activity.type || "SMS",
                                                "SMS",
                                                activity.ActivitiesSequence
                                                    ?.activity_template_id ??
                                                undefined
                                            );
                                        } catch (notificationError) {
                                            // Silently fail - notification errors are non-critical
                                        }
                                    }

                                    if (template?.sms_content) {
                                        // Use consolidated template processing for SMS content
                                        smsContent =
                                            await processTemplateContent(
                                                template.sms_content,
                                                activity,
                                                activityContact,
                                                usedLanguage || "English"
                                            );
                                    }
                                }

                                // Collect SMS message for batch processing
                                // Use customer's SMS from name if available, otherwise fallback to "ARchaser"
                                const senderName =
                                    activity.Account?.sms_from_name ||
                                    "ARchaser";

                                smsMessages.push({
                                    to: activityContact.Contact.mobile,
                                    from: senderName,
                                    body: smsContent,
                                    countryId: customer.country_id,
                                    accountId: activity.Account.id,
                                    activityId: Number(activity.id),
                                    activityContactId: activityContact.id,
                                    activity: activity,
                                    activityContact: activityContact,
                                });
                            } // Close the else block for SMS processing
                        }

                        // Note: Email sending is handled in the main channel selection logic above
                        // This duplicate section was causing emails to be sent twice and has been removed
                    } catch (contactError: any) {
                        if (selectedChannel === "Email") {
                            const failureResult =
                                await handleActivityEmailSendFailure(
                                    activityContact.id,
                                    contactError,
                                    activityContact.retry_count ?? 0
                                );

                            if (failureResult.action === "deferred") {
                                processStats.emailsDeferred++;
                                const correlationId =
                                    LogService.getContext();
                                await logService.logMessage(
                                    LogLevel.WARNING,
                                    `Transient email failure; contact ${activityContact.id} remains Scheduled (retry ${(activityContact.retry_count ?? 0) + 1})`,
                                    "activityWorkflowManager.transientEmailRetry",
                                    {
                                        step: "PHASE2_EMAIL_TRANSIENT_DEFERRED",
                                        activity_id: activity.id.toString(),
                                        activity_contact_id:
                                            activityContact.id,
                                        customer_id: activity.customer_id,
                                        account_id: activity.Account?.id,
                                        retry_count:
                                            (activityContact.retry_count ?? 0) +
                                            1,
                                    },
                                    activity.Account?.id,
                                    undefined,
                                    jobId,
                                    correlationId || undefined
                                );
                                continue;
                            }

                            processStats.emailsFailed++;
                        } else {
                            await prisma.activityContact.update({
                                where: { id: activityContact.id },
                                data: {
                                    status: "Failed",
                                },
                            });
                        }

                        failedCount++;
                        activitySuccess = false;

                        const correlationId = LogService.getContext();
                        const errorMessage = `Failed to process activity contact ${activityContact.id} for activity ${activity.id}: ${contactError.message} `;
                        await logService.logMessage(
                            LogLevel.ERROR,
                            errorMessage,
                            "activityWorkflowManager.processActivityContact",
                            {
                                step: "PHASE1_CONTACT_PROCESSING_ERROR",
                                activity_id: activity.id.toString(),
                                activity_contact_id: activityContact.id,
                                customer_id: activity.customer_id,
                                account_id: activity.Account?.id,
                                error: contactError.message,
                                stack: contactError.stack,
                            },
                            activity.Account?.id,
                            undefined,
                            jobId,
                            correlationId || undefined
                        );
                    }
                }

                // Update activity status based on success/failure
                let finalActivityStatus;
                if (activitySuccess) {
                    // All contacts succeeded
                    finalActivityStatus = ActivityStatus.DELIVERED;
                } else if (hasSuccessfulContact) {
                    // Some contacts succeeded - partially sent
                    finalActivityStatus = ActivityStatus.SENT;
                } else {
                    // All contacts failed
                    finalActivityStatus = ActivityStatus.FAILED;
                }

                await prisma.activity.update({
                    where: { id: activity.id },
                    data: {
                        status: finalActivityStatus,
                        actual_delivery_time: hasSuccessfulContact
                            ? new Date()
                            : null,
                        last_sent_time: hasSuccessfulContact
                            ? new Date()
                            : null,
                    },
                });

                if (
                    (finalActivityStatus === ActivityStatus.SENT ||
                        finalActivityStatus === ActivityStatus.DELIVERED) &&
                    activity.ActivitiesSequence?.step_type === "due"
                ) {
                    await setDueNotificationSentOnInvoices(activity);
                }

                const statusDescription = activitySuccess
                    ? "Delivered"
                    : hasSuccessfulContact
                        ? "Partially Sent"
                        : "Failed";
                // CRITICAL FIX: Update last_automated_step when ANY contact succeeds (not just when ALL succeed)
                // This ensures step progression even when some contacts fail
                if (
                    hasSuccessfulContact &&
                    activity.collection_period_id &&
                    activity.ActivitiesSequence?.category === "Automated"
                ) {
                    const updateResult =
                        await prisma.customerCollectionPeriod.update({
                            where: { id: activity.collection_period_id! },
                            data: {
                                last_automated_step:
                                    activity.ActivitiesSequence.step ?? 0,
                            },
                        });

                    // Verify the update was successful
                    const verification =
                        await prisma.customerCollectionPeriod.findUnique({
                            where: { id: activity.collection_period_id! },
                            select: { last_automated_step: true },
                        });

                    if (
                        verification?.last_automated_step !==
                        (activity.ActivitiesSequence.step ?? 0)
                    ) {
                        throw new Error(
                            `Failed to update last_automated_step for collection period ${activity.collection_period_id} `
                        );
                    }

                    if (logCallback) {
                        logCallback(
                            `STEP UPDATED: Collection period ${activity.collection_period_id} - last_automated_step updated to ${activity.ActivitiesSequence.step} after successful sending`,
                            "INFO",
                            {
                                collection_period_id:
                                    activity.collection_period_id,
                                step: activity.ActivitiesSequence.step,
                                activitySuccess: activitySuccess,
                                hasSuccessfulContact: hasSuccessfulContact,
                                sentCount: sentCount,
                                failedCount: failedCount,
                                reason: "step_updated_after_successful_send",
                            }
                        );
                    }

                    // Dry run: when skipping actual SMS send, no delivery webhook runs; set
                    // is_last_automated_step_delivered and next_category via shared helper.
                    if (skipSmsSend && hasSuccessfulContact) {
                        await applyDryRunLastStepIfNeeded(activity);
                    }
                }

                // CRITICAL ADDITION: Transition category for Promise_to_pay and Dispute activities
                if (
                    hasSuccessfulContact &&
                    (activity.ActivitiesSequence?.category ===
                        "Promise_to_pay" ||
                        activity.ActivitiesSequence?.category === "Dispute" ||
                        activity.type === "Promise_to_pay" ||
                        activity.type === "Dispute") &&
                    activity.collection_period_id
                ) {
                    try {
                        const collectionPeriod =
                            await prisma.customerCollectionPeriod.findUnique({
                                where: { id: activity.collection_period_id },
                                select: {
                                    id: true,
                                    customer_id: true,
                                    current_category: true,
                                    previous_category: true,
                                },
                            });

                        if (collectionPeriod) {
                            const { CustomerService } = await import(
                                "../services/CustomerService"
                            );
                            const customerService = new CustomerService();

                            // Determine target category
                            // If previous was Automated, go back to Automated (resume)
                            // If previous was Not Automated (Agent/etc) or null, go to Agent
                            const targetCategory =
                                collectionPeriod.previous_category ===
                                    "Automated"
                                    ? "Automated"
                                    : "Agent";

                            await customerService.updateCollectionPeriodCategory(
                                collectionPeriod.id,
                                targetCategory,
                                collectionPeriod.current_category || "",
                                activity.Account.id,
                                activity.customer_id,
                                {
                                    reason: `Transition after sending ${activity.type} notification`,
                                    userId: "system",
                                    isManualCategoryChange: false,
                                    // resume automated sequence if going back to Automated
                                    resetStepToZero: false,
                                }
                            );

                            if (logCallback) {
                                logCallback(
                                    `CATEGORY TRANSITION: Collection period ${collectionPeriod.id} transitioned to ${targetCategory} after sending ${activity.type} `,
                                    "INFO",
                                    {
                                        collection_period_id:
                                            collectionPeriod.id,
                                        activity_type: activity.type,
                                        previous_category:
                                            collectionPeriod.previous_category,
                                        target_category: targetCategory,
                                    }
                                );
                            }
                        }
                    } catch (error: any) {
                        // Log but don't fail the whole process
                        const errorMessage = `Failed to transition category for activity ${activity.id}: ${error instanceof Error ? error.message : "Unknown error"} `;
                        await logService.logMessage(
                            LogLevel.ERROR,
                            errorMessage,
                            "activityWorkflowManager.categoryTransition",
                            {
                                activity_id: activity.id,
                                error: error.message,
                            },
                            activity.Account.id
                        );
                    }
                }

                if (activitySuccess) {
                    processStats.activitiesCompleted++;
                }

                // Note: Fallback automation is handled separately

                let activityTitle = "";
                const stepNumber = activity.ActivitiesSequence?.step ?? "";
                const sequenceCategory = activity.ActivitiesSequence?.category;

                // Get the contact count (just the number, not "X contacts")
                let contactDisplay = "0";
                if (
                    activity.ActivityContact &&
                    activity.ActivityContact.length > 0
                ) {
                    contactDisplay = activity.ActivityContact.length.toString();
                }

                // Get timing information for parameter inclusion
                const sentTime = new Date();
                const timeDisplay = sentTime.toISOString();

                // Prepare title and parameters according to new translation system
                let titleParams: any = {};

                if (activity.ActivitiesSequence?.step_type === "due") {
                    // Handle due notification activities
                    // This must be checked BEFORE generic "Automated" category because due steps are also automated
                    if (activitySuccess || hasSuccessfulContact) {
                        activityTitle =
                            "{{activities.fields.activity_due_notification}}";
                    } else {
                        // Use failed title for failed due notifications
                        activityTitle =
                            "{{activities.fields.activity_due_notification_failed}}";
                    }

                    const params = (activity.title_params as any) || {};
                    let invoiceCount = params.count;
                    if (!invoiceCount && params.invoiceNumber) {
                        invoiceCount = params.invoiceNumber.split(',').length;
                    }

                    titleParams = {
                        ...params,
                        invoiceNumber: params.invoiceNumber || "Unknown", // Keep for internal use if needed
                        contacts: contactDisplay,
                        count: invoiceCount || 1
                    };
                } else if (
                    sequenceCategory === "Automated" &&
                    !!stepNumber
                ) {
                    if (activitySuccess) {
                        activityTitle =
                            "{{activities.fields.activity_automated_step_sent}}";
                    } else {
                        activityTitle =
                            "{{activities.fields.activity_automated_step_failed}}";
                    }

                    titleParams = {
                        step: stepNumber.toString(),
                        contacts: contactDisplay,
                        time: timeDisplay,
                    };
                } else if (
                    sequenceCategory === "Promise_to_pay" ||
                    activity.type === "Promise_to_pay"
                ) {
                    activityTitle = "{{activities.fields.promise_to_pay_sent}}";
                } else if (
                    selectedChannel === "SMS" ||
                    selectedChannel === "WhatsApp" ||
                    selectedChannel === "Email"
                ) {
                    // Determine if this is an automated step activity
                    // Check if it's part of an automated sequence, not just if it's system-generated
                    const isAutomatedStep =
                        activity.ActivitiesSequence?.category === "Automated" &&
                        activity.ActivitiesSequence?.step;

                    if (activitySuccess) {
                        // All contacts succeeded
                        if (isAutomatedStep) {
                            activityTitle =
                                "{{activities.fields.activity_automated_step_sent}}";
                        } else {
                            switch (selectedChannel) {
                                case "SMS":
                                    activityTitle =
                                        "{{activities.fields.sms_sent}}";
                                    break;
                                case "Email":
                                    activityTitle =
                                        "{{activities.fields.email_sent}}";
                                    break;
                                case "WhatsApp":
                                    activityTitle =
                                        "{{activities.fields.whatsapp_sent}}";
                                    break;
                            }
                        }
                    } else if (hasSuccessfulContact) {
                        // Some contacts succeeded - partially sent
                        if (isAutomatedStep) {
                            activityTitle =
                                "{{activities.fields.activity_automated_step_partially_sent}}";
                        } else {
                            switch (selectedChannel) {
                                case "SMS":
                                    activityTitle =
                                        "{{activities.fields.sms_partially_sent}}";
                                    break;
                                case "Email":
                                    activityTitle =
                                        "{{activities.fields.email_partially_sent}}";
                                    break;
                                case "WhatsApp":
                                    activityTitle =
                                        "{{activities.fields.whatsapp_partially_sent}}";
                                    break;
                            }
                        }
                    } else {
                        // All contacts failed
                        if (isAutomatedStep) {
                            activityTitle =
                                "{{activities.fields.activity_automated_step_failed}}";
                        } else {
                            switch (selectedChannel) {
                                case "SMS":
                                    activityTitle =
                                        "{{activities.fields.sms_failed}}";
                                    break;
                                case "Email":
                                    activityTitle =
                                        "{{activities.fields.email_failed}}";
                                    break;
                                case "WhatsApp":
                                    activityTitle =
                                        "{{activities.fields.whatsapp_failed}}";
                                    break;
                            }
                        }
                    }

                    titleParams = {
                        contacts: contactDisplay,
                        time: timeDisplay,
                        ...(isAutomatedStep && activity.ActivitiesSequence?.step
                            ? {
                                step: activity.ActivitiesSequence.step.toString(),
                            }
                            : {}),
                    };
                }

                await ACTIVITY_Service.updateActivityTitle(
                    Number(activity.id),
                    activityTitle,
                    Object.keys(titleParams).length > 0 ? titleParams : null
                );
            } catch (activityError: any) {
                const errorMessage = `Error processing activity ${activity.id}: ${activityError.message} `;
                processStats.errors.push(errorMessage);

                // Log to system log (MongoDB) with proper job context
                const correlationId = LogService.getContext();
                await logService.logMessage(
                    LogLevel.ERROR,
                    errorMessage,
                    "activityWorkflowManager.updateActivityTitle",
                    {
                        step: "PHASE1_ACTIVITY_TITLE_UPDATE_ERROR",
                        activity_id: activity.id.toString(),
                        customer_id: activity.customer_id,
                        account_id: activity.Account?.id,
                        error: activityError.message,
                        stack: activityError.stack,
                    },
                    activity.Account?.id,
                    undefined, // userId
                    jobId,
                    correlationId || undefined
                );
            }
        }

        // ========================================
        // BATCH SMS PROCESSING - START
        // ========================================
        if (smsMessages.length > 0) {
            const batchSmsStart = Date.now();

            try {
                // Process SMS messages in batch
                const smsResults = await smsVendorService.sendBatchSMS(
                    smsMessages.map((msg) => ({
                        to: msg.to,
                        from: msg.from,
                        body: msg.body,
                        countryId: msg.countryId,
                        activityId: msg.activityId,
                    }))
                );

                // Verify we received results for all messages
                if (smsResults.length !== smsMessages.length) {
                    // Some SMS results are missing - this is handled by the individual message processing
                }

                // Update activity contacts based on batch results
                for (let i = 0; i < smsResults.length; i++) {
                    const result = smsResults[i];
                    const smsMessage = smsMessages[i];

                    try {
                        if (result.success) {
                            await prisma.activityContact.update({
                                where: { id: smsMessage.activityContactId },
                                data: {
                                    status: "Sent",
                                    sent_at: new Date(),
                                    message_id: result.messageId,
                                    vendor_message_id:
                                        result.vendorMessageId || null, // Store vendor's actual message ID
                                    sms_vendor_id: result.vendorId || null, // Store vendor ID for status tracking
                                },
                            });
                            processStats.smsSent++;
                        } else {
                            const failureReason =
                                result.error || "SMS sending failed";
                            await prisma.activityContact.update({
                                where: { id: smsMessage.activityContactId },
                                data: {
                                    status: "Failed",
                                    failed_at: new Date(),
                                    failure_reason: failureReason,
                                },
                            });
                            processStats.smsFailed++;
                            if (stepCollector) {
                                stepCollector.addStep(
                                    "SMS_FAILED",
                                    failureReason,
                                    "ERROR",
                                    {
                                        activityContactId:
                                            smsMessage.activityContactId,
                                        to: smsMessage.to,
                                        error: failureReason,
                                        vendorId: result.vendorId,
                                    }
                                );
                            }
                        }
                    } catch (updateError: any) {
                        // Silently ignore update errors - activity status update failures are non-critical
                    }
                }

                // Handle any messages that didn't get results (safety check)
                if (smsResults.length < smsMessages.length) {
                    const missingCount = smsMessages.length - smsResults.length;
                    // Mark missing messages as failed
                    for (
                        let i = smsResults.length;
                        i < smsMessages.length;
                        i++
                    ) {
                        const smsMessage = smsMessages[i];
                        const noResultReason =
                            "No result received from batch processing";
                        try {
                            await prisma.activityContact.update({
                                where: { id: smsMessage.activityContactId },
                                data: {
                                    status: "Failed",
                                    failed_at: new Date(),
                                    failure_reason: noResultReason,
                                },
                            });
                            processStats.smsFailed++;
                            if (stepCollector) {
                                stepCollector.addStep(
                                    "SMS_FAILED",
                                    noResultReason,
                                    "ERROR",
                                    {
                                        activityContactId:
                                            smsMessage.activityContactId,
                                        to: smsMessage.to,
                                    }
                                );
                            }
                        } catch (updateError: any) {
                            // Silently ignore update errors - activity status update failures are non-critical
                        }
                    }
                }

                // Update activity status and last_automated_step for activities that had successful batch SMS sends
                // (In the batch path we don't set hasSuccessfulContact in the loop, so step was never updated)
                const activityIdsWithBatchSuccess = new Set<number>();
                for (let i = 0; i < smsResults.length; i++) {
                    if (smsResults[i].success) {
                        activityIdsWithBatchSuccess.add(smsMessages[i].activityId);
                    }
                }
                for (const activityId of Array.from(activityIdsWithBatchSuccess)) {
                    const activity = smsMessages.find(
                        (m) => m.activityId === activityId
                    )?.activity;
                    if (!activity?.collection_period_id || !activity.ActivitiesSequence) {
                        continue;
                    }
                    const totalForActivity = smsMessages.filter(
                        (m) => m.activityId === activityId
                    ).length;
                    const successForActivity = smsMessages.filter(
                        (m, idx) =>
                            m.activityId === activityId && smsResults[idx].success
                    ).length;
                    const allSucceeded =
                        successForActivity === totalForActivity;
                    const finalActivityStatus = allSucceeded
                        ? ActivityStatus.DELIVERED
                        : ActivityStatus.SENT;
                    await prisma.activity.update({
                        where: { id: activityId },
                        data: {
                            status: finalActivityStatus,
                            actual_delivery_time: new Date(),
                            last_sent_time: new Date(),
                        },
                    });

                    if (
                        (finalActivityStatus === ActivityStatus.SENT ||
                            finalActivityStatus === ActivityStatus.DELIVERED) &&
                        activity.ActivitiesSequence?.step_type === "due"
                    ) {
                        await setDueNotificationSentOnInvoices(activity);
                    }

                    // Update activity title to reflect sent/delivered status
                    try {
                        let activityTitle = "";
                        const stepNumber = activity.ActivitiesSequence?.step ?? "";
                        const sequenceCategory = activity.ActivitiesSequence?.category;
                        const contactDisplay = totalForActivity.toString();
                        const timeDisplay = new Date().toISOString();
                        let titleParams: any = {};

                        if (activity.ActivitiesSequence?.step_type === "due") {
                            if (allSucceeded || successForActivity > 0) {
                                activityTitle = "{{activities.fields.activity_due_notification}}";
                            } else {
                                activityTitle = "{{activities.fields.activity_due_notification_failed}}";
                            }

                            const params = (activity.title_params as any) || {};
                            let invoiceCount = params.count;
                            if (!invoiceCount && params.invoiceNumber) {
                                invoiceCount = params.invoiceNumber.split(",").length;
                            }

                            titleParams = {
                                ...params,
                                contacts: contactDisplay,
                                count: invoiceCount || 1,
                            };
                        } else if (
                            sequenceCategory === "Automated" &&
                            !!stepNumber
                        ) {
                            if (allSucceeded) {
                                activityTitle = "{{activities.fields.activity_automated_step_sent}}";
                            } else {
                                activityTitle = "{{activities.fields.activity_automated_step_failed}}";
                            }

                            titleParams = {
                                step: stepNumber.toString(),
                                contacts: contactDisplay,
                                time: timeDisplay,
                            };
                        }

                        if (activityTitle) {
                            await ACTIVITY_Service.updateActivityTitle(
                                Number(activityId),
                                activityTitle,
                                Object.keys(titleParams).length > 0
                                    ? titleParams
                                    : null
                            );
                        }
                    } catch (titleError) {
                        // Ignore title update errors in batch
                    }
                    if (
                        activity.ActivitiesSequence.category === "Automated"
                    ) {
                        await prisma.customerCollectionPeriod.update({
                            where: { id: activity.collection_period_id },
                            data: {
                                last_automated_step:
                                    activity.ActivitiesSequence.step ?? 0,
                            },
                        });
                        if (logCallback) {
                            logCallback(
                                `STEP UPDATED (batch SMS): Collection period ${activity.collection_period_id} - last_automated_step updated to ${activity.ActivitiesSequence.step}`,
                                "INFO",
                                {
                                    collection_period_id:
                                        activity.collection_period_id,
                                    step: activity.ActivitiesSequence.step,
                                    activityId,
                                    reason: "batch_sms_success",
                                }
                            );
                        }
                        await applyDryRunLastStepIfNeeded(activity);
                    }
                }

                const batchSmsDuration = Date.now() - batchSmsStart;
                const successfulSms = smsResults.filter(
                    (r) => r.success
                ).length;
                const failedSms = smsResults.filter((r) => !r.success).length;

                // Enhanced logging for customer-specific execution
                if (logCallback) {
                    logCallback(
                        `Batch SMS processing completed - ${successfulSms} successful, ${failedSms} failed`,
                        "INFO",
                        {
                            step: "BATCH_SMS_COMPLETE",
                            messageCount: smsMessages.length,
                            successfulCount: successfulSms,
                            failedCount: failedSms,
                            duration: batchSmsDuration,
                            averageTimePerMessage: Math.round(
                                batchSmsDuration / smsMessages.length
                            ),
                        }
                    );
                }
            } catch (batchError: any) {
                // Log batch SMS failure to system log
                const correlationId = LogService.getContext();
                const batchErrorMessage = `Batch SMS processing failed, falling back to individual processing: ${batchError.message} `;
                await logService.logMessage(
                    LogLevel.ERROR,
                    batchErrorMessage,
                    "activityWorkflowManager.batchSMSProcessing",
                    {
                        step: "PHASE1_BATCH_SMS_ERROR",
                        sms_messages_count: smsMessages.length,
                        error: batchError.message,
                        stack: batchError.stack,
                    },
                    undefined, // accountId (varies per message)
                    undefined, // userId
                    jobId,
                    correlationId || undefined
                );

                if (stepCollector) {
                    stepCollector.addStep(
                        "SMS_BATCH_ERROR",
                        batchErrorMessage,
                        "ERROR",
                        {
                            sms_messages_count: smsMessages.length,
                            error: batchError.message,
                        }
                    );
                }

                // Fallback to individual SMS processing if batch fails
                let fallbackSuccessful = 0;
                let fallbackFailed = 0;
                const activityIdsWithFallbackSuccess = new Set<number>();

                for (const smsMessage of smsMessages) {
                    try {
                        const individualResult = await smsVendorService.sendSMS(
                            smsMessage.to,
                            smsMessage.from,
                            smsMessage.body,
                            smsMessage.countryId,
                            smsMessage.activityId
                        );

                        if (individualResult.success) {
                            await prisma.activityContact.update({
                                where: { id: smsMessage.activityContactId },
                                data: {
                                    status: "Sent",
                                    sent_at: new Date(),
                                    message_id: individualResult.messageId,
                                    vendor_message_id:
                                        individualResult.vendorMessageId ||
                                        null, // Store vendor's actual message ID
                                    sms_vendor_id:
                                        individualResult.vendorId || null, // Store vendor ID for status tracking
                                },
                            });
                            processStats.smsSent++;
                            fallbackSuccessful++;
                            activityIdsWithFallbackSuccess.add(
                                smsMessage.activityId
                            );
                        } else {
                            const failureReason =
                                individualResult.error ||
                                "SMS sending failed";
                            await prisma.activityContact.update({
                                where: { id: smsMessage.activityContactId },
                                data: {
                                    status: "Failed",
                                    failed_at: new Date(),
                                    failure_reason: failureReason,
                                },
                            });
                            processStats.smsFailed++;
                            fallbackFailed++;
                            if (stepCollector) {
                                stepCollector.addStep(
                                    "SMS_FAILED",
                                    failureReason,
                                    "ERROR",
                                    {
                                        activityContactId:
                                            smsMessage.activityContactId,
                                        to: smsMessage.to,
                                        error: failureReason,
                                        context: "individual_fallback",
                                        vendorId: individualResult.vendorId,
                                    }
                                );
                            }
                        }
                    } catch (individualError: any) {
                        const failureReason =
                            individualError.message || "SMS sending failed";
                        try {
                            await prisma.activityContact.update({
                                where: { id: smsMessage.activityContactId },
                                data: {
                                    status: "Failed",
                                    failed_at: new Date(),
                                    failure_reason: failureReason,
                                },
                            });
                            processStats.smsFailed++;
                            fallbackFailed++;

                            if (stepCollector) {
                                stepCollector.addStep(
                                    "SMS_FAILED",
                                    failureReason,
                                    "ERROR",
                                    {
                                        activityContactId:
                                            smsMessage.activityContactId,
                                        to: smsMessage.to,
                                        error: failureReason,
                                        context: "individual_fallback",
                                    }
                                );
                            }

                            // Log to system log (MongoDB) with proper job context
                            const correlationId = LogService.getContext();
                            const errorMessage = `Individual SMS fallback failed for activity contact ${smsMessage.activityContactId}: ${individualError.message} `;
                            await logService.logMessage(
                                LogLevel.ERROR,
                                errorMessage,
                                "activityWorkflowManager.individualSMSFallback",
                                {
                                    step: "PHASE1_INDIVIDUAL_SMS_FALLBACK_ERROR",
                                    activity_id:
                                        smsMessage.activityId.toString(),
                                    activity_contact_id:
                                        smsMessage.activityContactId,
                                    account_id: smsMessage.accountId,
                                    error: individualError.message,
                                    stack: individualError.stack,
                                },
                                smsMessage.accountId,
                                undefined, // userId
                                jobId,
                                correlationId || undefined
                            );
                        } catch (updateError: any) {
                            // Silently ignore update errors - activity status update failures are non-critical
                        }
                    }
                }

                // Update activity status and last_automated_step for activities that had successful individual fallback sends
                for (const activityId of Array.from(activityIdsWithFallbackSuccess)) {
                    const activity = smsMessages.find(
                        (m) => m.activityId === activityId
                    )?.activity;
                    if (!activity?.collection_period_id || !activity.ActivitiesSequence) {
                        continue;
                    }
                    const totalForActivity = smsMessages.filter(
                        (m) => m.activityId === activityId
                    ).length;
                    const allSucceeded = totalForActivity === 1;
                    const finalActivityStatus = allSucceeded
                        ? ActivityStatus.DELIVERED
                        : ActivityStatus.SENT;
                    await prisma.activity.update({
                        where: { id: activityId },
                        data: {
                            status: finalActivityStatus,
                            actual_delivery_time: new Date(),
                            last_sent_time: new Date(),
                        },
                    });

                    if (
                        (finalActivityStatus === ActivityStatus.SENT ||
                            finalActivityStatus === ActivityStatus.DELIVERED) &&
                        activity.ActivitiesSequence?.step_type === "due"
                    ) {
                        await setDueNotificationSentOnInvoices(activity);
                    }

                    // Update activity title to reflect sent/delivered status
                    try {
                        let activityTitle = "";
                        const stepNumber = activity.ActivitiesSequence?.step ?? "";
                        const sequenceCategory = activity.ActivitiesSequence?.category;
                        const contactDisplay = totalForActivity.toString();
                        const timeDisplay = new Date().toISOString();
                        let titleParams: any = {};

                        if (activity.ActivitiesSequence?.step_type === "due") {
                            if (allSucceeded) {
                                activityTitle = "{{activities.fields.activity_due_notification}}";
                            } else {
                                activityTitle = "{{activities.fields.activity_due_notification_failed}}";
                            }

                            const params = (activity.title_params as any) || {};
                            let invoiceCount = params.count;
                            if (!invoiceCount && params.invoiceNumber) {
                                invoiceCount = params.invoiceNumber.split(",").length;
                            }

                            titleParams = {
                                ...params,
                                contacts: contactDisplay,
                                count: invoiceCount || 1,
                            };
                        } else if (
                            sequenceCategory === "Automated" &&
                            !!stepNumber
                        ) {
                            if (allSucceeded) {
                                activityTitle = "{{activities.fields.activity_automated_step_sent}}";
                            } else {
                                activityTitle = "{{activities.fields.activity_automated_step_failed}}";
                            }

                            titleParams = {
                                step: stepNumber.toString(),
                                contacts: contactDisplay,
                                time: timeDisplay,
                            };
                        }

                        if (activityTitle) {
                            await ACTIVITY_Service.updateActivityTitle(
                                Number(activityId),
                                activityTitle,
                                Object.keys(titleParams).length > 0
                                    ? titleParams
                                    : null
                            );
                        }
                    } catch (titleError) {
                        // Ignore title update errors in batch
                    }
                    if (
                        activity.ActivitiesSequence.category === "Automated"
                    ) {
                        await prisma.customerCollectionPeriod.update({
                            where: { id: activity.collection_period_id },
                            data: {
                                last_automated_step:
                                    activity.ActivitiesSequence.step ?? 0,
                            },
                        });
                        if (logCallback) {
                            logCallback(
                                `STEP UPDATED (individual fallback): Collection period ${activity.collection_period_id} - last_automated_step updated to ${activity.ActivitiesSequence.step}`,
                                "INFO",
                                {
                                    collection_period_id:
                                        activity.collection_period_id,
                                    step: activity.ActivitiesSequence.step,
                                    activityId,
                                    reason: "individual_fallback_success",
                                }
                            );
                        }
                        await applyDryRunLastStepIfNeeded(activity);
                    }
                }

                // Log fallback completion
            }
        }

        // ========================================
        // SMS PROCESSING VERIFICATION - START
        // ========================================
        if (smsMessages.length > 0) {
            // Verify all SMS messages have been processed and logged
            const processedActivityContactIds = smsMessages.map(
                (msg) => msg.activityContactId
            );

            try {
                const verificationResults =
                    await prisma.activityContact.findMany({
                        where: {
                            id: { in: processedActivityContactIds },
                        },
                        select: {
                            id: true,
                            status: true,
                            sent_at: true,
                            failed_at: true,
                            message_id: true,
                            vendor_message_id: true,
                            failure_reason: true,
                        },
                    });

                const sentCount = verificationResults.filter(
                    (r) => r.status === "Sent"
                ).length;
                const failedCount = verificationResults.filter(
                    (r) => r.status === "Failed"
                ).length;
                const pendingCount = verificationResults.filter(
                    (r) => r.status === "Scheduled"
                ).length;

                // Enhanced logging for customer-specific execution
                if (logCallback) {
                    logCallback(
                        `SMS verification completed - ${sentCount} sent, ${failedCount} failed, ${pendingCount} pending`,
                        "INFO",
                        {
                            step: "SMS_VERIFICATION_COMPLETE",
                            totalProcessed: smsMessages.length,
                            sentCount: sentCount,
                            failedCount: failedCount,
                            pendingCount: pendingCount,
                        }
                    );
                }

                // Alert if any messages are still pending
                if (pendingCount > 0) {
                    // Pending messages detected - this is logged elsewhere in the process
                }
            } catch (verificationError: any) {
                // Silently ignore verification errors - SMS verification failures are non-critical
            }
        }
        // ========================================
        // SMS PROCESSING VERIFICATION - END
        // ========================================

        // ========================================
        // BATCH SMS PROCESSING - END
        // ========================================

        const phase2Duration = Date.now() - phase2Start;
        processStats.phase2Duration = phase2Duration;

        // Add summary for activities with no contacts
        if (activitiesWithNoContacts > 0 && stepCollector) {
            stepCollector.addStep(
                "ACTIVITIES_NO_CONTACTS_SUMMARY",
                `${activitiesWithNoContacts} activities skipped due to no contacts found`,
                "WARNING",
                {
                    activitiesWithNoContacts: activitiesWithNoContacts,
                    totalActivitiesFound: processStats.totalActivitiesFound,
                    percentage: Math.round(
                        (activitiesWithNoContacts /
                            processStats.totalActivitiesFound) *
                        100
                    ),
                }
            );
        }

        // Note: Category reversion for periods with no sequences is handled in Phase 2 (Generate Activities)

        // Add phase completion message to step collector
        if (stepCollector) {
            stepCollector.addStep(
                "PHASE1_COMPLETE",
                "Phase 1 completed: Activity Sending",
                "INFO",
                {
                    phase2Stats: {
                        totalActivitiesFound: processStats.totalActivitiesFound,
                        activitiesWithContacts:
                            processStats.activitiesWithContacts,
                        activitiesWithNoContacts: activitiesWithNoContacts,
                        emailsSent: processStats.emailsSent,
                        emailsFailed: processStats.emailsFailed,
                        emailsDeferred: processStats.emailsDeferred,
                        smsSent: processStats.smsSent,
                        smsFailed: processStats.smsFailed,
                        activitiesCompleted: processStats.activitiesCompleted,
                        duration: phase2Duration,
                    },
                }
            );
        }
        // ========================================
        // PHASE 1: Send Activities - END
        // ========================================

        // ========================================
        // PHASE 2: Generate Activities - START
        // ========================================
        {
            // Open Phase 1 block
            const phase1Start = Date.now();
            // Add Phase 2 start message to step collector
            if (stepCollector) {
                stepCollector.addStep(
                    "PHASE2_START",
                    "Starting Phase 2: Activity Generation",
                    "INFO",
                    {
                        phase: "Activity Generation",
                    }
                );
            }
            if (logCallback) {
                logCallback("Starting Phase 2: Activity Generation", "INFO", {
                    processName: "activityWorkflowManager",
                    startTime: startTime.toISOString(),
                    jobId,
                    customerId: customerId || "ALL",
                    step: "PHASE2_START",
                    stepNumber: 4,
                });
            }

            // Step 1: Get all collection periods that need activity generation (OPTIMIZED)
            const getCollectionPeriodsStart = Date.now();
            const whereClause = {
                period_end_date: null,
                create_next_activity: true,
                current_category: "Automated" as const,
                Customer: excludeCreditOnlyCustomerWhere({
                    automation_stuck_no_contacts: { not: true },
                }), // Skip customers that are stuck due to no contacts
                ...(customerId && { customer_id: customerId }),
            };

            // Log query parameters for customer-specific execution
            if (logCallback) {
                logCallback(
                    "Querying collection periods for activity generation",
                    "INFO",
                    {
                        customer_id: customerId,
                        period_end_date: null,
                        create_next_activity: true,
                        current_category: "Automated",
                        has_customer_filter: !!customerId,
                    }
                );
            }

            // OPTIMIZATION: Simplified query - only fetch essential data
            const collectionPeriods =
                await prisma.customerCollectionPeriod.findMany({
                    where: whereClause,
                    select: {
                        id: true,
                        customer_id: true,
                        last_automated_step: true,
                        create_next_activity: true,
                        period_start_date: true,
                        period_end_date: true,
                        current_category: true,
                        previous_category: true,
                        Customer: {
                            select: {
                                account_id: true,
                                type: true,
                                email: true,
                                customer_uuid: true,
                                language: true,
                                sequence_container_id: true,
                                Person: {
                                    select: {
                                        mobile: true,
                                        first_name: true,
                                    },
                                },
                                Company: {
                                    select: {
                                        name: true,
                                        Contact: {
                                            select: {
                                                id: true,
                                                email: true,
                                                mobile: true,
                                                status: true,
                                                first_name: true,
                                                company_wide_address: true,
                                                receives_standard_reminder: true,
                                                receives_escalated_reminder: true,
                                            },
                                        },
                                    },
                                },
                                // Note: Account removed from Customer select since Customer doesn't have Account relation
                                // Account will be fetched separately using customer.account_id if needed
                                Country: {
                                    select: {
                                        id: true,
                                        iso2: true,
                                    },
                                },
                                State: {
                                    select: {
                                        iso2: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: {
                        id: "asc",
                    },
                });

            processStats.totalCollectionPeriods = collectionPeriods.length;
            const getCollectionPeriodsDuration =
                Date.now() - getCollectionPeriodsStart;

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
                            last_automated_step: true,
                            period_start_date: true,
                            is_last_automated_step_delivered: true,
                            Customer: {
                                select: { automation_stuck_no_contacts: true },
                            },
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

                    // Analyze why periods don't match the query criteria
                    const analysis = {
                        totalPeriods: allPeriodsForCustomer.length,
                        periodsWithPeriodEndDate: allPeriodsForCustomer.filter(
                            (p) => p.period_end_date !== null
                        ).length,
                        periodsWithCreateNextActivityTrue:
                            allPeriodsForCustomer.filter(
                                (p) => p.create_next_activity === true
                            ).length,
                        periodsWithAutomatedCategory:
                            allPeriodsForCustomer.filter(
                                (p) => p.current_category === "Automated"
                            ).length,
                        periodsNotStuck: allPeriodsForCustomer.filter(
                            (p) => p.Customer?.automation_stuck_no_contacts !== true
                        ).length,
                        periodsMatchingAllCriteria:
                            allPeriodsForCustomer.filter(
                                (p) =>
                                    p.period_end_date === null &&
                                    p.create_next_activity === true &&
                                    p.current_category === "Automated" &&
                                    p.Customer?.automation_stuck_no_contacts !== true
                            ).length,
                        periodDetails: allPeriodsForCustomer.map((p) => {
                            const latestActivity = latestActivityByPeriod.get(
                                p.id
                            );
                            return {
                                id:
                                    typeof p.id === "bigint"
                                        ? (p.id as bigint).toString()
                                        : (p.id as number),
                                period_end_date:
                                    p.period_end_date?.toISOString() || null,
                                create_next_activity: p.create_next_activity,
                                current_category: p.current_category,
                                automation_stuck_no_contacts:
                                    p.Customer?.automation_stuck_no_contacts ?? false,
                                last_automated_step: p.last_automated_step,
                                is_last_automated_step_delivered:
                                    p.is_last_automated_step_delivered,
                                period_start_date:
                                    p.period_start_date?.toISOString() || null,
                                latestActivity: latestActivity
                                    ? {
                                        id:
                                            typeof latestActivity.id ===
                                                "bigint"
                                                ? latestActivity.id.toString()
                                                : latestActivity.id,
                                        status: latestActivity.status,
                                        step: latestActivity
                                            .ActivitiesSequence?.step,
                                        created_at:
                                            latestActivity.created_at?.toISOString(),
                                    }
                                    : null,
                                matchesCriteria:
                                    p.period_end_date === null &&
                                    p.create_next_activity === true &&
                                    p.current_category === "Automated" &&
                                    p.Customer?.automation_stuck_no_contacts !== true,
                                // Check if processAutomatedCollectionPeriods would set create_next_activity to true
                                eligibleForProcessAutomatedCollectionPeriods:
                                    p.create_next_activity === false &&
                                    p.is_last_automated_step_delivered ===
                                    false &&
                                    p.period_end_date === null &&
                                    p.current_category === "Automated" &&
                                    (!latestActivity ||
                                        latestActivity.status === "DELIVERED" ||
                                        latestActivity.status === "CANCELLED"),
                            };
                        }),
                    };

                    // Helper function to convert BigInt values to strings recursively
                    const serializeBigInt = (obj: any): any => {
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
                    };

                    // Serialize the analysis object to handle BigInt values
                    const serializedAnalysis = serializeBigInt(analysis);

                    // Log to step collector (primary logging mechanism)
                    if (stepCollector) {
                        stepCollector.addStep(
                            "PHASE2_COLLECTION_PERIOD_ANALYSIS",
                            `Collection period analysis for customer ${customerId}`,
                            "INFO",
                            {
                                customer_id: customerId,
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
                            }
                        );
                    }
                }
            }

            if (collectionPeriods.length === 0) {
                // Check what collection periods exist that don't match
                const allPeriods =
                    await prisma.customerCollectionPeriod.findMany({
                        where: {
                            ...(customerId && { customer_id: customerId }),
                            period_end_date: null,
                            current_category: "Automated",
                        },
                        select: {
                            id: true,
                            create_next_activity: true,
                            current_category: true,
                            last_automated_step: true,
                            previous_category: true,
                        },
                    });
            }

            // Add collection periods found message to step collector
            if (stepCollector) {
                stepCollector.addStep(
                    "COLLECTION_PERIODS_FOUND",
                    `Found ${collectionPeriods.length} collection periods for activity generation`,
                    "INFO",
                    {
                        collectionPeriodsCount: collectionPeriods.length,
                        duration: getCollectionPeriodsDuration,
                    }
                );
            }
            // Enhanced logging for customer-specific execution
            if (logCallback) {
                logCallback(
                    `Found ${collectionPeriods.length} collection periods for activity generation`,
                    "INFO",
                    {
                        step: "PHASE2_COLLECTION_PERIODS_FOUND",
                        stepNumber: 5,
                        collectionPeriodsCount: collectionPeriods.length,
                        collectionPeriods: collectionPeriods.map((cp) => ({
                            id: cp.id,
                            customer_id: cp.customer_id,
                            current_category: cp.current_category,
                            create_next_activity: cp.create_next_activity,
                            last_automated_step: cp.last_automated_step,
                            period_end_date: cp.period_end_date,
                        })),
                    }
                );
            }

            // OPTIMIZATION: Pre-fetch all required data in bulk
            const accountIds = Array.from(
                new Set(
                    collectionPeriods.map(
                        (cp) => (cp as any).Customer.account_id
                    )
                )
            );
            // Batch fetch default sequence containers FIRST
            const defaultSequenceContainers =
                await prisma.sequenceContainer.findMany({
                    where: {
                        account_id: { in: accountIds },
                        category: "Automated",
                        is_default: true,
                        active: true,
                    },
                    select: {
                        id: true,
                        account_id: true,
                    },
                });

            // Group default containers by account_id
            const defaultContainersByAccount = new Map<number, number>();
            if (
                defaultSequenceContainers &&
                defaultSequenceContainers.length > 0
            ) {
                defaultSequenceContainers.forEach((container) => {
                    defaultContainersByAccount.set(
                        container.account_id,
                        container.id
                    );
                });
            }

            // Collect sequence container IDs from customers AND default containers
            const sequenceContainerIds = Array.from(
                new Set([
                    ...collectionPeriods
                        .map((cp) => (cp as any).Customer.sequence_container_id)
                        .filter((id): id is number => id !== null),
                    ...Array.from(defaultContainersByAccount.values()),
                ])
            );

            // Batch fetch activity sequences for all customers
            const activitySequences = await prisma.activitiesSequence.findMany({
                where: {
                    account_id: { in: accountIds },
                    category: "Automated",
                    active: true,
                    AND: [
                        {
                            OR: [
                                { step_type: null },
                                { step_type: "overdue" },
                            ],
                        },
                        {
                            OR: [
                                {
                                    sequence_container_id: {
                                        in: sequenceContainerIds,
                                    },
                                },
                                { sequence_container_id: null },
                            ],
                        },
                    ],
                },
                include: {
                    ActivitiesTemplate: {
                        include: {
                            ActivityTemplateLanguage: true,
                        },
                    },
                },
                orderBy: {
                    step: "asc",
                },
            });

            // Group sequences by account_id and sequence_container_id for efficient lookup
            const sequencesByAccount = new Map<string, any[]>();
            if (activitySequences && activitySequences.length > 0) {
                activitySequences.forEach((seq) => {
                    const key = `${seq.account_id}_${seq.sequence_container_id || "default"}`;
                    if (!sequencesByAccount.has(key)) {
                        sequencesByAccount.set(key, []);
                    }
                    sequencesByAccount.get(key)!.push(seq);
                });
            }

            // OPTIMIZATION: Batch fetch existing activities to check for conflicts
            const collectionPeriodIds = collectionPeriods.map((cp) => cp.id);
            const currentTime = new Date();
            // Check for both scheduled activities (past, present, and future) AND any activities for automated sequences
            // This prevents creating duplicate steps even if previous activities were already sent/delivered
            // CRITICAL FIX: Include ALL non-cancelled automated activities to prevent any duplicates
            // ENHANCED: Comprehensive check for all automated activities regardless of status
            const existingActivities = await prisma.activity.findMany({
                where: {
                    collection_period_id: { in: collectionPeriodIds },
                    OR: [
                        {
                            // Standard automated activities (Email/SMS)
                            type: { in: ["Email", "SMS"] },
                            OR: [
                                // ALL scheduled activities - catches activities that haven't been sent yet
                                {
                                    status: ActivityStatus.SCHEDULED,
                                },
                                // SENT activities - catches activities that were just sent
                                {
                                    status: ActivityStatus.SENT,
                                },
                                // DELIVERED activities - catches activities that were completed
                                {
                                    status: ActivityStatus.DELIVERED,
                                },
                                // Any automated sequence activities (prevents duplicate steps) - most comprehensive
                                {
                                    ActivitiesSequence: {
                                        category: "Automated",
                                    },
                                    status: {
                                        not: ActivityStatus.CANCELLED, // Exclude only cancelled activities
                                    },
                                },
                            ],
                        },
                        {
                            // Category change logs - Critical for manual reset logic (Agent -> Automated)
                            type: "Internal",
                            title: "{{activities.fields.category_change}}",
                        },
                    ],
                },
                select: {
                    id: true,
                    collection_period_id: true,
                    type: true,
                    status: true,
                    schedule_time: true,

                    created_at: true, // Needed for date comparison
                    title: true, // Needed for identifying category changes
                    title_params: true, // Needed for identifying reset details
                    activity_sequence_id: true, // CRITICAL: Include this for duplicate checking
                    ActivitiesSequence: {
                        select: {
                            step: true,
                            category: true,
                        },
                    },
                },
            });

            // Group existing activities by collection_period_id
            const existingActivitiesByPeriod = new Map<number, any[]>();
            if (existingActivities && existingActivities.length > 0) {
                existingActivities.forEach((activity) => {
                    const periodId = activity.collection_period_id;
                    if (!periodId) return; // Skip if no collection_period_id

                    if (!existingActivitiesByPeriod.has(periodId)) {
                        existingActivitiesByPeriod.set(periodId, []);
                    }
                    existingActivitiesByPeriod.get(periodId)!.push(activity);
                });
            }

            // OPTIMIZATION: Process collection periods in batches
            const BATCH_SIZE = 10; // Reduced from 50 to prevent connection exhaustion
            const CONCURRENCY_LIMIT = 5; // Max 5 concurrent operations per batch
            const TIMEOUT_MS = 25 * 60 * 1000; // 25 minutes (5 min buffer)
            const batchStartTime = Date.now();

            // Arrays to collect updates for bulk operations
            const collectionPeriodUpdates: Array<{ id: number; data: any }> =
                [];
            const activitiesToCreate: any[] = [];
            const customerDetailsForCalculation = new Map<number, any>();
            const periodsToRevert: Array<{
                id: number;
                customerId: number;
                accountId: number;
                reason: string;
            }> = [];

            for (let i = 0; i < collectionPeriods.length; i += BATCH_SIZE) {
                // Check timeout before each batch
                if (Date.now() - batchStartTime > TIMEOUT_MS) {
                    if (logCallback) {
                        logCallback(
                            "Job timeout approaching - stopping processing",
                            "WARNING",
                            {
                                processedCount: i,
                                totalCount: collectionPeriods.length,
                                elapsedTime: Date.now() - batchStartTime,
                            }
                        );
                    }
                    break;
                }

                const batch = collectionPeriods.slice(i, i + BATCH_SIZE);

                // Process batch with concurrency limit to prevent connection exhaustion
                await processWithConcurrencyLimit(
                    batch,
                    CONCURRENCY_LIMIT,
                    async (collectionPeriod) => {
                        try {
                            return await processCollectionPeriod(
                                collectionPeriod,
                                sequencesByAccount,
                                defaultContainersByAccount,
                                existingActivitiesByPeriod,
                                collectionPeriodUpdates,
                                activitiesToCreate,
                                customerDetailsForCalculation,
                                processStats,
                                logCallback,
                                ACTIVITY_Service,
                                customerService,
                                periodsToRevert
                            );
                        } catch (error: any) {
                            const errorMessage = `Error processing collection period ${collectionPeriod.id}: ${error.message || error.toString()} `;
                            processStats.errors.push(errorMessage);

                            // Log to system log (MongoDB) with proper job context
                            const correlationId = LogService.getContext();
                            await logService.logMessage(
                                LogLevel.ERROR,
                                errorMessage,
                                "activityWorkflowManager.processCollectionPeriod",
                                {
                                    step: "PHASE2_COLLECTION_PERIOD_PROCESSING_ERROR",
                                    collection_period_id: collectionPeriod.id,
                                    customer_id: collectionPeriod.customer_id,
                                    account_id:
                                        collectionPeriod.Customer?.account_id,
                                    error: error.message || error.toString(),
                                    stack:
                                        error instanceof Error
                                            ? error.stack
                                            : undefined,
                                },
                                collectionPeriod.Customer?.account_id,
                                undefined, // userId
                                jobId,
                                correlationId || undefined
                            );

                            // Set create_next_activity to false to prevent infinite retry loops
                            collectionPeriodUpdates.push({
                                id: collectionPeriod.id,
                                data: { create_next_activity: false },
                            });
                        }
                    }
                );

                // Log progress every batch
                if (logCallback) {
                    logCallback(
                        `Processed batch ${Math.floor(i / BATCH_SIZE) + 1} /${Math.ceil(
                            collectionPeriods.length / BATCH_SIZE
                        )} `,
                        "INFO",
                        {
                            processedCount: i + batch.length,
                            totalCount: collectionPeriods.length,
                            batchSize: batch.length,
                        }
                    );
                }

                // Increase delay between batches to allow connections to be released
                if (i + BATCH_SIZE < collectionPeriods.length) {
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }
            }

            // OPTIMIZATION: Execute bulk updates
            if (collectionPeriodUpdates.length > 0) {
                const updateGroups = new Map<
                    string,
                    { data: any; ids: number[] }
                >();

                collectionPeriodUpdates.forEach((update) => {
                    const dataKey = JSON.stringify(update.data);
                    if (!updateGroups.has(dataKey)) {
                        updateGroups.set(dataKey, {
                            data: update.data,
                            ids: [],
                        });
                    }
                    updateGroups.get(dataKey)!.ids.push(update.id);
                });

                // Execute grouped updates in smaller batches to prevent connection exhaustion
                const UPDATE_BATCH_SIZE = 5; // Process max 5 updates concurrently
                const updateGroupsArray = Array.from(updateGroups.values());
                const updateResults: PromiseSettledResult<any>[] = [];

                for (
                    let i = 0;
                    i < updateGroupsArray.length;
                    i += UPDATE_BATCH_SIZE
                ) {
                    const batch = updateGroupsArray.slice(
                        i,
                        i + UPDATE_BATCH_SIZE
                    );
                    const batchResults = await Promise.allSettled(
                        batch.map(async ({ data, ids }) => {
                            if (ids.length === 1) {
                                return await prisma.customerCollectionPeriod.update(
                                    {
                                        where: { id: ids[0] },
                                        data,
                                    }
                                );
                            } else {
                                return await prisma.customerCollectionPeriod.updateMany(
                                    {
                                        where: { id: { in: ids } },
                                        data,
                                    }
                                );
                            }
                        })
                    );
                    updateResults.push(...batchResults);

                    // Small delay between update batches
                    if (i + UPDATE_BATCH_SIZE < updateGroupsArray.length) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, 200)
                        );
                    }
                }

                const successfulUpdates = updateResults.filter(
                    (result) => result.status === "fulfilled"
                );
                processStats.collectionPeriodsUpdated +=
                    successfulUpdates.length;
            }

            // OPTIMIZATION: Calculate next activity times in bulk
            if (customerDetailsForCalculation.size > 0) {
                // Log input to calculation
                const customerDetailsArray = Array.from(
                    customerDetailsForCalculation.entries()
                ).map(([id, details]) => ({
                    customer_id: id,
                    account_id: details.account_id,
                    last_automated_step: details.last_automated_step,
                    expected_next_step: details.last_automated_step + 1,
                    period_start_date: details.period_start_date?.toISOString(),
                }));

                if (stepCollector) {
                    stepCollector.addStep(
                        "PHASE2_CALCULATE_TIMES",
                        `Calculating next activity times for ${customerDetailsForCalculation.size} customers`,
                        "INFO",
                        {
                            customersCount: customerDetailsForCalculation.size,
                            customerDetails: customerDetailsArray,
                        }
                    );
                }

                if (logCallback) {
                    logCallback("Calculating next activity times", "INFO", {
                        step: "PHASE2_CALCULATE_TIMES",
                        customersCount: customerDetailsForCalculation.size,
                        customerDetails: customerDetailsArray,
                    });
                }

                const calculatedTimes =
                    await customerService.calculateNextAutomatedActivityTime(
                        customerDetailsForCalculation
                    );

                // Log calculation results
                const missingCustomerIds = Array.from(
                    customerDetailsForCalculation.keys()
                ).filter((id) => !calculatedTimes.has(id));

                if (stepCollector) {
                    stepCollector.addStep(
                        "PHASE2_CALCULATED_TIMES_RECEIVED",
                        `Received calculated times: ${calculatedTimes.size} of ${customerDetailsForCalculation.size} customers`,
                        missingCustomerIds.length > 0 ? "WARNING" : "INFO",
                        {
                            calculatedTimesCount: calculatedTimes.size,
                            expectedCount: customerDetailsForCalculation.size,
                            calculatedCustomerIds: Array.from(
                                calculatedTimes.keys()
                            ),
                            expectedCustomerIds: Array.from(
                                customerDetailsForCalculation.keys()
                            ),
                            missingCustomerIds: missingCustomerIds,
                        }
                    );
                }

                if (logCallback) {
                    logCallback("Received calculated times", "INFO", {
                        step: "PHASE2_CALCULATED_TIMES_RECEIVED",
                        calculatedTimesCount: calculatedTimes.size,
                        calculatedCustomerIds: Array.from(
                            calculatedTimes.keys()
                        ),
                        expectedCustomerIds: Array.from(
                            customerDetailsForCalculation.keys()
                        ),
                        missingCustomerIds: missingCustomerIds,
                    });
                }

                // Create activities with calculated times
                for (const activityData of activitiesToCreate) {
                    const calculatedTime = calculatedTimes.get(
                        activityData.customerId
                    );

                    if (calculatedTime) {
                        activityData.scheduledTime =
                            calculatedTime.schedule_time;
                        activityData.calculation =
                            calculatedTime.schedule_calculation;

                        // CRITICAL FIX: Double-check database right before creation to prevent race conditions
                        // This handles cases where the same activity was created by another process/job between
                        // the initial query and this creation loop
                        // NOTE: For manual resets (Agent/Promise_to_pay/Dispute -> Automated), we allow creating activities even if old ones exist
                        // CRITICAL: Check ONLY previous_category, not last_automated_step, because after step 1 is sent,
                        // last_automated_step becomes 1, but we still need to ignore old activities from previous lifecycle
                        const isManualReset =
                            activityData.collectionPeriod.previous_category ===
                            "Agent" ||
                            activityData.collectionPeriod.previous_category ===
                            "Promise_to_pay" ||
                            activityData.collectionPeriod.previous_category ===
                            "Dispute";

                        // CRITICAL FIX: Check for existing activities more comprehensively
                        // Check by both activity_sequence_id AND step to catch duplicates more reliably
                        // ENHANCED: Check for SCHEDULED, SENT, and DELIVERED statuses to prevent duplicates
                        // But allow old DELIVERED activities (from before Dispute/PTP) to be replaced
                        // CRITICAL: For manual resets, ONLY check SCHEDULED/SENT activities (current cycle)
                        // ENHANCED: Check for existing activities more carefully
                        // Define early to use in query
                        const isResumeFromDisputeOrPTP =
                            (activityData.collectionPeriod.previous_category ===
                                "Dispute" ||
                                activityData.collectionPeriod
                                    .previous_category === "Promise_to_pay") &&
                            activityData.collectionPeriod.current_category ===
                            "Automated";

                        const existingActivityCheck =
                            await prisma.activity.findFirst({
                                where: {
                                    collection_period_id:
                                        activityData.collectionPeriod.id,
                                    OR: [
                                        // Check by activity_sequence_id (most specific)
                                        {
                                            activity_sequence_id:
                                                activityData.sequence.id,
                                        },
                                        // Also check by step number and category (backup check)
                                        {
                                            ActivitiesSequence: {
                                                step: activityData.sequence
                                                    .step,
                                                category: "Automated",
                                            },
                                        },
                                    ],
                                    status: {
                                        in:
                                            isManualReset ||
                                                isResumeFromDisputeOrPTP
                                                ? [
                                                    // For manual resets OR dispute/PTP resume: Only check SCHEDULED/SENT (current cycle)
                                                    // Ignore DELIVERED (old cycle)
                                                    ActivityStatus.SCHEDULED,
                                                    ActivityStatus.SENT,
                                                ]
                                                : [
                                                    // Normal case: Check all statuses
                                                    ActivityStatus.SCHEDULED,
                                                    ActivityStatus.SENT,
                                                    ActivityStatus.DELIVERED,
                                                ],
                                    },
                                },
                                select: {
                                    id: true,
                                    status: true,
                                    created_at: true,
                                    activity_sequence_id: true,
                                    ActivitiesSequence: {
                                        select: {
                                            step: true,
                                            category: true,
                                        },
                                    },
                                },
                            });

                        if (existingActivityCheck) {
                            const activityAge =
                                Date.now() -
                                new Date(
                                    existingActivityCheck.created_at
                                ).getTime();
                            const fiveMinutesAgo = 5 * 60 * 1000; // 5 minutes in milliseconds
                            const isRecentActivity =
                                activityAge < fiveMinutesAgo;

                            // Check if this is a resume from Dispute/PTP (should preserve step, but allow creating if old activity exists)
                            const isResumeFromDisputeOrPTP =
                                (activityData.collectionPeriod
                                    .previous_category === "Dispute" ||
                                    activityData.collectionPeriod
                                        .previous_category ===
                                    "Promise_to_pay") &&
                                activityData.collectionPeriod
                                    .current_category === "Automated";

                            // For manual resets (Agent -> Automated), only skip if the activity was created very recently
                            // This indicates it's a duplicate from the current run, not an old activity from previous lifecycle
                            if (isManualReset) {
                                if (isRecentActivity) {
                                    // Activity was created very recently, likely a duplicate from current run
                                    processStats.skippedDueToExistingActivities++;
                                    if (logCallback) {
                                        logCallback(
                                            `Skipping activity creation for manually reset collection period ${activityData.collectionPeriod.id}, step ${activityData.sequence.step} - recent duplicate activity exists(id: ${existingActivityCheck.id}, created ${Math.round(activityAge / 1000)}s ago)`,
                                            "INFO",
                                            {
                                                step: "PHASE2_DUPLICATE_PREVENTION",
                                                collection_period_id:
                                                    activityData
                                                        .collectionPeriod.id,
                                                sequence_step:
                                                    activityData.sequence.step,
                                                existing_activity_id:
                                                    existingActivityCheck.id.toString(),
                                                existing_activity_status:
                                                    existingActivityCheck.status,
                                                activity_age_seconds:
                                                    Math.round(
                                                        activityAge / 1000
                                                    ),
                                                reason: "recent_duplicate_in_manual_reset",
                                                isManualReset: true,
                                            }
                                        );
                                    }
                                    continue; // Skip to next activity
                                } else {
                                    // Old activity from previous lifecycle, allow creating new one
                                    if (logCallback) {
                                        logCallback(
                                            `Allowing activity creation for manually reset collection period ${activityData.collectionPeriod.id}, step ${activityData.sequence.step} - existing activity is old(${Math.round(activityAge / 1000 / 60)} minutes old), will create new one`,
                                            "INFO",
                                            {
                                                step: "PHASE2_MANUAL_RESET_ALLOWED",
                                                collection_period_id:
                                                    activityData
                                                        .collectionPeriod.id,
                                                sequence_step:
                                                    activityData.sequence.step,
                                                existing_activity_id:
                                                    existingActivityCheck.id.toString(),
                                                activity_age_minutes:
                                                    Math.round(
                                                        activityAge / 1000 / 60
                                                    ),
                                                reason: "manual_reset_old_activity",
                                                isManualReset: true,
                                            }
                                        );
                                    }
                                    // Continue to create the activity
                                }
                            } else if (isResumeFromDisputeOrPTP) {
                                // When resuming from Dispute/PTP, allow creating if:
                                // 1. The existing activity is old (from before Dispute/PTP was created), OR
                                // 2. The existing activity is DELIVERED (completed step, can resume to next)
                                // But skip if it's a recent SCHEDULED or SENT activity (likely duplicate)
                                if (
                                    isRecentActivity &&
                                    (existingActivityCheck.status ===
                                        ActivityStatus.SCHEDULED ||
                                        existingActivityCheck.status ===
                                        ActivityStatus.SENT)
                                ) {
                                    // Recent scheduled/sent activity, likely a duplicate
                                    processStats.skippedDueToExistingActivities++;
                                    if (logCallback) {
                                        logCallback(
                                            `Skipping activity creation for collection period ${activityData.collectionPeriod.id}, step ${activityData.sequence.step} - recent duplicate activity exists(id: ${existingActivityCheck.id}, status: ${existingActivityCheck.status}, created ${Math.round(activityAge / 1000)}s ago)`,
                                            "INFO",
                                            {
                                                step: "PHASE2_DUPLICATE_PREVENTION",
                                                collection_period_id:
                                                    activityData
                                                        .collectionPeriod.id,
                                                sequence_step:
                                                    activityData.sequence.step,
                                                existing_activity_id:
                                                    existingActivityCheck.id.toString(),
                                                existing_activity_status:
                                                    existingActivityCheck.status,
                                                activity_age_seconds:
                                                    Math.round(
                                                        activityAge / 1000
                                                    ),
                                                reason: "recent_duplicate_in_resume",
                                                isResumeFromDisputeOrPTP: true,
                                            }
                                        );
                                    }
                                    continue; // Skip to next activity
                                } else {
                                    // Old activity or DELIVERED activity, allow creating to resume
                                    if (logCallback) {
                                        logCallback(
                                            `Allowing activity creation for resume from ${activityData.collectionPeriod.previous_category} - collection period ${activityData.collectionPeriod.id}, step ${activityData.sequence.step} - existing activity is ${isRecentActivity ? "old" : "delivered"} (${Math.round(activityAge / 1000 / 60)} minutes old, status: ${existingActivityCheck.status}), will create new one`,
                                            "INFO",
                                            {
                                                step: "PHASE2_RESUME_ALLOWED",
                                                collection_period_id:
                                                    activityData
                                                        .collectionPeriod.id,
                                                sequence_step:
                                                    activityData.sequence.step,
                                                existing_activity_id:
                                                    existingActivityCheck.id.toString(),
                                                existing_activity_status:
                                                    existingActivityCheck.status,
                                                activity_age_minutes:
                                                    Math.round(
                                                        activityAge / 1000 / 60
                                                    ),
                                                reason: "resume_after_dispute_or_ptp",
                                                isResumeFromDisputeOrPTP: true,
                                            }
                                        );
                                    }
                                    // Continue to create the activity
                                }
                            } else {
                                // Normal case: skip if activity exists (not a reset or resume)
                                // But allow if it's an old DELIVERED activity (might be from before category change)
                                if (
                                    existingActivityCheck.status ===
                                    ActivityStatus.DELIVERED &&
                                    !isRecentActivity
                                ) {
                                    // Old delivered activity, might be from before category change, allow creating
                                    if (logCallback) {
                                        logCallback(
                                            `Allowing activity creation for collection period ${activityData.collectionPeriod.id}, step ${activityData.sequence.step} - existing DELIVERED activity is old(${Math.round(activityAge / 1000 / 60)} minutes old), will create new one`,
                                            "INFO",
                                            {
                                                step: "PHASE2_OLD_DELIVERED_ALLOWED",
                                                collection_period_id:
                                                    activityData
                                                        .collectionPeriod.id,
                                                sequence_step:
                                                    activityData.sequence.step,
                                                existing_activity_id:
                                                    existingActivityCheck.id.toString(),
                                                activity_age_minutes:
                                                    Math.round(
                                                        activityAge / 1000 / 60
                                                    ),
                                                reason: "old_delivered_activity",
                                            }
                                        );
                                    }
                                    // Continue to create the activity
                                } else {
                                    // Recent activity or non-delivered status, skip to prevent duplicate
                                    processStats.skippedDueToExistingActivities++;
                                    if (logCallback) {
                                        logCallback(
                                            `Skipping activity creation for collection period ${activityData.collectionPeriod.id}, step ${activityData.sequence.step} - activity already exists in database(id: ${existingActivityCheck.id}, status: ${existingActivityCheck.status}${isRecentActivity ? `, created ${Math.round(activityAge / 1000)}s ago` : ""})`,
                                            "INFO",
                                            {
                                                step: "PHASE2_DUPLICATE_PREVENTION",
                                                collection_period_id:
                                                    activityData
                                                        .collectionPeriod.id,
                                                sequence_step:
                                                    activityData.sequence.step,
                                                existing_activity_id:
                                                    existingActivityCheck.id.toString(),
                                                existing_activity_status:
                                                    existingActivityCheck.status,
                                                activity_age_seconds:
                                                    isRecentActivity
                                                        ? Math.round(
                                                            activityAge / 1000
                                                        )
                                                        : undefined,
                                                reason: "race_condition_prevention",
                                                isManualReset: isManualReset,
                                            }
                                        );
                                    }
                                    continue; // Skip to next activity
                                }
                            }
                        }

                        // FINAL DATABASE CHECK: Query database one more time right before creation
                        // This prevents race conditions between multiple cron jobs and ensures absolute duplicate prevention
                        // ENHANCED: Also check current last_automated_step to prevent race condition with processAutomatedCollectionPeriods
                        // CRITICAL: For manual resets, only check SCHEDULED/SENT (ignore DELIVERED from old lifecycle)
                        const [finalDuplicateCheck, currentCollectionPeriod] =
                            await Promise.all([
                                prisma.activity.findFirst({
                                    where: {
                                        collection_period_id:
                                            activityData.collectionPeriod.id,
                                        OR: [
                                            // Check by activity_sequence_id (most specific)
                                            {
                                                activity_sequence_id:
                                                    activityData.sequence.id,
                                                status: isManualReset
                                                    ? {
                                                        in: [
                                                            ActivityStatus.SCHEDULED,
                                                            ActivityStatus.SENT,
                                                        ],
                                                    }
                                                    : {
                                                        not: ActivityStatus.CANCELLED,
                                                    },
                                            },
                                            // Check by step number and category (backup)
                                            {
                                                ActivitiesSequence: {
                                                    step: activityData.sequence
                                                        .step,
                                                    category: "Automated",
                                                },
                                                status: isManualReset
                                                    ? {
                                                        in: [
                                                            ActivityStatus.SCHEDULED,
                                                            ActivityStatus.SENT,
                                                        ],
                                                    }
                                                    : {
                                                        not: ActivityStatus.CANCELLED,
                                                    },
                                            },
                                        ],
                                    },
                                    select: {
                                        id: true,
                                        status: true,
                                        created_at: true,
                                        ActivitiesSequence: {
                                            select: {
                                                step: true,
                                                category: true,
                                            },
                                        },
                                    },
                                }),
                                // RACE CONDITION FIX: Also check current last_automated_step value
                                prisma.customerCollectionPeriod.findUnique({
                                    where: {
                                        id: activityData.collectionPeriod.id,
                                    },
                                    select: {
                                        last_automated_step: true,
                                        create_next_activity: true,
                                    },
                                }),
                            ]);

                        // Check if activity already exists OR if last_automated_step was updated by another process
                        const currentLastStep =
                            currentCollectionPeriod?.last_automated_step ?? 0;
                        const stepAlreadyCompleted =
                            activityData.sequence.step <= currentLastStep;

                        if (finalDuplicateCheck || stepAlreadyCompleted) {
                            // Activity already exists or step was completed by another process, skip creation
                            processStats.skippedDueToExistingActivities++;
                            if (logCallback) {
                                const reason = finalDuplicateCheck
                                    ? `activity already exists(id: ${finalDuplicateCheck.id}, status: ${finalDuplicateCheck.status})`
                                    : `step ${activityData.sequence.step} already completed(current last_automated_step: ${currentLastStep})`;

                                logCallback(
                                    `FINAL CHECK: Skipping activity creation for collection period ${activityData.collectionPeriod.id}, step ${activityData.sequence.step} - ${reason} `,
                                    "WARNING",
                                    {
                                        step: "PHASE2_FINAL_DUPLICATE_CHECK",
                                        collection_period_id:
                                            activityData.collectionPeriod.id,
                                        sequence_step:
                                            activityData.sequence.step,
                                        existing_activity_id:
                                            finalDuplicateCheck?.id?.toString(),
                                        existing_activity_status:
                                            finalDuplicateCheck?.status,
                                        existing_activity_step:
                                            finalDuplicateCheck
                                                ?.ActivitiesSequence?.step,
                                        current_last_automated_step:
                                            currentLastStep,
                                        original_last_automated_step:
                                            activityData.collectionPeriod
                                                .last_automated_step,
                                        step_already_completed:
                                            stepAlreadyCompleted,
                                        reason: finalDuplicateCheck
                                            ? "final_database_duplicate_check"
                                            : "step_completed_by_another_process",
                                    }
                                );
                            }
                            continue; // Skip to next activity
                        }

                        try {
                            // RACE CONDITION FIX: Atomically mark the collection period as "processing"
                            // by setting create_next_activity = false before creating the activity
                            // This prevents other processes from trying to create the same activity
                            const atomicUpdate =
                                await prisma.customerCollectionPeriod.updateMany(
                                    {
                                        where: {
                                            id: activityData.collectionPeriod
                                                .id,
                                            create_next_activity: true, // Only update if still true
                                            // Additional safety: ensure step hasn't progressed
                                            // CRITICAL FIX: Allow null last_automated_step (treat as 0)
                                            OR: [
                                                { last_automated_step: null },
                                                {
                                                    last_automated_step: {
                                                        lte:
                                                            activityData
                                                                .sequence.step -
                                                            1, // Ensure we're creating the next step
                                                    },
                                                },
                                            ],
                                        },
                                        data: {
                                            create_next_activity: false,
                                            modified_at: new Date(),
                                        },
                                    }
                                );

                            if (atomicUpdate.count === 0) {
                                // Another process already grabbed this collection period or step progressed
                                processStats.skippedDueToExistingActivities++;
                                if (logCallback) {
                                    logCallback(
                                        `ATOMIC LOCK: Another process already processing collection period ${activityData.collectionPeriod.id}, step ${activityData.sequence.step} `,
                                        "INFO",
                                        {
                                            step: "PHASE2_ATOMIC_LOCK_FAILED",
                                            collection_period_id:
                                                activityData.collectionPeriod
                                                    .id,
                                            sequence_step:
                                                activityData.sequence.step,
                                            reason: "another_process_processing",
                                        }
                                    );
                                }
                                continue; // Skip to next activity
                            }

                            const activity =
                                await ACTIVITY_Service.createAutomatedActivity(
                                    activityData.collectionPeriod,
                                    activityData.sequence,
                                    {
                                        scheduledTime:
                                            activityData.scheduledTime,
                                        calculation:
                                            activityData.calculation || "",
                                    },
                                    activityData.calculation
                                );
                            processStats.activitiesCreated++;

                            // Clear next_activity_date and reset is_last_automated_step_delivered when activity is successfully created
                            // CRITICAL: Reset is_last_automated_step_delivered to false so processAutomatedCollectionPeriods Phase 2
                            // can prepare the next step after this one is delivered
                            try {
                                await prisma.customerCollectionPeriod.update({
                                    where: {
                                        id: activityData.collectionPeriod.id,
                                    },
                                    data: {
                                        create_next_activity: false,
                                        next_activity_date: null, // Clear when activity is created
                                        is_last_automated_step_delivered: false, // Reset flag to allow next step preparation
                                    },
                                });
                            } catch (updateError) {
                                // Log but don't fail the whole process if update fails
                                if (logCallback) {
                                    logCallback(
                                        `Failed to clear next_activity_date for collection period ${activityData.collectionPeriod.id}: ${updateError instanceof Error ? updateError.message : String(updateError)} `,
                                        "WARNING",
                                        {
                                            step: "PHASE2_CLEAR_NEXT_ACTIVITY_DATE_ERROR",
                                            collection_period_id:
                                                activityData.collectionPeriod
                                                    .id,
                                            error:
                                                updateError instanceof Error
                                                    ? updateError.message
                                                    : String(updateError),
                                        }
                                    );
                                }
                            }

                            if (logCallback) {
                                logCallback(
                                    "Activity created successfully",
                                    "INFO",
                                    {
                                        step: "PHASE2_ACTIVITY_CREATED",
                                        customer_id: activityData.customerId,
                                        activity_id: activity.id,
                                        sequence_step:
                                            activityData.sequence.step,
                                        scheduled_time:
                                            activityData.scheduledTime.toISOString(),
                                    }
                                );
                            }
                        } catch (error: any) {
                            const errorMessage = `Failed to create activity for customer ${activityData.customerId}: ${error.message} `;
                            processStats.errors.push(errorMessage);

                            // RESTORE FLAG: If activity creation failed, restore create_next_activity flag
                            // so the activity can be retried in the next cron run
                            try {
                                await prisma.customerCollectionPeriod.update({
                                    where: {
                                        id: activityData.collectionPeriod.id,
                                    },
                                    data: {
                                        create_next_activity: true,
                                        modified_at: new Date(),
                                    },
                                });
                            } catch (restoreError) {
                                if (logCallback) {
                                    logCallback(
                                        `Failed to restore create_next_activity flag for collection period ${activityData.collectionPeriod.id} `,
                                        "ERROR",
                                        {
                                            step: "PHASE2_FLAG_RESTORE_ERROR",
                                            collection_period_id:
                                                activityData.collectionPeriod
                                                    .id,
                                            restore_error:
                                                restoreError instanceof Error
                                                    ? restoreError.message
                                                    : "Unknown error",
                                        }
                                    );
                                }
                            }

                            // Get correlation ID for system log
                            const correlationId = LogService.getContext();

                            // Log to system log (MongoDB) with proper job context
                            await logService.logMessage(
                                LogLevel.ERROR,
                                errorMessage,
                                "activityWorkflowManager.createAutomatedActivity",
                                {
                                    step: "PHASE2_ACTIVITY_CREATION_ERROR",
                                    customer_id: activityData.customerId,
                                    sequence_step: activityData.sequence.step,
                                    collection_period_id:
                                        activityData.collectionPeriod.id,
                                    account_id:
                                        activityData.collectionPeriod.Customer
                                            .account_id,
                                    error: error.message,
                                    stack: error.stack,
                                },
                                activityData.collectionPeriod.Customer
                                    .account_id,
                                undefined, // userId
                                jobId,
                                correlationId || undefined
                            );

                            if (logCallback) {
                                logCallback(errorMessage, "ERROR", {
                                    step: "PHASE2_ACTIVITY_CREATION_ERROR",
                                    customer_id: activityData.customerId,
                                    sequence_step: activityData.sequence.step,
                                    error: error.message,
                                    stack: error.stack,
                                });
                            }

                            // Check if this is a "No contacts found" error and mark customer as stuck (and period create_next_activity: false)
                            if (
                                error.message &&
                                error.message.includes("No contacts found")
                            ) {
                                try {
                                    const account =
                                        await prisma.account.findUnique({
                                            where: {
                                                id: activityData
                                                    .collectionPeriod.Customer
                                                    .account_id,
                                            },
                                            select: {
                                                has_collection: true,
                                                has_credit_insurance: true,
                                            },
                                        });
                                    if (isCreditOnlyAccount(account)) {
                                        if (logCallback) {
                                            logCallback(
                                                `Skipped automation_stuck_no_contacts for credit-only customer ${activityData.customerId}`,
                                                "INFO",
                                                {
                                                    step: "PHASE2_SKIP_STUCK_CREDIT_ONLY",
                                                    customer_id:
                                                        activityData.customerId,
                                                }
                                            );
                                        }
                                    } else {
                                        await prisma.customer.update({
                                            where: {
                                                id: activityData.customerId,
                                            },
                                            data: {
                                                automation_stuck_no_contacts: true,
                                            },
                                        });
                                        await prisma.customerCollectionPeriod.update(
                                            {
                                                where: {
                                                    id: activityData
                                                        .collectionPeriod.id,
                                                },
                                                data: {
                                                    create_next_activity: false,
                                                },
                                            }
                                        );

                                        if (logCallback) {
                                            logCallback(
                                                `Marked customer ${activityData.customerId} as stuck due to no contacts (period ${activityData.collectionPeriod.id})`,
                                                "INFO",
                                                {
                                                    step: "PHASE2_MARKED_STUCK_NO_CONTACTS",
                                                    collection_period_id:
                                                        activityData
                                                            .collectionPeriod
                                                            .id,
                                                    customer_id:
                                                        activityData.customerId,
                                                }
                                            );
                                        }
                                    }
                                } catch (updateError) {
                                    // Log but don't fail the whole process if update fails
                                    if (logCallback) {
                                        logCallback(
                                            `Failed to mark customer ${activityData.customerId} as stuck: ${updateError instanceof Error ? updateError.message : String(updateError)} `,
                                            "WARNING",
                                            {
                                                step: "PHASE2_MARK_STUCK_ERROR",
                                                collection_period_id:
                                                    activityData
                                                        .collectionPeriod.id,
                                                customer_id:
                                                    activityData.customerId,
                                                error:
                                                    updateError instanceof Error
                                                        ? updateError.message
                                                        : String(updateError),
                                            }
                                        );
                                    }
                                }
                            }
                        }
                    } else {

                        // Log when calculated time is missing
                        const missingTimeMessage = `No calculated time returned for customer ${activityData.customerId}.Sequence step: ${activityData.sequence.step}, Account ID: ${activityData.collectionPeriod.Customer.account_id} `;
                        processStats.errors.push(missingTimeMessage);

                        if (logCallback) {
                            logCallback(missingTimeMessage, "WARNING", {
                                step: "PHASE2_MISSING_CALCULATED_TIME",
                                customer_id: activityData.customerId,
                                account_id:
                                    activityData.collectionPeriod.Customer
                                        .account_id,
                                sequence_step: activityData.sequence.step,
                                sequence_id: activityData.sequence.id,
                                last_automated_step:
                                    activityData.collectionPeriod
                                        .last_automated_step,
                                period_start_date:
                                    activityData.collectionPeriod.period_start_date?.toISOString(),
                                expected_next_step:
                                    (activityData.collectionPeriod
                                        .last_automated_step || 0) + 1,
                                calculatedTimesKeys: Array.from(
                                    calculatedTimes.keys()
                                ),
                            });
                        }
                    }
                }
            }

            // Handle collection periods that need category reversion (no sequences found)
            if (periodsToRevert.length > 0) {
                if (logCallback) {
                    logCallback(
                        `Reverting ${periodsToRevert.length} collection period(s) to Agent category(no sequences found)`,
                        "INFO",
                        {
                            step: "PHASE2_REVERT_CATEGORIES",
                            periodsToRevert: periodsToRevert.length,
                        }
                    );
                }

                for (const periodToRevert of periodsToRevert) {
                    try {
                        await customerService.updateCollectionPeriodCategory(
                            periodToRevert.id,
                            "Agent",
                            "Automated",
                            periodToRevert.accountId,
                            periodToRevert.customerId,
                            {
                                reason: periodToRevert.reason,
                                userId: "system",
                                isManualCategoryChange: false,
                                translate: (key: string) => key,
                            }
                        );

                        if (logCallback) {
                            logCallback(
                                `Successfully reverted collection period ${periodToRevert.id} to Agent category`,
                                "INFO",
                                {
                                    step: "PHASE2_REVERT_CATEGORY_SUCCESS",
                                    collectionPeriodId: periodToRevert.id,
                                    customerId: periodToRevert.customerId,
                                    reason: periodToRevert.reason,
                                }
                            );
                        }
                    } catch (error: any) {
                        const errorMessage = `Failed to revert collection period ${periodToRevert.id} to Agent: ${error.message} `;
                        processStats.errors.push(errorMessage);

                        if (logCallback) {
                            logCallback(errorMessage, "ERROR", {
                                step: "PHASE2_REVERT_CATEGORY_ERROR",
                                collectionPeriodId: periodToRevert.id,
                                customerId: periodToRevert.customerId,
                                error: error.message,
                            });
                        }
                    }
                }
            }

            const phase1Duration = Date.now() - phase1Start;
            processStats.phase1Duration = phase1Duration;
            // ========================================
            // PHASE 2: Generate Activities - END
            // ========================================

            // Log final completion
            const totalDuration = Date.now() - startTime.getTime();

            // Enhanced logging for customer-specific execution
            if (logCallback) {
                logCallback(
                    "Job completed successfully",
                    "INFO",
                    {
                        customer_id: customerId,
                        job_name: "Activity Workflow Manager",
                        total_duration_ms: totalDuration,
                    },
                    {
                        collection_periods_processed:
                            processStats.totalCollectionPeriods,
                        activities_created: processStats.activitiesCreated,
                        collection_periods_updated:
                            processStats.collectionPeriodsUpdated,
                        activities_sent: processStats.activitiesWithContacts,
                        all_steps_completed: true,
                        no_errors: true,
                    }
                );
            }

            // Add process completion message to step collector
            if (stepCollector) {
                stepCollector.addStep(
                    "COMPLETE",
                    "Activity Workflow Manager process completed successfully",
                    "INFO",
                    {
                        totalDuration,
                        finalStats: processStats,
                    }
                );
            }
            if (logCallback) {
                logCallback(
                    "Activity Workflow Manager process completed successfully",
                    "INFO",
                    {
                        processName: "activityWorkflowManager",
                        startTime: startTime.toISOString(),
                        jobId,
                        customerId: customerId || "ALL",
                        step: "COMPLETE",
                        stepNumber: 8,
                        totalDuration,
                        finalStats: processStats,
                    }
                );
            }

            // Trigger real-time Control Center update if activities were created or sent
            if (
                processStats.activitiesCreated > 0 ||
                processStats.activitiesCompleted > 0 ||
                processStats.collectionPeriodsUpdated > 0
            ) {
                try {
                    const realtimeService =
                        ControlCenterRealtimeService.getInstance();
                    await realtimeService.triggerUpdate(
                        `activityWorkflowManager: Created ${processStats.activitiesCreated} activities, sent ${processStats.activitiesCompleted} activities, updated ${processStats.collectionPeriodsUpdated} collection periods`,
                        {
                            excludeFromNotifications: true, // Exclude from notification dropdown
                            source: "automated", // Mark as automated process
                        }
                    );
                } catch (realtimeError) {
                    // Silently ignore realtime service errors - Control Center updates are non-critical
                }
            }
        } // Close main try block

        // Job summary logging removed to prevent email notifications
    } catch (error: any) {
        const errorMessage = `Critical error in activityWorkflowManager: ${error.message} `;
        processStats.errors.push(errorMessage);

        // Log to system log (MongoDB) with proper job context
        const correlationId = LogService.getContext();
        await logService.logMessage(
            LogLevel.ERROR,
            errorMessage,
            "activityWorkflowManager.critical",
            {
                step: "CRITICAL_ERROR",
                error: error.message,
                stack: error.stack,
                finalStats: processStats,
                jobId,
                customerId: customerId || "ALL",
            },
            undefined, // accountId (varies)
            undefined, // userId
            jobId,
            correlationId || undefined
        );

        // Add error to step collector if available
        if (stepCollector) {
            stepCollector.addStep("CRITICAL_ERROR", errorMessage, "ERROR", {
                error: error.message,
                stack: error.stack,
                finalStats: processStats,
            });
        }

        throw error; // Re-throw to ensure the job is marked as failed
    }
}

// When contacts are added or updated, clear the flag
// This should be called from contact management functions
export async function clearStuckFlagForCustomer(customerId: number) {
    // Get customer details to find account and sequence container
    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
            account_id: true,
            sequence_container_id: true,
        },
    });

    if (!customer) {
        return;
    }

    // Use the revalidation function to properly check if contacts match next sequence step
    await revalidateStuckCollectionPeriodsForSequence(
        customer.account_id,
        customer.sequence_container_id
    );
}
