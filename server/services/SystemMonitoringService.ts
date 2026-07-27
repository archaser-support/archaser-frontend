import { ensureMongoConnection } from "@/lib/mongoose";
import { prisma } from "@/lib/prisma";
import Log from "@/models/Log";
import { ActivityStatus, LogLevel } from "@/types/enums";
import { detectServerEnvironment } from "@/utils/domainUtils";
import { serializeBigInt } from "@/utils/serializeBigInt";

import { EmailService } from "../EmailService";

import { LogService } from "./LogService";

export interface Alert {
    type: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    message: string;
    details: Record<string, unknown>;
    timestamp: Date;
    recommendedActions?: string[];
}

export class SystemMonitoringService {
    // Static cache to persist across all instances (survives between cron runs)
    private static alertCooldownCache: Map<string, number> = new Map();
    private readonly COOLDOWN_HOURS: number;
    private readonly SCHEDULED_ACTIVITIES_THRESHOLD_HOURS = 24;
    private readonly ACTIVITY_FAILURE_RATE_THRESHOLD = 10; // percentage
    private readonly STUCK_ACTIVITY_THRESHOLD_HOURS = 2;
    private readonly CRON_JOB_STALE_THRESHOLD_HOURS = 6;
    private logService: LogService;

    constructor() {
        this.COOLDOWN_HOURS = parseInt(
            process.env.SYSTEM_ALERT_COOLDOWN_HOURS || "2",
            10
        );
        this.logService = LogService.getInstance();
    }

