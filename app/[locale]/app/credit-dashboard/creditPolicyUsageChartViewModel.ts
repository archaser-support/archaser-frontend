import type { PolicyLimitUsageCategoryTotals } from "@/server/services/creditInsurance/portfolioPolicyLimitUsage";

export type PolicyUsageChartCategory = {
    fullLabel: string;
    shortLabel: string;
    totals: PolicyLimitUsageCategoryTotals;
    /**
     * When false, Top-Up Covered is omitted from that bar (Named / DCL).
     * True uncovered exposure (beyond top-up) still shows; Total keeps the orange segment.
     */
    showTopUpCovered?: boolean;
};

export type PolicyUsageChartStackedSeries = {
    usedWithin: number[];
    remaining: number[];
    /** Above-base AR covered by top-up (0 when showTopUpCovered is false). */
    topUpCovered: number[];
    uncovered: number[];
    stackHeights: number[];
    usagePct: number[];
    /** Approved limit per category (for tooltip). Total includes top-up; Named/DCL are base only. */
    approvedLimits: number[];
};

function effectiveApprovedLimit(
    approvedLimit: number,
    topUpTotal: number
): number {
    return Math.max(0, approvedLimit) + Math.max(0, topUpTotal);
}

/** Top-Up bar appears only when active top-up capacity is greater than zero. */
export function shouldShowTopUpPolicyUsageBar(
    topUpCoverTotal: number | undefined
): boolean {
    return (topUpCoverTotal ?? 0) > 0;
}

/**
 * Stack Total / Named / DCL. When `showTopUpCovered` is false, only the
 * top-up-covered portion is omitted (not folded into Uncovered).
 * Top-up is included in approved limit / usage % for the Total bar only.
 */
export function buildPolicyUsageBaseStackedSeries(
    categories: PolicyUsageChartCategory[]
): PolicyUsageChartStackedSeries {
    const usedWithin = categories.map((category) =>
        Math.max(0, category.totals.usedWithinLimit)
    );
    const remaining = categories.map((category) =>
        Math.max(0, category.totals.remaining)
    );
    const topUpCovered = categories.map((category) => {
        if (category.showTopUpCovered === false) {
            return 0;
        }
        return Math.max(0, category.totals.topUpCoveredExcess);
    });
    const uncovered = categories.map((category) =>
        Math.max(0, category.totals.uncoveredExposure)
    );
    const approvedLimits = categories.map((category) => {
        const base = Math.max(0, category.totals.approvedLimit);
        // Named / DCL: base approved only. Total: base + top-up.
        if (category.showTopUpCovered === false) {
            return base;
        }
        return effectiveApprovedLimit(base, category.totals.topUpTotal);
    });
    const stackHeights = categories.map(
        (_category, index) =>
            usedWithin[index] +
            remaining[index] +
            topUpCovered[index] +
            uncovered[index]
    );
    // Usage % = Used / approved limit for that bar (Total includes top-up in denominator).
    const usagePct = categories.map((_category, index) => {
        const limit = approvedLimits[index];
        if (limit <= 0) {
            return 0;
        }
        return Math.max(0, (usedWithin[index] / limit) * 100);
    });
    return {
        usedWithin,
        remaining,
        topUpCovered,
        uncovered,
        stackHeights,
        usagePct,
        approvedLimits,
    };
}
