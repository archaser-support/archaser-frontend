import { describe, expect, it } from "vitest";

import {
    aggregatePortfolioTermsBreachFromInvoices,
    resolveCustomerTermsBreachOutstanding,
    resolvePortfolioTermsBreachContribution,
    resolveUncoveredExposureFromPolicyRows,
    sumFlagBasedTermsBreachOutstanding,
} from "@/server/services/creditInsurance/termBreachResolver";

const AS_OF = new Date(2026, 6, 9);

describe("termBreachResolver", () => {
    it("uncovered customer → terms breach equals full open AR", () => {
        expect(
            resolveCustomerTermsBreachOutstanding({
                uncovered: true,
                totalOpenAr: 12_500,
                invoices: [
                    {
                        outstanding: 12_500,
                        ctvPaymentTerm: true,
                    },
                ],
                asOf: AS_OF,
            })
        ).toBe(12_500);
    });

    it("insured customer uses flag-based breach sum", () => {
        expect(
            resolveCustomerTermsBreachOutstanding({
                uncovered: false,
                totalOpenAr: 5_000,
                invoices: [
                    { outstanding: 2_000, ctvPaymentTerm: true },
                    { outstanding: 1_000, ctvPaymentTerm: false },
                ],
                asOf: AS_OF,
            })
        ).toBe(2_000);
    });

    it("portfolio contribution is zero for uncovered customers", () => {
        expect(
            resolvePortfolioTermsBreachContribution({
                uncovered: true,
                flagBasedAmount: 9_000,
            })
        ).toBe(0);
        expect(
            resolvePortfolioTermsBreachContribution({
                uncovered: false,
                flagBasedAmount: 9_000,
            })
        ).toBe(9_000);
    });

    it("flag-based sum ignores excluded-from-policy-only invoices", () => {
        expect(
            sumFlagBasedTermsBreachOutstanding(
                [{ outstanding: 1_000, ctvPaymentTerm: false }],
                AS_OF
            )
        ).toBe(0);
    });

    it("resolveUncoveredExposureFromPolicyRows matches cohort rules", () => {
        expect(resolveUncoveredExposureFromPolicyRows([])).toBe(true);
        expect(
            resolveUncoveredExposureFromPolicyRows([
                {
                    insurance_policy_id: null,
                    is_active: true,
                    policy_exclusion_reason: null,
                },
            ])
        ).toBe(true);
        expect(
            resolveUncoveredExposureFromPolicyRows([
                {
                    insurance_policy_id: 10,
                    is_active: true,
                    policy_exclusion_reason: "Credit hold",
                },
            ])
        ).toBe(true);
        expect(
            resolveUncoveredExposureFromPolicyRows([
                {
                    insurance_policy_id: 10,
                    is_active: true,
                    policy_exclusion_reason: null,
                },
            ])
        ).toBe(false);
    });

    it("aggregatePortfolioTermsBreachFromInvoices counts breach reasons", () => {
        const agg = aggregatePortfolioTermsBreachFromInvoices([
            {
                outstanding_debt: 500,
                customer_outstanding_debt: 500,
                reporting_breach: false,
                ctv_payment_term: true,
                ctv_customer_overdue_mep: false,
                ctv_outdated_dcl: false,
                ctv_invoice_after_policy_end: false,
            },
            {
                outstanding_debt: 300,
                customer_outstanding_debt: 300,
                reporting_breach: true,
                ctv_payment_term: false,
                ctv_customer_overdue_mep: false,
                ctv_outdated_dcl: false,
                ctv_invoice_after_policy_end: false,
            },
        ]);

        expect(agg.invoiceCount).toBe(2);
        expect(agg.totalAmount).toBe(800);
        expect(agg.countByReason.paymentTerm).toBe(1);
        expect(agg.countByReason.reportingBreach).toBe(1);
    });
});
