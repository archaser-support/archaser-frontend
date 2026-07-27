import { describe, expect, it } from "vitest";

import { resolvePaymentImportAmounts } from "@/server/services/import/resolvePaymentImportAmounts";

describe("resolvePaymentImportAmounts", () => {
    const dualCurrencyInvoice = {
        amount: 1000,
        customer_amount: 1200,
        customer_currency: "EUR",
    };

    it("derives base amount from invoice ratio when base amount is missing", () => {
        const result = resolvePaymentImportAmounts(
            {
                customer_amount: 500,
                customer_currency: "EUR",
            },
            dualCurrencyInvoice
        );

        expect(result).toEqual({
            ok: true,
            amount: 500 * (1000 / 1200),
            customer_amount: 500,
            customer_currency: "EUR",
        });
    });

    it("keeps explicit base amount when provided", () => {
        const result = resolvePaymentImportAmounts(
            {
                amount: 999,
                customer_amount: 500,
                customer_currency: "EUR",
            },
            dualCurrencyInvoice
        );

        expect(result).toEqual({
            ok: true,
            amount: 999,
            customer_amount: 500,
            customer_currency: "EUR",
        });
    });

    it("derives 1:1 base amount for same-currency invoices", () => {
        const result = resolvePaymentImportAmounts(
            {
                customer_amount: 250,
                customer_currency: "USD",
            },
            {
                amount: 1000,
                customer_amount: 1000,
                customer_currency: "USD",
            }
        );

        expect(result).toEqual({
            ok: true,
            amount: 250,
            customer_amount: 250,
            customer_currency: "USD",
        });
    });

    it("allows negative customer amounts using the same ratio", () => {
        const result = resolvePaymentImportAmounts(
            {
                customer_amount: -600,
                customer_currency: "EUR",
            },
            dualCurrencyInvoice
        );

        expect(result).toEqual({
            ok: true,
            amount: -600 * (1000 / 1200),
            customer_amount: -600,
            customer_currency: "EUR",
        });
    });

    it("fails when invoice ratio is unavailable", () => {
        expect(
            resolvePaymentImportAmounts(
                { customer_amount: 100, customer_currency: "EUR" },
                { amount: null, customer_amount: 1200, customer_currency: "EUR" }
            )
        ).toEqual({
            ok: false,
            errorKey: "import.validation.paymentInvoiceRatioUnavailable",
        });

        expect(
            resolvePaymentImportAmounts(
                { customer_amount: 100, customer_currency: "EUR" },
                { amount: 1000, customer_amount: 0, customer_currency: "EUR" }
            )
        ).toEqual({
            ok: false,
            errorKey: "import.validation.paymentInvoiceRatioUnavailable",
        });
    });

    it("fails when row currency does not match invoice currency", () => {
        const result = resolvePaymentImportAmounts(
            {
                customer_amount: 100,
                customer_currency: "USD",
            },
            dualCurrencyInvoice
        );

        expect(result).toEqual({
            ok: false,
            errorKey: "import.validation.paymentCurrencyMismatch",
        });
    });

    it("compares currencies case-insensitively", () => {
        const result = resolvePaymentImportAmounts(
            {
                customer_amount: 1200,
                customer_currency: "eur",
            },
            dualCurrencyInvoice
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.amount).toBe(1000);
        }
    });

    it("fails when customer amount is zero", () => {
        const result = resolvePaymentImportAmounts(
            {
                customer_amount: 0,
                customer_currency: "EUR",
            },
            dualCurrencyInvoice
        );

        expect(result).toEqual({
            ok: false,
            errorKey: "import.validation.paymentCustomerAmountZero",
        });
    });

    it("treats undefined base amount as missing and derives", () => {
        const result = resolvePaymentImportAmounts(
            {
                amount: undefined,
                customer_amount: 1200,
                customer_currency: "EUR",
            },
            dualCurrencyInvoice
        );

        expect(result).toEqual({
            ok: true,
            amount: 1000,
            customer_amount: 1200,
            customer_currency: "EUR",
        });
    });
});
