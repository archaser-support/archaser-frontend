import {
    computeInvoiceCapacityGapContribution,
    computeLimitAssessedAmountForNewOpenInvoice,
    parseImportDateToLocalCalendarDate,
} from "@/server/services/creditInsurance/invoiceInsuranceFields";
import { linkDeferredPaymentAndRecalc } from "@/server/services/invoicePayment/linkDeferredPaymentAndRecalc";

export type ReplayEventType = "invoice_open" | "payment_apply";

export type ReplayInvoiceInput = {
    invoiceNumber: string;
    invoiceDate: Date;
    netAmount: number;
    customerNetAmount: number;
    /** Existing DB id when replaying persisted invoices */
    invoiceId?: number;
};

export type ReplayPaymentInput = {
    id: number;
    invoiceNumber: string;
    paymentDate: Date;
    amount: number;
    customerAmount: number;
    invoiceId?: number | null;
};

export type ReplayEvent =
    | {
          type: "invoice_open";
          date: Date;
          payload: ReplayInvoiceInput;
      }
    | {
          type: "payment_apply";
          date: Date;
          payload: ReplayPaymentInput;
      };

export type ReplaySimulationInvoice = {
    invoiceNumber: string;
    invoiceId?: number;
    netAmount: number;
    customerNetAmount: number;
    outstanding: number;
    customerOutstanding: number;
    limitAssessedAmount: number | null;
};

export type ReplaySimulationConfig = {
    approvedLimit: number;
    topUpTotal?: number;
};

export type ReplaySimulationSummary = {
    eventsApplied: number;
    paymentsLinked: number;
    deferredRemaining: number;
};

export type ReplayCustomerSummary = ReplaySimulationSummary & {
    customerId: number;
};

export type ReplayBatchSummary = {
    customersAffected: number;
    eventsApplied: number;
    paymentsLinked: number;
    deferredRemaining: number;
    perCustomer: ReplayCustomerSummary[];
};

function calendarDayKey(date: Date): number {
    const normalized = parseImportDateToLocalCalendarDate(date);
    if (!normalized) {
        return date.getTime();
    }
    return (
        normalized.getFullYear() * 10000 +
        (normalized.getMonth() + 1) * 100 +
        normalized.getDate()
    );
}

/** Same-day tie-break: invoice_open before payment_apply. */
export function compareReplayEvents(a: ReplayEvent, b: ReplayEvent): number {
    const dayCmp = calendarDayKey(a.date) - calendarDayKey(b.date);
    if (dayCmp !== 0) {
        return dayCmp;
    }
    if (a.type === b.type) {
        return 0;
    }
    return a.type === "invoice_open" ? -1 : 1;
}

export function sortReplayEvents(events: ReplayEvent[]): ReplayEvent[] {
    return [...events].sort(compareReplayEvents);
}

export function buildReplayEvents(
    invoices: ReplayInvoiceInput[],
    payments: ReplayPaymentInput[]
): ReplayEvent[] {
    const events: ReplayEvent[] = [
        ...invoices.map(
            (invoice): ReplayEvent => ({
                type: "invoice_open",
                date: invoice.invoiceDate,
                payload: invoice,
            })
        ),
        ...payments.map(
            (payment): ReplayEvent => ({
                type: "payment_apply",
                date: payment.paymentDate,
                payload: payment,
            })
        ),
    ];
    return sortReplayEvents(events);
}

function sumOpenAr(invoices: ReplaySimulationInvoice[]): number {
    return invoices.reduce((sum, inv) => sum + Math.max(0, inv.outstanding), 0);
}

function gapForInvoice(inv: ReplaySimulationInvoice): number {
    if (inv.limitAssessedAmount == null) {
        return 0;
    }
    return computeInvoiceCapacityGapContribution({
        outstandingLeft: inv.outstanding,
        limitAssessedAmount: inv.limitAssessedAmount,
    });
}

