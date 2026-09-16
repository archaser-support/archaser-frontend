/**
 * Response shapes for the Nest credit-insurance endpoints consumed by the
 * dashboard, portfolio health and customer trend screens.
 */

export const PORTFOLIO_HEALTH_BELOW_THRESHOLD_PCT = 85;
export const INSURER_DECLINED_REASON = "Insurer declined";

export const NO_COVERAGE_REASON_KEYS = [
    "pending_review",
    "credit_hold",
    "insurer_declined",
    "no_linked_policy",
] as const;

export type CanonicalNoCoverageReasonKey =
    (typeof NO_COVERAGE_REASON_KEYS)[number];

/** Canonical slug, or raw policy_exclusion_reason text from the API. */
export type NoCoverageReasonKey = CanonicalNoCoverageReasonKey | string;

export const UTILIZATION_DISTRIBUTION_BIN_KEYS = [
    "0_20",
    "20_40",
    "40_60",
    "60_80",
    "80_100",
    "100_110",
    "110_120",
    "120_130",
    "130_150",
    "150_plus",
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
     * Sum of per-customer at-risk under the shared formula: uncovered → full AR;
     * insured → Σ max(capacity_gap_i, terms_breach_i) per open invoice.
     * Live portfolio has no policy max-cover residual on top of customer sums.
     */
    atRiskExposure: number;
    /**
     * Sum of insured-customer at-risk (same per-invoice max formula) only.
     * Equals atRiskExposure minus withoutPolicy.totalAmount when without-policy
     * cohort is included in scope.
     */
    policyRiskExposure: number;
    /**
     * Insured customers in scope with open AR > 0 (same rows that feed {@link CreditDashboardSummary.policyRiskExposure}).
     */
    policyRiskExposureCustomerCount: number;
    /**
     * Same customer-sum drivers as {@link CreditDashboardSummary.atRiskExposure}
     * (no post-sum AR min-cap; live path has no policy residual).
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
    /** True when portfolio total AR was carried forward (identical non-zero). */
    isStaleCarriedForward?: boolean;
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
    /** Chronic over-limit streak (Bucket 1). */
    overLimitGap?: PortfolioOverLimitGapSection | null;
    /** Health slope, AR volatility, stale snapshots (Bucket 1 KPIs #5 / #6 / #7). */
    staleSlopeVolatility?: PortfolioStaleSlopeVolatilitySection | null;
    /** AR / exposure reconciliation (Bucket 1 KPI #13). */
    exposureReconciliation?: PortfolioExposureReconciliationSection | null;
    /** Breach dilution + clean-streak (Bucket 1 KPIs #11 / #12). */
    breachDilutionStreak?: PortfolioBreachDilutionStreakSection | null;
};

export type PortfolioOverLimitGapSection = {
    customersWithData: number;
    longestStreakDays: number;
    longestStreakStart: string | null;
    longestStreakEnd: string | null;
    longestStreakCustomerId: number | null;
    longestStreakCustomerName: string | null;
    accountCurrency: string;
};

export type HealthMomentumClassification =
    | "improving"
    | "flat"
    | "deteriorating";

export type PortfolioStaleSlopeVolatilitySection = {
    staleCarriedForwardDayCount: number;
    customersWithStaleDays: number;
    customersWithExtremeMoves: number;
    customersWithData: number;
    portfolioHealthSlope: number | null;
    portfolioHealthClassification: HealthMomentumClassification | null;
    portfolioHealthSlopeSuppressed: boolean;
    portfolioHealthDaysUsed: number;
    portfolioPeakHealth: number | null;
    portfolioPeakDate: string | null;
    portfolioCurrentHealth: number | null;
    portfolioCurrentDate: string | null;
    avgCustomerArSigmaPct: number | null;
    accountCurrency: string;
};

export type PortfolioBreachDilutionStreakSection = {
    customersWithData: number;
    dilutedCustomerCount: number;
    resolvedCustomerCount: number;
    customersWithBreachHistory: number;
    customersCurrentlyInBreach: number;
    customersBreachFree: number;
    customersNeverBreached: number;
    accountCurrency: string;
};

export type PortfolioNoCoverageDailyPoint = {
    snapshotDate: string;
    totalCustomerCount: number;
    uncoveredCustomerCount: number;
    uncoveredAmount: number;
    approvedTotalReceivables: number;
    approvedTermsBreachAmount: number;
    amountByReason: Partial<Record<string, number>>;
    customerCountByReason: Partial<Record<string, number>>;
    breachAmountByReason: Partial<
        Record<TermsBreachByReasonSnapshotKey | string, number>
    >;
};

