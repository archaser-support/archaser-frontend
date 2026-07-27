import { Customer, CustomerPolicyHistoryItem } from "@/types/Customer";
import { resolveStoredCapacityGapSecondary } from "@/shared/creditInsurance/policyGapAmounts";
import {
    deriveSecondaryAmountFromInvoiceBucketRatio,
    resolveCustomerCreditInsuranceSecondaryCurrency,
    resolveInvoiceBucketRatioArPair,
} from "@/shared/creditInsurance/invoiceBucketAmounts";

export type CustomerWithProductInfo = Customer & {
    Account?: { has_credit_insurance?: boolean | null };
    policy_id?: number | null;
    customerPolicies?: CustomerPolicyHistoryItem[];
};

export type DashboardPolicyCard = {
    policyId: number;
    policyLabel: string;
    approvedLimit: number | null;
    usedAr: number | null;
    usagePct: number | null;
    overLimitAmount: number;
    isActive: boolean;
};

export type DashboardTrendStatus = "ready" | "no_history" | "loading" | "error";

export type DashboardTrendPoint = {
    snapshotDate: string;
    usageAmount: number;
    approvedLimit: number | null;
    usagePct: number | null;
};

export type CustomerCreditKpiCards = {
    healthIndex: number;
    atRiskExposure: number;
    policyUsagePct: number | null;
    activePolicyCount: number;
    termsBreachOutstanding: number;
    capacityGapAmount: number;
    uninsuredAmount: number;
    accountCurrency: string | null;
    creditInsuranceSecondaryCurrency?: string | null;
    totalArSecondary?: number | null;
    capacityGapAmountSecondary?: number | null;
    capacityGapLimitCurrency?: string | null;
    uninsuredAmountSecondary?: number | null;
    termsBreachOutstandingSecondary?: number | null;
    atRiskExposureSecondary?: number | null;
    isExcludedFromPolicy?: boolean;
    topUpTotal?: number | null;
    topUpUsagePct?: number | null;
    effectiveLimit?: number | null;
    effectiveUsagePct?: number | null;
};

export type RiskExposureTrendSeries = {
    policyId: number;
    policyLabel: string;
    series: Array<{ snapshotDate: string; amount: number }>;
};

export type TermsBreachReasonSlice = {
    key: string;
    labelKey: string;
    count: number;
};

export type DashboardCardContract = {
    eligibleForCreditSection: boolean;
    policyCards: DashboardPolicyCard[];
    selectedPolicyId: number | null;
    trend: {
        status: DashboardTrendStatus;
        points: DashboardTrendPoint[];
    };
    kpis: {
        capacityGapAmount: number;
        /** Stored limit excess on scoped CustomerPolicy (display ≥ 0). */
        uninsuredAmount: number;
        termsBreachOutstanding: number;
        reportingBreachInvoiceCount: number;
        overdueBlockInvoiceCount: number;
        /** Invoice-bucket ratio secondary line for capacity gap display. */
        capacityGapAmountSecondary: number | null;
    };
    creditKpis: CustomerCreditKpiCards | null;
    riskExposureByPolicy: RiskExposureTrendSeries[];
    termsBreachReasonSlices: TermsBreachReasonSlice[];
};

