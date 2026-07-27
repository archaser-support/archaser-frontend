import { describe, expect, it } from "vitest";

import {
    computeInvoiceCapacityGapDualCurrency,
    invoiceImplicitBasePerCustomerUnit,
} from "@/server/services/creditInsurance/invoiceCapacityGapAmounts";
import { computeInvoiceCapacityGapContribution } from "@/server/services/creditInsurance/invoiceInsuranceFields";

import fixture from "../../fixtures/capacity-gap-excel-sheet1.json";

/**
 * Excel sheet 1 — sticky per-invoice gap: paying a non-gap invoice does not
 * reduce another invoice's gap; paying a gap invoice reduces only that slice.
 */
describe("invoiceCapacityGapExcelScenario", () => {
    const limit = fixture.approvedLimit;

    function gapLimit(outstanding: number, assessed: number): number {
        return computeInvoiceCapacityGapContribution({
            outstandingLeft: outstanding,
            limitAssessedAmount: assessed,
        });
    }

    it("three invoices at limit produce expected limit-currency gaps", () => {
        const assessed = [limit, limit, limit];
        const outstanding = [11_500, 3_000, 1_500];
        const gaps = outstanding.map((o, i) => gapLimit(o, assessed[i]!));
        expect(gaps[0]).toBe(1_500);
        expect(gaps[1]).toBe(0);
        expect(gaps[2]).toBe(0);
    });

    it("paying invoice 1 does not change invoice 2 or 3 gap (sticky)", () => {
        const inv2Outstanding = 3_000;
        const inv3Outstanding = 1_500;
        expect(gapLimit(inv2Outstanding, limit)).toBe(0);
        expect(gapLimit(inv3Outstanding, limit)).toBe(0);
    });

    it("paying gap invoice 3 reduces only that invoice gap", () => {
        const afterPaymentOutstanding = 500;
        expect(gapLimit(afterPaymentOutstanding, limit)).toBe(0);
    });

    it("dual-currency base gap uses invoice implicit rate", () => {
        const t = fixture.implicitRateTest;
        const result = computeInvoiceCapacityGapDualCurrency({
            row: {
                outstanding_debt: t.outstanding_debt,
                customer_outstanding_debt: t.customer_outstanding_debt,
                limit_assessed_amount: t.limit_assessed_amount,
                limit_assessed_currency: "EUR",
            },
            accountCurrency: "ILS",
        });
        expect(result.gapLimit).toBe(t.gapLimit);
        expect(result.gapBase).toBeCloseTo(t.expectedGapBase, 2);
        expect(
            invoiceImplicitBasePerCustomerUnit({
                outstanding_debt: t.outstanding_debt,
                customer_outstanding_debt: t.customer_outstanding_debt,
            })
        ).toBeCloseTo(t.outstanding_debt / t.customer_outstanding_debt, 6);
    });

    it("legacy contribution helper matches sticky formula", () => {
        expect(
            computeInvoiceCapacityGapContribution({
                outstandingLeft: 11_500,
                limitAssessedAmount: limit,
            })
        ).toBe(1_500);
    });
});
