import { describe, expect, it } from "vitest";

import {
    DATED_BACKFILL_FIXTURE_START_ISO,
    INVOICE_SAMPLES,
    PAYMENT_SAMPLES,
} from "@/server/integrations/priority/fixtures/samplePayloads";
import { applyODataFilter } from "@/server/integrations/priority/priorityODataFilterEval";
import {
    buildBackfillEntityPullPhases,
    buildCutoverOptionsSnapshot,
    formatCutoverOptionsSummary,
} from "@/server/services/billingConnectorBackfillBounds";
import { sortInvoicesForImport } from "@/server/services/import/sortInvoicesForImport";
import { mapErpRecord } from "@/server/utils/connectorFieldUtils";

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
        expect(t000001Rows[0]?.invoice_number).toBe("INV-2024-OPEN");
        expect(t000001Rows[1]?.invoice_number).toBe("INV-2025-0001");
        expect(t000001Rows[2]?.invoice_number).toBe("CN-2025-0001");
    });
});

describe("preview vs backfill cutover window parity", () => {
    const start = new Date(DATED_BACKFILL_FIXTURE_START_ISO);

    it("preview uses the same BACKFILL pull phases as cutover backfill", () => {
        // Preview go/no-go must request the same ERP windows as Start/resume backfill.
        const previewPhases = buildBackfillEntityPullPhases({
            entityType: "Invoice",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: true,
            timeZone: "UTC",
        });
        const backfillPhases = buildBackfillEntityPullPhases({
            entityType: "Invoice",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: true,
            timeZone: "UTC",
        });
        expect(previewPhases).toEqual(backfillPhases);

        const olderOpen = applyODataFilter(
            INVOICE_SAMPLES as unknown as Record<string, unknown>[],
            String(previewPhases[0].filter)
        );
        const dated = applyODataFilter(
            INVOICE_SAMPLES as unknown as Record<string, unknown>[],
            String(previewPhases[1].filter)
        );
        expect(olderOpen.map((r) => r.IVNUM)).toContain("INV-2024-OPEN");
        expect(dated.map((r) => r.IVNUM)).toContain("INV-2025-0003");
        expect(dated.map((r) => r.IVNUM)).not.toContain("INV-2024-OPEN");
    });

    it("preview dated-only window matches backfill when older-open is off", () => {
        const phases = buildBackfillEntityPullPhases({
            entityType: "Payment",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: false,
            timeZone: "UTC",
        });
        expect(phases.map((p) => p.id)).toEqual(["dated"]);
        const payments = applyODataFilter(
            PAYMENT_SAMPLES as unknown as Record<string, unknown>[],
            String(phases[0].filter)
        );
        expect(payments.map((r) => r.PAYNUM)).not.toContain("PAY-2024-OPEN-1");
        expect(payments.map((r) => r.PAYNUM)).toEqual(
            expect.arrayContaining(["PAY-2025-0002", "PAY-2025-0003"])
        );
    });

    it("incremental phases ignore cutover start date (watermarks only)", () => {
        expect(
            buildBackfillEntityPullPhases({
                entityType: "Invoice",
                syncMode: "INCREMENTAL",
                backfillStartDate: start,
                includeOlderOpenInvoices: true,
            })
        ).toEqual([{ id: "full", filter: null }]);
    });
});

describe("cutover options sync-history snapshot", () => {
    it("summarizes start date, older-open, and skip-breach for support", () => {
        const snapshot = buildCutoverOptionsSnapshot({
            backfillStartDate: new Date(Date.UTC(2024, 0, 1)),
            includeOlderOpenInvoices: true,
            skipReportingBreachOnBackfill: true,
        });
        expect(snapshot).toEqual({
            backfill_start_date: "2024-01-01",
            include_older_open_invoices: true,
            skip_reporting_breach_on_backfill: true,
        });
        expect(formatCutoverOptionsSummary(snapshot)).toBe(
            "start 2024-01-01 · older-open on · skip-breach on"
        );
    });

    it("summarizes full-history backfill with skip-breach off", () => {
        const snapshot = buildCutoverOptionsSnapshot({
            backfillStartDate: null,
            includeOlderOpenInvoices: true,
            skipReportingBreachOnBackfill: false,
        });
        expect(formatCutoverOptionsSummary(snapshot)).toBe(
            "full history · skip-breach off"
        );
    });
});
