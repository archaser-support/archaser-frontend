/**
 * Currency resolution for Customer amount fields in report formatting/export.
 */

import { isCreditDashboardEnrichedCustomerField } from "@/server/services/creditInsurance/creditDashboardReportEnrichment";

import {
    getActiveCustomerPolicyRow,
    isCustomerPolicyBackedReportField,
} from "./reportCustomerPolicyFields";
import {
    isTrendCostBackedReportField,
} from "./reportCustomerTrendCostFields";

function pickCurrency(
    ...candidates: Array<string | null | undefined>
): string | null {
    for (const candidate of candidates) {
        const trimmed = candidate?.trim();
        if (trimmed) {
            return trimmed;
        }
    }
    return null;
}

/** Customer fields that should render as localized currency in reports. */
const CUSTOMER_CURRENCY_AMOUNT_FIELDS = new Set([
    "approved_limit",
    "capacity_gap_amount",
    "top_up_total",
    "effective_approved_limit",
    "open_receivable_amount",
    "terms_breach_outstanding",
    "policy_risk_allocated",
    "top_up_resolved_amount",
    "total_due_amount",
    "total_overdue_amount",
]);

export function isCustomerReportCurrencyAmountField(field: string): boolean {
    if (CUSTOMER_CURRENCY_AMOUNT_FIELDS.has(field)) {
        return true;
    }
    if (isCreditDashboardEnrichedCustomerField(field)) {
        return field !== "open_invoice_count";
    }
    if (isTrendCostBackedReportField(field)) {
        return (
            field === "top_up_total" || field === "effective_approved_limit"
        );
    }
    if (isCustomerPolicyBackedReportField(field)) {
        return (
            field === "approved_limit" || field === "capacity_gap_amount"
        );
    }
    return false;
}

/** Fields stored in account currency (legacy credit dashboard KPI parity). */
const ACCOUNT_CURRENCY_CUSTOMER_FIELDS = new Set([
    "open_receivable_amount",
    "top_up_total",
    "effective_approved_limit",
    "terms_breach_outstanding",
    "policy_risk_allocated",
    "top_up_resolved_amount",
]);

export function resolveCustomerAmountFieldCurrency(
    row: unknown,
    field: string,
    accountCurrency: string
): string {
    if (
        ACCOUNT_CURRENCY_CUSTOMER_FIELDS.has(field) ||
        field === "top_up_total" ||
        field === "effective_approved_limit"
    ) {
        return accountCurrency;
    }

    const policy = getActiveCustomerPolicyRow(row);
    const policyRecord = policy as Record<string, unknown> | null;
    const insurancePolicy = policyRecord?.InsurancePolicy as
        | Record<string, unknown>
        | null
        | undefined;

    const customerRow =
        row && typeof row === "object"
            ? (row as Record<string, unknown>)
            : null;

    return (
        pickCurrency(
            policyRecord?.approved_limit_currency as string | undefined,
            insurancePolicy?.currency as string | undefined,
            customerRow?.customer_due_currency1 as string | undefined,
            customerRow?.customer_currency as string | undefined,
            customerRow?.currency as string | undefined
        ) ?? accountCurrency
    );
}
