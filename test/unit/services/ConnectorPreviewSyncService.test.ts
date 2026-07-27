import { describe, expect, it } from "vitest";

import { sortInvoicesForImport } from "@/server/services/import/sortInvoicesForImport";
import { mapErpRecord } from "@/server/utils/connectorFieldUtils";
import { INVOICE_SAMPLES } from "@/server/integrations/priority/fixtures/samplePayloads";

describe("Connector preview invoice ordering", () => {
    it("sorts mapped invoice preview rows by date then number per customer", () => {
        const rules = [
            { archaserField: "customer_number", erpField: "CUSTNAME" },
            { archaserField: "invoice_number", erpField: "IVNUM" },
            {
                archaserField: "invoice_date",
                erpField: "IVDATE",
                transform: "date" as const,
            },
        ];

        const mapped = INVOICE_SAMPLES.map((row) => mapErpRecord(row, rules));
        const shuffled = [...mapped].reverse();
        const sorted = sortInvoicesForImport(
            shuffled.map((row) => ({
                customer_number: String(row.customer_number ?? ""),
                invoice_number: String(row.invoice_number ?? ""),
                invoice_date: String(row.invoice_date ?? ""),
                ...row,
            }))
        );

        const t000001Rows = sorted.filter(
            (row) => row.customer_number === "T000001"
        );
        expect(t000001Rows[0]?.invoice_number).toBe("INV-2025-0001");
        expect(t000001Rows[1]?.invoice_number).toBe("CN-2025-0001");
    });
});
