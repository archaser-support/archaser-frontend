import { prisma } from "@/lib/prisma";
import { ensureMongoConnection } from "@/lib/mongoose";
import Log from "@/models/Log";
import nodemailer from "nodemailer";
import * as metrics from "./metrics";

// Cache the last update time to prevent too frequent updates
let lastUpdateTime = 0;
const UPDATE_INTERVAL_MS = 60000; // Update every 60 seconds

/**
 * Updates all Prometheus gauges with current application health data.
 * Called on each /api/metrics request to ensure fresh data.
 */
export async function updateMetrics(): Promise<void> {
    const now = Date.now();

    // Skip if updated recently
    if (now - lastUpdateTime < UPDATE_INTERVAL_MS) {
        return;
    }

    lastUpdateTime = now;

    const currentTime = new Date();
    const oneHourAgo = new Date(currentTime.getTime() - 1 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(
        currentTime.getTime() - 24 * 60 * 60 * 1000
    );
    const sevenDaysAgo = new Date(
        currentTime.getTime() - 7 * 24 * 60 * 60 * 1000
    );
    const twoHoursAgo = new Date(currentTime.getTime() - 2 * 60 * 60 * 1000);

    // ============================================================
    // System & Database Health Metrics (High Priority)
    // ============================================================
    try {
        await prisma.$queryRaw`SELECT 1`;
        metrics.dbPostgresConnected.set(1);

        // Fetch Postgres active connections
        const pgStats = await prisma.$queryRaw<any[]>`SELECT count(*) as count FROM pg_stat_activity`;
        const pgCount = Number(pgStats[0]?.count || 0);
        metrics.dbPostgresConnections.set(pgCount);
    } catch (error) {
        console.error("Postgres health check failed:", error);
        metrics.dbPostgresConnected.set(0);
        metrics.dbPostgresConnections.set(0);
    }

    if (process.env.NODE_ENV !== "development") {
        try {
            await ensureMongoConnection();
            metrics.dbMongodbConnected.set(1);

            // Fetch MongoDB active connections
            const mongoose = (await import("@/lib/mongoose")).default;
            if (mongoose.connection.db) {
                const mongoStats = await mongoose.connection.db.command({ serverStatus: 1 });
                const mongoCount = mongoStats.connections?.current || 0;
                metrics.dbMongodbConnections.set(mongoCount);
            }
        } catch (error) {
            console.error("MongoDB health check failed:", error);
            metrics.dbMongodbConnected.set(0);
            metrics.dbMongodbConnections.set(0);
        }
    } else {
        metrics.dbMongodbConnected.set(0);
        metrics.dbMongodbConnections.set(0);
    }

    // ============================================================
    // Communication Provider Connection Metrics
    // ============================================================
    try {
        const host = process.env.EMAIL_SERVER_HOST || "";
        const portRaw = process.env.EMAIL_SERVER_PORT || "";
        const user = process.env.EMAIL_SERVER_USER || "";
        const pass = process.env.EMAIL_SERVER_PASSWORD || "";
        const from = process.env.EMAIL_FROM || "";
        const port = parseInt(portRaw || "0", 10);

        const smtpConfigured =
            host.trim() !== "" &&
            Number.isFinite(port) &&
            port > 0 &&
            user.trim() !== "" &&
            pass.trim() !== "" &&
            from.trim() !== "";

        let smtpConnected = 0;
        if (smtpConfigured) {
            try {
                const transporter = nodemailer.createTransport({
                    host,
                    port,
                    secure: port === 465,
                    auth: {
                        user,
                        pass,
                    },
                    connectionTimeout: 3000,
                    greetingTimeout: 3000,
                    socketTimeout: 5000,
                });
                await transporter.verify();
                smtpConnected = 1;
            } catch {
                smtpConnected = 0;
            }
        }
        metrics.emailSmtpConnected.set(smtpConnected);

        const sesConfigured =
            host.toLowerCase().includes("amazonaws.com") ||
            !!process.env.SES_CONFIGURATION_SET;
        metrics.emailSesConnected.set(sesConfigured && smtpConnected ? 1 : 0);

        const activeVendors = await prisma.sMSVendor.findMany({
            where: { is_active: true },
            select: {
                id: true,
                name: true,
                provider: true,
                api_key: true,
                account_sid: true,
                auth_token: true,
            },
            orderBy: [{ priority: "asc" }, { id: "asc" }],
        });

        metrics.smsProvidersConfiguredTotal.set(activeVendors.length);
        metrics.smsProviderStatus.reset();

        for (const vendor of activeVendors) {
            const provider = String(vendor.provider || "")
                .trim()
                .toLowerCase();
            let stateValue = 0;
            if (provider === "twilio") {
                stateValue =
                    vendor.account_sid && vendor.auth_token ? 2 : 1;
            } else if (provider === "messagebird" || provider === "inforu") {
                stateValue = vendor.api_key ? 2 : 1;
            } else {
                stateValue =
                    vendor.api_key || (vendor.account_sid && vendor.auth_token)
                        ? 2
                        : 1;
            }

            metrics.smsProviderStatus
                .labels(
                    String(vendor.id),
                    vendor.name || `Vendor-${vendor.id}`,
                    vendor.provider || "unknown"
                )
                .set(stateValue);
        }
    } catch (error) {
        console.error("Communication connection metrics update failed:", error);
        metrics.emailSmtpConnected.set(0);
        metrics.emailSesConnected.set(0);
        metrics.smsProvidersConfiguredTotal.set(0);
        metrics.smsProviderStatus.reset();
    }

    try {
        // ============================================================
        // Cron Job Metrics
        // ============================================================
        const allCronJobs = await prisma.cronJob.findMany({
            select: {
                id: true,
                name: true,
                active: true,
                next_run_at: true,
                last_run_at: true,
                last_execution_duration_seconds: true,
                success_count_30d: true,
                failure_count_30d: true,
                timeout_count_30d: true,
            },
        });


        const totalJobs = allCronJobs.length;
        const runningJobs = allCronJobs.filter(
            (job) => job.active === true
        ).length;
        // Add 5-minute tolerance buffer to avoid false positives from timing/race conditions
        // Jobs are only considered overdue if they haven't run 5+ minutes past their scheduled time
        const fiveMinutesAgo = new Date(currentTime.getTime() - 5 * 60 * 1000);
        const overdueJobs = allCronJobs.filter(
            (job) => job.next_run_at && job.next_run_at < fiveMinutesAgo
        ).length;
        const notRunIn24h = allCronJobs.filter(
            (job) => !job.last_run_at || job.last_run_at < twentyFourHoursAgo
        ).length;

        // Calculate success rate
        const totalExecutions =
            allCronJobs.reduce(
                (sum: number, job) => sum + (job.success_count_30d || 0),
                0
            ) +
            allCronJobs.reduce(
                (sum: number, job) => sum + (job.failure_count_30d || 0),
                0
            ) +
            allCronJobs.reduce(
                (sum: number, job) => sum + (job.timeout_count_30d || 0),
                0
            );
        const totalSuccesses = allCronJobs.reduce(
            (sum: number, job) => sum + (job.success_count_30d || 0),
            0
        );
        const successRate =
            totalExecutions > 0 ? (totalSuccesses / totalExecutions) * 100 : 0;

        metrics.cronJobsTotal.set(totalJobs);
        metrics.cronJobsRunning.set(runningJobs);
        metrics.cronJobsOverdue.set(overdueJobs);
        metrics.cronJobsNotRun24h.set(notRunIn24h);
        metrics.cronJobSuccessRate.set(successRate);

        // Update per-job metrics
        allCronJobs.forEach((job) => {
            if (job.name) {
                if (job.last_execution_duration_seconds !== null) {
                    metrics.cronJobDuration
                        .labels(job.name)
                        .set(job.last_execution_duration_seconds);
                }
                if (job.last_run_at) {
                    metrics.cronJobLastRun
                        .labels(job.name)
                        .set(Math.floor(job.last_run_at.getTime() / 1000));
                }
                if (job.next_run_at) {
                    metrics.cronJobNextRun
                        .labels(job.name)
                        .set(Math.floor(job.next_run_at.getTime() / 1000));
                }
            }
        });

        // ============================================================
        // Activity Metrics
        // ============================================================
        const [
            emailsSent24h,
            emailsFailed24h,
            emailsBounced24h,
            smsSent24h,
            smsFailed24h,
            stuckActivities,
            systemActivitiesCreated,
            lastSystemActivity,
            emailContactsTotal,
            emailContactsDelivered,
            emailContactsOpened,
            emailContactsClicked,
            emailContactsBounced,
            emailContactsFailed,
        ] = await Promise.all([
            prisma.activity.count({
                where: {
                    type: "Email",
                    actual_delivery_time: { gte: twentyFourHoursAgo },
                },
            }),
            prisma.activity.count({
                where: {
                    type: "Email",
                    status: "FAILED",
                    created_at: { gte: twentyFourHoursAgo },
                },
            }),
            prisma.activity.count({
                where: {
                    type: "Email",
                    status: "BOUNCED",
                    created_at: { gte: twentyFourHoursAgo },
                },
            }),
            prisma.activity.count({
                where: {
                    type: "SMS",
                    actual_delivery_time: { gte: twentyFourHoursAgo },
                },
            }),
            prisma.activity.count({
                where: {
                    type: "SMS",
                    status: "FAILED",
                    created_at: { gte: twentyFourHoursAgo },
                },
            }),
            prisma.activity.count({
                where: {
                    status: "SCHEDULED",
                    schedule_time: { lt: twoHoursAgo },
                    system_generated: true,
                },
            }),
            // Count system-generated activities created in last 24 hours
            prisma.activity.count({
                where: {
                    system_generated: true,
                    created_at: { gte: twentyFourHoursAgo },
                },
            }),
            // Get last system-generated activity creation time
            prisma.activity.findFirst({
                where: { system_generated: true },
                orderBy: { created_at: "desc" },
                select: { created_at: true },
            }),
            // New Email Contact Metrics - filter by Email channel only
            prisma.activityContact.count({
                where: {
                    communication_channel: 'Email',
                    created_at: { gte: twentyFourHoursAgo }
                },
            }),
            prisma.activityContact.count({
                where: {
                    communication_channel: 'Email',
                    delivered_at: { gte: twentyFourHoursAgo }
                },
            }),
            prisma.activityContact.count({
                where: {
                    communication_channel: 'Email',
                    email_opened_at: { gte: twentyFourHoursAgo }
                },
            }),
            prisma.activityContact.count({
                where: {
                    communication_channel: 'Email',
                    email_clicked_at: { gte: twentyFourHoursAgo }
                },
            }),
            prisma.activityContact.count({
                where: {
                    communication_channel: 'Email',
                    bounced_at: { gte: twentyFourHoursAgo }
                },
            }),
            prisma.activityContact.count({
                where: {
                    communication_channel: 'Email',
                    failed_at: { gte: twentyFourHoursAgo }
                },
            }),
        ]);

        metrics.emailsSent.set(emailsSent24h);
        metrics.emailsFailed.set(emailsFailed24h);
        metrics.emailsBounced.set(emailsBounced24h);
        metrics.smsSent.set(smsSent24h);
        metrics.smsFailed.set(smsFailed24h);
        metrics.activitiesStuck.set(stuckActivities);
        metrics.systemActivitiesCreated24h.set(systemActivitiesCreated);

        metrics.emailContactsTotal24h.set(emailContactsTotal);
        metrics.emailContactsDelivered24h.set(emailContactsDelivered);
        metrics.emailContactsOpened24h.set(emailContactsOpened);
        metrics.emailContactsClicked24h.set(emailContactsClicked);
        metrics.emailContactsBounced24h.set(emailContactsBounced);
        metrics.emailContactsFailed24h.set(emailContactsFailed);

        // Calculate hours since last system activity
        if (lastSystemActivity?.created_at) {
            const hoursSinceLast =
                (currentTime.getTime() - lastSystemActivity.created_at.getTime()) /
                (1000 * 60 * 60);
            metrics.hoursSinceLastSystemActivity.set(
                Math.round(hoursSinceLast * 10) / 10
            );
        } else {
            // No system activities exist, set to a high value to trigger alerts
            metrics.hoursSinceLastSystemActivity.set(999);
        }

        // ============================================================
        // Import Metrics
        // ============================================================
        const [importsPending, importsStuck, imports24h] = await Promise.all([
            prisma.importJob.count({
                where: { status: { in: ["Pending", "Processing"] } },
            }),
            prisma.importJob.count({
                where: {
                    status: { in: ["Pending", "Processing"] },
                    created_at: { lt: oneHourAgo },
                },
            }),
            prisma.importJob.count({
                where: { created_at: { gte: twentyFourHoursAgo } },
            }),
        ]);

        metrics.importJobsPending.set(importsPending);
        metrics.importJobsStuck.set(importsStuck);
        metrics.importJobsSuccess24h.set(imports24h);

        // ============================================================
        // Collection Period Health Metrics
        // ============================================================
        const [
            activeCollPeriods,
            stuckNoContacts,
            withoutActivities,
            overdueCreation,
        ] = await Promise.all([
            prisma.customerCollectionPeriod.count({
                where: { period_end_date: null },
            }),
            prisma.customer.count({
                where: {
                    automation_stuck_no_contacts: true,
                },
            }),
            prisma.customerCollectionPeriod.count({
                where: {
                    period_end_date: null,
                    current_category: "Automated",
                    OR: [
                        { next_activity_date: null },
                        { next_activity_date: { lt: twentyFourHoursAgo } },
                    ],
                    // Match ActivityService.hasScheduledAutomatedActivities: workflow clears
                    // next_activity_date when an automated activity row exists in SCHEDULED.
                    NOT: {
                        Activity: {
                            some: {
                                status: "SCHEDULED",
                                ActivitiesSequence: {
                                    is: { category: "Automated" },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.customerCollectionPeriod.count({
                where: {
                    period_end_date: null,
                    create_next_activity: true,
                    next_activity_date: { lt: currentTime },
                },
            }),
        ]);

        metrics.activeCollectionPeriods.set(activeCollPeriods);
        metrics.automationStuckNoContacts.set(stuckNoContacts);
        metrics.periodsWithoutActivities.set(withoutActivities);
        metrics.overdueActivityCreation.set(overdueCreation);

        // ============================================================
        // Dispute Metrics
        // ============================================================
        // dispute_status enum: New, Under_Review, Awaiting_Update, Resolved, Cancelled
        const [
            openDisputes,
            pendingDisputes,
            created24h,
            resolved24h,
            staleDisputes,
        ] = await Promise.all([
            prisma.customerDispute.count({
                where: { dispute_status: "New" },
            }),
            prisma.customerDispute.count({
                where: { dispute_status: { in: ["New", "Under_Review", "Awaiting_Update"] } },
            }),
            prisma.customerDispute.count({
                where: { created_at: { gte: twentyFourHoursAgo } },
            }),
            prisma.customerDispute.count({
                where: { closed_at: { gte: twentyFourHoursAgo } },
            }),
            prisma.customerDispute.count({
                where: {
                    dispute_status: { in: ["New", "Under_Review", "Awaiting_Update"] },
                    created_at: { lt: sevenDaysAgo },
                },
            }),
        ]);

        metrics.disputesOpen.set(openDisputes);
        metrics.disputesPending.set(pendingDisputes);
        metrics.disputesCreated24h.set(created24h);
        metrics.disputesResolved24h.set(resolved24h);
        metrics.disputesStale.set(staleDisputes);

        // ============================================================
        // Promise to Pay Metrics
        // ============================================================
        const todayStart = new Date(currentTime);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(currentTime);
        todayEnd.setHours(23, 59, 59, 999);

        const [activePTPs, ptpToday, brokenPTPs] = await Promise.all([
            prisma.customerCollectionPeriod.count({
                where: {
                    period_end_date: null,
                    promise_to_pay_date: { gte: currentTime },
                },
            }),
            prisma.customerCollectionPeriod.count({
                where: {
                    period_end_date: null,
                    promise_to_pay_date: { gte: todayStart, lte: todayEnd },
                },
            }),
            prisma.customerCollectionPeriod.count({
                where: {
                    period_end_date: null,
                    promise_to_pay_date: { lt: currentTime },
                    total_outstanding_amount: { gt: 0 },
                },
            }),
        ]);

        metrics.ptpActive.set(activePTPs);
        metrics.ptpDueToday.set(ptpToday);
        metrics.ptpBroken.set(brokenPTPs);

        // ============================================================
        // Contact Health Metrics
        // ============================================================
        const [
            highBounce,
            highSMSFail,
            lowCommScore,
            recentBounces,
            recentSMSFails,
        ] = await Promise.all([
            prisma.contact.count({
                where: { email_bounce_count: { gte: 3 } },
            }),
            prisma.contact.count({
                where: { sms_delivery_failure_count: { gte: 3 } },
            }),
            prisma.contact.count({
                where: { communication_score: { lt: 0.5 } },
            }),
            prisma.contact.count({
                where: { last_email_bounce: { gte: twentyFourHoursAgo } },
            }),
            prisma.contact.count({
                where: { last_sms_failure: { gte: twentyFourHoursAgo } },
            }),
        ]);

        metrics.contactsHighBounce.set(highBounce);
        metrics.contactsHighSMSFailure.set(highSMSFail);
        metrics.contactsLowCommScore.set(lowCommScore);
        metrics.recentEmailBounces.set(recentBounces);
        metrics.recentSMSFailures.set(recentSMSFails);



        // ============================================================
        // Error Log Metrics (MongoDB)
        // ============================================================
        if (process.env.NODE_ENV !== "development") {
            try {
                await ensureMongoConnection();
                const [errors1h, errors24h, warnings24h] = await Promise.all([
                    Log.countDocuments({
                        level: "ERROR",
                        timestamp: { $gte: oneHourAgo },
                    }),
                    Log.countDocuments({
                        level: "ERROR",
                        timestamp: { $gte: twentyFourHoursAgo },
                    }),
                    Log.countDocuments({
                        level: "WARNING",
                        timestamp: { $gte: twentyFourHoursAgo },
                    }),
                ]);

                metrics.applicationErrors1h.set(errors1h);
                metrics.applicationErrors24h.set(errors24h);
                metrics.applicationWarnings24h.set(warnings24h);
            } catch (mongoError) {
                // Continue without MongoDB metrics if there's an error
                console.error("Failed to fetch error logs from MongoDB:", mongoError);
            }
        }

        // ============================================================
        // Billing Connector Metrics
        // ============================================================
        try {
            const connectorsInError = await prisma.billingConnector.groupBy({
                by: ["provider"],
                where: { status: "Error" },
                _count: { id: true },
            });
            const errorByProvider = new Map(
                connectorsInError.map((row) => [row.provider, row._count.id])
            );
            for (const provider of ["PRIORITY", "SAP_BUSINESS_ONE"] as const) {
                metrics.billingConnectorConnectorsInError.set(
                    { provider },
                    errorByProvider.get(provider) ?? 0
                );
            }

            const latestCheckpoint = await prisma.connectorSyncState.aggregate({
                _max: { backfill_last_checkpoint_at: true },
            });
            const checkpointTs =
                latestCheckpoint._max.backfill_last_checkpoint_at?.getTime() ??
                0;
            metrics.billingConnectorLastCheckpointTimestamp.set(
                { provider: "PRIORITY" },
                checkpointTs / 1000
            );

            if (process.env.NODE_ENV !== "development") {
                await ensureMongoConnection();
                const ConnectorSyncExecution = (
                    await import("@/models/ConnectorSyncExecution")
                ).default;
                const staleCutoff = new Date(Date.now() - 15 * 60 * 1000);
                const staleRunning = await ConnectorSyncExecution.countDocuments({
                    status: "RUNNING",
                    started_at: { $lt: staleCutoff },
                });
                metrics.billingConnectorStaleRunningCount.set(staleRunning);
            }
        } catch (billingMetricsError) {
            console.error(
                "Failed to update billing connector metrics:",
                billingMetricsError
            );
        }
    } catch (error) {
        console.error("Error updating Prometheus metrics:", error);
    }
}
