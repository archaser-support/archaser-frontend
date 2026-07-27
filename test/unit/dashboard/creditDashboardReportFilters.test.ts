import { describe, it, expect, vi } from "vitest";

vi.mock(
    "@/server/services/creditInsurance/creditInsuranceDashboardService",
    () => ({
        getCapacityGapReport: vi.fn(async () => ({
            total: 2,
            rows: [{ customerId: 10 }, { customerId: 20 }],
        })),
        getPolicyRiskExposureReport: vi.fn(async () => ({
            total: 1,
            rows: [{ customerId: 30 }],
        })),
        getLimitWarningReport: vi.fn(async () => ({
            total: 1,
            rows: [{ customerId: 40 }],
        })),
        getNoPolicyExposureReport: vi.fn(async () => ({
            total: 0,
            rows: [],
        })),
    })
);

vi.mock(
    "@/server/services/creditInsurance/creditInsuranceTopUpDashboardService",
    () => ({
        getTopUpCoverReport: vi.fn(async () => ({
            total: 1,
            rows: [{ customerId: 50 }],
        })),
        getTopUpExpiringReport: vi.fn(async () => ({
            total: 1,
            rows: [{ customerId: 60 }],
        })),
    })
);

import { prepareDashboardCreditCustomerExecuteFilters } from "@/server/services/dashboardCreditCustomerExecuteFilters";
import { customersScopedForCreditDashboard } from "@/server/services/creditInsurance/customerPolicyQueryHelpers";
import { zeroLimitWarningMembershipWhere } from "@/server/services/creditInsurance/creditDashboardCustomerMembership";
import {
    buildCreditDashboardReportFilters,
    CREDIT_DASHBOARD_CUSTOMER_MEMBERSHIP_FILTER_FIELD,
    CREDIT_DASHBOARD_CUSTOMER_SCOPE_FILTER_FIELD,
    CREDIT_DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES,
    DASHBOARD_CREDIT_CUSTOMERS_CONTEXT,
    DASHBOARD_CREDIT_INVOICES_CONTEXT,
    encodeCreditDashboardCustomerScopeValue,
    encodeNoPolicyExposureMembershipValue,
    getCreditDashboardSystemReportUniqueName,
    isCreditDashboardReportType,
    parseCreditDashboardCustomerMembershipValue,
    parseCreditDashboardCustomerScopeValue,
    shouldUseCreditDashboardViewBased,
} from "@/shared/dashboard/creditDashboardReportFilters";
import {
    canAccessReportsForContext,
    isCreditDashboardReportContext,
} from "@/shared/dashboard/dashboardInvoiceReportAccess";
import { getViewConfig } from "@/shared/utils/viewConfigs";