/**
 * Pure in-memory chronological replay for capacity-gap timeline rules.
 * Stamps limit_assessed_amount at invoice_open using open AR with only
 * payments applied on earlier timeline events (same-day payments apply after
 * invoice_open due to tie-break).
 */
export function simulateCustomerArReplay(
    config: ReplaySimulationConfig,
    invoices: ReplayInvoiceInput[],
    payments: ReplayPaymentInput[]
): {
    summary: ReplaySimulationSummary;
    invoices: ReplaySimulationInvoice[];
} {
    const events = buildReplayEvents(invoices, payments);
    const invoiceState = new Map<string, ReplaySimulationInvoice>();
    const linkedPaymentIds = new Set<number>();
    let paymentsLinked = 0;

    for (const event of events) {
        if (event.type === "invoice_open") {
            const payload = event.payload;
            const openArBefore = sumOpenAr(Array.from(invoiceState.values()));
            const outstanding = Math.max(0, payload.netAmount);
            const limitAssessedAmount =
                computeLimitAssessedAmountForNewOpenInvoice({
                    approvedLimit: config.approvedLimit,
                    topUpTotal: config.topUpTotal ?? 0,
                    openArOnPolicyBeforeInvoice: openArBefore,
                    newInvoiceOutstanding: outstanding,
                });

            invoiceState.set(payload.invoiceNumber, {
                invoiceNumber: payload.invoiceNumber,
                invoiceId: payload.invoiceId,
                netAmount: payload.netAmount,
                customerNetAmount: payload.customerNetAmount,
                outstanding,
                customerOutstanding: Math.max(0, payload.customerNetAmount),
                limitAssessedAmount,
            });
            continue;
        }

        const payment = event.payload;
        const invoice = invoiceState.get(payment.invoiceNumber);
        if (!invoice) {
            continue;
        }

        invoice.outstanding = Math.max(0, invoice.outstanding - payment.amount);
        invoice.customerOutstanding = Math.max(
            0,
            invoice.customerOutstanding - payment.customerAmount
        );
        linkedPaymentIds.add(payment.id);
        paymentsLinked += 1;
    }

    const deferredRemaining = payments.filter(
        (p) => !linkedPaymentIds.has(p.id)
    ).length;

    return {
        summary: {
            eventsApplied: events.length,
            paymentsLinked,
            deferredRemaining,
        },
        invoices: Array.from(invoiceState.values()),
    };
}

export function getInvoiceGap(inv: ReplaySimulationInvoice): number {
    return gapForInvoice(inv);
}

export type ReplayCustomerArImportParams = {
    customerId: number;
    accountId: number;
    invoices?: ReplayInvoiceInput[];
    payments?: ReplayPaymentInput[];
    approvedLimit?: number;
    topUpTotal?: number;
};

/**
 * DB-backed replay for a single customer. Links deferred payments on
 * payment_apply events and re-stamps limit_assessed_amount on invoice_open.
 */
