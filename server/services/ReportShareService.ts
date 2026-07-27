import { Prisma, ReportShare, user_role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";
import { LogService } from "./LogService";
import { EmailService } from "../EmailService";
import { getUserLanguage } from "../EmailService";
import {
    getEmailTemplate,
    getEmailSubject,
    EMAIL_TYPES,
} from "@/shared/templates/email-templates";

interface ShareReportData {
    reportId: number;
    sharedWithUserId?: string;
    sharedWithRole?: string;
    permission: "view" | "edit";
    createdBy: string;
    accountId: number;
}

export class ReportShareService {
    private static instance: ReportShareService;
    private logService = LogService.getInstance();

    public static getInstance(): ReportShareService {
        if (!ReportShareService.instance) {
            ReportShareService.instance = new ReportShareService();
        }
        return ReportShareService.instance;
    }

    /**
     * Share report with user or role
     */
    async shareReport(data: ShareReportData): Promise<ReportShare> {
        try {
            // Validate input
            if (!data.sharedWithUserId && !data.sharedWithRole) {
                throw new Error(
                    "Either sharedWithUserId or sharedWithRole must be provided"
                );
            }

            // Validate role if provided
            if (data.sharedWithRole) {
                const validRoles = Object.values(user_role);
                if (!validRoles.includes(data.sharedWithRole as user_role)) {
                    throw new Error(
                        `Invalid role: ${data.sharedWithRole}. Valid roles are: ${validRoles.join(", ")}`
                    );
                }
            }

            // Verify report exists and user has permission
            const report = await (prisma as any).report.findUnique({
                where: { id: data.reportId },
                include: {
                    Account: true,
                },
            });

            if (!report) {
                throw new Error("Report not found");
            }

            // Prevent sharing system reports
            if (report.is_system) {
                throw new Error("System reports cannot be shared");
            }

            // Allow sharing if report belongs to account
            if (report.account_id !== data.accountId) {
                throw new Error("Unauthorized to share this report");
            }

            // Check if share already exists
            const existingShareWhere: any = {
                report_id: data.reportId,
            };

            if (data.sharedWithUserId) {
                existingShareWhere.shared_with_user_id = data.sharedWithUserId;
            } else if (data.sharedWithRole) {
                existingShareWhere.shared_with_role = data.sharedWithRole;
            }

            const existingShare = await (prisma as any).reportShare.findFirst({
                where: existingShareWhere,
            });

            let share: ReportShare;

            if (existingShare) {
                // Try to update existing share, but if it doesn't exist (was deleted), create a new one
                try {
                    share = await (prisma as any).reportShare.update({
                        where: { id: existingShare.id },
                        data: {
                            permission: data.permission,
                        },
                    });
                } catch (error: any) {
                    // If record not found (P2025), it was deleted, so create a new one
                    if (error?.code === "P2025") {
                        const shareData: any = {
                            report_id: data.reportId,
                            permission: data.permission,
                            created_by: data.createdBy,
                        };

                        if (data.sharedWithUserId) {
                            shareData.shared_with_user_id =
                                data.sharedWithUserId;
                            shareData.shared_with_role = null;
                        } else if (data.sharedWithRole) {
                            shareData.shared_with_role =
                                data.sharedWithRole as user_role;
                            shareData.shared_with_user_id = null;
                        }

                        share = await (prisma as any).reportShare.create({
                            data: shareData,
                        });
                    } else {
                        throw error;
                    }
                }
            } else {
                // Create new share
                const shareData: any = {
                    report_id: data.reportId,
                    permission: data.permission,
                    created_by: data.createdBy,
                };

                if (data.sharedWithUserId) {
                    shareData.shared_with_user_id = data.sharedWithUserId;
                    shareData.shared_with_role = null;
                } else if (data.sharedWithRole) {
                    // Cast to enum type for Prisma
                    shareData.shared_with_role =
                        data.sharedWithRole as user_role;
                    shareData.shared_with_user_id = null;
                }

                share = await (prisma as any).reportShare.create({
                    data: shareData,
                });
            }

            // Send email notification if shared with user
            // Only send to users in the account, not contacts
            if (data.sharedWithUserId) {
                // Verify user belongs to the account before sending
                const targetUser = await (prisma as any).user.findUnique({
                    where: { id: data.sharedWithUserId },
                    select: { account_id: true },
                });

                if (targetUser && targetUser.account_id === data.accountId) {
                    await this.sendShareNotification(
                        data.sharedWithUserId,
                        report.name,
                        data.reportId,
                        data.accountId,
                        data.createdBy,
                        data.permission
                    );
                } else {
                    await this.logService.logMessage(
                        LogLevel.WARNING,
                        `Attempted to share report with user ${data.sharedWithUserId} who does not belong to account ${data.accountId}`,
                        "ReportShareService",
                        {
                            userId: data.sharedWithUserId,
                            accountId: data.accountId,
                            userAccountId: targetUser?.account_id,
                        },
                        data.accountId,
                        data.createdBy
                    );
                }
            }

            await this.logService.logMessage(
                LogLevel.INFO,
                `Report shared: ${report.name} (ID: ${data.reportId}) with ${data.sharedWithUserId || data.sharedWithRole}`,
                "ReportShareService",
                undefined,
                data.accountId,
                data.createdBy
            );

            return share;
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to share report: ${error instanceof Error ? error.message : String(error)}`,
                "ReportShareService",
                undefined,
                data.accountId,
                data.createdBy
            );
            throw error;
        }
    }

    /**
     * Send email notification when report is shared
     * Only sends to users in the same account, not contacts
     */
    private async sendShareNotification(
        userId: string,
        reportName: string,
        reportId: number,
        accountId: number,
        createdBy: string,
        permission: "view" | "edit"
    ): Promise<void> {
        try {
            // Verify user belongs to the account (not a contact)
            const user = await (prisma as any).user.findUnique({
                where: { id: userId },
                select: { email: true, name: true, account_id: true },
            });

            if (!user || !user.email) {
                return;
            }

            // Ensure user belongs to the same account
            if (user.account_id !== accountId) {
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `Attempted to share report with user ${userId} from different account`,
                    "ReportShareService",
                    { userId, accountId, userAccountId: user.account_id },
                    accountId
                );
                return;
            }

            // Get creator's name
            const creator = await (prisma as any).user.findUnique({
                where: { id: createdBy },
                select: { name: true, email: true },
            });

            const creatorName = creator?.name || creator?.email || "A colleague";

            // Build report URL
            const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
            const reportUrl = `${baseUrl}/app/reports/${reportId}`;

            // Get user's language preference
            const userLanguage = await getUserLanguage(user.email);

            // Translate permission based on language
            const permissionText =
                userLanguage === "he"
                    ? permission === "view"
                        ? "צפייה"
                        : "עריכה"
                    : permission === "view"
                      ? "View"
                      : "Edit";

            // Get email subject and template
            let subject = getEmailSubject(EMAIL_TYPES.REPORT_SHARED, userLanguage);
            // Replace reportName in subject if it contains the variable
            subject = subject.replace("${reportName}", reportName);

            const template = getEmailTemplate(
                EMAIL_TYPES.REPORT_SHARED,
                userLanguage,
                {
                    userName: user.name || "User",
                    creatorName: creatorName,
                    reportName: reportName,
                    reportUrl: reportUrl,
                    permission: permissionText,
                }
            );

            const emailService = new EmailService();
            await emailService.sendEmail(user.email, subject, template);
        } catch (error) {
            // Log but don't throw - email failure shouldn't break sharing
            console.error("Failed to send share notification email:", error);
        }
    }

    /**
     * Get reports shared with user
     */
    async getSharedReports(
        userId: string,
        userRole?: string
    ): Promise<ReportShare[]> {
        const where: Prisma.ReportShareWhereInput = {
            OR: [
                { shared_with_user_id: userId },
                ...(userRole ? [{ shared_with_role: userRole as any }] : []),
            ],
        };

        return await (prisma as any).reportShare.findMany({
            where,
            include: {
                Report: true,
            },
        });
    }

    /**
     * Check if user has access to report
     */
    async checkSharePermission(
        reportId: number,
        userId?: string,
        userRole?: string
    ): Promise<boolean> {
        // Check if report is public
        const report = await (prisma as any).report.findUnique({
            where: { id: reportId },
            select: { is_public: true, account_id: true },
        });

        if (!report) {
            return false;
        }

        if (report.is_public) {
            return true;
        }

        // Check shares
        if (userId || userRole) {
            const share = await (prisma as any).reportShare.findFirst({
                where: {
                    report_id: reportId,
                    OR: [
                        ...(userId ? [{ shared_with_user_id: userId }] : []),
                        ...(userRole
                            ? [{ shared_with_role: userRole as any }]
                            : []),
                    ],
                },
            });

            return !!share;
        }

        return false;
    }

    /**
     * Get shares for a report
     */
    async getReportShares(
        reportId: number,
        accountId: number
    ): Promise<ReportShare[]> {
        // Verify report exists and belongs to account or is a system report
        const report = await (prisma as any).report.findUnique({
            where: { id: reportId },
            select: { account_id: true, is_system: true },
        });

        if (!report) {
            throw new Error("Report not found");
        }

        // Allow access if report belongs to account or is a system report
        if (report.account_id !== accountId && !report.is_system) {
            throw new Error("Unauthorized to view shares for this report");
        }

        return await (prisma as any).reportShare.findMany({
            where: {
                report_id: reportId,
            },
            include: {
                User_ReportShare_shared_with_user_idToUser: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
        });
    }

    /**
     * Remove share
     */
    async removeShare(shareId: number, accountId: number): Promise<void> {
        const share = await (prisma as any).reportShare.findUnique({
            where: { id: shareId },
            include: { Report: true },
        });

        if (!share) {
            throw new Error("Share not found");
        }

        if (share.Report.account_id !== accountId) {
            throw new Error("Unauthorized to remove this share");
        }

        await (prisma as any).reportShare.delete({
            where: { id: shareId },
        });

        await this.logService.logMessage(
            LogLevel.INFO,
            `Report share removed: ${share.Report.name} (Share ID: ${shareId})`,
            "ReportShareService",
            undefined,
            accountId
        );
    }
}
