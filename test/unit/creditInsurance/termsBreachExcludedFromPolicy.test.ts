import { describe, expect, it } from "vitest";

import { applyTermsBreachOtherBucket } from "@/server/services/creditInsurance/customerDashboardKpisService";
import {
    aggregateTermsBreachByReasonFromInvoices,
    invoiceHasTermsBreachFlag,
} from "@/server/services/creditInsurance/customerPolicyTrendTermsBreachByReason";
import {
    isTermsBreachReasonFilter,
    type TermsBreachCountByReason,
} from "@/server/services/creditInsurance/creditInsuranceDashboardService";

const EMPTY_BY_REASON: TermsBreachCountByReason = {
    reportingBreach: 0,
    paymentTerm: 0,
    customerOverdueMep: 0,
    outdatedDcl: 0,
    invoiceAfterPolicyEnd: 0,
};

describe("terms breach — excluded-from-policy category removed", () => {
    it("does not accept ctv_customer_excluded_from_policy as a report reason filter", () => {
        expect(
            isTermsBreachReasonFilter("ctv_customer_excluded_from_policy")
        ).toBe(false);
    });

    it("accepts only the five active breach reason filters", () => {
        const allowed = [
            "reporting_breach",
            "ctv_payment_term",
            "ctv_customer_overdue_mep",
            "ctv_outdated_dcl",
            "ctv_invoice_after_policy_end",
        ] as const;

        for (const code of allowed) {
            expect(isTermsBreachReasonFilter(code)).toBe(true);
        }
    });

    it("invoiceHasTermsBreachFlag ignores excluded-from-policy-only invoices", () => {
        expect(
            invoiceHasTermsBreachFlag({
                reportingBreach: false,
                ctvPaymentTerm: false,
                ctvCustomerOverdueMep: false,
                ctvOutdatedDcl: false,
                ctvInvoiceAfterPolicyEnd: false,
            })
        ).toBe(false);
    });

    it("aggregateTermsBreachByReasonFromInvoices does not bucket excluded-only invoices", () => {
        const snapshot = aggregateTermsBreachByReasonFromInvoices([
            {
                policyId: 1,
                outstanding: 1_000,
                reportingBreach: false,
                ctvPaymentTerm: false,
                ctvCustomerOverdueMep: false,
                ctvOutdatedDcl: false,
                ctvInvoiceAfterPolicyEnd: false,
            },
        ]);

        expect(snapshot).toEqual({});
    });

    it("aggregateTermsBreachByReasonFromInvoices still counts real breach flags on excluded customers", () => {
        const snapshot = aggregateTermsBreachByReasonFromInvoices([
            {
                policyId: 1,
                outstanding: 500,
                reportingBreach: false,
                ctvPaymentTerm: true,
                ctvCustomerOverdueMep: false,
                ctvOutdatedDcl: false,
                ctvInvoiceAfterPolicyEnd: false,
            },
        ]);

        expect(snapshot.paymentTerm).toEqual({ count: 1, amount: 500 });
    });

    it("applyTermsBreachOtherBucket uses the five known reason buckets only", () => {
        const result = applyTermsBreachOtherBucket(
            {
                ...EMPTY_BY_REASON,
                reportingBreach: 2,
                paymentTerm: 1,
            },
            5
        );

        expect(result).toEqual({
            reportingBreach: 2,
            paymentTerm: 1,
            customerOverdueMep: 0,
            outdatedDcl: 0,
            invoiceAfterPolicyEnd: 0,
            other: 2,
        });
        expect(result).not.toHaveProperty("customerExcludedFromPolicy");
    });
});
