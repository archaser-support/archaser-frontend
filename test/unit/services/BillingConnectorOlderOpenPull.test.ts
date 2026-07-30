import { describe, expect, it } from "vitest";

import {
    DATED_BACKFILL_FIXTURE_START_ISO,
    INVOICE_SAMPLES,
    PAYMENT_SAMPLES,
} from "@/server/integrations/priority/fixtures/samplePayloads";
import {
    buildPaymentsByInvoiceLinkFilters,
    buildUnpaidOpenInvoicesBeforeDateFilter,
} from "@/server/integrations/priority/priorityDatedBackfillFilters";
import {
    applyODataFilter,
    compileODataFilter,
} from "@/server/integrations/priority/priorityODataFilterEval";
import {
    buildBackfillEntityPullPhases,
    extractInvoiceCustomerLinks,
} from "@/server/services/billingConnectorBackfillBounds";

/**
 * Orchestration seam for dated + older-open pull plans (slice 03).
 * Asserts which ERP windows would be requested and which fixture rows match.
 */
describe("billing connector older-open pull orchestration", () => {
    const start = new Date(DATED_BACKFILL_FIXTURE_START_ISO);

    it("when older-open on: unpaid pre-date invoices + related payments + on/after", () => {
        const invoicePhases = buildBackfillEntityPullPhases({
            entityType: "Invoice",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: true,
            timeZone: "UTC",
        });
        const paymentPhases = buildBackfillEntityPullPhases({
            entityType: "Payment",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: true,
            timeZone: "UTC",
        });

        expect(invoicePhases.map((p) => p.id)).toEqual(["older_open", "dated"]);
        expect(paymentPhases.map((p) => p.id)).toEqual(["related", "dated"]);

        const olderOpenFilter = String(invoicePhases[0].filter);
        const datedInvoiceFilter = String(invoicePhases[1].filter);
        const datedPaymentFilter = String(paymentPhases[1].filter);

        const olderOpenInvoices = applyODataFilter(
            INVOICE_SAMPLES as unknown as Record<string, unknown>[],
            olderOpenFilter
        );
        const datedInvoices = applyODataFilter(
            INVOICE_SAMPLES as unknown as Record<string, unknown>[],
            datedInvoiceFilter
        );

        expect(olderOpenInvoices.map((r) => r.IVNUM)).toEqual(
            expect.arrayContaining(["INV-2024-OPEN", "INV-2025-0002"])
        );
        expect(olderOpenInvoices.map((r) => r.IVNUM)).not.toContain(
            "INV-2024-PAID"
        );
        expect(datedInvoices.map((r) => r.IVNUM)).toContain("INV-2025-0003");
        expect(datedInvoices.map((r) => r.IVNUM)).not.toContain(
            "INV-2024-OPEN"
        );

        const links = extractInvoiceCustomerLinks(olderOpenInvoices);
        const relatedFilters = buildPaymentsByInvoiceLinkFilters(links);
        expect(relatedFilters.length).toBeGreaterThan(0);

        const relatedPayments = PAYMENT_SAMPLES.filter((row) =>
            relatedFilters.some((filter) => {
                const pred = compileODataFilter(filter);
                return pred?.(row as unknown as Record<string, unknown>);
            })
        );
        expect(relatedPayments.map((r) => r.PAYNUM)).toEqual(
            expect.arrayContaining(["PAY-2024-OPEN-1", "PAY-2024-OPEN-2"])
        );
        expect(relatedPayments.map((r) => r.PAYNUM)).not.toContain(
            "PAY-2024-PAID-1"
        );

        const datedPayments = applyODataFilter(
            PAYMENT_SAMPLES as unknown as Record<string, unknown>[],
            datedPaymentFilter
        );
        expect(datedPayments.map((r) => r.PAYNUM)).toEqual(
            expect.arrayContaining(["PAY-2025-0002", "PAY-2025-0003"])
        );
    });

    it("when older-open off: only on/after invoices and payments", () => {
        const invoicePhases = buildBackfillEntityPullPhases({
            entityType: "Invoice",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: false,
            timeZone: "UTC",
        });
        const paymentPhases = buildBackfillEntityPullPhases({
            entityType: "Payment",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: false,
            timeZone: "UTC",
        });

        expect(invoicePhases.map((p) => p.id)).toEqual(["dated"]);
        expect(paymentPhases.map((p) => p.id)).toEqual(["dated"]);

        const invoices = applyODataFilter(
            INVOICE_SAMPLES as unknown as Record<string, unknown>[],
            String(invoicePhases[0].filter)
        );
        const payments = applyODataFilter(
            PAYMENT_SAMPLES as unknown as Record<string, unknown>[],
            String(paymentPhases[0].filter)
        );

        expect(invoices.map((r) => r.IVNUM)).not.toContain("INV-2024-OPEN");
        expect(invoices.map((r) => r.IVNUM)).toContain("INV-2025-0003");
        expect(payments.map((r) => r.PAYNUM)).not.toContain("PAY-2024-OPEN-1");
        expect(payments.map((r) => r.PAYNUM)).toContain("PAY-2025-0003");
    });

    it("related payments match by invoice number + customer link", () => {
        const filter = buildUnpaidOpenInvoicesBeforeDateFilter(
            DATED_BACKFILL_FIXTURE_START_ISO
        );
        const openRows = applyODataFilter(
            INVOICE_SAMPLES as unknown as Record<string, unknown>[],
            filter
        );
        const links = extractInvoiceCustomerLinks(openRows);
        expect(links).toEqual(
            expect.arrayContaining([
                { ivnum: "INV-2024-OPEN", custname: "T000001" },
            ])
        );

        const [linkFilter] = buildPaymentsByInvoiceLinkFilters([
            { ivnum: "INV-2024-OPEN", custname: "T000001" },
        ]);
        const pred = compileODataFilter(linkFilter);
        expect(
            pred?.(PAYMENT_SAMPLES[0] as unknown as Record<string, unknown>)
        ).toBe(true);
        expect(
            pred?.({
                PAYNUM: "PAY-OTHER",
                IVNUM: "INV-2024-OPEN",
                CUSTNAME: "T000002",
            })
        ).toBe(false);
    });
});
