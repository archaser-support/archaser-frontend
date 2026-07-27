import { describe, expect, it } from "vitest";

import { normalizeInvoiceImportInput } from "@/server/services/import/normalizeInvoiceImportInput";

describe("normalizeInvoiceImportInput", () => {
    const accountId = 7;

    it("maps billing catalog field names to InvoiceInput", () => {
        const result = normalizeInvoiceImportInput(
            {
                customer_number: "5405",
                invoice_number: "361528757",
                invoice_date: "2026-06-22",
                due_date: "2026-07-02",
                base_amount: 5000,
                invoice_amount: 1000,
                currency: "GBP",
            },
            accountId
        );

        expect(result).toEqual({
            account_id: accountId,
            customer_number: "5405",
            invoice_number: "361528757",
            invoice_date: "2026-06-22",
            due_date: "2026-07-02",
            amount: 5000,
            customer_amount: 1000,
            customer_currency: "GBP",
        });
    });

    it("prefers explicit amount and customer_amount over catalog aliases", () => {
        const result = normalizeInvoiceImportInput(
            {
                customer_number: "5405",
                invoice_number: "INV-1",
                invoice_date: "2026-06-22",
                amount: 5000,
                customer_amount: 1000,
                customer_currency: "GBP",
                base_amount: 999,
                invoice_amount: 111,
                currency: "USD",
            },
            accountId
        );

        expect(result.amount).toBe(5000);
        expect(result.customer_amount).toBe(1000);
        expect(result.customer_currency).toBe("GBP");
    });

    it("passes through file-import shaped rows unchanged", () => {
        const row = {
            account_id: accountId,
            customer_number: "C-1",
            invoice_number: "INV-1",
            invoice_date: "2026-05-01",
            due_date: "2026-05-15",
            amount: 100,
            customer_amount: 100,
            customer_currency: "USD",
            total_paid: 40,
            customer_total_paid: 40,
        };

        expect(normalizeInvoiceImportInput(row, accountId)).toEqual({
            account_id: accountId,
            customer_number: "C-1",
            invoice_number: "INV-1",
            invoice_date: "2026-05-01",
            due_date: "2026-05-15",
            amount: 100,
            customer_amount: 100,
            customer_currency: "USD",
            total_paid: 40,
            customer_total_paid: 40,
        });
    });

    it("does not leak catalog-only keys onto InvoiceInput", () => {
        const result = normalizeInvoiceImportInput(
            {
                customer_number: "5405",
                invoice_number: "INV-1",
                invoice_date: "2026-06-22",
                base_amount: 5000,
                invoice_amount: 1000,
                currency: "GBP",
            },
            accountId
        );

        expect(result).not.toHaveProperty("base_amount");
        expect(result).not.toHaveProperty("invoice_amount");
        expect(result).not.toHaveProperty("currency");
    });
});
