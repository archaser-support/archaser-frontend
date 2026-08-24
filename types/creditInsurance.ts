/**
 * Response shapes for the Nest credit-insurance endpoints consumed by the
 * dashboard, portfolio health and customer trend screens.
 */
import type { cost_calculation_method } from "@/types/db";

export const PORTFOLIO_HEALTH_BELOW_THRESHOLD_PCT = 85;
export const INSURER_DECLINED_REASON = "Insurer declined";

export const NO_COVERAGE_REASON_KEYS = [
    "pending_review",
    "credit_hold",
    "insurer_declined",
    "other",
    "no_linked_policy",
] as const;

export type NoCoverageReasonKey = (typeof NO_COVERAGE_REASON_KEYS)[number];

export const UTILIZATION_DISTRIBUTION_BIN_KEYS = [
    "0_10",
    "10_20",
    "20_50",
    "50_75",
    "75_plus",
] as const;

export type UtilizationDistributionBinKey =
    (typeof UTILIZATION_DISTRIBUTION_BIN_KEYS)[number];

/** Invoice counts per breach flag (one invoice may contribute to multiple categories). */
export type TermsBreachCountByReason = {
    reportingBreach: number;
    paymentTerm: number;
    customerOverdueMep: number;
    outdatedDcl: number;
    invoiceAfterPolicyEnd: number;
};

export type TermsBreachByReasonSnapshotKey = keyof (TermsBreachCountByReason & {
    other: number;
});

export type PolicyLimitUsageCategoryTotals = {
    /** Sum of eligible open AR in account currency. */
    openAr: number;
    /** Sum of eligible base approved limits in account currency. */
    approvedLimit: number;
    /** Sum of eligible active top-up cover in account currency. */
    topUpTotal: number;
    /** Sum of per-customer used within limit: Σ min(AR, approved limit). */
    usedWithinLimit: number;
    /** Sum of per-customer remaining: Σ max(0, approved limit − AR). */
    remaining: number;
    /**
     * Sum of per-customer AR above base covered by that customer's top-up
     * (not min(portfolio excess, Σ top-up)).
     */
    topUpCoveredExcess: number;
    /** Sum of per-customer AR beyond base approved limit plus that customer's top-up. */
    uncoveredExposure: number;
    /**
     * Portfolio usage percentage: usedWithinLimit / approved capacity × 100.
     * Combined uses base + top-up; Named and DCL use base approved only.
     */
    usagePct: number;
};

export type TopUpDashboardBlock = {
    activeCoverTotal: number;
    customersWithActiveCount: number;
    expiringWithinDays: {
        customerCount: number;
        totalAmount: number;
        windowDays: number;
        urgentCustomerCount: number;
    };
    incrementalCoverTotal: number;
    coverDeclinedDueToLimit: {
        customerCount: number;
        coverLostTotal: number;
    };
};

export type TopUpExpiringSoonAlert = {
    customerId: number;
    customerName: string | null;
    policyId: number;
    policyNumber: string | null;
    endDate: string;
};

export type CreditDashboardSummary = {
    healthIndex: number;
    totalReceivables: number;
    /**
     * Sum of per-customer compliant remainder: open AR minus allocated at-risk
     * (see atRiskExposure). Equals totalReceivables − atRiskExposure.
     */
    compliantExposure: number;
    /**
     * Sum of per-customer allocated at-risk: no-policy customers → full AR;
     * with policy → min(AR, capacity gap + terms breach outstanding);
     * plus portfolio limit residual: max(0, Σ policy max(0, policy AR − max cover) − capacity gap total).
     */
    atRiskExposure: number;
    /**
     * Sum of min(AR, gap + terms breach) for customers with a linked policy only.
     * Equals atRiskExposure minus withoutPolicy.totalAmount.
     */
    policyRiskExposure: number;
    /**
     * Insured customers in scope with open AR > 0 (same rows that feed {@link CreditDashboardSummary.policyRiskExposure}).
     */
    policyRiskExposureCustomerCount: number;
    /**
     * Uncapped driver sum: no-policy → full AR; with policy → capacity gap +
     * terms breach (gap invoices omitted from breach; before min with AR).
     */
    grossRiskExposure: number;
    overdueBlockCustomerCount: number;
    /** Sum of customer total AR (due + overdue) for customers in overdue block. */
    overdueBlockTotalOutstanding: number;
    capacityGap: {
        totalAmount: number;
        customerOverLimitCount: number;
    };
    termsBreach: {
        invoiceCount: number;
        totalAmount: number;
        /** Invoices per breach flag (counts may overlap across categories). */
        countByReason: TermsBreachCountByReason;
    };
    /** Customers with no linked policy: count and total open AR (treated as uninsured in at-risk logic). */
    withoutPolicy: {
        customerCount: number;
        totalAmount: number;
    };
    /** Invoices to report: open, not in breach, target within the next N days. */
    reportingCountdown: {
        invoiceCount: number;
        totalAmount: number;
        windowDays: number;
    };
    /** Unique customers: near limit (below 100% AR) and/or credit score expiring in window. */
    limitWarnings: {
        customerCount: number;
        totalAmount: number;
        thresholdPct: number;
        scoreWarnDays: number;
    };
    zeroLimitWarnings: {
        customerCount: number;
    };
    /** Account default currency for display (ISO code). */
    accountCurrency: string;
    hasTopUpPolicies: boolean;
    topUp: TopUpDashboardBlock | null;
    /**
     * Portfolio policy-limits usage: customer approved-limit categories
     * (combined / Named / DCL/SDL), not insurer policy max-cover caps.
     */
    policyUsage: {
        combined: PolicyLimitUsageCategoryTotals;
        named: PolicyLimitUsageCategoryTotals;
        dclSdl: PolicyLimitUsageCategoryTotals;
        topUpCoverTotal: number;
        topUpCoverUsed: number;
        topUpCoverRemaining: number;
        topUpCoverOverEffective: number;
    };
    policyMaxCoverAlerts: Array<{
        policyId: number;
        policyNumber: string | null;
        totalAr: number;
        maxCover: number;
        exceededAmount: number;
    }>;
    policyExpirationAlerts: Array<{
        policyId: number;
        policyNumber: string | null;
        endDate: string;
    }>;
    topUpExpirationAlerts: TopUpExpiringSoonAlert[];
};

