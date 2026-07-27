import { fetchAndStoreCurrencyRates } from "@/server/services/currencyRateService";

export default async function fetchCurrencyRatesJob(
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
            "FX_FETCH_START",
            "Starting currency rate fetch",
            "INFO"
        );
        const result = await fetchAndStoreCurrencyRates();
        const duration = Date.now() - start;
        const message = `Fetched currency rates: ${result.ratesStored} stored`;
        stepCollector?.addStep("FX_FETCH_DONE", message, "INFO", result);
        logCallback?.(message, "INFO", result);
        return {
            success: true,
            message,
            summary: result,
            duration,
        };
    } catch (error: any) {
        const duration = Date.now() - start;
        const message = error?.message || "Currency rate fetch cron failed";
        stepCollector?.addStep("FX_FETCH_ERROR", message, "ERROR", {
            stack: error?.stack,
        });
        logCallback?.(message, "ERROR", { stack: error?.stack });
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(message);
    }
}