    /**
     * Safe Prisma query wrapper that handles errors gracefully
     * Logs errors to MongoDB via LogService (which already uses MongoDB)
     */
    private async safePrismaQuery<T>(
        queryFn: () => Promise<T>,
        errorContext: string
    ): Promise<T | null> {
        try {
            return await queryFn();
        } catch (error) {
            // Log error using LogService (which uses MongoDB via mongoLogService)
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Prisma connection failure in SystemMonitoringService: ${errorContext}`,
                "SystemMonitoringService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    context: errorContext,
                }
            );
            return null;
        }
    }

    /**
     * Run all monitoring checks and send alerts
     */
    async runAllChecks(stepCollector?: {
        addStep: (
            step: string,
            message: string,
            level?: "INFO" | "ERROR" | "WARNING" | "DEBUG",
            parameters?: any,
            results?: any,
            duration?: number
        ) => void;
    }): Promise<void> {
        const checksStartTime = Date.now();
        const checkResults: Array<{
            name: string;
            alert: Alert | null;
            duration: number;
            status: "success" | "error";
            error?: string;
        }> = [];

        try {
            await this.logService.logMessage(
                LogLevel.INFO,
                "Starting system health monitoring checks",
                "SystemMonitoringService"
            );

            if (stepCollector) {
                stepCollector.addStep(
                    "CHECKS_START",
                    "Starting all health monitoring checks",
                    "INFO",
                    {
                        totalChecks: 6,
                        checks: [
                            "Scheduled Activities",
                            "Stuck Activities",
                            "Next Activity Schedule Date",
                            "Cron Job Failures",
                            "Automated Collections Without Scheduled Activities",
                            "Overdue Invoices With Unassigned Collection Category",
                        ],
                    }
                );
            }

            const checks = [
                {
                    name: "Scheduled Activities",
                    fn: () => this.checkScheduledActivities(),
                },
                {
                    name: "Stuck Activities",
                    fn: () => this.checkStuckActivities(),
                },
                {
                    name: "Next Activity Schedule Date",
                    fn: () => this.checkNextActivityScheduleDate(),
                },
                {
                    name: "Cron Job Failures",
                    fn: () => this.checkCronJobFailures(),
                },
                {
                    name: "Automated Collections Without Scheduled Activities",
                    fn: () =>
                        this.checkAutomatedCollectionPeriodsWithoutScheduledActivities(),
                },
                {
                    name: "Overdue Invoices With Unassigned Collection Category",
                    fn: () =>
                        this.checkOverdueWithUnassignedCollectionCategory(),
                },
                // Future checks can be added here:
                // { name: "Cron Job Health", fn: () => this.checkCronJobHealth() },
                // { name: "Activity Processing Health", fn: () => this.checkActivityProcessingHealth() },
            ];

            // Execute checks sequentially to get detailed timing for each
            for (const check of checks) {
                const checkStart = Date.now();
                try {
                    if (stepCollector) {
                        stepCollector.addStep(
                            `CHECK_${check.name.toUpperCase().replace(/\s+/g, "_")}_START`,
                            `Starting check: ${check.name}`,
                            "INFO",
                            { checkName: check.name }
                        );
                    }

                    const alert = await check.fn();
                    let alertToSend = alert;
                    let suppressedByCooldown = false;

                    if (alert) {
                        const shouldSend = await this.shouldSendAlert(alert.type);
                        if (!shouldSend) {
                            suppressedByCooldown = true;
                            alertToSend = null;
                        }
                    }
                    const checkDuration = Date.now() - checkStart;

                    if (stepCollector) {
                        stepCollector.addStep(
                            `CHECK_${check.name.toUpperCase().replace(/\s+/g, "_")}_COMPLETE`,
                            alertToSend
                                ? `Check completed: ${check.name} - Alert generated`
                                : suppressedByCooldown
                                    ? `Check completed: ${check.name} - Alert suppressed by cooldown`
                                : `Check completed: ${check.name} - No issues found`,
                            alertToSend || suppressedByCooldown
                                ? "WARNING"
                                : "INFO",
                            {
                                checkName: check.name,
                                alertGenerated: alertToSend !== null,
                                suppressedByCooldown,
                                alertType: alertToSend?.type || alert?.type || null,
                                alertSeverity:
                                    alertToSend?.severity || alert?.severity || null,
                            },
                            alertToSend || suppressedByCooldown
                                ? {
                                    alertDetails: alertToSend?.details || alert?.details,
                                    alertMessage: alertToSend?.message || alert?.message,
                                    recommendedActions:
                                        alertToSend?.recommendedActions ||
                                        alert?.recommendedActions,
                                }
                                : undefined,
                            checkDuration
                        );
                    }

                    checkResults.push({
                        name: check.name,
                        alert: alertToSend,
                        duration: checkDuration,
                        status: "success",
                    });

                    // Send alert if one was generated
                    if (alertToSend) {
                        const alertStart = Date.now();
                        await this.sendAlert(alertToSend);
                        const alertDuration = Date.now() - alertStart;

                        if (stepCollector) {
                            stepCollector.addStep(
                                `ALERT_SENT_${check.name.toUpperCase().replace(/\s+/g, "_")}`,
                                `Alert sent for: ${check.name}`,
                                "INFO",
                                {
                                    alertType: alertToSend.type,
                                    alertSeverity: alertToSend.severity,
                                    alertMessage: alertToSend.message,
                                },
                                undefined,
                                alertDuration
                            );
                        }
                    }
                } catch (error) {
                    const checkDuration = Date.now() - checkStart;
                    const errorMessage =
                        error instanceof Error ? error.message : String(error);

                    if (stepCollector) {
                        stepCollector.addStep(
                            `CHECK_${check.name.toUpperCase().replace(/\s+/g, "_")}_ERROR`,
                            `Check failed: ${check.name}`,
                            "ERROR",
                            {
                                checkName: check.name,
                                error: errorMessage,
                                stack:
                                    error instanceof Error
                                        ? error.stack
                                        : undefined,
                            },
                            undefined,
                            checkDuration
                        );
                    }

                    checkResults.push({
                        name: check.name,
                        alert: null,
                        duration: checkDuration,
                        status: "error",
                        error: errorMessage,
                    });

                    await this.logService.logMessage(
                        LogLevel.ERROR,
                        `Monitoring check failed: ${errorMessage}`,
                        "SystemMonitoringService",
                        {
                            checkName: check.name,
                            error: errorMessage,
                        }
                    );
                }
            }

            const totalDuration = Date.now() - checksStartTime;
            const alertsGenerated = checkResults.filter(
                (r) => r.alert !== null
            ).length;
            const checksWithErrors = checkResults.filter(
                (r) => r.status === "error"
            ).length;

            if (stepCollector) {
                stepCollector.addStep(
                    "CHECKS_SUMMARY",
                    `All health checks completed: ${alertsGenerated} alert(s) generated, ${checksWithErrors} error(s)`,
                    checksWithErrors > 0
                        ? "ERROR"
                        : alertsGenerated > 0
                            ? "WARNING"
                            : "INFO",
                    {
                        totalChecks: checkResults.length,
                        alertsGenerated,
                        checksWithErrors,
                        totalDuration,
                    },
                    {
                        checkResults: checkResults.map((r) => ({
                            name: r.name,
                            status: r.status,
                            duration: r.duration,
                            alertType: r.alert?.type || null,
                            alertSeverity: r.alert?.severity || null,
                            error: r.error || null,
                        })),
                    },
                    totalDuration
                );
            }

            await this.logService.logMessage(
                LogLevel.INFO,
                "System health monitoring checks completed",
                "SystemMonitoringService",
                {
                    totalChecks: checkResults.length,
                    alertsGenerated,
                    checksWithErrors,
                    totalDuration,
                }
            );
        } catch (error) {
            const totalDuration = Date.now() - checksStartTime;

            if (stepCollector) {
                stepCollector.addStep(
                    "CHECKS_FAILED",
                    `System health monitoring failed: ${error instanceof Error ? error.message : String(error)}`,
                    "ERROR",
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                        partialResults: checkResults,
                    },
                    undefined,
                    totalDuration
                );
            }

            await this.logService.logMessage(
                LogLevel.ERROR,
                `System health monitoring failed: ${error instanceof Error ? error.message : String(error)}`,
                "SystemMonitoringService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    partialResults: checkResults,
                }
            );
            throw error;
        }
    }

    /**
     * Check for automated collection periods without scheduled activities
     * Alerts when open Automated collection periods have no scheduled activities
     * AND no activities were created in the last 24 hours
     */
    async checkAutomatedCollectionPeriodsWithoutScheduledActivities(): Promise<Alert | null> {
        try {
            const twentyFourHoursAgo = new Date(
                Date.now() - 24 * 60 * 60 * 1000
            );

            // 1. Find all open Automated collection periods
            const automatedCollectionPeriods = await this.safePrismaQuery(
                () =>
                    prisma.customerCollectionPeriod.findMany({
                        where: {
                            period_end_date: null,
                            current_category: "Automated",
                        },
                        select: {
                            id: true,
                            customer_id: true,
                            period_start_date: true,
                            create_next_activity: true,
                            Customer: {
                                select: {
                                    id: true,
                                    account_id: true,
                                    automation_stuck_no_contacts: true,
                                },
                            },
                        },
                        take: 1000, // Limit for performance
                    }),
                "checkAutomatedCollectionPeriodsWithoutScheduledActivities_findPeriods"
            );

            if (
                !automatedCollectionPeriods ||
                automatedCollectionPeriods.length === 0
            ) {
                return null;
            }

            const collectionPeriodIds = automatedCollectionPeriods.map(
                (cp) => cp.id
            );

            // 2. Find which collection periods have scheduled activities
            const periodsWithScheduledActivities = await this.safePrismaQuery(
                () =>
                    prisma.activity.findMany({
                        where: {
                            collection_period_id: {
                                in: collectionPeriodIds,
                            },
                            status: ActivityStatus.SCHEDULED,
                        },
                        select: {
                            collection_period_id: true,
                        },
                        distinct: ["collection_period_id"],
                    }),
                "checkAutomatedCollectionPeriodsWithoutScheduledActivities_findScheduled"
            );

            if (periodsWithScheduledActivities === null) {
                return null; // Prisma failed, skip this check
            }

            const periodsWithScheduledSet = new Set(
                periodsWithScheduledActivities.map(
                    (a) => a.collection_period_id
                )
            );

            // 3. Find which collection periods have activities created in last 24 hours
            const periodsWithRecentActivities = await this.safePrismaQuery(
                () =>
                    prisma.activity.findMany({
                        where: {
                            collection_period_id: {
                                in: collectionPeriodIds,
                            },
                            created_at: {
                                gte: twentyFourHoursAgo,
                            },
                        },
                        select: {
                            collection_period_id: true,
                        },
                        distinct: ["collection_period_id"],
                    }),
                "checkAutomatedCollectionPeriodsWithoutScheduledActivities_findRecent"
            );

            if (periodsWithRecentActivities === null) {
                return null; // Prisma failed, skip this check
            }

            const periodsWithRecentSet = new Set(
                periodsWithRecentActivities.map((a) => a.collection_period_id)
            );

            // 4. Filter collection periods that have NO scheduled activities AND NO recent activities
            const problematicPeriods = automatedCollectionPeriods.filter(
                (cp) =>
                    !periodsWithScheduledSet.has(cp.id) &&
                    !periodsWithRecentSet.has(cp.id)
            );

            if (problematicPeriods.length === 0) {
                return null;
            }

            // 5. Get last activity creation time for each problematic period
            const problematicPeriodIds = problematicPeriods.map((cp) => cp.id);
            const lastActivities = await this.safePrismaQuery(
                () =>
                    prisma.activity.findMany({
                        where: {
                            collection_period_id: {
                                in: problematicPeriodIds,
                            },
                        },
                        select: {
                            collection_period_id: true,
                            created_at: true,
                        },
                        orderBy: {
                            created_at: "desc",
                        },
                    }),
                "checkAutomatedCollectionPeriodsWithoutScheduledActivities_lastActivities"
            );

            // Group last activities by collection period
            const lastActivityByPeriod = new Map<number, Date>();
            if (lastActivities) {
                for (const activity of lastActivities) {
                    const periodId = activity.collection_period_id;
                    if (periodId != null && !lastActivityByPeriod.has(periodId)) {
                        lastActivityByPeriod.set(periodId, activity.created_at);
                    }
                }
            }

            // 6. Get Activity Workflow Manager cron job status
            const workflowJob = await this.safePrismaQuery(
                () =>
                    prisma.cronJob.findFirst({
                        where: { name: "Activity Workflow Manager" },
                        select: { last_run_at: true, active: true },
                    }),
                "checkAutomatedCollectionPeriodsWithoutScheduledActivities_workflowJob"
            );

            // 7. Prepare details for alert
            const periodDetails = problematicPeriods.slice(0, 50).map((cp) => {
                const lastActivity = lastActivityByPeriod.get(cp.id);
                const hoursSinceLastActivity = lastActivity
                    ? Math.round(
                        ((Date.now() - lastActivity.getTime()) /
                            (1000 * 60 * 60)) *
                        10
                    ) / 10
                    : null;

                return {
                    collectionPeriodId: cp.id,
                    customerId: cp.customer_id,
                    accountId: cp.Customer?.account_id,
                    lastActivityCreated: lastActivity
                        ? lastActivity.toISOString()
                        : "Never",
                    hoursSinceLastActivity,
                    createNextActivity: cp.create_next_activity,
                    automationStuckNoContacts: cp.Customer?.automation_stuck_no_contacts ?? false,
                };
            });

            // Group by account for summary
            const periodsByAccount = new Map<number, number>();
            problematicPeriods.forEach((cp) => {
                const accountId = cp.Customer?.account_id;
                if (accountId) {
                    periodsByAccount.set(
                        accountId,
                        (periodsByAccount.get(accountId) || 0) + 1
                    );
                }
            });

            // 8. Generate CRITICAL alert
            return {
                type: "AUTOMATED_COLLECTIONS_WITHOUT_SCHEDULED_ACTIVITIES",
                severity: "CRITICAL",
                message: `${problematicPeriods.length} Automated collection period(s) have no scheduled activities and no recent activity creation`,
                details: {
                    affectedCollectionPeriods: problematicPeriods.length,
                    periodsByAccount: Object.fromEntries(periodsByAccount),
                    workflowJobLastRun:
                        workflowJob?.last_run_at?.toISOString() || "Never",
                    workflowJobActive: workflowJob?.active || false,
                    samplePeriods: periodDetails,
                    totalPeriodsChecked: automatedCollectionPeriods.length,
                },
                timestamp: new Date(),
                recommendedActions: [
                    "Check Activity Workflow Manager cron job status",
                    "Verify cron job is running and active",
                    "Check for errors in activity creation process",
                    "Review collection periods without scheduled activities",
                    "Verify activity sequences are configured correctly",
                    "Check if customers have valid contacts for activity creation",
                ],
            };
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to check automated collection periods without scheduled activities: ${error instanceof Error ? error.message : String(error)}`,
                "SystemMonitoringService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                }
            );
            // Don't throw - continue with other checks
            return null;
        }
    }

    /**
     * Customers with overdue exposure whose open collection period has no current_category
     * (often shown as N/A in the UI). Surfaces data-quality / workflow gaps.
     */
    async checkOverdueWithUnassignedCollectionCategory(): Promise<Alert | null> {
        try {
            const customers = await this.safePrismaQuery(
                () =>
                    prisma.customer.findMany({
                        where: {
                            OR: [
                                { number_of_overdue_invoices: { gt: 0 } },
                                { total_invoices_overdue: { gt: 0 } },
                                {
                                    Invoice: {
                                        some: {
                                            status: "Overdue",
                                            OR: [
                                                {
                                                    customer_outstanding_debt: {
                                                        gt: 0,
                                                    },
                                                },
                                                { outstanding_debt: { gt: 0 } },
                                            ],
                                        },
                                    },
                                },
                            ],
                            CustomerCollectionPeriod: {
                                some: {
                                    period_end_date: null,
                                    current_category: null,
                                },
                            },
                        },
                        select: {
                            id: true,
                            customer_number: true,
                            email: true,
                            number_of_overdue_invoices: true,
                            total_invoices_overdue: true,
                            Account: {
                                select: { id: true, name: true },
                            },
                            CustomerCollectionPeriod: {
                                where: { period_end_date: null },
                                take: 1,
                                orderBy: { period_start_date: "desc" },
                                select: {
                                    id: true,
                                    current_category: true,
                                    period_start_date: true,
                                },
                            },
                        },
                        take: 500,
                        orderBy: { id: "desc" },
                    }),
                "checkOverdueWithUnassignedCollectionCategory"
            );

            if (!customers || customers.length === 0) {
                return null;
            }

            const sample = customers.slice(0, 50).map((c) => ({
                customerId: c.id,
                customerNumber: c.customer_number,
                accountId: c.Account?.id,
                accountName: c.Account?.name,
                email: c.email,
                numberOfOverdueInvoices: c.number_of_overdue_invoices,
                totalInvoicesOverdue: c.total_invoices_overdue,
                openPeriodId: c.CustomerCollectionPeriod?.[0]?.id,
                currentCategory: c.CustomerCollectionPeriod?.[0]?.current_category,
            }));

            const byAccount = new Map<number, number>();
            for (const c of customers) {
                const aid = c.Account?.id;
                if (aid) {
                    byAccount.set(aid, (byAccount.get(aid) || 0) + 1);
                }
            }

            return {
                type: "OVERDUE_INVOICES_UNASSIGNED_COLLECTION_CATEGORY",
                severity: "MEDIUM",
                message: `${customers.length} customer(s) have overdue invoices while the open collection period has no category (N/A)`,
                details: {
                    affectedCustomers: customers.length,
                    customersByAccount: Object.fromEntries(byAccount),
                    sampleCustomers: sample,
                },
                timestamp: new Date(),
                recommendedActions: [
                    "Review Alert Data Drilldown dashboard: Overdue — open period category N/A",
                    "Assign a valid current_category on the open CustomerCollectionPeriod",
                    "Verify customer/invoice aggregates match invoice rows (Overdue + outstanding > 0)",
                ],
            };
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed overdue + unassigned category check: ${error instanceof Error ? error.message : String(error)}`,
                "SystemMonitoringService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                }
            );
            return null;
        }
    }

    /**
     * Check for scheduled activities missing (no activities created in last 24 hours)
     */
    async checkScheduledActivities(): Promise<Alert | null> {
        try {
            // 1. Count activities with system_generated=true created in last 24 hours
            const activitiesCount = await this.safePrismaQuery(
                () =>
                    prisma.activity.count({
                        where: {
                            system_generated: true,
                            created_at: {
                                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                            },
                        },
                    }),
                "checkScheduledActivities_count"
            );

            if (activitiesCount === null) {
                return null; // Prisma failed, skip this check
            }

            // 2. Get last activity creation time
            const lastActivity = await this.safePrismaQuery(
                () =>
                    prisma.activity.findFirst({
                        where: { system_generated: true },
                        orderBy: { created_at: "desc" },
                        select: { created_at: true },
                    }),
                "checkScheduledActivities_lastActivity"
            );

            // 3. Check Activity Workflow Manager cron job last run
            const workflowJob = await this.safePrismaQuery(
                () =>
                    prisma.cronJob.findFirst({
                        where: { name: "Activity Workflow Manager" },
                        select: { last_run_at: true, active: true },
                    }),
                "checkScheduledActivities_workflowJob"
            );

            // 4. Count collection periods waiting for activities
            const waitingPeriods =
                (await this.safePrismaQuery(
                    () =>
                        prisma.customerCollectionPeriod.count({
                            where: {
                                period_end_date: null,
                                current_category: "Automated",
                                create_next_activity: true,
                            },
                        }),
                    "checkScheduledActivities_waitingPeriods"
                )) || 0;

            // 5. Generate alert if threshold exceeded
            if (activitiesCount === 0 && lastActivity) {
                const hoursSince =
                    (Date.now() - lastActivity.created_at.getTime()) /
                    (1000 * 60 * 60);
                if (hoursSince >= this.SCHEDULED_ACTIVITIES_THRESHOLD_HOURS) {
                    return {
                        type: "SCHEDULED_ACTIVITIES_MISSING",
                        severity: "HIGH",
                        message:
                            "No scheduled activities created in last 24 hours",
                        details: {
                            hoursSinceLastActivity:
                                Math.round(hoursSince * 10) / 10,
                            lastActivityCreated:
                                lastActivity.created_at.toISOString(),
                            waitingCollectionPeriods: waitingPeriods,
                            workflowJobLastRun:
                                workflowJob?.last_run_at?.toISOString() ||
                                "Never",
                            workflowJobActive: workflowJob?.active || false,
                        },
                        timestamp: new Date(),
                        recommendedActions: [
                            "Check Activity Workflow Manager cron job status",
                            "Verify cron job is running and active",
                            "Check for errors in activity creation process",
                            "Review collection periods waiting for activities",
                        ],
                    };
                }
            }

            // Also alert if no activities exist at all and there are waiting periods
            if (!lastActivity && waitingPeriods > 0) {
                return {
                    type: "SCHEDULED_ACTIVITIES_MISSING",
                    severity: "HIGH",
                    message:
                        "No scheduled activities have ever been created and there are waiting collection periods",
                    details: {
                        waitingCollectionPeriods: waitingPeriods,
                        workflowJobLastRun:
                            workflowJob?.last_run_at?.toISOString() || "Never",
                        workflowJobActive: workflowJob?.active || false,
                    },
                    timestamp: new Date(),
                    recommendedActions: [
                        "Check Activity Workflow Manager cron job status",
                        "Verify cron job is running and active",
                        "Check for errors in activity creation process",
                        "Review collection periods waiting for activities",
                    ],
                };
            }

            return null;
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to check scheduled activities: ${error instanceof Error ? error.message : String(error)}`,
                "SystemMonitoringService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                }
            );
            // Don't throw - continue with other checks
            return null;
        }
    }

    /**
     * Get system administrator email addresses
     */
    async getSystemAdminEmails(): Promise<string[]> {
        return ["support@archaser.com", "ofir@cloudial.io"];
    }

    /**
     * Get cooldown period in hours for a specific alert type
     */
    private getCooldownHours(alertType: string): number {
        // Enforce a strict once-per-24-hours policy for all monitoring alerts.
        // Keeping this centralized prevents any alert type from spamming notifications.
        void alertType;
        return 24;
    }

    /**
     * Check if alert should be sent based on cooldown
     * Uses MongoDB to persist cooldown across server restarts
     */
    private async shouldSendAlert(alertType: string): Promise<boolean> {
        const key = alertType;

        // First check in-memory cache (fast path)
        let lastSent = SystemMonitoringService.alertCooldownCache.get(key);

        // If not in cache, check MongoDB (survives server restarts)
        if (!lastSent) {
            try {
                await ensureMongoConnection();
                const mongoLog = await Log.findOne({
                    source: "SystemMonitoringService",
                    message: {
                        $regex: `Alert ${alertType} sent to`,
                        $options: "i",
                    },
                    "details.isCooldownMarker": true,
                })
                    .sort({ timestamp: -1 })
                    .select("timestamp")
                    .lean();

                if (mongoLog?.timestamp) {
                    lastSent = new Date(mongoLog.timestamp).getTime();
                    // Update cache for next time
                    SystemMonitoringService.alertCooldownCache.set(
                        key,
                        lastSent
                    );
                }
            } catch (error) {
                // If database query fails, log and allow alert (fail open)
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `Failed to check cooldown from MongoDB for ${alertType}, allowing alert`,
                    "SystemMonitoringService",
                    {
                        alertType,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    }
                );
                return true;
            }
        }

        if (!lastSent) {
            await this.logService.logMessage(
                LogLevel.DEBUG,
                `Alert ${alertType} has no previous cooldown timestamp - will send`,
                "SystemMonitoringService",
                {
                    alertType,
                    cacheSize: SystemMonitoringService.alertCooldownCache.size,
                }
            );
            return true;
        }

        const cooldownHours = this.getCooldownHours(alertType);
        const cooldownMs = cooldownHours * 60 * 60 * 1000;
        const timeSinceLastSent = Date.now() - lastSent;
        const hoursSinceLastSent = timeSinceLastSent / (1000 * 60 * 60);
        const shouldSend = timeSinceLastSent >= cooldownMs;

        await this.logService.logMessage(
            LogLevel.DEBUG,
            `Alert ${alertType} cooldown check: lastSent=${new Date(lastSent).toISOString()}, hoursSince=${hoursSinceLastSent.toFixed(2)}, cooldownHours=${cooldownHours}, shouldSend=${shouldSend}`,
            "SystemMonitoringService",
            {
                alertType,
                lastSent: new Date(lastSent).toISOString(),
                hoursSinceLastSent: Math.round(hoursSinceLastSent * 100) / 100,
                cooldownHours,
                shouldSend,
            }
        );

        return shouldSend;
    }

    /**
     * Update cooldown cache for alert type
     * Writes cooldown marker to MongoDB for persistence across server restarts
     */
    private async updateCooldown(alertType: string): Promise<void> {
        const now = Date.now();
        SystemMonitoringService.alertCooldownCache.set(alertType, now);

        // Write cooldown marker to MongoDB (works in all environments)
        // This bypasses MongoLogService's development skip to ensure cooldown works in local
        try {
            await ensureMongoConnection();
            const cooldownLog = new Log({
                timestamp: new Date(now),
                level: "INFO",
                message: `Alert ${alertType} sent to`,
                source: "SystemMonitoringService",
                details: {
                    alertType,
                    cooldownTimestamp: new Date(now).toISOString(),
                    isCooldownMarker: true, // Flag to identify cooldown records
                },
            });
            await cooldownLog.save();
        } catch (error) {
            // Log error but don't fail - cooldown cache still works
            await this.logService.logMessage(
                LogLevel.WARNING,
                `Failed to write cooldown marker to MongoDB for ${alertType}`,
                "SystemMonitoringService",
                {
                    alertType,
                    error:
                        error instanceof Error ? error.message : String(error),
                }
            );
        }

        await this.logService.logMessage(
            LogLevel.DEBUG,
            `Updated cooldown for alert ${alertType} at ${new Date(now).toISOString()}`,
            "SystemMonitoringService",
            {
                alertType,
                timestamp: new Date(now).toISOString(),
                cacheSize: SystemMonitoringService.alertCooldownCache.size,
            }
        );
    }

    /**
     * Generate HTML email content for system alert
     */
    private generateAlertEmailHTML(alert: Alert): string {
        const environment = detectServerEnvironment();
        const envDisplay =
            environment === "localhost"
                ? "Local Development"
                : environment === "preprod"
                    ? "Pre-Production"
                    : "Production";
        const grafanaAlertDrilldownUrl =
            environment === "preprod"
                ? "https://grafana.staging.archaser.com/d/alert-drilldown-staging/alert-data-drilldown-staging?orgId=1&from=now-24h&to=now&timezone=browser&refresh=1m"
                : "https://grafana.production.archaser.com/d/alert-drilldown-staging/alert-data-drilldown-staging?orgId=1&from=now-24h&to=now&timezone=browser&refresh=1m";

        const timestamp = alert.timestamp.toISOString();

        // Format details for HTML
        const formattedDetails = JSON.stringify(
            serializeBigInt(alert.details),
            null,
            2
        )
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Get severity badge color
        const severityColor =
            alert.severity === "CRITICAL"
                ? "#dc3545"
                : alert.severity === "HIGH"
                    ? "#fd7e14"
                    : alert.severity === "MEDIUM"
                        ? "#ffc107"
                        : "#6c757d";

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: ${severityColor};
            color: white;
            padding: 20px;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f8f9fa;
            padding: 20px;
            border: 1px solid #dee2e6;
        }
        .section {
            margin-bottom: 20px;
            background-color: white;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid ${severityColor};
        }
        .section-title {
            font-weight: bold;
            color: ${severityColor};
            margin-bottom: 10px;
            font-size: 16px;
        }
        .field {
            margin-bottom: 10px;
        }
        .field-label {
            font-weight: bold;
            color: #666;
            display: inline-block;
            min-width: 150px;
        }
        .field-value {
            color: #333;
        }
        .code-block {
            background-color: #f4f4f4;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-critical {
            background-color: #dc3545;
            color: white;
        }
        .badge-high {
            background-color: #fd7e14;
            color: white;
        }
        .badge-medium {
            background-color: #ffc107;
            color: #333;
        }
        .badge-low {
            background-color: #6c757d;
            color: white;
        }
        .actions-list {
            margin: 10px 0;
            padding-left: 20px;
        }
        .actions-list li {
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚨 System Health Alert</h1>
        <p>An alert has been detected in the ARchaser system monitoring</p>
    </div>
    
    <div class="content">
        <div class="section">
            <div class="section-title">Alert Information</div>
            <div class="field">
                <span class="field-label">Alert Type:</span>
                <span class="field-value">${alert.type}</span>
            </div>
            <div class="field">
                <span class="field-label">Severity:</span>
                <span class="field-value">
                    <span class="badge badge-${alert.severity.toLowerCase()}">${alert.severity}</span>
                </span>
            </div>
            <div class="field">
                <span class="field-label">Message:</span>
                <span class="field-value">${alert.message}</span>
            </div>
            <div class="field">
                <span class="field-label">Timestamp:</span>
                <span class="field-value">${timestamp}</span>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Alert Details</div>
            <div class="code-block">${formattedDetails}</div>
        </div>

        ${alert.recommendedActions && alert.recommendedActions.length > 0
                ? `
        <div class="section">
            <div class="section-title">Recommended Actions</div>
            <ul class="actions-list">
                ${alert.recommendedActions
                    .map(
                        (action) =>
                            `<li>${action.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`
                    )
                    .join("")}
            </ul>
        </div>
        `
                : ""
            }

        <div class="section">
            <div class="section-title">System Information</div>
            <div class="field">
                <span class="field-label">Environment:</span>
                <span class="field-value">${envDisplay}</span>
            </div>
            <div class="field">
                <span class="field-label">Dashboard:</span>
                <span class="field-value">
                    <a href="${grafanaAlertDrilldownUrl}" style="color: #2563eb; text-decoration: none;">View in Grafana →</a>
                </span>
            </div>
            <div class="field">
                <span class="field-label">Cooldown Period:</span>
                <span class="field-value">${this.COOLDOWN_HOURS} hours</span>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * Send alert email to system administrators
     */
    async sendAlert(alert: Alert): Promise<void> {
        // Check cooldown
        if (!(await this.shouldSendAlert(alert.type))) {
            await this.logService.logMessage(
                LogLevel.INFO,
                `Alert ${alert.type} skipped due to cooldown period`,
                "SystemMonitoringService",
                { alertType: alert.type }
            );
            return;
        }

        try {
            // Get admin emails
            const adminEmails = await this.getSystemAdminEmails();

            // Override emails if environment variable is set
            const emailOverride = process.env.SYSTEM_ALERT_EMAIL_OVERRIDE;
            const recipientEmails = emailOverride
                ? emailOverride.split(",").map((e) => e.trim())
                : adminEmails;

            if (recipientEmails.length === 0) {
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `No recipient emails found for alert ${alert.type}`,
                    "SystemMonitoringService",
                    { alertType: alert.type }
                );
                return;
            }

            // Format email
            const emailService = new EmailService();
            // Set default sender name for system alerts
            emailService.setSenderName("ARchaser System Monitor");
            // Note: EmailService automatically adds environment prefix to subject
            const subject = `[SYSTEM ALERT] [${alert.severity}] ${alert.type} - ${alert.message}`;

            const htmlContent = this.generateAlertEmailHTML(alert);

            // Send email to all recipients
            const emailPromises = recipientEmails.map((recipient) =>
                emailService
                    .sendEmail(recipient, subject, htmlContent)
                    .then(async () => {
                        await this.logService.logMessage(
                            LogLevel.INFO,
                            `Alert email sent to ${recipient}`,
                            "SystemMonitoringService",
                            { email: recipient, alertType: alert.type }
                        );
                    })
                    .catch(async (error) => {
                        // Log error but continue to other emails
                        await this.logService.logMessage(
                            LogLevel.ERROR,
                            `Failed to send alert to ${recipient}: ${error instanceof Error ? error.message : String(error)}`,
                            "SystemMonitoringService",
                            {
                                email: recipient,
                                alertType: alert.type,
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : String(error),
                            }
                        );
                    })
            );

            await Promise.allSettled(emailPromises);

            // Update cooldown
            await this.updateCooldown(alert.type);

            await this.logService.logMessage(
                LogLevel.INFO,
                `Alert ${alert.type} sent to ${recipientEmails.length} recipient(s)`,
                "SystemMonitoringService",
                {
                    alertType: alert.type,
                    recipientCount: recipientEmails.length,
                }
            );
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to send alert: ${error instanceof Error ? error.message : String(error)}`,
                "SystemMonitoringService",
                {
                    alertType: alert.type,
                    error:
                        error instanceof Error ? error.message : String(error),
                }
            );
            // Don't throw - we don't want to break monitoring if email fails
        }
    }

    /**
     * Check cron job health (future implementation)
     */
    async checkCronJobHealth(): Promise<Alert | null> {
        // Future implementation
        return null;
    }

    /**
     * Check activity processing health (future implementation)
     */
    async checkActivityProcessingHealth(): Promise<Alert | null> {
        // Future implementation
        return null;
    }

    /**
     * Check for stuck activities (activities with SCHEDULED status where schedule_time has passed)
     */
    async checkStuckActivities(): Promise<Alert | null> {
        try {
            // Find activities scheduled in past but not processed
            const stuckActivities = await this.safePrismaQuery(
                () =>
                    prisma.activity.findMany({
                        where: {
                            status: "SCHEDULED", // ActivityStatus.SCHEDULED = 15
                            schedule_time: {
                                lt: new Date(
                                    Date.now() -
                                    this.STUCK_ACTIVITY_THRESHOLD_HOURS *
                                    60 *
                                    60 *
                                    1000
                                ),
                            },
                            system_generated: true,
                        },
                        select: {
                            id: true,
                            schedule_time: true,
                            created_at: true,
                            collection_period_id: true,
                            Customer: {
                                select: {
                                    id: true,
                                    account_id: true,
                                    Person: {
                                        select: {
                                            first_name: true,
                                            last_name: true,
                                        },
                                    },
                                    Company: { select: { name: true } },
                                },
                            },
                        },
                        take: 100, // Limit to prevent huge queries
                    }),
                "checkStuckActivities"
            );

            if (!stuckActivities || stuckActivities.length === 0) {
                return null;
            }

            // Group by account for better reporting
            const stuckByAccount = new Map<number, number>();
            stuckActivities.forEach((activity) => {
                const accountId = activity.Customer?.account_id;
                if (accountId) {
                    stuckByAccount.set(
                        accountId,
                        (stuckByAccount.get(accountId) || 0) + 1
                    );
                }
            });

            // Get total count (may be more than the 100 we fetched)
            const totalStuckCount =
                (await this.safePrismaQuery(
                    () =>
                        prisma.activity.count({
                            where: {
                                status: "SCHEDULED",
                                schedule_time: {
                                    lt: new Date(
                                        Date.now() -
                                        this
                                            .STUCK_ACTIVITY_THRESHOLD_HOURS *
                                        60 *
                                        60 *
                                        1000
                                    ),
                                },
                                system_generated: true,
                            },
                        }),
                    "checkStuckActivities_count"
                )) || 0;

            const oldestStuck = stuckActivities.sort(
                (a, b) => a.schedule_time.getTime() - b.schedule_time.getTime()
            )[0];

            const hoursStuck = oldestStuck
                ? Math.round(
                    ((Date.now() - oldestStuck.schedule_time.getTime()) /
                        (1000 * 60 * 60)) *
                    10
                ) / 10
                : 0;

            return {
                type: "STUCK_ACTIVITIES",
                severity: "MEDIUM",
                message: `${totalStuckCount} activities are stuck (scheduled in past but not processed)`,
                details: {
                    stuckCount: totalStuckCount,
                    oldestStuckHours: hoursStuck,
                    oldestStuckScheduleTime:
                        oldestStuck?.schedule_time.toISOString(),
                    stuckByAccount: Object.fromEntries(stuckByAccount),
                    sampleActivityIds: stuckActivities
                        .slice(0, 10)
                        .map((a) => a.id),
                },
                timestamp: new Date(),
                recommendedActions: [
                    "Check Activity Workflow Manager cron job status",
                    "Verify activity processing service is running",
                    "Review activity status transitions",
                    "Check for database connection issues",
                ],
            };
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to check stuck activities: ${error instanceof Error ? error.message : String(error)}`,
                "SystemMonitoringService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                }
            );
            return null;
        }
    }

    /**
     * Check for collection periods where next_activity_date has passed but no activity was created
     */
    async checkNextActivityScheduleDate(): Promise<Alert | null> {
        try {
            const now = new Date();

            // Find collection periods where next_activity_date has passed but no activity was created
            const stuckPeriods = await this.safePrismaQuery(
                () =>
                    prisma.customerCollectionPeriod.findMany({
                        where: {
                            period_end_date: null,
                            current_category: "Automated",
                            create_next_activity: true,
                            next_activity_date: {
                                lt: now, // Date has passed
                            },
                            Customer: {
                                automation_stuck_no_contacts: { not: true },
                            },
                        },
                        select: {
                            id: true,
                            customer_id: true,
                            next_activity_date: true,
                            create_next_activity: true,
                            Customer: {
                                select: {
                                    id: true,
                                    account_id: true,
                                    Person: {
                                        select: {
                                            first_name: true,
                                            last_name: true,
                                        },
                                    },
                                    Company: {
                                        select: { name: true },
                                    },
                                },
                            },
                            Activity: {
                                where: {
                                    system_generated: true,
                                },
                                select: { id: true, created_at: true },
                                orderBy: { created_at: "desc" },
                                take: 1,
                            },
                        },
                        take: 100, // Limit for performance
                    }),
                "checkNextActivityScheduleDate"
            );

            if (!stuckPeriods || stuckPeriods.length === 0) {
                return null;
            }

            // Filter out periods that actually have activities created after next_activity_date
            const trulyStuckPeriods = stuckPeriods.filter((cp) => {
                if (!cp.next_activity_date) {
                    return true; // No date set, consider stuck
                }
                // Check if any activity was created after next_activity_date
                const nextActivityDate = cp.next_activity_date;
                const hasActivityAfterDate = cp.Activity.some(
                    (activity) => activity.created_at >= nextActivityDate
                );
                return !hasActivityAfterDate; // Stuck if no activity after the scheduled date
            });

            if (trulyStuckPeriods.length === 0) {
                return null;
            }

            // Get total count (may be more than 100)
            const totalStuckCount =
                (await this.safePrismaQuery(
                    () =>
                        prisma.customerCollectionPeriod.count({
                            where: {
                                period_end_date: null,
                                current_category: "Automated",
                                create_next_activity: true,
                                next_activity_date: {
                                    lt: now,
                                },
                                Customer: {
                                    automation_stuck_no_contacts: { not: true },
                                },
                            },
                        }),
                    "checkNextActivityScheduleDate_count"
                )) || 0;

            // Group by account
            const stuckByAccount = new Map<number, number>();
            const oldestStuck = trulyStuckPeriods.sort((a, b) => {
                const dateA = a.next_activity_date?.getTime() || 0;
                const dateB = b.next_activity_date?.getTime() || 0;
                return dateA - dateB;
            })[0];

            trulyStuckPeriods.forEach((cp) => {
                const accountId = cp.Customer?.account_id;
                if (accountId) {
                    stuckByAccount.set(
                        accountId,
                        (stuckByAccount.get(accountId) || 0) + 1
                    );
                }
            });

            const hoursOverdue = oldestStuck?.next_activity_date
                ? Math.round(
                    ((now.getTime() -
                        oldestStuck.next_activity_date.getTime()) /
                        (1000 * 60 * 60)) *
                    10
                ) / 10
                : 0;

            return {
                type: "NEXT_ACTIVITY_SCHEDULE_DATE_PASSED",
                severity: "HIGH",
                message: `${totalStuckCount} collection period(s) have passed their next activity schedule date without activity creation`,
                details: {
                    stuckCount: totalStuckCount,
                    oldestStuckHoursOverdue: hoursOverdue,
                    oldestStuckScheduleDate:
                        oldestStuck?.next_activity_date?.toISOString(),
                    oldestStuckCollectionPeriodId: oldestStuck?.id,
                    oldestStuckCustomerId: oldestStuck?.customer_id,
                    stuckByAccount: Object.fromEntries(stuckByAccount),
                    sampleCollectionPeriodIds: trulyStuckPeriods
                        .slice(0, 10)
                        .map((cp) => cp.id),
                },
                timestamp: new Date(),
                recommendedActions: [
                    "Check Activity Workflow Manager cron job status",
                    "Verify activity creation process is running",
                    "Review collection periods with passed next_activity_date",
                    "Check for errors preventing activity creation",
                ],
            };
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to check next activity schedule date: ${error instanceof Error ? error.message : String(error)}`,
                "SystemMonitoringService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                }
            );
            return null;
        }
    }

    /**
     * Check for cron job failures (Process Automated Collection Periods and Activity Workflow Manager)
     */
    async checkCronJobFailures(): Promise<Alert | null> {
        try {
            const monitoredJobs = [
                "Process Automated Collection Periods",
                "Activity Workflow Manager",
            ];

            const jobChecks = await Promise.all(
                monitoredJobs.map((jobName) =>
                    this.checkSingleJobFailure(jobName)
                )
            );

            const failedJobs = jobChecks.filter(
                (alert) => alert !== null
            ) as Alert[];

            if (failedJobs.length === 0) {
                return null;
            }

            // If multiple jobs failed, create a combined alert
            if (failedJobs.length > 1) {
                return {
                    type: "MULTIPLE_CRON_JOB_FAILURES",
                    severity: "HIGH",
                    message: `${failedJobs.length} critical cron jobs have failed`,
                    details: {
                        failedJobs: failedJobs.map((alert) => ({
                            jobName: alert.details.jobName,
                            lastRunAt: alert.details.lastRunAt,
                            hoursSinceLastRun: alert.details.hoursSinceLastRun,
                            alertType: alert.type,
                        })),
                    },
                    timestamp: new Date(),
                    recommendedActions: [
                        "Check cron job execution logs",
                        "Verify cron job scheduler is running",
                        "Review recent error logs for each job",
                        "Check database connectivity",
                    ],
                };
            }

            // Return single job failure alert
            return failedJobs[0];
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to check cron job failures: ${error instanceof Error ? error.message : String(error)}`,
                "SystemMonitoringService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                }
            );
            return null;
        }
    }

    /**
     * Check a single cron job for failures
     */
    private async checkSingleJobFailure(
        jobName: string
    ): Promise<Alert | null> {
        try {
            const job = await this.safePrismaQuery(
                () =>
                    prisma.cronJob.findFirst({
                        where: { name: jobName },
                        select: {
                            id: true,
                            name: true,
                            active: true,
                            last_run_at: true,
                            cron_expression: true,
                            next_run_at: true,
                            modified_at: true,
                        },
                    }),
                `checkSingleJobFailure_${jobName}`
            );

            if (!job) {
                return {
                    type: "CRON_JOB_NOT_FOUND",
                    severity: "HIGH",
                    message: `Cron job "${jobName}" not found in database`,
                    details: { jobName },
                    timestamp: new Date(),
                    recommendedActions: [
                        `Verify "${jobName}" cron job exists in database`,
                        "Check cron job configuration",
                    ],
                };
            }

            // Check if job is stuck (active for too long)
            // A job should only be active while it's running, not for extended periods
            if (job.active && job.modified_at) {
                const activeDuration =
                    Date.now() - new Date(job.modified_at).getTime();
                const activeHours = activeDuration / (1000 * 60 * 60);
                const STUCK_JOB_THRESHOLD_HOURS = 2; // Consider stuck if active for more than 2 hours

                if (activeHours > STUCK_JOB_THRESHOLD_HOURS) {
                    return {
                        type: "CRON_JOB_STUCK",
                        severity: "HIGH",
                        message: `Cron job "${jobName}" appears to be stuck (active for ${Math.round(activeHours * 10) / 10} hours)`,
                        details: {
                            jobName,
                            jobId: job.id,
                            activeDurationHours:
                                Math.round(activeHours * 10) / 10,
                            lastModifiedAt: job.modified_at.toISOString(),
                        },
                        timestamp: new Date(),
                        recommendedActions: [
                            `Check if "${jobName}" is actually running`,
                            "Review job execution logs",
                            "Consider manually resetting the job if it's stuck",
                        ],
                    };
                }
            }

            // Check if job should have run but didn't (next_run_at is in the past and job is inactive)
            // This indicates the scheduler might not be running or there's an issue
            if (!job.active && job.next_run_at) {
                const now = new Date();
                const nextRunAt = new Date(job.next_run_at);
                const overdueMinutes =
                    (now.getTime() - nextRunAt.getTime()) / (1000 * 60);

                // Only alert if the job is overdue by more than 30 minutes
                // This gives some buffer for normal scheduling delays
                if (overdueMinutes > 30) {
                    return {
                        type: "CRON_JOB_OVERDUE",
                        severity: "MEDIUM",
                        message: `Cron job "${jobName}" should have run ${Math.round(overdueMinutes)} minutes ago but hasn't started`,
                        details: {
                            jobName,
                            jobId: job.id,
                            nextRunAt: job.next_run_at.toISOString(),
                            overdueMinutes: Math.round(overdueMinutes),
                            lastRunAt:
                                job.last_run_at?.toISOString() || "Never",
                        },
                        timestamp: new Date(),
                        recommendedActions: [
                            "Verify cron scheduler is running",
                            `Check if "${jobName}" is blocked by another running job`,
                            "Review scheduler logs for errors",
                        ],
                    };
                }
            }

            // Note: CronJob model doesn't have last_error field
            // Error tracking is done through logs instead

            // Check if job hasn't run in expected time
            // For these jobs, expect them to run at least once every 6 hours
            const EXPECTED_MAX_HOURS_BETWEEN_RUNS =
                this.CRON_JOB_STALE_THRESHOLD_HOURS;
            if (job.last_run_at) {
                const hoursSinceLastRun =
                    (Date.now() - new Date(job.last_run_at).getTime()) /
                    (1000 * 60 * 60);
                if (hoursSinceLastRun > EXPECTED_MAX_HOURS_BETWEEN_RUNS) {
                    return {
                        type: "CRON_JOB_STALE",
                        severity: "MEDIUM",
                        message: `Cron job "${jobName}" hasn't run in ${Math.round(hoursSinceLastRun * 10) / 10} hours`,
                        details: {
                            jobName,
                            jobId: job.id,
                            lastRunAt: job.last_run_at.toISOString(),
                            hoursSinceLastRun:
                                Math.round(hoursSinceLastRun * 10) / 10,
                            expectedMaxHours: EXPECTED_MAX_HOURS_BETWEEN_RUNS,
                        },
                        timestamp: new Date(),
                        recommendedActions: [
                            `Check why "${jobName}" hasn't run recently`,
                            "Verify cron scheduler is working",
                            "Check for job execution errors",
                        ],
                    };
                }
            } else {
                // Job has never run
                return {
                    type: "CRON_JOB_NEVER_RUN",
                    severity: "HIGH",
                    message: `Cron job "${jobName}" has never run`,
                    details: {
                        jobName,
                        jobId: job.id,
                    },
                    timestamp: new Date(),
                    recommendedActions: [
                        `Manually trigger "${jobName}" to test`,
                        "Check cron job configuration",
                        "Verify cron scheduler is running",
                    ],
                };
            }

            return null;
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to check single job failure for ${jobName}: ${error instanceof Error ? error.message : String(error)}`,
                "SystemMonitoringService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                    jobName,
                }
            );
            return null;
        }
    }
}
