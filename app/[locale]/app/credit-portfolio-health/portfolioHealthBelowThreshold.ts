import {
    PORTFOLIO_HEALTH_BELOW_THRESHOLD_PCT,
    type PortfolioHealthDailyPoint,
} from "@/types/creditInsurance";

/** Browser-wide preference for the portfolio-health below-threshold cut-off. */
export const PORTFOLIO_HEALTH_BELOW_THRESHOLD_STORAGE_KEY =
    "cph-portfolio-health-below-threshold-pct";

export const PORTFOLIO_HEALTH_BELOW_THRESHOLD_MIN = 50;
export const PORTFOLIO_HEALTH_BELOW_THRESHOLD_MAX = 100;
export const PORTFOLIO_HEALTH_BELOW_THRESHOLD_DEFAULT =
    PORTFOLIO_HEALTH_BELOW_THRESHOLD_PCT;

export function clampPortfolioHealthBelowThreshold(value: number): number {
    if (!Number.isFinite(value)) {
        return PORTFOLIO_HEALTH_BELOW_THRESHOLD_DEFAULT;
    }
    return Math.min(
        PORTFOLIO_HEALTH_BELOW_THRESHOLD_MAX,
        Math.max(PORTFOLIO_HEALTH_BELOW_THRESHOLD_MIN, Math.round(value))
    );
}

export function readPortfolioHealthBelowThreshold(): number {
    if (typeof window === "undefined") {
        return PORTFOLIO_HEALTH_BELOW_THRESHOLD_DEFAULT;
    }
    try {
        const raw = window.localStorage.getItem(
            PORTFOLIO_HEALTH_BELOW_THRESHOLD_STORAGE_KEY
        );
        if (raw == null) {
            return PORTFOLIO_HEALTH_BELOW_THRESHOLD_DEFAULT;
        }
        return clampPortfolioHealthBelowThreshold(Number(raw));
    } catch {
        return PORTFOLIO_HEALTH_BELOW_THRESHOLD_DEFAULT;
    }
}

export function writePortfolioHealthBelowThreshold(value: number): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(
            PORTFOLIO_HEALTH_BELOW_THRESHOLD_STORAGE_KEY,
            String(clampPortfolioHealthBelowThreshold(value))
        );
    } catch {
        // Ignore quota / private-mode failures.
    }
}

/**
 * Share of eligible days with health strictly below `thresholdPct`.
 * Matches server series math: zero-AR days are excluded from the denominator.
 */
export function computePctDaysBelowThreshold(
    daily: PortfolioHealthDailyPoint[],
    thresholdPct: number
): number {
    const eligible = daily.filter((d) => d.totalReceivables > 0);
    if (eligible.length === 0) {
        return 0;
    }
    const belowCount = eligible.filter(
        (d) => d.healthIndex < thresholdPct
    ).length;
    return (100 * belowCount) / eligible.length;
}