function normalizeNumber(value: unknown): number | null {
    if (value == null || value === "") {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeCount(value: unknown): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function resolvePolicyLabel(policy: CustomerPolicyHistoryItem): string {
    const policyNumber = policy.InsurancePolicy?.policy_number?.trim();
    if (policyNumber) {
        return policyNumber;
    }
    return `Policy #${policy.insurance_policy_id ?? policy.id}`;
}

/** One card per insurance policy; history may contain multiple rows for the same policy. */
export function dedupeCustomerPolicyHistoryRows(
    rows: CustomerPolicyHistoryItem[]
): CustomerPolicyHistoryItem[] {
    const byPolicyId = new Map<number, CustomerPolicyHistoryItem>();

    for (const row of rows) {
        if (row.insurance_policy_id == null) {
            continue;
        }
        const policyId = Number(row.insurance_policy_id);
        const existing = byPolicyId.get(policyId);
        if (!existing) {
            byPolicyId.set(policyId, row);
            continue;
        }
        if (row.is_active && !existing.is_active) {
            byPolicyId.set(policyId, row);
            continue;
        }
        if (!row.is_active && existing.is_active) {
            continue;
        }
        if (Number(row.id ?? 0) > Number(existing.id ?? 0)) {
            byPolicyId.set(policyId, row);
        }
    }

    return Array.from(byPolicyId.values());
}

/** Policy row for dashboard scope: selected insurance policy, else active, else first. */
export function resolveDashboardPolicyRow(
    customer: CustomerWithProductInfo | null | undefined,
    selectedPolicyId: number | null
): CustomerPolicyHistoryItem | null {
    const rows = dedupeCustomerPolicyHistoryRows(
        customer?.customerPolicies ?? []
    );
    if (selectedPolicyId != null) {
        return (
            rows.find((r) => Number(r.insurance_policy_id) === selectedPolicyId) ??
            null
        );
    }
    return rows.find((r) => r.is_active) ?? rows[0] ?? null;
}

function readUninsuredFromPolicyRow(
    row: CustomerPolicyHistoryItem | null
): number {
    if (!row || row.outdated_dcl === true) {
        return 0;
    }
    if (row.approved_limit == null || row.approved_limit === "") {
        return 0;
    }
    if (row.uninsured_amount == null) {
        return 0;
    }
    return Math.max(0, Number(row.uninsured_amount));
}

function getCustomerFxRate(customer: CustomerWithProductInfo | null | undefined): number | null {
    if (!customer) return null;
    const totalAr = Number(customer.total_ar ?? 0);
    const totalArSec = Number((customer as any).total_ar_secondary ?? 0);
    if (totalAr > 0 && totalArSec > 0) {
        return totalAr / totalArSec;
    }
    return null;
}

function readCapacityGapFromPolicyRow(
    row: CustomerPolicyHistoryItem | null,
    policyOpenAr: number | null | undefined
): number {
    if (!row || row.outdated_dcl === true) {
        return 0;
    }
    if (row.approved_limit == null || row.approved_limit === "") {
        return 0;
    }
    if (row.capacity_gap_amount == null) {
        return 0;
    }
    const gap = Math.max(0, Number(row.capacity_gap_amount));
    const ar = policyOpenAr != null ? Number(policyOpenAr) : null;
    if (ar == null || ar <= 0) {
        return 0;
    }
    const approvedLimit = Number(row.approved_limit);
    const approvedInAccount =
        Number.isFinite(approvedLimit) && approvedLimit > 0
            ? approvedLimit
            : null;
    let capped = Math.min(gap, ar);
    if (approvedInAccount != null) {
        capped = Math.min(capped, Math.max(0, ar - approvedInAccount));
    }
    return capped;
}

function resolveCapacityGapSecondaryForDisplay(args: {
    gapPrimary: number;
    customer: CustomerWithProductInfo | null | undefined;
    arPrimary: number | null | undefined;
    creditKpis?: CustomerCreditKpiCards | null;
    selectedPolicyId?: number | null;
}): number | null {
    if (args.creditKpis?.capacityGapAmountSecondary != null) {
        return args.creditKpis.capacityGapAmountSecondary;
    }
    if (args.gapPrimary <= 0 || !args.customer) {
        return null;
    }
    const storedOnCustomer = normalizeNumber(
        (args.customer as { capacity_gap_secondary?: unknown })
            .capacity_gap_secondary
    );
    if (storedOnCustomer != null) {
        return storedOnCustomer;
    }
    const accountCurrency =
        args.customer.Account?.currency ??
        (args.customer as { account_currency?: string }).account_currency ??
        null;
    const secondaryCurrency = resolveCustomerCreditInsuranceSecondaryCurrency(
        args.customer as Customer,
        accountCurrency
    );
    if (!secondaryCurrency) {
        return null;
    }
    const policyRows = dedupeCustomerPolicyHistoryRows(
        args.customer.customerPolicies ?? []
    );
    const fromPolicy = resolveStoredCapacityGapSecondary(
        policyRows,
        secondaryCurrency,
        args.selectedPolicyId != null
            ? { policyId: args.selectedPolicyId }
            : undefined
    );
    if (fromPolicy != null) {
        return fromPolicy;
    }
    const fallbackArPrimary =
        args.arPrimary != null && args.arPrimary > 0
            ? args.arPrimary
            : normalizeNumber(args.customer.total_ar) ?? 0;
    const { arPrimary, arSecondary } = resolveInvoiceBucketRatioArPair(
        args.customer as Customer,
        secondaryCurrency,
        fallbackArPrimary
    );
    return deriveSecondaryAmountFromInvoiceBucketRatio(
        args.gapPrimary,
        arPrimary,
        arSecondary
    );
}

export function buildPolicyCards(
    customer: CustomerWithProductInfo | null | undefined
): DashboardPolicyCard[] {
    const fxRate = getCustomerFxRate(customer);
    const effectiveLimitFromCustomer = normalizeNumber(
        (customer as CustomerWithProductInfo & { effective_approved_limit?: unknown })
            ?.effective_approved_limit
    );
    const policyRows = dedupeCustomerPolicyHistoryRows(
        customer?.customerPolicies ?? []
    );
    return policyRows
        .filter((row) => row.insurance_policy_id != null)
        .map((row) => {
            const approvedLimit = normalizeNumber(row.approved_limit);
            const limitForUsage =
                row.is_active && effectiveLimitFromCustomer != null
                    ? effectiveLimitFromCustomer
                    : approvedLimit;
            const usedAr =
                normalizeNumber(row.policy_open_ar) ??
                normalizeNumber((customer as Customer)?.total_ar);
            const usagePct =
                limitForUsage != null && limitForUsage > 0 && usedAr != null
                    ? Math.min(999.99, (100 * usedAr) / limitForUsage)
                    : null;
            const overLimitAmount = readCapacityGapFromPolicyRow(row, usedAr);

            return {
                policyId: Number(row.insurance_policy_id),
                policyLabel: resolvePolicyLabel(row),
                approvedLimit,
                usedAr,
                usagePct,
                overLimitAmount,
                isActive: row.is_active === true,
            };
        })
        .sort((a, b) => {
            if (a.isActive !== b.isActive) {
                return a.isActive ? -1 : 1;
            }
            return a.policyLabel.localeCompare(b.policyLabel);
        });
}

type OverdueCollectionPeriodLike = {
    total_outstanding_amount?: number | null;
    no_of_overdue_invoices?: number | null;
    customer_outstanding_amount1?: number | null;
    customer_outstanding_amount2?: number | null;
} | null | undefined;

type OverdueCustomerLike = {
    total_overdue_amount?: number | null;
    number_of_overdue_invoices?: number | null;
    total_invoices_overdue?: number | null;
    customer_overdue_amount1?: number | null;
    customer_overdue_amount2?: number | null;
};

function sumOptionalAmounts(
    a1?: number | null,
    a2?: number | null
): number {
    return Math.max(0, Number(a1 ?? 0)) + Math.max(0, Number(a2 ?? 0));
}

/**
 * Overdue KPI for the customer dashboard card.
 * Uses the best available denormalized total (customer row, open collection period, or currency buckets).
 * Avoids showing 0 when the open period is stale but `Customer.total_overdue_amount` is populated.
 */
export function resolveCustomerOverdueDisplayMetrics(
    customer: OverdueCustomerLike,
    openPeriod?: OverdueCollectionPeriodLike
): { amount: number; invoiceCount: number } {
    const amount = Math.max(
        Number(customer.total_overdue_amount ?? 0),
        Number(openPeriod?.total_outstanding_amount ?? 0),
        sumOptionalAmounts(
            customer.customer_overdue_amount1,
            customer.customer_overdue_amount2
        ),
        sumOptionalAmounts(
            openPeriod?.customer_outstanding_amount1,
            openPeriod?.customer_outstanding_amount2
        )
    );

    const invoiceCount = Math.max(
        Number(
            customer.number_of_overdue_invoices ??
                customer.total_invoices_overdue ??
                0
        ),
        Number(openPeriod?.no_of_overdue_invoices ?? 0)
    );

    return { amount, invoiceCount };
}

export function isCreditDashboardSectionEligible(
    customer: Customer | null | undefined,
    hasCreditProduct: boolean
): boolean {
    const typedCustomer = customer as CustomerWithProductInfo | null | undefined;
    return hasCreditProduct && (typedCustomer?.customerPolicies?.length ?? 0) > 0;
}

export function buildDashboardCardContract(args: {
    customer: Customer | null | undefined;
    hasCreditProduct: boolean;
    selectedPolicyId: number | null;
    trendStatus: DashboardTrendStatus;
    trendPoints: DashboardTrendPoint[];
    creditKpis?: CustomerCreditKpiCards | null;
    riskExposureByPolicy?: RiskExposureTrendSeries[];
    termsBreachReasonSlices?: TermsBreachReasonSlice[];
}): DashboardCardContract {
    const typedCustomer = args.customer as CustomerWithProductInfo | null | undefined;
    const fxRate = getCustomerFxRate(typedCustomer);
    const policyCards = buildPolicyCards(typedCustomer);
    const effectiveSelectedPolicyId =
        args.selectedPolicyId != null &&
        policyCards.some((card) => card.policyId === args.selectedPolicyId)
            ? args.selectedPolicyId
            : null;

    const scopedPolicyRow = resolveDashboardPolicyRow(
        typedCustomer,
        effectiveSelectedPolicyId
    );
    const scopedPolicyOpenAr =
        normalizeNumber(scopedPolicyRow?.policy_open_ar) ??
        normalizeNumber(typedCustomer?.total_ar);
    const isPolicyScoped =
        effectiveSelectedPolicyId != null && scopedPolicyRow != null;
    const allPoliciesCapacityGapAmount = policyCards.reduce(
        (sum, card) => sum + Math.max(0, Number(card.overLimitAmount ?? 0)),
        0
    );
    const allPoliciesUninsuredAmount = dedupeCustomerPolicyHistoryRows(
        typedCustomer?.customerPolicies ?? []
    ).reduce((sum, row) => sum + readUninsuredFromPolicyRow(row), 0);

    const resolvedPrimaryGap = isPolicyScoped
        ? readCapacityGapFromPolicyRow(scopedPolicyRow, scopedPolicyOpenAr)
        : allPoliciesCapacityGapAmount;

    const resolvedSecondaryGap = resolveCapacityGapSecondaryForDisplay({
        gapPrimary: resolvedPrimaryGap,
        customer: typedCustomer,
        arPrimary: isPolicyScoped ? scopedPolicyOpenAr : normalizeNumber(typedCustomer?.total_ar),
        creditKpis: args.creditKpis,
        selectedPolicyId: effectiveSelectedPolicyId,
    });

    return {
        eligibleForCreditSection: isCreditDashboardSectionEligible(
            args.customer,
            args.hasCreditProduct
        ),
        policyCards,
        selectedPolicyId: effectiveSelectedPolicyId,
        trend: {
            status: args.trendStatus,
            points: args.trendPoints,
        },
        kpis: {
            capacityGapAmount: resolvedPrimaryGap,
            uninsuredAmount: isPolicyScoped
                ? readUninsuredFromPolicyRow(scopedPolicyRow)
                : allPoliciesUninsuredAmount,
            termsBreachOutstanding: isPolicyScoped
                ? normalizeCount(scopedPolicyRow.terms_breach_outstanding)
                : normalizeCount(typedCustomer?.terms_breach_outstanding),
            reportingBreachInvoiceCount: isPolicyScoped
                ? normalizeCount(scopedPolicyRow.reporting_breach_invoice_count)
                : normalizeCount(typedCustomer?.reporting_breach_invoice_count),
            overdueBlockInvoiceCount: isPolicyScoped
                ? normalizeCount(scopedPolicyRow.overdue_block_invoice_count)
                : normalizeCount(typedCustomer?.overdue_block_invoice_count),
            capacityGapAmountSecondary: resolvedSecondaryGap,
        },
        creditKpis: args.creditKpis ?? null,
        riskExposureByPolicy: args.riskExposureByPolicy ?? [],
        termsBreachReasonSlices: args.termsBreachReasonSlices ?? [],
    };
}
