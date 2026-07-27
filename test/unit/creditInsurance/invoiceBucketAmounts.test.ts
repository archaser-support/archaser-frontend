import { describe, expect, it } from "vitest";

import {
    resolveCustomerDueSecondaryFromInvoiceBuckets,
    resolveCustomerOverdueSecondaryFromInvoiceBuckets,
} from "@/shared/creditInsurance/invoiceBucketAmounts";

describe("invoice bucket secondary amounts", () => {
    it("sums overdue buckets in the selected invoice currency", () => {
        const total = resolveCustomerOverdueSecondaryFromInvoiceBuckets(
            {
                customer_overdue_currency1: "GBP",
                customer_overdue_amount1: 5_100,
                customer_overdue_currency2: "GBP",
                customer_overdue_amount2: 8_452,
            },
            "GBP"
        );

        expect(total).toBe(13_552);
    });

    it("sums due buckets in the selected invoice currency", () => {
        const total = resolveCustomerDueSecondaryFromInvoiceBuckets(
            {
                customer_due_currency1: "GBP",
                customer_due_amount1: 1_000,
                customer_due_currency2: "ILS",
                customer_due_amount2: 500,
            },
            "GBP"
        );

        expect(total).toBe(1_000);
    });

    it("returns zero when no buckets match the invoice currency", () => {
        const total = resolveCustomerOverdueSecondaryFromInvoiceBuckets(
            {
                customer_overdue_currency1: "ILS",
                customer_overdue_amount1: 67_760,
            },
            "GBP"
        );

        expect(total).toBe(0);
    });
});
