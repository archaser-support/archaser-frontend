/**
 * Prepare dashboard_credit_invoices execute filters: strip membership markers
 * and expand into primaryWhereExtras (terms / reporting / reported cohorts).
 */

import {
    reportedInvoicesMembershipWhere,
    reportingCountdownMembershipWhere,
    resolveReportingCountdownWindowDays,
    termsBreachMembershipWhere,
} from "@/server/services/creditInsurance/creditDashboardInvoiceMembership";
import type { Filter } from "@/server/services/ReportExecutionService.types";
import {
    CREDIT_DASHBOARD_INVOICE_MEMBERSHIP_FILTER_FIELD,
    parseCreditDashboardInvoiceMembershipValue,
} from "@/shared/dashboard/creditDashboardReportFilters";

export interface PreparedDashboardCreditInvoiceExecuteFilters {
    filters: Filter[];
    primaryWhereExtras?: Record<string, unknown>;
}

export async function prepareDashboardCreditInvoiceExecuteFilters(
    filters: Filter[] | undefined,
    options: { accountId: number }
): Promise<PreparedDashboardCreditInvoiceExecuteFilters> {
    if (!filters?.length) {
        return { filters: filters ?? [] };
    }

    const membershipIndex = filters.findIndex(
        (f) =>
            f.table === "Invoice" &&
            f.field === CREDIT_DASHBOARD_INVOICE_MEMBERSHIP_FILTER_FIELD
    );

    if (membershipIndex < 0) {
        return { filters };
    }

    const marker = filters[membershipIndex];
    const parsed = parseCreditDashboardInvoiceMembershipValue(marker.value);
    const rest = filters.filter((_, i) => i !== membershipIndex);

    if (!parsed.type) {
        return { filters: rest };
    }

    const policyIdFilter = rest.find(
        (f) =>
            f.table === "Invoice" &&
            f.field === "policy_id" &&
            f.operator === "equals"
    );
    const customerIdFilter = rest.find(
        (f) =>
            f.table === "Invoice" &&
            f.field === "customer_id" &&
            f.operator === "equals"
    );
    const policyId =
        policyIdFilter != null && Number.isFinite(Number(policyIdFilter.value))
            ? Number(policyIdFilter.value)
            : undefined;
    const customerId =
        customerIdFilter != null &&
        Number.isFinite(Number(customerIdFilter.value))
            ? Number(customerIdFilter.value)
            : undefined;

    // Scope filters stay in `filters` so QueryBuilder applies them; membership
    // extras carry the KPI cohort (account_id + status/breach/dates).
    let primaryWhereExtras: Record<string, unknown>;

    if (parsed.type === "terms") {
        primaryWhereExtras = termsBreachMembershipWhere(options.accountId, {
            termsBreachReason: parsed.termsBreachReason,
            termsOverdueOnly: parsed.termsOverdueOnly,
            policyId,
            customerId,
        }) as Record<string, unknown>;
        // policy/customer already in where — strip duplicate plain filters
        return {
            filters: rest.filter(
                (f) =>
                    !(
                        f.table === "Invoice" &&
                        (f.field === "policy_id" || f.field === "customer_id")
                    )
            ),
            primaryWhereExtras,
        };
    }

    if (parsed.type === "reporting") {
        const windowDays = await resolveReportingCountdownWindowDays(
            options.accountId
        );
        primaryWhereExtras = reportingCountdownMembershipWhere(
            options.accountId,
            windowDays,
            { policyId, customerId }
        ) as Record<string, unknown>;
        return {
            filters: rest.filter(
                (f) =>
                    !(
                        f.table === "Invoice" &&
                        (f.field === "policy_id" || f.field === "customer_id")
                    )
            ),
            primaryWhereExtras,
        };
    }

    primaryWhereExtras = reportedInvoicesMembershipWhere(options.accountId, {
        policyId,
        customerId,
    }) as Record<string, unknown>;
    return {
        filters: rest.filter(
            (f) =>
                !(
                    f.table === "Invoice" &&
                    (f.field === "policy_id" || f.field === "customer_id")
                )
        ),
        primaryWhereExtras,
    };
}
