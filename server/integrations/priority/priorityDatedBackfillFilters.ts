/**
 * Dated-backfill OData filters for Priority (slice 01 spike).
 *
 * Live sandbox validation (Priority Cloud usdemo, Jul 2026):
 * - CINVOICES has no IVBALANCE — unpaid cannot be filtered on CINVOICES alone.
 * - TFNCITEMS2ONE exposes IVBALANCE + CURDATE and accepts unpaid + date $filter.
 * - Payment→invoice: Archaser contract entity TOTARPAY carries IVNUM + CUSTNAME
 *   on the row (server $filter). Sites that only expose TINVOICES link invoices
 *   via TFNCITEMS_SUBFORM.FNCIREF1 — parent collection cannot be filtered by that
 *   subform field → client filter after a scoped pull.
 */

/** Open AR discovery form (confirmed on Priority Cloud sandbox). */
export const PRIORITY_OPEN_ITEMS_ENTITY_SET = "TFNCITEMS2ONE" as const;

export interface PriorityInvoiceCustomerLink {
    /** Priority invoice number (IVNUM / FNCIREF1). */
    ivnum: string;
    /** Priority customer number (CUSTNAME / ACCNAME). */
    custname: string;
}

export interface PriorityDatedBackfillFilterContract {
    /**
     * Unpaid / open balance discovery.
     * Gate: yes → server filter on TFNCITEMS2ONE; CINVOICES lacks IVBALANCE.
     */
    unpaidOpen: {
        strategy: "server_filter";
        entitySet: typeof PRIORITY_OPEN_ITEMS_ENTITY_SET;
        balanceField: "IVBALANCE";
        /** Document date on open items (not CINVOICES.IVDATE). */
        dateField: "CURDATE";
        invoiceFlagField: "INVOICEFLAG";
        invoiceFlagValue: "Y";
        /**
         * Local mock mirrors unpaid semantics on CINVOICES.IVBALANCE + IVDATE so
         * Invoice entity pulls can be exercised without wiring TFNCITEMS2ONE into
         * PriorityProviderClient yet.
         */
        mockInvoiceEntitySet: "CINVOICES";
        mockBalanceField: "IVBALANCE";
        mockDateField: "IVDATE";
        openDefinition: "IVBALANCE ne 0 (gt 0 or lt 0); ignore STATDES / FINAL";
        exampleFilter: string;
        fallbackIfEntityUnavailable: "client_filter_after_pull";
    };
    /** On/after cutover window for invoice create/document date. */
    invoicesOnOrAfter: {
        entitySet: "CINVOICES";
        dateField: "IVDATE";
        exampleFilter: string;
    };
    /** On/after cutover window for payment document date. */
    paymentsOnOrAfter: {
        entitySet: "TOTARPAY";
        dateField: "PAYDATE";
        exampleFilter: string;
    };
    /**
     * Related payments for older-open invoices.
     * Gate: yes on flat TOTARPAY (IVNUM+CUSTNAME); partial on TINVOICES-only sites.
     */
    paymentsByInvoiceLink: {
        strategy: "server_filter_chunked";
        entitySet: "TOTARPAY";
        invoiceField: "IVNUM";
        customerField: "CUSTNAME";
        maxLinksPerFilter: number;
        exampleFilter: string;
        tinvoicesFallback: {
            entitySet: "TINVOICES";
            linkFieldInSubform: "FNCIREF1";
            strategy: "client_filter_after_scoped_pull";
            note: string;
        };
    };
}

const EXAMPLE_START = "2024-01-01T00:00:00Z";

export const PRIORITY_DATED_BACKFILL_FILTERS: PriorityDatedBackfillFilterContract =
    {
        unpaidOpen: {
            strategy: "server_filter",
            entitySet: PRIORITY_OPEN_ITEMS_ENTITY_SET,
            balanceField: "IVBALANCE",
            dateField: "CURDATE",
            invoiceFlagField: "INVOICEFLAG",
            invoiceFlagValue: "Y",
            mockInvoiceEntitySet: "CINVOICES",
            mockBalanceField: "IVBALANCE",
            mockDateField: "IVDATE",
            openDefinition:
                "IVBALANCE ne 0 (gt 0 or lt 0); ignore STATDES / FINAL",
            exampleFilter: `INVOICEFLAG eq 'Y' and (IVBALANCE gt 0 or IVBALANCE lt 0) and CURDATE lt ${EXAMPLE_START}`,
            fallbackIfEntityUnavailable: "client_filter_after_pull",
        },
        invoicesOnOrAfter: {
            entitySet: "CINVOICES",
            dateField: "IVDATE",
            exampleFilter: `IVDATE ge ${EXAMPLE_START}`,
        },
        paymentsOnOrAfter: {
            entitySet: "TOTARPAY",
            dateField: "PAYDATE",
            exampleFilter: `PAYDATE ge ${EXAMPLE_START}`,
        },
        paymentsByInvoiceLink: {
            strategy: "server_filter_chunked",
            entitySet: "TOTARPAY",
            invoiceField: "IVNUM",
            customerField: "CUSTNAME",
            maxLinksPerFilter: 20,
            exampleFilter: `(IVNUM eq 'INV-2024-0001' and CUSTNAME eq 'T000001')`,
            tinvoicesFallback: {
                entitySet: "TINVOICES",
                linkFieldInSubform: "FNCIREF1",
                strategy: "client_filter_after_scoped_pull",
                note: "Sandbox TINVOICES link invoices on TFNCITEMS_SUBFORM.FNCIREF1; $expand=$filter does not restrict parents — pull by customer/date then keep lines where FNCIREF1 matches older-open IVNUMs.",
            },
        },
    };

