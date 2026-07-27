import { Prisma, ReportSchedule } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";
import { LogService } from "./LogService";
import { ReportExecutionService } from "./ReportExecutionService";
import { ReportExportService } from "./ReportExportService";

interface ScheduleConfig {
    scheduleType: "daily" | "weekly" | "monthly" | "custom";
    dayOfWeek?: number; // 0-6 (Sunday-Saturday)
    dayOfMonth?: number; // 1-31
    time?: string; // HH:mm format
    timezone?: string;
    recipients?: string[];
    format?: "csv" | "excel" | "pdf";
    cronExpression?: string; // For custom schedules
}

interface CreateScheduleData {
    reportId: number;
    scheduleType: string;
    scheduleConfig: ScheduleConfig;
    accountId: number;
    userId?: string;
}

export class ReportScheduleService {
    private static instance: ReportScheduleService;
    private logService = LogService.getInstance();

    public static getInstance(): ReportScheduleService {
        if (!ReportScheduleService.instance) {
            ReportScheduleService.instance = new ReportScheduleService();
        }
        return ReportScheduleService.instance;
    }

    /**
     * Calculate next run time based on schedule
     */
    private calculateNextRun(
        scheduleType: string,
        config: ScheduleConfig
    ): Date {
        const now = new Date();
        const time = config.time || "09:00";
        const [hours, minutes] = time.split(":").map(Number);

        let nextRun = new Date(now);
        nextRun.setHours(hours, minutes, 0, 0);

        switch (scheduleType) {
            case "daily":
                // Every day at specified time
                if (nextRun <= now) {
                    nextRun.setDate(nextRun.getDate() + 1);
                }
                break;

            case "weekly":
                // Specific day of week
                const dayOfWeek = config.dayOfWeek ?? 1; // Default to Monday
                const currentDay = now.getDay();
                const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;

                if (daysUntilTarget === 0 && nextRun <= now) {
                    nextRun.setDate(nextRun.getDate() + 7);
                } else {
                    nextRun.setDate(nextRun.getDate() + daysUntilTarget);
                }
                break;

            case "monthly":
                // Specific day of month
                const dayOfMonth = config.dayOfMonth ?? 1;
                nextRun.setDate(dayOfMonth);

                if (nextRun <= now) {
                    nextRun.setMonth(nextRun.getMonth() + 1);
                }
                break;

            case "custom":
                // Use cron expression - for now, default to daily
                if (nextRun <= now) {
                    nextRun.setDate(nextRun.getDate() + 1);
                }
                break;

            default:
                // Default to tomorrow
                nextRun.setDate(nextRun.getDate() + 1);
        }

        return nextRun;
    }

