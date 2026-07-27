import { describe, expect, it } from "vitest";

import {
    aggregateTermsBreachByReasonFromInvoices,
    invoiceMatchesPolicyScope,
    type TermsBreachInvoiceForAggregation,
} from "@/server/services/creditInsurance/customerPolicyTrendTermsBreachByReason";

function breachInvoice(
    overrides: Partial<TermsBreachInvoiceForAggregation> = {}
): TermsBreachInvoiceForAggregation {
    return {
        policyId: 10,
        outstanding: 1_000,
        reportingBreach: false,
        ctvPaymentTerm: false,
        ctvCustomerOverdueMep: false,
        ctvOutdatedDcl: false,
        ctvInvoiceAfterPolicyEnd: false,
        ...overrides,
    };
}

describe("invoiceMatchesPolicyScope", () => {
    it("matches null-policy invoices when scope is null", () => {
        expect(invoiceMatchesPolicyScope(null, null)).toBe(true);
        expect(invoiceMatchesPolicyScope(10, null)).toBe(false);
    });

    it("matches a specific policy id", () => {
        expect(invoiceMatchesPolicyScope(10, 10)).toBe(true);
        expect(invoiceMatchesPolicyScope(11, 10)).toBe(false);
    });
});

describe("aggregateTermsBreachByReasonFromInvoices", () => {
    it("returns {} when there are no breach invoices", () => {
        expect(
            aggregateTermsBreachByReasonFromInvoices([
                breachInvoice({ ctvPaymentTerm: false, outstanding: 500 }),
            ])
        ).toEqual({});
    });

    it("maps a single-flag invoice to one reason bucket", () => {
        const snapshot = aggregateTermsBreachByReasonFromInvoices([
            breachInvoice({
                policyId: 7,
                outstanding: 2_500,
                ctvPaymentTerm: true,
            }),
        ]);

        expect(snapshot).toEqual({
            paymentTerm: { count: 1, amount: 2_500 },
        });
    });

    it("counts and amounts multi-flag invoices in each applicable bucket", () => {
        const snapshot = aggregateTermsBreachByReasonFromInvoices([
            breachInvoice({
                outstanding: 800,
                reportingBreach: true,
                ctvPaymentTerm: true,
            }),
        ]);

        expect(snapshot.reportingBreach).toEqual({ count: 1, amount: 800 });
        expect(snapshot.paymentTerm).toEqual({ count: 1, amount: 800 });
    });

    it("filters invoices to the requested policy scope", () => {
        const snapshot = aggregateTermsBreachByReasonFromInvoices(
            [
                breachInvoice({
                    policyId: 10,
                    ctvPaymentTerm: true,
                    outstanding: 100,
                }),
                breachInvoice({
                    policyId: 20,
                    ctvPaymentTerm: true,
                    outstanding: 200,
                }),
                breachInvoice({
                    policyId: null,
                    reportingBreach: true,
                    outstanding: 300,
                }),
            ],
            10
        );

        expect(snapshot).toEqual({
            paymentTerm: { count: 1, amount: 100 },
        });
    });

    it("scopes null-policy rows to invoices without policy_id", () => {
        const snapshot = aggregateTermsBreachByReasonFromInvoices(
            [
                breachInvoice({
                    policyId: null,
                    ctvOutdatedDcl: true,
                    outstanding: 450,
                }),
                breachInvoice({
                    policyId: 99,
                    ctvOutdatedDcl: true,
                    outstanding: 900,
                }),
            ],
            null
        );

        expect(snapshot).toEqual({
            outdatedDcl: { count: 1, amount: 450 },
        });
    });
});