describe("creditDashboardReportFilters", () => {
    it("recognizes credit dashboard report types", () => {
        expect(isCreditDashboardReportType("overdue")).toBe(true);
        expect(isCreditDashboardReportType("capacity")).toBe(true);
        expect(isCreditDashboardReportType("terms")).toBe(true);
        expect(isCreditDashboardReportType("overdue-customers")).toBe(false);
    });

    it("maps overdue to credit customers context and unique_name", () => {
        expect(getCreditDashboardSystemReportUniqueName("overdue")).toBe(
            CREDIT_DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES.overdue
        );
        const result = buildCreditDashboardReportFilters({ type: "overdue" });
        expect(result.useViewBased).toBe(true);
        expect(result.grain).toBe("customers");
        expect(result.context).toBe(DASHBOARD_CREDIT_CUSTOMERS_CONTEXT);
        expect(result.systemReportUniqueName).toBe(
            "dashboard_credit_customers_overdue"
        );
    });

    it("locks overdue_block + customer scope marker for overdue", () => {
        const result = buildCreditDashboardReportFilters({
            type: "overdue",
            policyId: 42,
            customerId: 7,
        });

        expect(result.additionalFilters).toEqual([
            {
                table: "Customer",
                field: CREDIT_DASHBOARD_CUSTOMER_SCOPE_FILTER_FIELD,
                operator: "equals",
                value: "42",
            },
            {
                table: "Customer",
                field: "overdue_block",
                operator: "equals",
                value: true,
            },
            {
                table: "Customer",
                field: "id",
                operator: "equals",
                value: 7,
            },
        ]);
        expect(shouldUseCreditDashboardViewBased({ type: "overdue" })).toBe(
            true
        );
    });

    it.each([
        "capacity",
        "policy_risk",
        "limit_warning",
        "zero_limit_warning",
    ] as const)(
        "locks scope + membership marker for %s",
        (type) => {
            const result = buildCreditDashboardReportFilters({
                type,
                policyId: 5,
            });
            expect(result.useViewBased).toBe(true);
            expect(result.systemReportUniqueName).toBe(
                CREDIT_DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES[type]
            );
            expect(result.additionalFilters).toEqual([
                {
                    table: "Customer",
                    field: CREDIT_DASHBOARD_CUSTOMER_SCOPE_FILTER_FIELD,
                    operator: "equals",
                    value: "5",
                },
                {
                    table: "Customer",
                    field: CREDIT_DASHBOARD_CUSTOMER_MEMBERSHIP_FILTER_FIELD,
                    operator: "equals",
                    value: type,
                },
            ]);
        }
    );

    it("encodes includeNoPolicyExposure on membership marker", () => {
        expect(encodeNoPolicyExposureMembershipValue(true)).toBe(
            "no_policy_exposure"
        );
        expect(encodeNoPolicyExposureMembershipValue(false)).toBe(
            "no_policy_exposure:0"
        );
        const result = buildCreditDashboardReportFilters({
            type: "no_policy_exposure",
            includeNoPolicyExposure: false,
        });
        expect(result.useViewBased).toBe(true);
        expect(result.additionalFilters[1]?.value).toBe(
            "no_policy_exposure:0"
        );
    });

    it("encodes all-policies scope as 'all'", () => {
        expect(encodeCreditDashboardCustomerScopeValue(null)).toBe("all");
        expect(parseCreditDashboardCustomerScopeValue("all")).toBeUndefined();
        expect(parseCreditDashboardCustomerScopeValue("99")).toBe(99);
    });

    it("enables ViewBased for all credit dashboard report types", () => {
        const types = [
            "overdue",
            "capacity",
            "policy_risk",
            "limit_warning",
            "zero_limit_warning",
            "no_policy_exposure",
            "top_up",
            "top_up_expiring",
            "terms",
            "reporting",
            "reported",
        ] as const;
        for (const type of types) {
            expect(shouldUseCreditDashboardViewBased({ type })).toBe(true);
        }
    });

    it("locks invoice membership markers for terms/reporting/reported", () => {
        const terms = buildCreditDashboardReportFilters({
            type: "terms",
            policyId: 3,
            termsBreachReason: "reporting_breach",
            termsOverdueOnly: true,
        });
        expect(terms.useViewBased).toBe(true);
        expect(terms.context).toBe("dashboard_credit_invoices");
        expect(terms.additionalFilters[0]?.value).toBe(
            "terms:overdue:reporting_breach"
        );

        const reporting = buildCreditDashboardReportFilters({
            type: "reporting",
            customerId: 8,
        });
        expect(reporting.useViewBased).toBe(true);
        expect(reporting.additionalFilters[0]?.value).toBe("reporting");
        expect(reporting.additionalFilters).toContainEqual({
            table: "Invoice",
            field: "customer_id",
            operator: "equals",
            value: 8,
        });

        expect(
            buildCreditDashboardReportFilters({ type: "reported" }).useViewBased
        ).toBe(true);
    });
});