export async function replayCustomerArImport(
    params: ReplayCustomerArImportParams
): Promise<ReplayCustomerSummary> {
    const { prisma } = await import("@/lib/prisma");
    const customerId = params.customerId;

    const [dbInvoices, dbPayments, insurance] = await Promise.all([
        prisma.invoice.findMany({
            where: { customer_id: customerId },
            select: {
                id: true,
                invoice_number: true,
                invoice_date: true,
                due_date: true,
                net_amount: true,
                customer_net_amount: true,
            },
        }),
        prisma.invoicePayment.findMany({
            where: { customer_id: customerId },
            select: {
                id: true,
                invoice_number: true,
                invoice_id: true,
                payment_date: true,
                amount: true,
                customer_amount: true,
            },
        }),
        prisma.customerPolicy.findFirst({
            where: {
                customer_id: customerId,
                is_active: true,
            },
            select: {
                approved_limit: true,
            },
            orderBy: { id: "desc" },
        }),
    ]);

    const invoiceInputs: ReplayInvoiceInput[] =
        params.invoices ??
        dbInvoices
            .filter((inv) => inv.invoice_number && inv.invoice_date)
            .map((inv) => ({
                invoiceNumber: inv.invoice_number!,
                invoiceDate: inv.invoice_date!,
                netAmount: inv.net_amount ?? 0,
                customerNetAmount: inv.customer_net_amount ?? 0,
                invoiceId: inv.id,
            }));

    // Linked UI/API payments historically stored invoice_id without
    // invoice_number; resolve the number from the invoice so replay still
    // includes those settlements (invoices-then-payments import order).
    const invoiceNumberById = new Map<number, string>();
    for (const inv of dbInvoices) {
        if (inv.invoice_number) {
            invoiceNumberById.set(inv.id, inv.invoice_number);
        }
    }
    for (const inv of invoiceInputs) {
        if (inv.invoiceId != null) {
            invoiceNumberById.set(inv.invoiceId, inv.invoiceNumber);
        }
    }

    const paymentInputs: ReplayPaymentInput[] =
        params.payments ??
        dbPayments
            .map((p): ReplayPaymentInput | null => {
                const invoiceNumber =
                    p.invoice_number ??
                    (p.invoice_id != null
                        ? invoiceNumberById.get(p.invoice_id)
                        : undefined);
                if (!invoiceNumber) {
                    return null;
                }
                return {
                    id: p.id,
                    invoiceNumber,
                    paymentDate: p.payment_date,
                    amount: p.amount,
                    customerAmount: p.customer_amount,
                    invoiceId: p.invoice_id,
                };
            })
            .filter((p): p is ReplayPaymentInput => p !== null);

    const approvedLimit =
        params.approvedLimit ??
        (insurance?.approved_limit != null
            ? Number(insurance.approved_limit)
            : 0);

    const events = buildReplayEvents(invoiceInputs, paymentInputs);
    const invoiceIdByNumber = new Map(
        invoiceInputs
            .filter((inv) => inv.invoiceId != null)
            .map((inv) => [inv.invoiceNumber, inv.invoiceId!])
    );

    let paymentsLinked = 0;
    let deferredRemaining = 0;
    const openArRunning = new Map<string, number>();

    for (const event of events) {
        if (event.type === "invoice_open") {
            const payload = event.payload;
            const scopeKey = "default";
            const openBefore = openArRunning.get(scopeKey) ?? 0;
            const outstanding = Math.max(0, payload.netAmount);
            const limitAssessedAmount =
                computeLimitAssessedAmountForNewOpenInvoice({
                    approvedLimit,
                    topUpTotal: params.topUpTotal ?? 0,
                    openArOnPolicyBeforeInvoice: openBefore,
                    newInvoiceOutstanding: outstanding,
                });

            if (payload.invoiceId != null) {
                await prisma.invoice.update({
                    where: { id: payload.invoiceId },
                    data: {
                        limit_assessed_amount: limitAssessedAmount,
                        limit_assessed_at: new Date(),
                        outstanding_debt: outstanding,
                        customer_outstanding_debt: Math.max(
                            0,
                            payload.customerNetAmount
                        ),
                    },
                });
                const { stampInvoiceInsuranceFieldsAsOf } = await import(
                    "@/server/services/creditInsurance/stampInvoiceInsuranceFieldsAsOf"
                );
                await stampInvoiceInsuranceFieldsAsOf(
                    payload.invoiceId,
                    payload.invoiceDate
                );
            }

            openArRunning.set(scopeKey, openBefore + outstanding);
            if (payload.invoiceId != null) {
                invoiceIdByNumber.set(payload.invoiceNumber, payload.invoiceId);
            }
            continue;
        }

        const payment = event.payload;
        const invoiceId =
            payment.invoiceId ??
            invoiceIdByNumber.get(payment.invoiceNumber) ??
            (
                await prisma.invoice.findFirst({
                    where: {
                        customer_id: customerId,
                        invoice_number: payment.invoiceNumber,
                    },
                    select: { id: true },
                })
            )?.id;

        if (invoiceId == null) {
            deferredRemaining += 1;
            continue;
        }

        invoiceIdByNumber.set(payment.invoiceNumber, invoiceId);

        const linkResult = await linkDeferredPaymentAndRecalc({
            invoicePaymentId: payment.id,
            invoiceId,
            forceRecalc: true,
        });
        if (!linkResult.alreadyLinked) {
            paymentsLinked += 1;
        }

        // Keep open-AR running total chronological for limit_assessed stamps.
        // Do not re-read live Due/Overdue outstanding — those already reflect
        // future payments when replaying a fully linked book.
        const scopeKey = "default";
        const openBeforePayment = openArRunning.get(scopeKey) ?? 0;
        const paymentAmount = Math.max(0, Number(payment.amount ?? 0));
        openArRunning.set(
            scopeKey,
            Math.max(0, openBeforePayment - paymentAmount)
        );
    }

    const stillDeferred = await prisma.invoicePayment.count({
        where: {
            customer_id: customerId,
            invoice_id: null,
        },
    });

    return {
        customerId,
        eventsApplied: events.length,
        paymentsLinked,
        deferredRemaining: Math.max(deferredRemaining, stillDeferred),
    };
}