export type PortfolioNoCoverageReasonItem = {
    reason: string;
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
    /** ISO currency code from the account (e.g. ILS, USD). */
    accountCurrency: string;
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
    /** Mean daily usage_amount over available snapshot days in the range. */
    usageAmount: number;
    /** Mean daily total_receivables (open AR) over available snapshot days. */
    openAr: number;
    /**
     * Mean daily effective utilization % over days with a positive effective
     * limit; null when no such day exists.
     */
    utilizationPct: number | null;
};

/** Per-customer utilization overshoot ranking (Bucket 1 KPI #2). */
export type PortfolioUtilizationOvershootCustomer = {
    customerId: number;
    customerName: string;
    avgOvershootPts: number;
    maxOvershootPts: number | null;
    maxOvershootDate: string | null;
    avgUsagePct: number | null;
    peakUsagePct: number | null;
    peakUsageDate: string | null;
    daysWithLimit: number;
    daysAvailable: number;
    /** Available days with utilization strictly above 100%. */
    daysAboveLimit: number;
    /** Longest consecutive available-day streak above 100%. */
    longestAboveLimitDays: number;
    limitCapped: boolean;
};

export type PortfolioUtilizationOvershootSection = {
    customersWithData: number;
    avgOvershootPts: number | null;
    topAvgOvershootPts: number | null;
    topAvgOvershootCustomerId: number | null;
    topAvgOvershootCustomerName: string | null;
    limitCappedCustomerCount: number;
    ranking: PortfolioUtilizationOvershootCustomer[];
};

export type PortfolioUtilizationDistributionBin = {
    bin: UtilizationDistributionBinKey;
    customerCount: number;
    customerPct: number;
    usageAmount: number;
    usagePct: number;
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
    distributionUsageTotal: number;
    accountCurrency: string;
    /** Daily portfolio / DCL / Named utilization for the Utilization chart. */
    daily: PortfolioUtilizationDailyPoint[];
    /** Snapshot day kept for API compatibility; distribution/top customers use the full range. */
    asOfDate: string | null;
    /**
     * Named customers with open AR = 0 on every day they were Named in range.
     * DCL excluded.
     */
    idleNamedCustomerCount?: number;
    /**
     * Distinct Named customers named anytime in the range (Costs denominator).
     */
    namedCustomerCountInRange?: number;
    /** Idle named share of named-in-range (0–100). */
    idleNamedCustomerPct?: number;
    /**
     * Σ (current fee × idle named × year multiplier). Null fee → $0.
     */
    idleNamedAnnualCreditAssessmentCost?: number;
    /** `max(1, ceil(inclusiveDaysInRange / 365))`. */
    yearMultiplier?: number;
    /** Utilization overshoot ranking + limit-capped count (Bucket 1 #2 / #3). */
    overshoot?: PortfolioUtilizationOvershootSection | null;
};

export type PortfolioCostDailyPoint = {
    snapshotDate: string;
    /** Sum of approved-row `total_daily_cost` for the day (includes top-ups). */
    totalDailyCost: number;
};

export type PortfolioCostMonthlyPoint = {
    month: string;
    /** Insurance premium for the month (Actual Sales + Limit day-slices). */
    insuranceCost: number;
    /** Registration markup on insurance premiums (not top-ups). */
    registrationFeeCost: number;
    /** Amortized top-up premiums for the month. */
    topUpCost: number;
    /** insuranceCost + registrationFeeCost + topUpCost. */
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
    /** Anomalous negative daily-cost visibility (Bucket 1 KPI #8). */
    negativeCost?: PortfolioNegativeCostSection | null;
    /**
     * Σ over policies of (current Annual Credit Assessment Fee × distinct
     * Named customers named anytime in range × year multiplier). Standalone
     * from Policy cost / monthly / effective cost.
     */
    annualCreditAssessmentCost?: number;
    /** Sum of per-policy distinct Named customers named anytime in the range. */
    namedCustomerCountInRange?: number;
    /** `max(1, ceil(inclusiveDaysInRange / 365))`. */
    yearMultiplier?: number;
};

export type PortfolioNegativeCostPreviewEntry = {
    customerId: number;
    customerName: string;
    snapshotDate: string;
    amount: number;
};

export type PortfolioNegativeCostSection = {
    negativeEntryCount: number;
    negativeEntrySum: number;
    customersAffected: number;
    minMagnitude: number;
    previewEntries: PortfolioNegativeCostPreviewEntry[];
    accountCurrency: string;
};