export type CreditDashboardHistoryPoint = {
    snapshotDate: string;
    totalReceivables: number;
    compliantExposure: number;
    atRiskExposure: number;
    healthIndex: number;
    overdueBlockCustomerCount: number;
    capacityGapTotalAmount: number;
    termsBreachTotalAmount: number;
    withoutPolicyTotalAmount: number;
    reportingCountdownInvoiceCount: number;
    limitWarningsCustomerCount: number;
};

export type CreditDashboardHistoryDelta = {
    totalReceivables: number | null;
    compliantExposure: number | null;
    atRiskExposure: number | null;
    healthIndex: number | null;
};

export type CreditDashboardMonthPct = {
    totalReceivables: number | null;
    compliantExposure: number | null;
    atRiskExposure: number | null;
    overdueBlockCustomerCount: number | null;
    capacityGapTotalAmount: number | null;
    termsBreachTotalAmount: number | null;
    withoutPolicyTotalAmount: number | null;
    reportingCountdownInvoiceCount: number | null;
    limitWarningsCustomerCount: number | null;
};

export type CreditDashboardHistoryInterval = "daily" | "weekly";

export type CreditDashboardSummaryHistory = {
    series: CreditDashboardHistoryPoint[];
    delta: CreditDashboardHistoryDelta;
    monthPct: CreditDashboardMonthPct;
    interval: CreditDashboardHistoryInterval;
};

export type PortfolioHealthSeriesMetrics = {
    averageHealthPct: number;
    lowestHealthPct: number;
    lowestHealthStreakDays: number;
    /** Inclusive YYYY-MM-DD start of the longest trough streak (most recent on ties). */
    lowestHealthStreakStart: string | null;
    /** Inclusive YYYY-MM-DD end of the longest trough streak (most recent on ties). */
    lowestHealthStreakEnd: string | null;
    pctDaysBelow85: number;
};

export type PortfolioHealthDailyPoint = {
    snapshotDate: string;
    totalReceivables: number;
    compliantExposure: number;
    atRiskExposure: number;
    healthIndex: number;
};

export type PortfolioHealthMonthlyPoint = {
    month: string;
    totalReceivables: number;
    compliantExposure: number;
    atRiskExposure: number;
};

export type PortfolioHealthSection = {
    seriesA: PortfolioHealthSeriesMetrics;
    seriesB: PortfolioHealthSeriesMetrics;
    dailyA: PortfolioHealthDailyPoint[];
    dailyB: PortfolioHealthDailyPoint[];
    monthlyA: PortfolioHealthMonthlyPoint[];
    monthlyB: PortfolioHealthMonthlyPoint[];
};

export type PortfolioNoCoverageDailyPoint = {
    snapshotDate: string;
    totalCustomerCount: number;
    uncoveredCustomerCount: number;
    uncoveredAmount: number;
    approvedTotalReceivables: number;
    approvedTermsBreachAmount: number;
    amountByReason: Partial<Record<NoCoverageReasonKey, number>>;
    customerCountByReason: Partial<Record<NoCoverageReasonKey, number>>;
    breachAmountByReason: Partial<
        Record<TermsBreachByReasonSnapshotKey | string, number>
    >;
};

