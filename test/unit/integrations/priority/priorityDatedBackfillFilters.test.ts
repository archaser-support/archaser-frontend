import { describe, expect, it } from "vitest";

import {
    DATED_BACKFILL_FIXTURE_START_ISO,
    INVOICE_SAMPLES,
    PAYMENT_SAMPLES,
} from "@/server/integrations/priority/fixtures/samplePayloads";
import {
    PRIORITY_DATED_BACKFILL_FILTERS,
    PRIORITY_DATED_BACKFILL_GATE_OUTCOMES,
    buildDatedBackfillQueryParams,
    buildInvoicesOnOrAfterDateFilter,
    buildPaymentsByInvoiceLinkFilters,
    buildPaymentsOnOrAfterDateFilter,
    buildUnpaidOpenInvoicesBeforeDateFilter,
    buildUnpaidOpenItemsBeforeDateFilter,
} from "@/server/integrations/priority/priorityDatedBackfillFilters";
import { applyODataFilter } from "@/server/integrations/priority/priorityODataFilterEval";
import { PRIORITY_GATE_OUTCOMES } from "@/server/integrations/priority/priorityApiContract";

describe("priorityDatedBackfillFilters", () => {
    it("records gate Yes for unpaid-open, payments-by-invoice, and mock coverage", () => {
        const byGate = Object.fromEntries(
            PRIORITY_DATED_BACKFILL_GATE_OUTCOMES.map((g) => [g.gate, g.answer])
        );
        expect(byGate.unpaid_open_filter).toBe("yes");
        expect(byGate.payments_by_invoice_link).toBe("yes");
        expect(byGate.mock_dated_open_payment_filters).toBe("yes");

        const contractGateIds = PRIORITY_GATE_OUTCOMES.map((g) => g.gate);
        expect(contractGateIds).toContain("unpaid_open_filter");
        expect(contractGateIds).toContain("payments_by_invoice_link");
        expect(contractGateIds).toContain("mock_dated_open_payment_filters");
    });

    it("documents TFNCITEMS2ONE server filter and CINVOICES mock stand-in", () => {
        expect(PRIORITY_DATED_BACKFILL_FILTERS.unpaidOpen.strategy).toBe(
            "server_filter"
        );
        expect(PRIORITY_DATED_BACKFILL_FILTERS.unpaidOpen.entitySet).toBe(
            "TFNCITEMS2ONE"
        );
        expect(
            PRIORITY_DATED_BACKFILL_FILTERS.unpaidOpen.mockInvoiceEntitySet
        ).toBe("CINVOICES");
        expect(
            PRIORITY_DATED_BACKFILL_FILTERS.paymentsByInvoiceLink.strategy
        ).toBe("server_filter_chunked");
    });

    it("builds unpaid-open and dated window filters", () => {
        const start = DATED_BACKFILL_FIXTURE_START_ISO;
        expect(buildUnpaidOpenItemsBeforeDateFilter(start)).toContain(
            "IVBALANCE gt 0"
        );
        expect(buildUnpaidOpenItemsBeforeDateFilter(start)).toContain(
            `CURDATE lt ${start}`
        );
        expect(buildUnpaidOpenInvoicesBeforeDateFilter(start)).toBe(
            `(IVBALANCE gt 0 or IVBALANCE lt 0) and IVDATE lt ${start}`
        );
        expect(buildInvoicesOnOrAfterDateFilter(start)).toBe(
            `IVDATE ge ${start}`
        );
        expect(buildPaymentsOnOrAfterDateFilter(start)).toBe(
            `PAYDATE ge ${start}`
        );
    });

    it("chunks payment-by-invoice link filters", () => {
        const links = Array.from({ length: 25 }, (_, i) => ({
            ivnum: `INV-${i}`,
            custname: `C${i}`,
        }));
        const filters = buildPaymentsByInvoiceLinkFilters(links, {
            maxLinksPerFilter: 20,
        });
        expect(filters).toHaveLength(2);
        expect(filters[0]).toContain("IVNUM eq 'INV-0'");
        expect(filters[0]).toContain("CUSTNAME eq 'C0'");
        expect(filters[1]).toContain("IVNUM eq 'INV-20'");
    });

    it("builds query params with $filter paging", () => {
        expect(
            buildDatedBackfillQueryParams({
                filter: "IVDATE ge 2025-06-01T00:00:00Z",
                top: 50,
                skip: 100,
            })
        ).toEqual({
            $filter: "IVDATE ge 2025-06-01T00:00:00Z",
            $top: "50",
            $skip: "100",
        });
    });
});

describe("priorityODataFilterEval (mock smoke)", () => {
    const start = DATED_BACKFILL_FIXTURE_START_ISO;

    it("returns only unpaid invoices before cutover date", () => {
        const filter = buildUnpaidOpenInvoicesBeforeDateFilter(start);
        const rows = applyODataFilter(
            INVOICE_SAMPLES as unknown as Record<string, unknown>[],
            filter
        );
        const ivnums = rows.map((row) => row.IVNUM).sort();
        expect(ivnums).toEqual(["INV-2024-OPEN", "INV-2025-0002"]);
        expect(rows.every((row) => Number(row.IVBALANCE) !== 0)).toBe(true);
        expect(
            rows.every(
                (row) => Date.parse(String(row.IVDATE)) < Date.parse(start)
            )
        ).toBe(true);
    });

    it("returns on/after invoices for dated window", () => {
        const rows = applyODataFilter(
            INVOICE_SAMPLES as unknown as Record<string, unknown>[],
            buildInvoicesOnOrAfterDateFilter(start)
        );
        expect(rows.map((row) => row.IVNUM)).toEqual(["INV-2025-0003"]);
    });

    it("returns payments linked to a known open invoice only", () => {
        const [filter] = buildPaymentsByInvoiceLinkFilters([
            { ivnum: "INV-2024-OPEN", custname: "T000001" },
        ]);
        const rows = applyODataFilter(
            PAYMENT_SAMPLES as unknown as Record<string, unknown>[],
            filter
        );
        expect(rows.map((row) => row.PAYNUM).sort()).toEqual([
            "PAY-2024-OPEN-1",
            "PAY-2024-OPEN-2",
        ]);
        expect(
            rows.every(
                (row) =>
                    row.IVNUM === "INV-2024-OPEN" && row.CUSTNAME === "T000001"
            )
        ).toBe(true);
    });

    it("excludes unrelated payments from invoice-link filter", () => {
        const [filter] = buildPaymentsByInvoiceLinkFilters([
            { ivnum: "INV-2024-OPEN", custname: "T000001" },
        ]);
        const rows = applyODataFilter(
            PAYMENT_SAMPLES as unknown as Record<string, unknown>[],
            filter
        );
        expect(rows.some((row) => row.IVNUM === "INV-2024-PAID")).toBe(false);
        expect(rows.some((row) => row.IVNUM === "INV-2025-0001")).toBe(false);
    });

    it("still evaluates incremental UDATE ge filters", () => {
        const rows = applyODataFilter(
            INVOICE_SAMPLES as unknown as Record<string, unknown>[],
            "UDATE ge 2025-06-01T00:00:00Z"
        );
        expect(rows.map((row) => row.IVNUM)).toEqual(["INV-2025-0003"]);
    });
});