export type PortfolioExposureReconciliationSection = {
    failingRowCount: number;
    maxAbsDelta: number | null;
    customersAffected: number;
    atRiskExceedsTotalRowCount: number;
    atRiskExceedsTotalCustomers: number;
    maxAtRiskExcess: number | null;
    epsilon: number;
    accountCurrency: string;
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
    avgSecondsPerDay?: number | null;
    estimatedSecondsRemaining?: number | null;
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

export type RiskExposurePolicySeries = {
    policyId: number;
    policyLabel: string;
    series: Array<{
        snapshotDate: string;
        amount: number;
        openArAmount?: number;
        capacityGapAmount?: number;
        termsBreachAmount?: number;
    }>;
};

export type CustomerDashboardKpiCards = {
    healthIndex: number;
    atRiskExposure: number;
    policyUsagePct: number | null;
    activePolicyCount: number;
    termsBreachOutstanding: number;
    /** Distinct open Due/Overdue invoices with any terms-breach flag (same membership as outstanding). */
    termsBreachInvoiceCount: number;
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
    overLimitDays?: number;
    overLimitDaysAvailable?: number;
    overLimitPctDays?: number | null;
    currentOverLimitStreakDays?: number;
    currentOverLimitStreakStart?: string | null;
    currentOverLimitStreakEnd?: string | null;
    longestOverLimitStreakDays?: number;
    longestOverLimitStreakStart?: string | null;
    longestOverLimitStreakEnd?: string | null;
    healthMomentumClassification?: HealthMomentumClassification | null;
    healthMomentumSlope?: number | null;
    healthMomentumDaysUsed?: number;
    healthMomentumSuppressed?: boolean;
    healthPeakValue?: number | null;
    healthPeakDate?: string | null;
    healthCurrentValue?: number | null;
    healthCurrentDate?: string | null;
    arVolatilitySigmaPct?: number | null;
    arVolatilityPairCount?: number;
    arVolatilityMinPctChange?: number | null;
    arVolatilityMinPctChangeDate?: string | null;
    arVolatilityMaxPctChange?: number | null;
    arVolatilityMaxPctChangeDate?: string | null;
    arVolatilityExtremeMoveCount?: number;
    arVolatilityDailyPctChanges?: Array<{
        snapshotDate: string;
        pctChange: number;
        extreme: boolean;
    }>;
    arVolatilityExtremeMoves?: Array<{
        snapshotDate: string;
        priorDate: string;
        pctChange: number;
    }>;
    arNewActivityEventCount?: number;
    staleDayCount?: number;
    staleDates?: string[];
    avgOvershootPts?: number | null;
    maxOvershootPts?: number | null;
    maxOvershootDate?: string | null;
    avgUsagePctPeriod?: number | null;
    peakUsagePctPeriod?: number | null;
    peakUsagePctDate?: string | null;
    overshootDaysWithLimit?: number;
    overshootDaysAvailable?: number;
    overshootDailyPts?: Array<{ snapshotDate: string; overshootPts: number }>;
    limitCapped?: boolean;
    limitCappedSuppressed?: boolean;
    limitCappedCompliantCv?: number | null;
    limitCappedTotalArCv?: number | null;
    limitCappedTotalArGrowthPct?: number | null;
    limitCappedCompliantGrowthPct?: number | null;
    limitCappedNormalizedSeries?: Array<{
        snapshotDate: string;
        totalArNormalized: number;
        compliantNormalized: number;
    }>;
    policyOpenArSharePct?: number | null;
    policyOpenArSharePolicyId?: number | null;
    policyOpenArSharePolicyNumber?: string | null;
    policyOpenArShareAsOfDate?: string | null;
    limitBreachForecastStatus?: string | null;
    limitBreachForecastThresholdPct?: number | null;
    limitBreachForecastProjectedDate?: string | null;
    limitBreachForecastDaysToThreshold?: number | null;
    limitBreachForecastCurrentUsagePct?: number | null;
    limitBreachForecastSlopePerDay?: number | null;
    limitBreachForecastRSquared?: number | null;
    limitBreachForecastSuppressed?: boolean;
    breachDilutionClassification?: "diluted" | "resolved" | "na" | null;
    breachDilutionSuppressed?: boolean;
    breachDilutionHealthRisePts?: number | null;
    breachDilutionBreachFirst?: number | null;
    breachDilutionBreachLast?: number | null;
    breachDilutionBreachChangePct?: number | null;
    breachDilutionArFirst?: number | null;
    breachDilutionArLast?: number | null;
    breachDilutionArGrowthPct?: number | null;
    breachStreakStatus?: "none" | "clean" | "open";
    breachStreakDays?: number;
    breachStreakStart?: string | null;
    breachStreakEnd?: string | null;
    breachEpisodeCount?: number;
    breachHasHistory?: boolean;
};

export type CustomerDashboardKpisResponse = {
    customerId: number;
    policyId: number | null;
    cards: CustomerDashboardKpiCards;
    riskExposureByPolicy: RiskExposurePolicySeries[];
    termsBreachReasonDistribution: TermsBreachCountByReason & { other: number };
};