export type PortfolioNoCoverageReasonItem = {
    reason: NoCoverageReasonKey;
    averageAmount: number;
    averageCustomerCount: number;
};

export type PortfolioNoCoverageSection = {
    averageUncoveredCustomerPct: number;
    averageUncoveredAmount: number;
    averageUncoveredCustomerCount: number;
    reasons: PortfolioNoCoverageReasonItem[];
    averageViolationPct: number;
    mainViolationReason: string | null;
    mainViolationReasonSharePct: number;
    totalBreachAmount: number;
};

export type PortfolioUtilizationDailyPoint = {
    snapshotDate: string;
    /** Portfolio effective util % for approved rows; null when limit sum is 0. */
    utilizationPct: number | null;
    /** Size-weighted util % for DCL (self-underwriting) rows; null when DCL limit sum is 0. */
    dclUtilizationPct: number | null;
    /** Size-weighted util % for Named (insurer-approved) rows; null when Named limit sum is 0. */
    namedUtilizationPct: number | null;
    /** Approved DCL customer count that day. */
    dclCustomerCount: number;
    /** Approved Named customer count that day. */
    namedCustomerCount: number;
    /** Sum of total_receivables for approved DCL rows. */
    dclAr: number;
    /** Sum of total_receivables for approved Named rows. */
    namedAr: number;
    /** Size-weighted top-up util % among rows with top_up_total > 0; null if none. */
    topUpUtilizationPct: number | null;
    activeTopUpCountSum: number;
    customersWithActiveTopUp: number;
};

export type PortfolioUtilizationTopCustomer = {
    customerId: number;
    customerName: string;
    usageAmount: number;
    /** Coverage/utilization % vs effective limit; null when limit ≤ 0. */
    utilizationPct: number | null;
};

export type PortfolioUtilizationDistributionBin = {
    bin: UtilizationDistributionBinKey;
    customerCount: number;
    customerPct: number;
};

export type PortfolioUtilizationSection = {
    averageUtilizationPct: number;
    pctDaysAbove100: number;
    peakUtilizationPct: number;
    peakUtilizationStreakDays: number;
    peakUtilizationStreakStart: string | null;
    peakUtilizationStreakEnd: string | null;
    /**
     * DCL (self-underwriting) share of covered customers (DCL + Named).
     * Uncovered customers are excluded from the denominator.
     */
    selfUnderwrittenCustomerPct: number;
    selfUnderwrittenArSharePct: number;
    selfUnderwrittenAverageAr: number;
    selfUnderwrittenAverageUtilizationPct: number | null;
    /** Named (insurer-approved) share of covered customers (DCL + Named). */
    approvedCustomerPct: number;
    approvedArSharePct: number;
    approvedAverageAr: number;
    approvedAverageUtilizationPct: number | null;
    averageTopUpUtilizationPct: number | null;
    /** Unique top-ups active on at least one day in the range. */
    periodActiveTopUpCount: number;
    /** Unique customers with an active top-up on at least one day in the range. */
    periodCustomersWithTopUp: number;
    topCustomers: PortfolioUtilizationTopCustomer[];
    efficiencyA: number | null;
    /** @deprecated Health B removed from UI; kept null for API compatibility. */
    efficiencyB: number | null;
    distribution: PortfolioUtilizationDistributionBin[];
    distributionCustomerCount: number;
    /** Daily portfolio / DCL / Named utilization for the Utilization chart. */
    daily: PortfolioUtilizationDailyPoint[];
    /** Snapshot day used for top customers and distribution; null when none. */
    asOfDate: string | null;
};

export type PortfolioCostDailyPoint = {
    snapshotDate: string;
    /** Sum of approved-row `total_daily_cost` for the day (includes top-ups). */
    totalDailyCost: number;
};

export type PortfolioCostMonthlyPoint = {
    month: string;
    totalCost: number;
};

export type PortfolioCostsSection = {
    periodCost: number;
    monthly?: PortfolioCostMonthlyPoint[];
    daily: PortfolioCostDailyPoint[];
    averageCompliantExposure: number;
    /**
     * Period cost ÷ average daily compliant exposure.
     * Null when average compliant exposure is 0 (guard).
     */
    effectiveCost: number | null;
    /** ISO currency code from the account (e.g. ILS, USD). */
    accountCurrency: string;
    selfUnderwrittenCustomerPct: number;
    selfUnderwrittenArSharePct: number;
    /** Mean daily DCL (self-underwriting) AR over the range. */
    selfUnderwrittenAverageAr: number;
    approvedCustomerPct: number;
    approvedArSharePct: number;
    /** Mean daily Named (insurer-approved) AR over the range. */
    approvedAverageAr: number;
    /** Always null until a policy-level deductible field exists. */
    deductiblePct: null;
};