export type PriorityDatedBackfillGateId =
    | "unpaid_open_filter"
    | "payments_by_invoice_link"
    | "mock_dated_open_payment_filters";

export interface PriorityDatedBackfillGateOutcome {
    gate: PriorityDatedBackfillGateId;
    answer: "yes" | "no" | "partial";
    mvpImpact: string;
    implementationNote: string;
}

/** Slice 01 gate outcomes for implementers of older-open pull (slice 03). */
export const PRIORITY_DATED_BACKFILL_GATE_OUTCOMES: readonly PriorityDatedBackfillGateOutcome[] =
    [
        {
            gate: "unpaid_open_filter",
            answer: "yes",
            mvpImpact:
                "Server open-before pull: query TFNCITEMS2ONE with unpaid IVBALANCE + CURDATE lt start. Do not rely on CINVOICES.IVBALANCE (absent on Priority Cloud sandbox).",
            implementationNote:
                "Discovery filter: INVOICEFLAG eq 'Y' and (IVBALANCE gt 0 or IVBALANCE lt 0) and CURDATE lt {startIso}. Then fetch matching CINVOICES by IVNUM (and customer). Mock: same unpaid semantics on CINVOICES.IVBALANCE + IVDATE. If TFNCITEMS2ONE is blocked on a site, fall back to broader pull + client filter on open-items payload.",
        },
        {
            gate: "payments_by_invoice_link",
            answer: "yes",
            mvpImpact:
                "Chunked related pulls on TOTARPAY: $filter=(IVNUM eq '…' and CUSTNAME eq '…') or …. Dedupe with on/after PAYDATE window via upsert.",
            implementationNote:
                "Use buildPaymentsByInvoiceLinkFilters (max 20 links per $filter). Entity set name varies — contract default TOTARPAY; confirm via $metadata. If only TINVOICES is available, use client_filter_after_scoped_pull on TFNCITEMS_SUBFORM.FNCIREF1 (see PRIORITY_DATED_BACKFILL_FILTERS.paymentsByInvoiceLink.tinvoicesFallback).",
        },
        {
            gate: "mock_dated_open_payment_filters",
            answer: "yes",
            mvpImpact:
                "Local/CI can exercise unpaid-open-before-date and payment-by-invoice without a live ERP.",
            implementationNote:
                "npx tsx scripts/testing/priority-mock-server.ts — CINVOICES supports IVBALANCE + IVDATE $filter; TOTARPAY supports IVNUM/CUSTNAME and PAYDATE $filter. Unit tests cover filter builders + mock evaluator.",
        },
    ];

function odataStringLiteral(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

/** Unpaid open items before start (production TFNCITEMS2ONE filter). */
export function buildUnpaidOpenItemsBeforeDateFilter(beforeIso: string): string {
    return (
        `INVOICEFLAG eq 'Y' and (IVBALANCE gt 0 or IVBALANCE lt 0) ` +
        `and CURDATE lt ${beforeIso}`
    );
}

/**
 * Mock / CINVOICES stand-in: unpaid balance with invoice date before start.
 * Open = IVBALANCE ne 0 regardless of STATDES.
 */
export function buildUnpaidOpenInvoicesBeforeDateFilter(
    beforeIso: string
): string {
    return `(IVBALANCE gt 0 or IVBALANCE lt 0) and IVDATE lt ${beforeIso}`;
}

export function buildInvoicesOnOrAfterDateFilter(onOrAfterIso: string): string {
    return `IVDATE ge ${onOrAfterIso}`;
}

export function buildPaymentsOnOrAfterDateFilter(onOrAfterIso: string): string {
    return `PAYDATE ge ${onOrAfterIso}`;
}

/**
 * One or more $filter strings for payments linked to invoice+customer pairs.
 * Chunks to keep URLs under Priority / proxy limits.
 */
export function buildPaymentsByInvoiceLinkFilters(
    links: readonly PriorityInvoiceCustomerLink[],
    options?: { maxLinksPerFilter?: number }
): string[] {
    const max =
        options?.maxLinksPerFilter ??
        PRIORITY_DATED_BACKFILL_FILTERS.paymentsByInvoiceLink.maxLinksPerFilter;

    if (links.length === 0) {
        return [];
    }

    const clauses = links.map(
        (link) =>
            `(IVNUM eq ${odataStringLiteral(link.ivnum)} and CUSTNAME eq ${odataStringLiteral(link.custname)})`
    );

    const filters: string[] = [];
    for (let i = 0; i < clauses.length; i += max) {
        filters.push(clauses.slice(i, i + max).join(" or "));
    }
    return filters;
}

/** Query params helper for a collection GET with $filter + paging. */
export function buildDatedBackfillQueryParams(options: {
    filter: string;
    top?: number;
    skip?: number;
}): Record<string, string> {
    const params: Record<string, string> = {
        $filter: options.filter,
    };
    if (options.top !== undefined) {
        params.$top = String(options.top);
    }
    if (options.skip !== undefined) {
        params.$skip = String(options.skip);
    }
    return params;
}
