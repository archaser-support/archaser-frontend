import { describe, expect, it } from "vitest";

import { computeInvoiceLineOpenArInAccountCurrency } from "@/server/services/creditInsurance/openReceivableByCustomerCurrency";

describe("computeInvoiceLineOpenArInAccountCurrency", () => {
    it("prefers outstanding_debt even when customer_currency differs from account", () => {
        expect(
            computeInvoiceLineOpenArInAccountCurrency(
                {
                    outstanding_debt: 50_000,
                    customer_outstanding_debt: 10_000,
                    amount: 10_000,
                    customer_currency: "GBP",
                },
                "ILS",
                39_200
            )
        ).toBe(50_000);
    });

    it("converts foreign customer currency only when outstanding_debt is zero", () => {
        expect(
            computeInvoiceLineOpenArInAccountCurrency(
                {
                    outstanding_debt: 0,
                    customer_outstanding_debt: 10_000,
                    amount: 10_000,
                    customer_currency: "GBP",
                },
                "ILS",
                50_000
            )
        ).toBe(50_000);
    });

    it("uses customer_outstanding when invoice currency matches account", () => {
        expect(
            computeInvoiceLineOpenArInAccountCurrency(
                {
                    outstanding_debt: 50_000,
                    customer_outstanding_debt: 60_000,
                    amount: 60_000,
                    customer_currency: "ILS",
                },
                "ILS"
            )
        ).toBe(50_000);
    });

    it("falls back to outstanding_debt when customer_currency is missing", () => {
        expect(
            computeInvoiceLineOpenArInAccountCurrency(
                {
                    outstanding_debt: 12_000,
                    customer_outstanding_debt: 0,
                    amount: 12_000,
                    customer_currency: null,
                },
                "ILS"
            )
        ).toBe(12_000);
    });
});
