import { describe, expect, it } from "vitest";

import { resolveInvoiceAmountFieldCurrency } from "@/server/utils/reportInvoiceAmountCurrency";

describe("resolveInvoiceAmountFieldCurrency", () => {
    const accountCurrency = "ILS";

    it("uses account currency for capacity_gap_amount", () => {
        expect(
            resolveInvoiceAmountFieldCurrency(
                {
                    customer_currency: "EUR",
                    limit_assessed_currency: "EUR",
                    capacity_gap_amount: 1176,
                },
                "capacity_gap_amount",
                accountCurrency
            )
        ).toBe("ILS");
    });

    it("uses limit assessed currency for capacity_gap_amount_limit", () => {
        expect(
            resolveInvoiceAmountFieldCurrency(
                {
                    customer_currency: "EUR",
                    limit_assessed_currency: "GBP",
                },
                "capacity_gap_amount_limit",
                accountCurrency
            )
        ).toBe("GBP");
    });

    it("falls back to customer currency for capacity_gap_amount_limit", () => {
        expect(
            resolveInvoiceAmountFieldCurrency(
                { customer_currency: "EUR" },
                "capacity_gap_amount_limit",
                accountCurrency
            )
        ).toBe("EUR");
    });

    it("keeps customer currency for customer_outstanding_debt", () => {
        expect(
            resolveInvoiceAmountFieldCurrency(
                { customer_currency: "EUR" },
                "customer_outstanding_debt",
                accountCurrency
            )
        ).toBe("EUR");
    });
});
