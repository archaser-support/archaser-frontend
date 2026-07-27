import { syncAllCustomerPolicyGapAmounts } from "@/server/services/creditInsurance/syncCustomerPolicyGapAmounts";
import { fetchAndStoreCurrencyRates } from "@/server/services/currencyRateService";

export default async function computeGapInBaseCurrencyJob(
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
    summary?: any;
    duration: number;
}> {
    const start = Date.now();
    try {
        stepCollector?.addStep(
            "GAP_BASE_START",
            "Fetching FX rates then computing gaps in base currency",
            "INFO"
        );
        const fxResult = await fetchAndStoreCurrencyRates();
        stepCollector?.addStep(
            "FX_BEFORE_GAP_DONE",
            `Stored ${fxResult.ratesStored} currency rate rows`,
            "INFO",
            fxResult
        );
        const result = await syncAllCustomerPolicyGapAmounts();
        const duration = Date.now() - start;
        const message = `FX ${fxResult.ratesStored} rates; base-currency gaps: ${result.customersUpdated} customers updated (missing rates: ${result.missingRates})`;
        stepCollector?.addStep("GAP_BASE_DONE", message, "INFO", {
            fxResult,
            gapResult: result,
        });
        logCallback?.(message, "INFO", { fxResult, gapResult: result });
        return {
            success: true,
            message,
            summary: { fxResult, gapResult: result },
            duration,
        };
    } catch (error: any) {
        const duration = Date.now() - start;
        const message =
            error?.message || "Gap in base currency computation cron failed";
        stepCollector?.addStep("GAP_BASE_ERROR", message, "ERROR", {
            stack: error?.stack,
        });
        logCallback?.(message, "ERROR", { stack: error?.stack });
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(message);
    }
}
