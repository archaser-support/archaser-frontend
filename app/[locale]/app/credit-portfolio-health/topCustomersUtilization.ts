import type { PortfolioUtilizationSection } from "@/types/creditInsurance";

export type TopCustomersUtilizationSummary = {
    averagePct: number | null;
    count: number;
    total: number;
    openArTotal: number;
    /** Top cohort open AR as % of portfolio open AR; null when denom is 0. */
    openArSharePct: number | null;
};

export function averageTopCustomersUtilization(
    customers: {
        utilizationPct: number | null;
        openAr?: number;
    }[],
    totalOpenAr: number
): TopCustomersUtilizationSummary {
    const total = customers.length;
    const openArTotal = customers.reduce(
        (sum, row) => sum + Math.max(0, Number(row.openAr) || 0),
        0
    );
    const denom = Math.max(0, Number(totalOpenAr) || 0);
    const openArSharePct =
        denom > 0 ? Math.min(100, (100 * openArTotal) / denom) : null;
    const withPct = customers.filter(
        (row): row is { utilizationPct: number; openAr?: number } =>
            row.utilizationPct != null && Number.isFinite(row.utilizationPct)
    );
    const count = withPct.length;
    if (count === 0) {
        return { averagePct: null, count, total, openArTotal, openArSharePct };
    }
    const averagePct =
        withPct.reduce((sum, row) => sum + row.utilizationPct, 0) / count;
    return { averagePct, count, total, openArTotal, openArSharePct };
}

/** Avg. utilization (top 10) KPI: top customers vs self-underwritten + approved open AR. */
export function sectionTopCustomersUtilization(
    section: Pick<
        PortfolioUtilizationSection,
        "topCustomers" | "selfUnderwrittenAverageAr" | "approvedAverageAr"
    >
): TopCustomersUtilizationSummary {
    const totalOpenAr =
        Math.max(0, Number(section.selfUnderwrittenAverageAr) || 0) +
        Math.max(0, Number(section.approvedAverageAr) || 0);
    return averageTopCustomersUtilization(section.topCustomers, totalOpenAr);
}
