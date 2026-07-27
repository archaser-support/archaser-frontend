import { describe, expect, it } from "vitest";

import {
    applyBusinessUnitFilterToInvoiceWhere,
    customersScopedByPolicyInvoicesOrActive,
    customersScopedForCreditDashboard,
    customersScopedForCreditDashboardWithBusinessUnit,
    mergeDashboardBusinessUnitIntoCustomerScope,
    policyDisplayFromCustomerRow,
    policyDisplayFromInvoiceRow,
    withInvoiceCustomerPolicyFilter,
} from "@/server/services/creditInsurance/customerPolicyQueryHelpers";

describe("withInvoiceCustomerPolicyFilter", () => {
    it("returns where unchanged when policyId is null", () => {
        const base = { account_id: 1, status: "Overdue" as const };
        expect(withInvoiceCustomerPolicyFilter(base)).toEqual(base);
    });

    it("requires strict policy_id when policyId is set", () => {
        const base = { account_id: 1 };
        const result = withInvoiceCustomerPolicyFilter(base, 42);
        expect(result).toEqual({
            AND: [base, { policy_id: 42 }],
        });
        expect(JSON.stringify(result)).not.toContain("policy_id: null");
    });
});

describe("customersScopedForCreditDashboard", () => {
    it("includes active CustomerPolicy or any open receivable when policyId is null", () => {
        const where = customersScopedForCreditDashboard(10);
        expect(where.OR).toHaveLength(2);
        expect(where.OR?.[0]).toEqual({
            CustomerPolicy: {
                some: {
                    is_active: true,
                    insurance_policy_id: { not: null },
                },
            },
        });
        expect(where.OR?.[1]).toEqual({
            Invoice: {
                some: {
                    account_id: 10,
                    status: { in: ["Due", "Overdue"] },
                },
            },
        });
    });

    it("delegates to invoice-or-active scope when policyId is set", () => {
        const where = customersScopedForCreditDashboard(10, 99);
        expect(where.OR).toHaveLength(2);
    });
});

describe("policyDisplayFromInvoiceRow", () => {
    it("prefers invoice-linked policy over active customer policy", () => {
        const customer = {
            CustomerPolicy: [
                {
                    customer_number_policy: "CN-1",
                    InsurancePolicy: {
                        policy_number: "2222Test6",
                        currency: "ILS",
                    },
                },
            ],
        };
        const invoice = {
            InsurancePolicy: {
                policy_number: "1111Test5",
                currency: "ILS",
            },
        };
        expect(policyDisplayFromInvoiceRow(invoice, customer)).toEqual({
            policy_number: "1111Test5",
            currency: "ILS",
            customer_number_policy: "CN-1",
        });
        expect(policyDisplayFromCustomerRow(customer).policy_number).toBe(
            "2222Test6"
        );
    });

    it("falls back to customer policy when invoice has no link", () => {
        const customer = {
            CustomerPolicy: [
                {
                    InsurancePolicy: { policy_number: "P-ACTIVE", currency: "USD" },
                },
            ],
        };
        expect(policyDisplayFromInvoiceRow({ InsurancePolicy: null }, customer)).toEqual(
            policyDisplayFromCustomerRow(customer)
        );
    });
});

describe("customersScopedByPolicyInvoicesOrActive", () => {
    it("includes active policy or open invoices on policy", () => {
        const where = customersScopedByPolicyInvoicesOrActive(10, 99);
        expect(where.account_id).toBe(10);
        expect(where.OR).toHaveLength(2);
        expect(where.OR?.[0]).toEqual({
            CustomerPolicy: {
                some: { is_active: true, insurance_policy_id: 99 },
            },
        });
        expect(where.OR?.[1]).toEqual({
            Invoice: {
                some: {
                    account_id: 10,
                    policy_id: 99,
                    status: { in: ["Due", "Overdue"] },
                },
            },
        });
    });
});

describe("mergeDashboardBusinessUnitIntoCustomerScope", () => {
    it("returns base scope when business unit filter is empty", () => {
        const base = customersScopedForCreditDashboard(10, 99);
        expect(
            mergeDashboardBusinessUnitIntoCustomerScope(base, {})
        ).toEqual(base);
    });

    it("ANDs specific business unit onto credit dashboard scope", () => {
        const merged = customersScopedForCreditDashboardWithBusinessUnit(
            10,
            99,
            { business_unit_id: 5 }
        );
        expect(merged).toEqual({
            AND: [
                customersScopedForCreditDashboard(10, 99),
                { business_unit_id: 5 },
            ],
        });
    });

    it("adds Customer filter on invoice queries", () => {
        const where = applyBusinessUnitFilterToInvoiceWhere(
            { account_id: 10, status: "Overdue" },
            { business_unit_id: 5 }
        );
        expect(where).toEqual({
            AND: [
                { account_id: 10, status: "Overdue" },
                { Customer: { business_unit_id: 5 } },
            ],
        });
    });
});