describe("prepareDashboardCreditCustomerExecuteFilters", () => {
    it("expands scope marker to customersScopedForCreditDashboard", async () => {
        const prepared = await prepareDashboardCreditCustomerExecuteFilters(
            [
                {
                    table: "Customer",
                    field: CREDIT_DASHBOARD_CUSTOMER_SCOPE_FILTER_FIELD,
                    operator: "equals",
                    value: "15",
                },
                {
                    table: "Customer",
                    field: "overdue_block",
                    operator: "equals",
                    value: true,
                },
            ],
            { accountId: 100 }
        );

        expect(prepared.filters).toEqual([
            {
                table: "Customer",
                field: "overdue_block",
                operator: "equals",
                value: true,
            },
        ]);
        expect(prepared.primaryWhereExtras).toEqual(
            customersScopedForCreditDashboard(100, 15)
        );
    });

    it("expands capacity membership to id.in from getCapacityGapReport", async () => {
        const prepared = await prepareDashboardCreditCustomerExecuteFilters(
            [
                {
                    table: "Customer",
                    field: CREDIT_DASHBOARD_CUSTOMER_SCOPE_FILTER_FIELD,
                    operator: "equals",
                    value: "all",
                },
                {
                    table: "Customer",
                    field: CREDIT_DASHBOARD_CUSTOMER_MEMBERSHIP_FILTER_FIELD,
                    operator: "equals",
                    value: "capacity",
                },
            ],
            { accountId: 55 }
        );

        expect(prepared.filters).toEqual([]);
        expect(prepared.primaryWhereExtras).toEqual({
            AND: [
                customersScopedForCreditDashboard(55, undefined),
                { id: { in: [10, 20] } },
            ],
        });
    });

    it("expands zero_limit membership to CustomerPolicy where fragment", async () => {
        const prepared = await prepareDashboardCreditCustomerExecuteFilters(
            [
                {
                    table: "Customer",
                    field: CREDIT_DASHBOARD_CUSTOMER_SCOPE_FILTER_FIELD,
                    operator: "equals",
                    value: "9",
                },
                {
                    table: "Customer",
                    field: CREDIT_DASHBOARD_CUSTOMER_MEMBERSHIP_FILTER_FIELD,
                    operator: "equals",
                    value: "zero_limit_warning",
                },
            ],
            { accountId: 1 }
        );

        expect(prepared.primaryWhereExtras).toEqual({
            AND: [
                customersScopedForCreditDashboard(1, 9),
                zeroLimitWarningMembershipWhere({ policyId: 9 }),
            ],
        });
    });

    it("parses no_policy_exposure:0 membership", () => {
        expect(
            parseCreditDashboardCustomerMembershipValue("no_policy_exposure:0")
        ).toEqual({
            type: "no_policy_exposure",
            includeNoPolicyExposure: false,
            withinDays: null,
        });
    });
});

describe("credit dashboard report access + viewConfig", () => {
    it("allows credit contexts with view_credit_dashboard", () => {
        expect(
            isCreditDashboardReportContext(DASHBOARD_CREDIT_CUSTOMERS_CONTEXT)
        ).toBe(true);
        expect(
            canAccessReportsForContext(DASHBOARD_CREDIT_CUSTOMERS_CONTEXT, {
                canViewReports: false,
                canViewCreditDashboard: true,
            })
        ).toBe(true);
        expect(
            canAccessReportsForContext(DASHBOARD_CREDIT_CUSTOMERS_CONTEXT, {
                canViewReports: false,
                canViewFinancialDashboard: true,
            })
        ).toBe(false);
    });

    it("registers dashboard_credit_customers view config", () => {
        const config = getViewConfig(DASHBOARD_CREDIT_CUSTOMERS_CONTEXT);
        expect(config).toBeDefined();
        expect(config?.tableName).toBe("Customer");
        expect(config?.linkHandlers?.customer).toBeTypeOf("function");
    });

    it("registers dashboard_credit_invoices view config", () => {
        const config = getViewConfig(DASHBOARD_CREDIT_INVOICES_CONTEXT);
        expect(config).toBeDefined();
        expect(config?.tableName).toBe("Invoice");
        expect(config?.linkHandlers?.invoice).toBeTypeOf("function");
    });
});
