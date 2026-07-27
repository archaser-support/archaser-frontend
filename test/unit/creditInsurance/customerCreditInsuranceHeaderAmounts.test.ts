import { describe, expect, it } from "vitest";

import {
    deriveSecondaryAmountFromInvoiceBucketRatio,
    resolveCustomerTotalArSecondaryFromInvoiceBuckets,
    resolveInvoiceBucketRatioArPair,
    resolveCapacityGapDisplayAmounts,
} from "@/shared/creditInsurance/invoiceBucketAmounts";

describe("deriveSecondaryAmountFromInvoiceBucketRatio", () => {
    it("scales primary amount by invoice bucket AR ratio (no live FX)", () => {
        expect(
            deriveSecondaryAmountFromInvoiceBucketRatio(3000, 15_000, 75_000)
        ).toBe(15_000);
    });

    it("returns null when primary AR is zero or missing", () => {
        expect(
            deriveSecondaryAmountFromInvoiceBucketRatio(3000, 0, 75_000)
        ).toBeNull();
        expect(
            deriveSecondaryAmountFromInvoiceBucketRatio(3000, 15_000, null)
        ).toBeNull();
    });

    it("returns null when gap primary is zero", () => {
        expect(
            deriveSecondaryAmountFromInvoiceBucketRatio(0, 15_000, 75_000)
        ).toBeNull();
    });
});

describe("resolveCapacityGapDisplayAmounts", () => {
    it("prefers stored capacity_gap_secondary from customer entity", () => {
        const display = resolveCapacityGapDisplayAmounts(
            {
                capacity_gap_amount: 3_000,
                capacity_gap_secondary: 600,
                credit_insurance_secondary_currency: "GBP",
                total_ar: 23_000,
                customer_due_currency1: "GBP",
                customer_due_amount1: 5_500,
            },
            3_000
        );
        expect(display.primary).toBe(3_000);
        expect(display.secondary).toBe(600);
    });

    it("falls back to invoice bucket ratio when stored secondary is missing", () => {
        const display = resolveCapacityGapDisplayAmounts(
            {
                capacity_gap_amount: 3_000,
                credit_insurance_secondary_currency: "ILS",
                customer_due_currency1: "ILS",
                customer_due_amount1: 75_000,
                total_ar: 15_000,
            },
            3_000
        );
        expect(display.primary).toBe(3_000);
        expect(display.secondary).toBe(15_000);
    });

    it("prefers KPI over stored customer gap when KPI is provided", () => {
        const display = resolveCapacityGapDisplayAmounts(
            { capacity_gap_amount: 1_000 },
            2_000
        );
        expect(display.primary).toBe(2_000);
    });

    it("uses KPI when stored gap is zero but KPI has the synced value", () => {
        const display = resolveCapacityGapDisplayAmounts(
            { capacity_gap_amount: 0 },
            1_000
        );
        expect(display.primary).toBe(1_000);
    });

    it("falls back to stored customer gap when KPI is not loaded yet", () => {
        const display = resolveCapacityGapDisplayAmounts(
            { capacity_gap_amount: 1_000 },
            null
        );
        expect(display.primary).toBe(1_000);
    });

    it("falls back to KPI when stored gap is null", () => {
        const display = resolveCapacityGapDisplayAmounts(
            { capacity_gap_amount: null },
            1_000
        );
        expect(display.primary).toBe(1_000);
    });

    it("prefers KPI secondary line when provided", () => {
        const display = resolveCapacityGapDisplayAmounts(
            {
                capacity_gap_amount: 0,
                capacity_gap_secondary: 200,
                credit_insurance_secondary_currency: "ILS",
            },
            1_000,
            { kpiGapSecondary: 1_000, kpiSecondaryCurrency: "ILS" }
        );
        expect(display.primary).toBe(1_000);
        expect(display.secondary).toBe(1_000);
    });
});

describe("resolveInvoiceBucketRatioArPair", () => {
    it("prefers denormalized total_ar over invoice open AR fallback", () => {
        const pair = resolveInvoiceBucketRatioArPair(
            {
                total_ar: 15_000,
                customer_due_currency1: "ILS",
                customer_due_amount1: 75_000,
            },
            "ILS",
            11_746.2
        );
        expect(pair.arPrimary).toBe(15_000);
        expect(pair.arSecondary).toBe(75_000);
        expect(
            deriveSecondaryAmountFromInvoiceBucketRatio(
                3_000,
                pair.arPrimary,
                pair.arSecondary
            )
        ).toBe(15_000);
    });
});

describe("resolveCustomerTotalArSecondaryFromInvoiceBuckets", () => {
    it("sums due/overdue buckets for the requested currency", () => {
        const total = resolveCustomerTotalArSecondaryFromInvoiceBuckets(
            {
                customer_due_currency1: "ILS",
                customer_due_amount1: 75_000,
                customer_overdue_currency1: null,
                customer_overdue_amount1: 0,
                customer_due_currency2: null,
                customer_due_amount2: 0,
                customer_overdue_currency2: null,
                customer_overdue_amount2: 0,
            },
            "ILS"
        );
        expect(total).toBe(75_000);
    });
});
