import { describe, expect, it } from "vitest";

import {
    aggregateImplicitBasePerLimitUnit,
    computeInvoiceCapacityGapDualCurrency,
    computeTopUpUsageMetrics,
    invoiceImplicitBasePerCustomerUnit,
    sumGapInSecondaryCurrencyFromInvoices,
} from "@/server/services/creditInsurance/invoiceCapacityGapAmounts";

import fixture from "../../fixtures/capacity-gap-excel-sheet1.json";

describe("invoiceCapacityGapAmounts", () => {
    it("uses implicit invoice FX when both outstanding fields are present", () => {
        const ratio = invoiceImplicitBasePerCustomerUnit({
            outstanding_debt: 3136,
            customer_outstanding_debt: 800,
        });
        expect(ratio).toBeCloseTo(3136 / 800, 6);

        const result = computeInvoiceCapacityGapDualCurrency({
            row: {
                outstanding_debt: 3136,
                customer_outstanding_debt: 800,
                limit_assessed_amount: 500,
                limit_assessed_currency: "EUR",
            },
            accountCurrency: "ILS",
        });
        expect(result.gapLimit).toBe(300);
        expect(result.gapBase).toBeCloseTo(1176, 2);
        expect(result.usedImplicitRate).toBe(true);
    });

    it("matches golden implicit rate gap base", () => {
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
    });

    it("copies gap_limit to gap_base when currencies match", () => {
        const result = computeInvoiceCapacityGapDualCurrency({
            row: {
                outstanding_debt: 5000,
                customer_outstanding_debt: null,
                limit_assessed_amount: 2000,
                limit_assessed_currency: "USD",
            },
            accountCurrency: "USD",
        });
        expect(result.gapLimit).toBe(3000);
        expect(result.gapBase).toBe(3000);
        expect(result.usedImplicitRate).toBe(false);
    });

    it("uses account outstanding when limit currency equals account currency (GBP/GBP)", () => {
        const result = computeInvoiceCapacityGapDualCurrency({
            row: {
                outstanding_debt: 15_000,
                customer_outstanding_debt: 75_000,
                limit_assessed_amount: 12_000,
                limit_assessed_currency: "GBP",
            },
            accountCurrency: "GBP",
        });
        expect(result.gapLimit).toBe(3_000);
        expect(result.gapBase).toBe(3_000);
        expect(result.usedImplicitRate).toBe(false);
    });

    it("returns zero gap when outstanding is within assessed limit", () => {
        const result = computeInvoiceCapacityGapDualCurrency({
            row: {
                outstanding_debt: 1000,
                customer_outstanding_debt: 1000,
                limit_assessed_amount: 5000,
                limit_assessed_currency: "USD",
            },
            accountCurrency: "USD",
        });
        expect(result.gapLimit).toBe(0);
        expect(result.gapBase).toBe(0);
    });

    it("does not use implicit ratio when signs differ", () => {
        const ratio = invoiceImplicitBasePerCustomerUnit({
            outstanding_debt: 100,
            customer_outstanding_debt: -50,
        });
        expect(ratio).toBeNull();
    });

    it("aggregates implicit FX across open invoices for limit conversion", () => {
        const ratio = aggregateImplicitBasePerLimitUnit([
            { outstanding_debt: 75_000, customer_outstanding_debt: 15_000 },
        ]);
        expect(ratio).toBe(5);
    });

    it("computes gap secondary from contributing invoices weighted by implicit FX", () => {
        const secondary = sumGapInSecondaryCurrencyFromInvoices(
            [
                {
                    capacity_gap_amount: 4_000,
                    outstanding_debt: 5_000,
                    customer_outstanding_debt: 1_000,
                    customer_currency: "GBP",
                },
                {
                    capacity_gap_amount: 13_500,
                    outstanding_debt: 18_000,
                    customer_outstanding_debt: 4_500,
                    customer_currency: "GBP",
                },
            ],
            "GBP"
        );
        expect(secondary).toBeCloseTo(4_000 * (1_000 / 5_000) + 13_500 * (4_500 / 18_000), 6);
    });
});

describe("computeTopUpUsageMetrics", () => {
    it.each(fixture.topUpUsageRows)(
        "sheet 2 row ar=$ar limit=$approvedLimit top=$topUpTotal",
        ({ ar, approvedLimit, topUpTotal, policyUsage, topUpUsage, effectiveUsage }) => {
            const metrics = computeTopUpUsageMetrics({
                ar,
                approvedLimit,
                topUpTotal,
            });
            expect(metrics.policyUsage).toBeCloseTo(policyUsage, 4);
            expect(metrics.topUpUsage).toBeCloseTo(topUpUsage, 4);
            expect(metrics.effectiveUsage).toBeCloseTo(effectiveUsage, 4);
        }
    );
});
