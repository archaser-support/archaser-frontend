/**
 * Cron Job: Anonymize Deleted Accounts
 * Runs daily to anonymize accounts that have passed the 30-day grace period
 */

import { AccountDeletionService } from "../services/AccountDeletionService";
import { LogService } from "../services/LogService";
import { LogLevel } from "@/types/enums";

export const anonymizeDeletedAccounts = async (
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
) => {
    const startTime = new Date();
    const logService = LogService.getInstance();
    const deletionService = new AccountDeletionService();

    try {
        await logService.logMessage(
            LogLevel.INFO,
            "Starting anonymization of deleted accounts cron job",
            "anonymizeDeletedAccounts"
        );

        if (logCallback) {
            logCallback("Starting anonymization of deleted accounts", "INFO", {
                startTime: startTime.toISOString(),
            });
        }

        // Get accounts that need anonymization
        const accountIds = await deletionService.getAccountsForAnonymization();

        if (accountIds.length === 0) {
            const message = "No accounts found for anonymization";
            await logService.logMessage(
                LogLevel.INFO,
                message,
                "anonymizeDeletedAccounts"
            );

            if (logCallback) {
                logCallback(message, "INFO");
            }

            if (stepCollector) {
                stepCollector.addStep(
                    "CHECK_ACCOUNTS",
                    message,
                    "INFO",
                    {},
                    { accountsFound: 0 },
                    Date.now() - startTime.getTime()
                );
            }

            return;
        }

        await logService.logMessage(
            LogLevel.INFO,
            `Found ${accountIds.length} accounts for anonymization`,
            "anonymizeDeletedAccounts",
            { accountCount: accountIds.length, accountIds }
        );

        if (logCallback) {
            logCallback(
                `Found ${accountIds.length} accounts for anonymization`,
                "INFO",
                { accountIds }
            );
        }

        if (stepCollector) {
            stepCollector.addStep(
                "CHECK_ACCOUNTS",
                `Found ${accountIds.length} accounts`,
                "INFO",
                { accountIds },
                { accountsFound: accountIds.length },
                Date.now() - startTime.getTime()
            );
        }

        // Anonymize each account
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const accountId of accountIds) {
            const accountStartTime = Date.now();

            try {
                await logService.logMessage(
                    LogLevel.INFO,
                    `Anonymizing account ${accountId}`,
                    "anonymizeDeletedAccounts",
                    { accountId }
                );

                if (logCallback) {
                    logCallback(`Anonymizing account ${accountId}`, "INFO", {
                        accountId,
                    });
                }

                const result =
                    await deletionService.anonymizeAccount(accountId);

                if (result.success) {
                    successCount++;

                    await logService.logMessage(
                        LogLevel.INFO,
                        `Successfully anonymized account ${accountId}`,
                        "anonymizeDeletedAccounts",
                        {
                            accountId,
                            usersAnonymized: result.usersAnonymized,
                            contactsAnonymized: result.contactsAnonymized,
                            activitiesAnonymized: result.activitiesAnonymized,
                            filesDeleted: result.filesDeleted,
                        }
                    );

                    if (logCallback) {
                        logCallback(
                            `Successfully anonymized account ${accountId}`,
                            "INFO",
                            {},
                            {
                                usersAnonymized: result.usersAnonymized,
                                contactsAnonymized: result.contactsAnonymized,
                                activitiesAnonymized:
                                    result.activitiesAnonymized,
                                filesDeleted: result.filesDeleted,
                            }
                        );
                    }

                    if (stepCollector) {
                        stepCollector.addStep(
                            `ANONYMIZE_ACCOUNT_${accountId}`,
                            `Anonymized account ${accountId}`,
                            "INFO",
                            { accountId },
                            {
                                usersAnonymized: result.usersAnonymized,
                                contactsAnonymized: result.contactsAnonymized,
                                activitiesAnonymized:
                                    result.activitiesAnonymized,
                                filesDeleted: result.filesDeleted,
                            },
                            Date.now() - accountStartTime
                        );
                    }
                } else {
                    errorCount++;
                    const errorMsg = `Account ${accountId} anonymization completed with errors: ${result.errors.join(", ")}`;
                    errors.push(errorMsg);

                    await logService.logMessage(
                        LogLevel.WARNING,
                        errorMsg,
                        "anonymizeDeletedAccounts",
                        { accountId, errors: result.errors }
                    );

                    if (logCallback) {
                        logCallback(errorMsg, "WARNING", {
                            accountId,
                            errors: result.errors,
                        });
                    }

                    if (stepCollector) {
                        stepCollector.addStep(
                            `ANONYMIZE_ACCOUNT_${accountId}`,
                            errorMsg,
                            "WARNING",
                            { accountId },
                            { errors: result.errors },
                            Date.now() - accountStartTime
                        );
                    }
                }
            } catch (error: any) {
                errorCount++;
                const errorMsg = `Failed to anonymize account ${accountId}: ${error.message}`;
                errors.push(errorMsg);

                await logService.logMessage(
                    LogLevel.ERROR,
                    errorMsg,
                    "anonymizeDeletedAccounts",
                    { accountId, error: error.message }
                );

                if (logCallback) {
                    logCallback(errorMsg, "ERROR", {
                        accountId,
                        error: error.message,
                    });
                }

                if (stepCollector) {
                    stepCollector.addStep(
                        `ANONYMIZE_ACCOUNT_${accountId}`,
                        errorMsg,
                        "ERROR",
                        { accountId },
                        { error: error.message },
                        Date.now() - accountStartTime
                    );
                }
            }
        }

        // Final summary
        const duration = Date.now() - startTime.getTime();
        const summaryMessage = `Anonymization completed: ${successCount} successful, ${errorCount} with errors`;

        await logService.logMessage(
            LogLevel.INFO,
            summaryMessage,
            "anonymizeDeletedAccounts",
            {
                totalAccounts: accountIds.length,
                successCount,
                errorCount,
                duration,
                errors: errors.length > 0 ? errors : undefined,
            }
        );

        if (logCallback) {
            logCallback(
                summaryMessage,
                errorCount > 0 ? "WARNING" : "INFO",
                { totalAccounts: accountIds.length, successCount, errorCount },
                { duration, errors }
            );
        }

        if (stepCollector) {
            stepCollector.addStep(
                "SUMMARY",
                summaryMessage,
                errorCount > 0 ? "WARNING" : "INFO",
                { totalAccounts: accountIds.length },
                { successCount, errorCount, duration, errors },
                duration
            );
        }
    } catch (error: any) {
        const errorMessage = `Anonymization cron job failed: ${error.message}`;

        await logService.logMessage(
            LogLevel.ERROR,
            errorMessage,
            "anonymizeDeletedAccounts",
            { error: error.message, stack: error.stack }
        );

        if (logCallback) {
            logCallback(errorMessage, "ERROR", { error: error.message });
        }

        if (stepCollector) {
            stepCollector.addStep(
                "ERROR",
                errorMessage,
                "ERROR",
                {},
                { error: error.message },
                Date.now() - startTime.getTime()
            );
        }

        throw error;
    }
};
