import path from "path";
import { describe, expect, it } from "vitest";

import {
    preprocessGoldenImportFiles,
    preprocessGoldenImportRows,
    preprocessGoldenInvoiceRow,
    preprocessGoldenPaymentRow,
} from "@/server/services/import/goldenLoop/preprocessGoldenImportFiles";

const FIXTURES_DIR = path.join(
    process.cwd(),
    "test/fixtures/import-golden-loop"
);

describe("preprocessGoldenImportFiles", () => {
    it("preprocesses committed golden fixtures with customer 4567 on every row", async () => {
        const result = await preprocessGoldenImportFiles({
            invoicesPath: path.join(FIXTURES_DIR, "invoices.xlsx"),
            paymentsPath: path.join(FIXTURES_DIR, "payments.xlsx"),
        });

        expect(result.invoices).toHaveLength(25);
        expect(result.payments).toHaveLength(13);
        expect(
            result.invoices.every((row) => row.customer_number === "4567")
        ).toBe(true);
        expect(
            result.payments.every((row) => row.customer_number === "4567")
        ).toBe(true);
    });

    it("maps invoice customer_id to customer_number and normalizes catalog aliases", () => {
        const row = preprocessGoldenInvoiceRow({
            customer_id: 4567,
            invoice_date: 46024,
            due_date: 46038,
            invoice_amount: 500,
            invoice_currency: "ILS",
            amount_base: 250,
            customer_total_paid: 5584562,
            invoice_number: "",
        });

        expect(row).toEqual({
            customer_number: "4567",
            invoice_number: "5584562",
            invoice_date: "2026-01-02",
            due_date: "2026-01-16",
            amount: 500,
            customer_amount: 500,
            customer_currency: "ILS",
        });
    });

    it("remaps payment customer 5405 to 4567", () => {
        const row = preprocessGoldenPaymentRow({
            customer_number: "5405",
            invoice_number: "5584561",
            payment_date: 46025,
            customer_amount: 150,
            currency: "ILS",
            reference: "Q8891",
        });

        expect(row).toEqual({
            customer_number: "4567",
            invoice_number: "5584561",
            payment_date: "2026-01-03",
            customer_amount: 150,
            customer_currency: "ILS",
            reference: "Q8891",
        });
    });

    it("converts Excel serial dates to ISO calendar dates", () => {
        const { invoices, payments } = preprocessGoldenImportRows(
            [
                {
                    customer_id: 4567,
                    invoice_date: 46023,
                    due_date: 46037,
                    invoice_amount: 250,
                    invoice_currency: "ILS",
                    amount_base: 250,
                    invoice_number: 5584561,
                },
            ],
            [
                {
                    customer_number: 4567,
                    invoice_number: 5584561,
                    payment_date: 46025,
                    customer_amount: 150,
                    currency: "ILS",
                    reference: "Q8891",
                },
            ]
        );

        expect(invoices[0]?.invoice_date).toBe("2026-01-01");
        expect(invoices[0]?.due_date).toBe("2026-01-15");
        expect(payments[0]?.payment_date).toBe("2026-01-03");
    });

    it("spot-checks invoice 5584561 and its payment from fixtures", async () => {
        const result = await preprocessGoldenImportFiles({
            invoicesPath: path.join(FIXTURES_DIR, "invoices.xlsx"),
            paymentsPath: path.join(FIXTURES_DIR, "payments.xlsx"),
        });

        const invoice = result.invoices.find(
            (row) => row.invoice_number === "5584561"
        );
        const payment = result.payments.find(
            (row) => row.invoice_number === "5584561"
        );

        expect(invoice).toMatchObject({
            customer_number: "4567",
            invoice_date: "2026-01-01",
            amount: 250,
            customer_amount: 250,
            customer_currency: "ILS",
        });
        expect(payment).toMatchObject({
            customer_number: "4567",
            payment_date: "2026-01-03",
            customer_amount: 150,
            customer_currency: "ILS",
            reference: "Q8891",
        });
    });

    it("keeps all fixture invoice and payment dates in Jan 2026", async () => {
        const result = await preprocessGoldenImportFiles({
            invoicesPath: path.join(FIXTURES_DIR, "invoices.xlsx"),
            paymentsPath: path.join(FIXTURES_DIR, "payments.xlsx"),
        });

        for (const row of result.invoices) {
            expect(row.invoice_date).toMatch(/^2026-01-/);
            if (row.due_date) {
                expect(row.due_date).toMatch(/^2026-/);
            }
        }

        for (const row of result.payments) {
            expect(row.payment_date).toMatch(/^2026-01-/);
        }
    });
});
