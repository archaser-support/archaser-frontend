/**
 * Prepare dashboard_credit_customers execute filters: strip credit scope +
 * membership markers and expand into primaryWhereExtras.
 */

import {
    resolveCreditCustomerMembershipIds,
    zeroLimitWarningMembershipWhere,
} from "@/server/services/creditInsurance/creditDashboardCustomerMembership";
import { customersScopedForCreditDashboard } from "@/server/services/creditInsurance/customerPolicyQueryHelpers";
import type { Filter } from "@/server/services/ReportExecutionService.types";
import {
    CREDIT_DASHBOARD_CUSTOMER_MEMBERSHIP_FILTER_FIELD,
    CREDIT_DASHBOARD_CUSTOMER_SCOPE_FILTER_FIELD,
    parseCreditDashboardCustomerMembershipValue,
    parseCreditDashboardCustomerScopeValue,
} from "@/shared/dashboard/creditDashboardReportFilters";

export interface PreparedDashboardCreditCustomerExecuteFilters {
    filters: Filter[];
    primaryWhereExtras?: Record<string, unknown>;
}

function andWhere(
    parts: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
    const defined = parts.filter(
        (p): p is Record<string, unknown> =>
            p != null && Object.keys(p).length > 0
    );
    if (defined.length === 0) {
        return undefined;
    }
    if (defined.length === 1) {
        return defined[0];
    }
    return { AND: defined };
}

/**
 * Expand `__credit_dashboard_customer_scope` (+ optional membership marker)
 * into the same customer cohort used by get*Report (without BU — execute
 * still applies businessUnitFilter separately).
 */
export async function prepareDashboardCreditCustomerExecuteFilters(
    filters: Filter[] | undefined,
    options: { accountId: number }
): Promise<PreparedDashboardCreditCustomerExecuteFilters> {
    if (!filters?.length) {
        return { filters: filters ?? [] };
    }

    let working = [...filters];
    let scopeWhere: Record<string, unknown> | undefined;
    let membershipWhere: Record<string, unknown> | undefined;

    const scopeIndex = working.findIndex(
        (f) =>
            f.table === "Customer" &&
            f.field === CREDIT_DASHBOARD_CUSTOMER_SCOPE_FILTER_FIELD
    );

    if (scopeIndex >= 0) {
        const marker = working[scopeIndex];
        const policyId = parseCreditDashboardCustomerScopeValue(marker.value);
        scopeWhere = customersScopedForCreditDashboard(
            options.accountId,
            policyId
        ) as Record<string, unknown>;
        working = working.filter((_, i) => i !== scopeIndex);

        const membershipIndex = working.findIndex(
            (f) =>
                f.table === "Customer" &&
                f.field === CREDIT_DASHBOARD_CUSTOMER_MEMBERSHIP_FILTER_FIELD
        );

        if (membershipIndex >= 0) {
            const membershipMarker = working[membershipIndex];
            const parsed = parseCreditDashboardCustomerMembershipValue(
                membershipMarker.value
            );
            working = working.filter((_, i) => i !== membershipIndex);

            if (parsed.type === "zero_limit_warning") {
                membershipWhere = zeroLimitWarningMembershipWhere({
                    policyId,
                }) as Record<string, unknown>;
            } else if (parsed.type != null) {
                const customerIdFilter = working.find(
                    (f) =>
                        f.table === "Customer" &&
                        f.field === "id" &&
                        f.operator === "equals"
                );
                const customerId =
                    customerIdFilter != null &&
                    Number.isFinite(Number(customerIdFilter.value))
                        ? Number(customerIdFilter.value)
                        : undefined;

                const ids = await resolveCreditCustomerMembershipIds(
                    parsed.type,
                    options.accountId,
                    {
                        policyId,
                        customerId,
                        includeNoPolicyExposure:
                            parsed.includeNoPolicyExposure,
                        withinDays: parsed.withinDays ?? undefined,
                    }
                );
                membershipWhere = {
                    id: { in: ids ?? [] },
                };
            }
        }
    } else {
        // Membership without scope is unexpected; still strip the marker.
        working = working.filter(
            (f) =>
                !(
                    f.table === "Customer" &&
                    f.field === CREDIT_DASHBOARD_CUSTOMER_MEMBERSHIP_FILTER_FIELD
                )
        );
    }

    return {
        filters: working,
        primaryWhereExtras: andWhere([scopeWhere, membershipWhere]),
    };
}
