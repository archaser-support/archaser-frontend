import { describe, expect, it } from "vitest";

import {
    buildDashboardCardContract,
    dedupeCustomerPolicyHistoryRows,
    isCreditDashboardSectionEligible,
    resolveCustomerOverdueDisplayMetrics,
} from "@/app/[locale]/app/customers/[customerId]/customerDashboardCardViewModel";
import type { Customer } from "@/types/Customer";

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
    return {
        id: 1,
        account_id: 10,
        customer_number: "C-1",
        collection_status: "Active",
        category_for_new_collection: "Automated",
        total_overdue_amount: 1 asya000,
        total_due_amount: 500,
        no_of_due_invoices: 2,
        number_of_overdue_invoices: 3,
        overdue_block: false,
        oldest_invoice_overdue_date: null,
        CustomerCollectionPeriod: [],
        customerPolicies: [],
        ...overrides,
    } as unknown as Customer;
}

describe("customerDashboardCardViewModel", () => {
    it("hides credit section when account has no credit product", () => {
        const customer = makeCustomer({
            customerPolicies: [{ id: 1, is_active: true, insurance_policy_id: 7 }] as any,
        });
        const visibility = isCreditDashboardSectionEligible(customer, false);
        expect(visibility).toBe(false);
    });

    it("defaults to all policies when selected policy is invalid", () => {
        const customer = makeCustomer({
            total_ar: 900,
            customerPolicies: [
                {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: 11,
                    approved_limit: 1000,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: 999,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.selectedPolicyId).toBeNull();
        expect(vm.eligibleForCreditSection).toBe(true);
    });

    it("keeps null selected policy for all-policies view", () => {
        const customer = makeCustomer({
            customerPolicies: [
                {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: 11,
                    approved_limit: 1000,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: null,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.selectedPolicyId).toBeNull();
        expect(vm.policyCards).toHaveLength(1);
    });

    it("scopes reporting and overdue block counts to selected policy row", () => {
        const customer = makeCustomer({
            reporting_breach_invoice_count: 10,
            overdue_block_invoice_count: 8,
            customerPolicies: [
                {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: 11,
                    reporting_breach_invoice_count: 10,
                    overdue_block_invoice_count: 8,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
                {
                    id: 2,
                    is_active: false,
                    insurance_policy_id: 22,
                    reporting_breach_invoice_count: 3,
                    overdue_block_invoice_count: 4,
                    InsurancePolicy: { id: 22, policy_number: "P-22" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: 22,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.kpis.reportingBreachInvoiceCount).toBe(3);
        expect(vm.kpis.overdueBlockInvoiceCount).toBe(4);
    });

    it("scopes terms breach KPI to selected policy row", () => {
        const customer = makeCustomer({
            terms_breach_outstanding: 50,
            customerPolicies: [
                {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: 11,
                    terms_breach_outstanding: 50,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
                {
                    id: 2,
                    is_active: false,
                    insurance_policy_id: 22,
                    terms_breach_outstanding: 5,
                    InsurancePolicy: { id: 22, policy_number: "P-22" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: 22,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.kpis.termsBreachOutstanding).toBe(5);
    });

    it("scopes capacity gap KPI to selected policy row", () => {
        const customer = makeCustomer({
            total_ar: 900,
            customerPolicies: [
                {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: 11,
                    approved_limit: 1000,
                    capacity_gap_amount: 10,
                    policy_open_ar: 900,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
                {
                    id: 2,
                    is_active: false,
                    insurance_policy_id: 22,
                    approved_limit: 500,
                    capacity_gap_amount: 200,
                    policy_open_ar: 400,
                    InsurancePolicy: { id: 22, policy_number: "P-22" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: 22,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.kpis.capacityGapAmount).toBe(200);
    });

    it("uses policy_open_ar on policy cards when present", () => {
        const customer = makeCustomer({
            total_ar: 9000,
            customerPolicies: [
                {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: 11,
                    approved_limit: 10000,
                    policy_open_ar: 100,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: null,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.policyCards[0]?.usedAr).toBe(100);
    });

    it("returns zero gap when synced capacity_gap_amount is zero", () => {
        const customer = makeCustomer({
            customerPolicies: [
                {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: 11,
                    approved_limit: 5900,
                    capacity_gap_amount: 0,
                    policy_open_ar: 6900,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: 11,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.kpis.capacityGapAmount).toBe(0);
        expect(vm.policyCards[0]?.overLimitAmount).toBe(0);
    });

    it("uses synced capacity_gap_amount only (no AR-minus-limit fallback)", () => {
        const customer = makeCustomer({
            total_ar: 75000,
            total_ar_secondary: 15000,
            customerPolicies: [
                {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: 11,
                    approved_limit: 12000,
                    capacity_gap_amount: 15000,
                    policy_open_ar: 75000,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: 11,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.kpis.capacityGapAmount).toBe(15000);
        expect(vm.policyCards[0]?.overLimitAmount).toBe(15000);
    });

    it("uses stored capacity_gap_amount on policy cards when present", () => {
        const customer = makeCustomer({
            total_ar: 900,
            customerPolicies: [
                {
                    id: 1,
                    is_active: false,
                    insurance_policy_id: 11,
                    approved_limit: 1000,
                    capacity_gap_amount: 120,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: null,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.policyCards[0]?.overLimitAmount).toBe(120);
    });

    it("uses stored capacity_gap_amount1 for secondary when currency matches", () => {
        const customer = makeCustomer({
            total_ar: 15_000,
            customer_due_currency1: "ILS",
            customer_due_amount1: 75_000,
            Account: { currency: "GBP", has_credit_insurance: true },
            customerPolicies: [
                {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: 11,
                    approved_limit: 12_000,
                    capacity_gap_amount: 3_000,
                    capacity_gap_amount1: 600,
                    capacity_gap_currency1: "ILS",
                    policy_open_ar: 15_000,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: 11,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.kpis.capacityGapAmount).toBe(3_000);
        expect(vm.kpis.capacityGapAmountSecondary).toBe(600);
    });

    it("maps breach invoice counts from customer payload", () => {
        const customer = makeCustomer({
            reporting_breach_invoice_count: 2,
            overdue_block_invoice_count: 3,
            customerPolicies: [
                {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: 11,
                    approved_limit: 1000,
                    InsurancePolicy: { id: 11, policy_number: "P-11" },
                },
            ] as any,
        });

        const vm = buildDashboardCardContract({
            customer,
            hasCreditProduct: true,
            selectedPolicyId: null,
            trendStatus: "no_history",
            trendPoints: [],
        });

        expect(vm.kpis.reportingBreachInvoiceCount).toBe(2);
        expect(vm.kpis.overdueBlockInvoiceCount).toBe(3);
    });

    it("prefers customer overdue totals when open collection period is zero", () => {
        const metrics = resolveCustomerOverdueDisplayMetrics(
            {
                total_overdue_amount: 12_500,
                number_of_overdue_invoices: 4,
            },
            {
                total_outstanding_amount: 0,
                no_of_overdue_invoices: 0,
            }
        );

        expect(metrics.amount).toBe(12_500);
        expect(metrics.invoiceCount).toBe(4);
    });

    it("uses collection period currency buckets when scalar totals are zero", () => {
        const metrics = resolveCustomerOverdueDisplayMetrics(
            {
                total_overdue_amount: 0,
                number_of_overdue_invoices: 0,
            },
            {
                total_outstanding_amount: 0,
                no_of_overdue_invoices: 2,
                customer_outstanding_amount1: 800,
                customer_outstanding_amount2: 200,
            }
        );

        expect(metrics.amount).toBe(1000);
        expect(metrics.invoiceCount).toBe(2);
    });

    it("dedupes policy history rows that share the same insurance policy", () => {
        const rows = dedupeCustomerPolicyHistoryRows([
            {
                id: 1,
                is_active: false,
                insurance_policy_id: 11,
                InsurancePolicy: { id: 11, policy_number: "P-11" },
            },
            {
                id: 2,
                is_active: true,
                insurance_policy_id: 11,
                InsurancePolicy: { id: 11, policy_number: "P-11" },
            },
            {
                id: 3,
                is_active: false,
                insurance_policy_id: 22,
                InsurancePolicy: { id: 22, policy_number: "P-22" },
            },
        ] as any);

        expect(rows).toHaveLength(2);
        expect(rows.find((r) => r.insurance_policy_id === 11)?.is_active).toBe(
            true
        );
        expect(rows.find((r) => r.insurance_policy_id === 11)?.id).toBe(2);
    });
});
