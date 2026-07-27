import { describe, expect, it } from "vitest";

import { sortInvoicesForImport } from "@/server/services/import/sortInvoicesForImport";

describe("sortInvoicesForImport", () => {
    it("sorts by invoice_date ascending then invoice_number within each customer", () => {
        const invoices = [
            {
                customer_number: "B",
                invoice_number: "INV-002",
                invoice_date: "2024-02-01",
            },
            {
                customer_number: "A",
                invoice_number: "INV-010",
                invoice_date: "2024-01-15",
            },
            {
                customer_number: "A",
                invoice_number: "INV-002",
                invoice_date: "2024-01-01",
            },
            {
                customer_number: "A",
                invoice_number: "INV-001",
                invoice_date: "2024-01-01",
            },
            {
                customer_number: "B",
                invoice_number: "INV-001",
                invoice_date: "2024-01-01",
            },
        ];

        const sorted = sortInvoicesForImport(invoices);

        expect(sorted.map((invoice) => invoice.invoice_number)).toEqual([
            "INV-001",
            "INV-002",
            "INV-010",
            "INV-001",
            "INV-002",
        ]);
        expect(sorted.map((invoice) => invoice.customer_number)).toEqual([
            "A",
            "A",
            "A",
            "B",
            "B",
        ]);
    });

    it("normalizes ISO datetime strings before comparing dates", () => {
        const invoices = [
            {
                customer_number: "A",
                invoice_number: "INV-002",
                invoice_date: "2024-01-02T00:00:00.000Z",
            },
            {
                customer_number: "A",
                invoice_number: "INV-001",
                invoice_date: "2024-01-01",
            },
        ];

        const sorted = sortInvoicesForImport(invoices);
        expect(sorted[0].invoice_number).toBe("INV-001");
        expect(sorted[1].invoice_number).toBe("INV-002");
    });
});