    /**
     * Create schedule
     * Limits users to 5 active scheduled reports
     */
    async createSchedule(data: CreateScheduleData): Promise<ReportSchedule> {
        try {
            // Verify report exists
            const report = await (prisma as any).report.findUnique({
                where: { id: data.reportId },
            });

            if (!report) {
                throw new Error("Report not found");
            }

            if (report.account_id !== data.accountId) {
                throw new Error("Unauthorized to schedule this report");
            }

            // Check schedule limit (5 active schedules per user)
            // Count all active schedules for reports created by this user in this account
            if (data.userId) {
                const userReports = await (prisma as any).report.findMany({
                    where: {
                        account_id: data.accountId,
                        created_by: data.userId,
                    },
                    select: { id: true },
                });

                const reportIds = userReports.map((r: any) => r.id);

                if (reportIds.length > 0) {
                    const activeSchedules = await (
                        prisma as any
                    ).reportSchedule.count({
                        where: {
                            report_id: { in: reportIds },
                            is_active: true,
                        },
                    });

                    if (activeSchedules >= 5) {
                        throw new Error(
                            "Maximum of 5 active scheduled reports allowed per user"
                        );
                    }
                }
            }

            // Calculate next run
            const nextRun = this.calculateNextRun(
                data.scheduleType,
                data.scheduleConfig
            );

            const schedule = await (prisma as any).reportSchedule.create({
                data: {
                    report_id: data.reportId,
                    schedule_type: data.scheduleType,
                    schedule_config: data.scheduleConfig as any,
                    is_active: true,
                    next_run_at: nextRun,
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                `Report schedule created: ${report.name} (Schedule ID: ${schedule.id})`,
                "ReportScheduleService",
                undefined,
                data.accountId
            );

            return schedule;
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to create schedule: ${error instanceof Error ? error.message : String(error)}`,
                "ReportScheduleService",
                undefined,
                data.accountId
            );
            throw error;
        }
    }

    /**
     * Update schedule
     */
    async updateSchedule(
        scheduleId: number,
        data: Partial<CreateScheduleData>,
        accountId: number
    ): Promise<ReportSchedule> {
        const schedule = await (prisma as any).reportSchedule.findUnique({
            where: { id: scheduleId },
            include: { Report: true },
        });

        if (!schedule) {
            throw new Error("Schedule not found");
        }

        if (schedule.Report.account_id !== accountId) {
            throw new Error("Unauthorized to update this schedule");
        }

        const modified_ata: any = {};

        if (data.scheduleType) {
            modified_ata.schedule_type = data.scheduleType;
        }

        if (data.scheduleConfig) {
            modified_ata.schedule_config = data.scheduleConfig as any;
            // Recalculate next run if config changed
            modified_ata.next_run_at = this.calculateNextRun(
                data.scheduleType || schedule.schedule_type,
                data.scheduleConfig
            );
        }

        return await (prisma as any).reportSchedule.update({
            where: { id: scheduleId },
            data: modified_ata,
        });
    }

    /**
     * Cancel schedule (set is_active to false)
     */
    async cancelSchedule(scheduleId: number, accountId: number): Promise<void> {
        const schedule = await (prisma as any).reportSchedule.findUnique({
            where: { id: scheduleId },
            include: { Report: true },
        });

        if (!schedule) {
            throw new Error("Schedule not found");
        }

        if (schedule.Report.account_id !== accountId) {
            throw new Error("Unauthorized to cancel this schedule");
        }

        await prisma.reportSchedule.update({
            where: { id: scheduleId },
            data: { is_active: false },
        });

        await this.logService.logMessage(
            LogLevel.INFO,
            `Report schedule cancelled: ${schedule.Report.name} (Schedule ID: ${scheduleId})`,
            "ReportScheduleService",
            undefined,
            accountId
        );
    }

    /**
     * Execute scheduled reports (called by cron job)
     */
    async executeScheduledReports(): Promise<void> {
        const now = new Date();

        // Find schedules that are due
        const dueSchedules = await (prisma as any).reportSchedule.findMany({
            where: {
                is_active: true,
                next_run_at: {
                    lte: now,
                },
            },
            include: {
                Report: true,
            },
        });

        for (const schedule of dueSchedules) {
            try {
                await this.executeScheduledReport(schedule.id);

                // Calculate next run
                const config =
                    schedule.schedule_config as unknown as ScheduleConfig;
                const nextRun = this.calculateNextRun(
                    schedule.schedule_type,
                    config
                );

                // Update schedule
                await (prisma as any).reportSchedule.update({
                    where: { id: schedule.id },
                    data: {
                        last_run_at: now,
                        next_run_at: nextRun,
                    },
                });
            } catch (error) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to execute scheduled report ${schedule.report_id}: ${error instanceof Error ? error.message : String(error)}`,
                    "ReportScheduleService",
                    undefined,
                    schedule.Report.account_id
                );
            }
        }
    }

    /**
     * Execute a single scheduled report
     */
    private async executeScheduledReport(scheduleId: number): Promise<void> {
        const schedule = await (prisma as any).reportSchedule.findUnique({
            where: { id: scheduleId },
            include: { Report: true },
        });

        if (!schedule) {
            throw new Error("Schedule not found");
        }

        const config = schedule.schedule_config as unknown as ScheduleConfig;
        const format = config.format || "csv";

        // Execute report
        const executionService = ReportExecutionService.getInstance();
        const result = await executionService.executeReport({
            reportId: schedule.report_id,
            accountId: schedule.Report.account_id,
        });

        // Export report
        const exportService = ReportExportService.getInstance();
        const exportData = await exportService.exportReport(
            schedule.report_id,
            schedule.Report.account_id,
            format
        );

        // Send to recipients
        if (config.recipients && config.recipients.length > 0) {
            // This would integrate with email service to send the export
            // For now, just log
            await this.logService.logMessage(
                LogLevel.INFO,
                `Scheduled report ${schedule.Report.name} executed and exported to ${config.recipients.join(", ")}`,
                "ReportScheduleService",
                undefined,
                schedule.Report.account_id
            );
        }
    }
}
