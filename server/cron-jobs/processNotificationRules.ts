import { NotificationRuleDeliveryService } from "@/server/services/creditInsurance/NotificationRuleDeliveryService";

export async function processNotificationRules(
    _customerId?: number,
    logCallback?: (
        message: string,
        level: "INFO" | "ERROR" | "WARNING" | "DEBUG",
        parameters?: any
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
): Promise<{
    success: boolean;
    message: string;
    summary?: {
        accountsProcessed: number;
        delivered: number;
        skipped: number;
        cleared: number;
    };
    duration: number;
}> {
    const start = Date.now();
    try {
        stepCollector?.addStep(
            "START",
            "Starting process notification rules",
            "INFO"
        );

        const service = new NotificationRuleDeliveryService();
        const summary = await service.processAllCreditInsuranceAccounts();
        const duration = Date.now() - start;
        const message = `Notification rules processed for ${summary.accountsProcessed} account(s): ${summary.delivered} delivered, ${summary.skipped} skipped, ${summary.cleared} cleared`;

        stepCollector?.addStep("COMPLETE", message, "INFO", summary, undefined, duration);
        logCallback?.(message, "INFO", summary);

        return {
            success: true,
            message,
            summary,
            duration,
        };
    } catch (error: unknown) {
        const duration = Date.now() - start;
        const message =
            error instanceof Error
                ? error.message
                : "processNotificationRules failed";
        stepCollector?.addStep(
            "ERROR",
            message,
            "ERROR",
            {
                stack: error instanceof Error ? error.stack : undefined,
            },
            undefined,
            duration
        );
        logCallback?.(message, "ERROR", {
            stack: error instanceof Error ? error.stack : undefined,
        });
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(message);
    }
}

export default processNotificationRules;
