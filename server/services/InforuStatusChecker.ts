import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";

import { ActivityService } from "./ActivityService";
import { LogService } from "./LogService";

export class InforuStatusChecker {
    private logService = LogService.getInstance();
    private activityService: ActivityService;
    private stepCollector?: {
        addStep: (
            step: string,
            message: string,
            level?: "INFO" | "ERROR" | "WARNING" | "DEBUG",
            parameters?: any,
            results?: any,
            duration?: number
        ) => void;
    };

    constructor(
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
        activityService?: ActivityService
    ) {
        this.stepCollector = stepCollector;
        this.activityService = activityService || new ActivityService();
    }

    /**
     * Check SMS delivery status for pending Inforu messages
     */
    async checkPendingSMSStatus(): Promise<void> {
        try {
            // Find all pending Inforu SMS messages
            // Note: We check for both records with message_id and without message_id
            // This handles cases where SMS was sent but message_id wasn't properly stored
            const pendingMessages = await prisma.activityContact.findMany({
                where: {
                    status: {
                        in: ["Sent", "Scheduled"],
                    },
                    communication_channel: "SMS", // Only SMS records
                    SMSVendor: {
                        provider: "inforu",
                    },
                    // Check for records with vendor_message_id (preferred) or message_id
                    OR: [
                        {
                            vendor_message_id: {
                                not: null,
                            },
                        },
                        {
                            message_id: {
                                not: null,
                            },
                        },
                    ],
                    // Only check messages from the last 7 days
                    created_at: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
                include: {
                    SMSVendor: true,
                },
                take: 20, // Reduced from 50 to 20 messages per check
            });

            if (pendingMessages.length === 0) {
                await this.logService.logMessage(
                    LogLevel.INFO,
                    "No pending Inforu SMS messages to check",
                    "InforuStatusChecker"
                );
                return;
            }

            // Add to step collector if available
            if (this.stepCollector) {
                this.stepCollector.addStep(
                    "CHECK_STATUS",
                    `Checking status for ${pendingMessages.length} pending Inforu SMS messages`,
                    "INFO",
                    {
                        messageCount: pendingMessages.length,
                    }
                );
            } else {
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Checking status for ${pendingMessages.length} pending Inforu SMS messages`,
                    "InforuStatusChecker"
                );
            }

            // Process messages in parallel batches to improve performance
            const batchSize = 5; // Process 5 messages concurrently
            let processedCount = 0;

            for (let i = 0; i < pendingMessages.length; i += batchSize) {
                const batch = pendingMessages.slice(i, i + batchSize);

                // Process batch in parallel
                await Promise.all(
                    batch.map(async (message) => {
                        try {
                            // Log processing (with error handling)
                            try {
                                await this.logService.logMessage(
                                    LogLevel.INFO,
                                    `Processing message ${message.message_id || message.vendor_message_id} (ActivityContact ID: ${message.id})`,
                                    "InforuStatusChecker",
                                    {
                                        activityContactId: message.id,
                                        messageId: message.message_id,
                                        vendorMessageId:
                                            message.vendor_message_id,
                                        status: message.status,
                                    }
                                );
                            } catch (logError) {
                                // Ignore logging errors in tests
                                console.warn(
                                    `[InforuStatusChecker] Failed to log processing: ${logError}`
                                );
                            }
                            await this.checkMessageStatus(message);
                        } catch (error: any) {
                            try {
                                await this.logService.logMessage(
                                    LogLevel.ERROR,
                                    `Failed to process message ${message.message_id}: ${error?.message || error}`,
                                    "InforuStatusChecker"
                                );
                            } catch (logError) {
                                // Ignore logging errors in tests
                                console.warn(
                                    `[InforuStatusChecker] Failed to log error: ${logError}`
                                );
                            }
                        }
                    })
                );

                processedCount += batch.length;

                // Log progress every batch
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Processed ${processedCount}/${pendingMessages.length} messages`,
                    "InforuStatusChecker"
                );

                // Add delay between batches to avoid overwhelming the API
                if (i + batchSize < pendingMessages.length) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                }
            }

            await this.logService.logMessage(
                LogLevel.INFO,
                `Completed processing ${processedCount} Inforu SMS messages`,
                "InforuStatusChecker"
            );
        } catch (error: any) {
            // Add to step collector if available
            if (this.stepCollector) {
                this.stepCollector.addStep(
                    "ERROR",
                    `Failed to check Inforu SMS status: ${error?.message || error}`,
                    "ERROR",
                    {
                        error: error?.message || error,
                    }
                );
            } else {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to check Inforu SMS status: ${error?.message || error}`,
                    "InforuStatusChecker"
                );
            }
        }
    }

    /**
     * Check status for a specific message
     */
    private async checkMessageStatus(message: any): Promise<void> {
        try {
            if (!message.SMSVendor) {
                return;
            }

            const vendor = message.SMSVendor;
            // Prefer vendor_message_id (vendor's actual ID), fallback to message_id (CustomerMessageID)
            const messageIdToCheck =
                message.vendor_message_id || message.message_id;

            // If no message ID, we can't check status via Inforu API
            if (!messageIdToCheck) {
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `Skipping status check for message without message ID: ActivityContact ID ${message.id}`,
                    "InforuStatusChecker",
                    {
                        activityContactId: message.id,
                        status: message.status,
                        sentAt: message.sent_at,
                    }
                );
                return;
            }

            // Call Inforu API to get message status
            const status = await this.getInforuMessageStatus(
                vendor,
                messageIdToCheck
            );

            if (status) {
                // Log before calling handleSMSDelivery for debugging (with error handling)
                try {
                    await this.logService.logMessage(
                        LogLevel.INFO,
                        `Calling handleSMSDelivery for message ${messageIdToCheck} with status ${status.status}`,
                        "InforuStatusChecker",
                        {
                            messageId: messageIdToCheck,
                            vendorMessageId: message.vendor_message_id,
                            customerMessageId: message.message_id,
                            status: status.status,
                        }
                    );
                } catch (logError) {
                    // Ignore logging errors in tests
                    console.warn(
                        `[InforuStatusChecker] Failed to log before handleSMSDelivery: ${logError}`
                    );
                }

                // Update the message status
                // IMPORTANT: handleSMSDelivery looks up records by message_id (our UUID/customerMessageID),
                // NOT by vendor_message_id (Inforu's ID). So we MUST pass message_id here.
                // If message_id is null/undefined, we cannot update the status properly.
                try {
                    if (!message.message_id) {
                        console.warn(
                            `[InforuStatusChecker] Cannot update status for message without message_id. ActivityContact ID: ${message.id}`
                        );
                        return;
                    }

                    await this.activityService.handleSMSDelivery(
                        message.message_id, // Always use message_id (our UUID), NOT vendor_message_id
                        status.status,
                        status.error,
                        status.timestamp
                    );
                } catch (handleError) {
                    console.error(
                        `[InforuStatusChecker] Error calling handleSMSDelivery for message ${messageIdToCheck}:`,
                        handleError
                    );
                    throw handleError;
                }

                // Add to step collector if available
                if (this.stepCollector) {
                    this.stepCollector.addStep(
                        "UPDATE_STATUS",
                        `Updated Inforu SMS status: ${messageIdToCheck} -> ${status.status}`,
                        "INFO",
                        {
                            messageId: messageIdToCheck,
                            vendorMessageId: message.vendor_message_id,
                            customerMessageId: message.message_id,
                            status: status.status,
                            error: status.error,
                        }
                    );
                } else {
                    await this.logService.logMessage(
                        LogLevel.INFO,
                        `Updated Inforu SMS status: ${messageIdToCheck} -> ${status.status}`,
                        "InforuStatusChecker",
                        {
                            messageId: messageIdToCheck,
                            vendorMessageId: message.vendor_message_id,
                            customerMessageId: message.message_id,
                            status: status.status,
                            error: status.error,
                        }
                    );
                }
            }
        } catch (error: any) {
            // Add to step collector if available
            if (this.stepCollector) {
                this.stepCollector.addStep(
                    "ERROR",
                    `Failed to check status for message ${message.message_id}: ${error?.message || error}`,
                    "ERROR",
                    {
                        messageId: message.message_id,
                        error: error?.message || error,
                    }
                );
            } else {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to check status for message ${message.message_id}: ${error?.message || error}`,
                    "InforuStatusChecker"
                );
            }
        }
    }

    /**
     * Get message status from Inforu API
     */
    private async getInforuMessageStatus(
        vendor: any,
        messageId: string
    ): Promise<any> {
        try {
            // Use the same credentials as in SMSVendorService
            const correctApiSecret = "588934a4-10af-4e95-ae40-9a900c07d64f";
            const credentials = `${vendor.api_key}:${correctApiSecret}`;
            const encoded = Buffer.from(credentials, "utf8").toString("base64");

            const response = await fetch(
                `https://capi.inforu.co.il/api/v2/SMS/GetMessageStatus?messageId=${messageId}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Basic ${encoded}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Inforu API error: ${response.status} ${response.statusText}`
                );
            }

            const responseData = await response.json();

            // Log the response for debugging (with error handling)
            try {
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Inforu API response for message ${messageId}: StatusId=${responseData.StatusId}, StatusDescription=${responseData.StatusDescription}`,
                    "InforuStatusChecker",
                    {
                        messageId,
                        statusId: responseData.StatusId,
                        statusDescription: responseData.StatusDescription,
                    }
                );
            } catch (logError) {
                // Ignore logging errors in tests
                console.warn(
                    `[InforuStatusChecker] Failed to log API response: ${logError}`
                );
            }

            // Map Inforu status to our system status
            // Inforu StatusId values:
            // 1 = Delivered (message was delivered to the recipient)
            // 2 = Sent/Pending (message was sent but delivery not confirmed yet)
            // 0 = Failed/Rejected (message failed to deliver)
            // Other values may exist, we'll log and skip them
            let status = "unknown";
            let error = null;

            if (responseData.StatusId === 1) {
                status = "delivered";
            } else if (responseData.StatusId === 2) {
                status = "sent";
            } else if (responseData.StatusId === 0) {
                status = "failed";
                error = responseData.StatusDescription || "Unknown error";
            } else {
                // Unknown status - log and skip
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `Inforu returned unknown StatusId ${responseData.StatusId} for message ${messageId}`,
                    "InforuStatusChecker",
                    {
                        messageId,
                        statusId: responseData.StatusId,
                        statusDescription: responseData.StatusDescription,
                        fullResponse: responseData,
                    }
                );
                return null; // Return null to skip updating
            }

            // If status is still "sent", don't update (nothing changed)
            // This prevents unnecessary database updates
            if (status === "sent") {
                return null; // Skip - no status change
            }

            const statusResult = {
                status,
                error,
                timestamp: new Date().toISOString(),
            };

            // Log the mapped status (with error handling)
            try {
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Mapped Inforu status for message ${messageId}: ${status}`,
                    "InforuStatusChecker",
                    {
                        messageId,
                        mappedStatus: status,
                        error,
                    }
                );
            } catch (logError) {
                // Ignore logging errors in tests
                console.warn(
                    `[InforuStatusChecker] Failed to log mapped status: ${logError}`
                );
            }

            return statusResult;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to get Inforu message status: ${error?.message || error}`,
                "InforuStatusChecker"
            );
            return null;
        }
    }
}
