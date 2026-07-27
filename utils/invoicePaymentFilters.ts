/**
 * Exclude deferred (unlinked) payments from live AR totals and aggregates.
 *
 * Prefer `{ gt: 0 }` over `{ not: null }`: Prisma rejects `{ not: null }` when the
 * generated client still types `invoice_id` as required `Int` (stale generate),
 * while `invoice_id > 0` also excludes SQL NULLs once the column is nullable.
 */
export const linkedInvoicePaymentWhere = {
    invoice_id: { gt: 0 },
} as const;