export type MaturityResult = {
    matured: number;
    deferredRemaining: number;
};

/**
 * Applies matured deferred payments for an account: any InvoicePayment row
 * with `invoice_id` null, `payment_date <= asOf`, and a matching invoice that
 * now exists is linked via the shared link-and-recalc helper.
 *
 * Used by the billing connector after each sync (Slice 5, D16).
 */
export async function applyMaturedDeferredPayments(
    accountId: number,
    asOf: Date
): Promise<MaturityResult> {
    const { prisma } = await import("@/lib/prisma");

    const deferredRows = await prisma.invoicePayment.findMany({
        where: {
            account_id: accountId,
            invoice_id: null,
            payment_date: { lte: asOf },
            invoice_number: { not: null },
        },
        select: {
            id: true,
            invoice_number: true,
            customer_id: true,
        },
    });

    if (deferredRows.length === 0) {
        const stillDeferred = await prisma.invoicePayment.count({
            where: { account_id: accountId, invoice_id: null },
        });
        return { matured: 0, deferredRemaining: stillDeferred };
    }

    let matured = 0;
    for (const row of deferredRows) {
        if (!row.invoice_number) {
            continue;
        }

        const invoice = await prisma.invoice.findFirst({
            where: {
                account_id: accountId,
                customer_id: row.customer_id,
                invoice_number: row.invoice_number,
            },
            select: { id: true },
        });

        if (!invoice) {
            continue;
        }

        const result = await linkDeferredPaymentAndRecalc({
            invoicePaymentId: row.id,
            invoiceId: invoice.id,
        });

        if (!result.alreadyLinked) {
            matured += 1;
        }
    }

    const stillDeferred = await prisma.invoicePayment.count({
        where: { account_id: accountId, invoice_id: null },
    });

    return { matured, deferredRemaining: stillDeferred };
}

export async function replayArImportForCustomers(
    customerIds: number[],
    accountId: number
): Promise<ReplayBatchSummary> {
    const perCustomer: ReplayCustomerSummary[] = [];

    for (const customerId of customerIds) {
        perCustomer.push(
            await replayCustomerArImport({ customerId, accountId })
        );
    }

    return {
        customersAffected: perCustomer.length,
        eventsApplied: perCustomer.reduce((s, c) => s + c.eventsApplied, 0),
        paymentsLinked: perCustomer.reduce((s, c) => s + c.paymentsLinked, 0),
        deferredRemaining: perCustomer.reduce(
            (s, c) => s + c.deferredRemaining,
            0
        ),
        perCustomer,
    };
}