export type CreditAsOfBackfillJobStatus =
    | "idle"
    | "running"
    | "paused"
    | "failed"
    | "complete";

export type CreditAsOfBackfillJobView = {
    status: CreditAsOfBackfillJobStatus;
    fromDate: string | null;
    toDate: string | null;
    checkpointDate: string | null;
    daysTotal: number;
    daysDone: number;
    lastError: string | null;
    requestedBy: string | null;
    startedAt: string | null;
    updatedAt: string | null;
    skipReportingBreach: boolean;
};

export type CreditPortfolioHealthResponse = {
    from: string;
    to: string;
    daysAvailable: number;
    daysInRange: number;
    portfolioHealth: PortfolioHealthSection | null;
    noCoverage: PortfolioNoCoverageSection | null;
    utilization: PortfolioUtilizationSection | null;
    costs: PortfolioCostsSection | null;
};

export type CustomerPolicyTrendTopRow = {
    customerId: number;
    customerName: string;
    policyNumber: string | null;
    approvedLimit: number | null;
    topUpTotal: number | null;
    effectiveApprovedLimit: number | null;
    usageAmount: number;
    /** Policy limit usage % (sheet 2; capped at 100% when top-up applies). */
    policyUsagePct: number | null;
    /** Top-up pool usage % when AR exceeds approved limit. */
    topUpUsagePct: number | null;
    /** AR / effective limit × 100. */
    effectiveUsagePct: number | null;
    /** Bar segment widths (% of effective limit, or policy-only when no top-up). */
    barPolicyPct: number;
    barTopUpPct: number;
    barOverPct: number;
    /** Primary bar length / legacy field: effective usage when top-up exists, else policy usage. */
    usagePct: number | null;
};

export type CustomerPolicyUsageTrendResponse = {
    snapshotDate: string | null;
    hasTopUpPolicies: boolean;
    topCustomers: CustomerPolicyTrendTopRow[];
};

export type CustomerPolicyDailyCostChangeFields = {
    policyDailyCostChange: number | null;
    policyCostCurrency: string | null;
    topUpDailyCostChange: number | null;
    topUpCostCurrency: string | null;
    totalDailyCostChange: number | null;
    costCalculationMethod: cost_calculation_method | null;
    costPercent: number | null;
};

export type CustomerPolicyDailyCostKpiMetadata = {
    priorSnapshotDate: string | null;
    gapFillDaysApplied?: number;
};

export type CustomerPolicyCustomerTrendPoint = {
    snapshotDate: string;
    usageAmount: number;
    approvedLimit: number | null;
    usagePct: number | null;
} & CustomerPolicyDailyCostChangeFields;

export type CustomerPolicyCustomerTrendLatestPoint =
    CustomerPolicyCustomerTrendPoint & CustomerPolicyDailyCostKpiMetadata;

export type CustomerPolicyCustomerTrendResponse = {
    customerId: number;
    policyId: number | null;
    fromDate: string | null;
    toDate: string | null;
    latest: CustomerPolicyCustomerTrendLatestPoint | null;
    series: CustomerPolicyCustomerTrendPoint[];
};

export type RiskExposurePolicySeries = {
    policyId: number;
    policyLabel: string;
    series: Array<{ snapshotDate: string; amount: number }>;
};

export type CustomerDashboardKpiCards = {
    healthIndex: number;
    atRiskExposure: number;
    policyUsagePct: number | null;
    activePolicyCount: number;
    termsBreachOutstanding: number;
    capacityGapAmount: number;
    /** Uninsured exposure: full open AR when excluded from policy, else stored uninsured (0 when outdated DCL). */
    uninsuredAmount: number;
    /** True when the scoped customer policy is excluded from policy. */
    isExcludedFromPolicy: boolean;
    totalAr: number;
    accountCurrency: string | null;
    creditInsuranceSecondaryCurrency?: string | null;
    totalArSecondary?: number | null;
    capacityGapAmountSecondary?: number | null;
    /** Limit/invoice currency for gap secondary line (may differ from creditInsuranceSecondaryCurrency). */
    capacityGapLimitCurrency?: string | null;
    uninsuredAmountSecondary?: number | null;
    termsBreachOutstandingSecondary?: number | null;
    atRiskExposureSecondary?: number | null;
    topUpTotal?: number | null;
    topUpUsagePct?: number | null;
    effectiveLimit?: number | null;
    effectiveUsagePct?: number | null;
};

export type CustomerDashboardKpisResponse = {
    customerId: number;
    policyId: number | null;
    cards: CustomerDashboardKpiCards;
    riskExposureByPolicy: RiskExposurePolicySeries[];
    termsBreachReasonDistribution: TermsBreachCountByReason & { other: number };
};
