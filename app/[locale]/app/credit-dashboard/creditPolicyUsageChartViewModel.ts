import type { PolicyLimitUsageCategoryTotals } from "@/types/creditInsurance";

export type PolicyUsageChartCategory = {
    fullLabel: string;
    shortLabel: string;
    totals: PolicyLimitUsageCategoryTotals;
    /**
     * When false, Top-Up Compliant is omitted from that bar (Named / DCL).
     * True at-risk exposure (beyond top-up) still shows; Total keeps the orange segment.
     */
    showTopUpCompliant?: boolean;
};

export type PolicyUsageChartStackedSeries = {
    usedWithin: number[];
    remaining: number[];
    /** Above-base AR made compliant by top-up (0 when showTopUpCompliant is false). */
    topUpCompliant: number[];
    atRisk: number[];
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
 * Stack Total / Named / DCL. When `showTopUpCompliant` is false, only the
 * top-up-compliant portion is omitted (not folded into at-risk).
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
    const topUpCompliant = categories.map((category) => {
        if (category.showTopUpCompliant === false) {
            return 0;
        }
        return Math.max(0, category.totals.topUpCompliantExcess);
    });
    const atRisk = categories.map((category) =>
        Math.max(0, category.totals.atRiskExposure)
    );
    const approvedLimits = categories.map((category) => {
        const base = Math.max(0, category.totals.approvedLimit);
        // Named / DCL: base approved only. Total: base + top-up.
        if (category.showTopUpCompliant === false) {
            return base;
        }
        return effectiveApprovedLimit(base, category.totals.topUpTotal);
    });
    const stackHeights = categories.map(
        (_category, index) =>
            usedWithin[index] +
            remaining[index] +
            topUpCompliant[index] +
            atRisk[index]
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
        topUpCompliant,
        atRisk,
        stackHeights,
        usagePct,
        approvedLimits,
    };
}
