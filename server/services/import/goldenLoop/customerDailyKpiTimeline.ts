import { computeCustomerKpiSnapshotFromInvoices } from "@/server/services/creditInsurance/customerKpiSnapshot";
import {
    computeStoredInvoiceCapacityGapFields,
} from "@/server/services/creditInsurance/invoiceCapacityGapAmounts";
import {
    computeCustomerOverdueBlock,
    computeInvoiceInsuranceRowData,
    computeLimitAssessedAmountForNewOpenInvoice,
    computeCreatedTermsViolationCustomerOverdueMep,
    parseImportDateToLocalCalendarDate,
} from "@/server/services/creditInsurance/invoiceInsuranceFields";
import {
    buildReplayEvents,
    type ReplayEvent,
    type ReplayInvoiceInput,
    type ReplayPaymentInput,
} from "@/server/services/import/importArReplayService";

import type {
    CustomerDailyKpiTimeline,
    DailyKpiSnapshot,
    GoldenExpectedKpiRow,
    GoldenEventKpiLogEntry,
    GoldenInvoiceImportRow,
    GoldenPaymentImportRow,
} from "./types";
import {
    buildGoldenEventKpiLogEntry,
    indexExpectedKpiRowsByDate,
} from "./goldenKpiEventLog";

export type TimelineCustomerInsurance = {
    maxPaymentTerm?: number | null;
    reportingDays?: number | null;
    maxAllowedMep?: number | null;
};

export type CustomerDailyKpiTimelineConfig = {
    approvedLimit: number;
    topUpTotal?: number;
    accountCurrency?: string | null;
    customerInsurance?: TimelineCustomerInsurance;
};

export type CustomerDailyKpiTimelineInput = {
    accountId: number;
    customerId: number;
    fromDate: string;
    toDate: string;
    invoices: TimelineReplayInvoiceInput[];
    payments: ReplayPaymentInput[];
    config: CustomerDailyKpiTimelineConfig;
    /** When set, logs KPI matrix vs expected after each invoice/payment replay event. */
    expectedKpiRows?: GoldenExpectedKpiRow[];
    onAfterEvent?: (entry: GoldenEventKpiLogEntry) => void;
};

export type TimelineReplayInvoiceInput = ReplayInvoiceInput & {
    dueDate?: Date | null;
};

type TimelineInvoiceState = {
    invoiceNumber: string;
    netAmount: number;
    outstanding: number;
    limitAssessedAmount: number | null;
    capacityGapAmount: number;
    capacityGapAmountLimit: number;
    dueDate: Date | null;
    targetReportingDate: Date | null;
    ctvPaymentTerm: boolean;
    ctvCustomerOverdueMep: boolean;
    inCapacityGap: boolean;
};

export const GOLDEN_LOOP_DEFAULT_MAX_PAYMENT_TERM = 42;
export const GOLDEN_LOOP_DEFAULT_MAX_ALLOWED_MEP = 15;

function parseIsoCalendarDate(iso: string): Date {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
    const normalized = parseImportDateToLocalCalendarDate(date) ?? date;
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, "0");
    const day = String(normalized.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function calendarDayKey(date: Date): number {
    const normalized = parseImportDateToLocalCalendarDate(date) ?? date;
    return (
        normalized.getFullYear() * 10000 +
        (normalized.getMonth() + 1) * 100 +
        normalized.getDate()
    );
}

function enumerateCalendarDays(fromDate: string, toDate: string): string[] {
    const days: string[] = [];
    const cursor = parseIsoCalendarDate(fromDate);
    const end = parseIsoCalendarDate(toDate);

    while (cursor.getTime() <= end.getTime()) {
        days.push(toIsoDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    return days;
}

function sumOpenAr(invoices: Iterable<TimelineInvoiceState>): number {
    let total = 0;
    for (const invoice of Array.from(invoices)) {
        total += Math.max(0, invoice.outstanding);
    }
    return total;
}

function resolveOldestInvoiceOverdueDate(
    invoices: Iterable<TimelineInvoiceState>,
    asOf: Date
): Date | null {
    const asOfKey = calendarDayKey(asOf);
    let oldest: Date | null = null;

    for (const invoice of Array.from(invoices)) {
        if (invoice.outstanding <= 0 || !invoice.dueDate) {
            continue;
        }
        if (calendarDayKey(invoice.dueDate) >= asOfKey) {
            continue;
        }
        if (!oldest || calendarDayKey(invoice.dueDate) < calendarDayKey(oldest)) {
            oldest = invoice.dueDate;
        }
    }

    return oldest;
}

function isCustomerOverdueBlockAsOf(
    invoices: Iterable<TimelineInvoiceState>,
    asOf: Date,
    config: CustomerDailyKpiTimelineConfig
): boolean {
    return computeCustomerOverdueBlock({
        oldestInvoiceOverdueDate: resolveOldestInvoiceOverdueDate(invoices, asOf),
        maxAllowedMepDays:
            config.customerInsurance?.maxAllowedMep ??
            GOLDEN_LOOP_DEFAULT_MAX_ALLOWED_MEP,
        today: asOf,
    });
}

function syncStoredInvoiceCapacityGaps(
    invoices: Iterable<TimelineInvoiceState>,
    accountCurrency: string | null
): void {
    for (const invoice of Array.from(invoices)) {
        const isOpenWithPolicy =
            invoice.outstanding > 0 && invoice.limitAssessedAmount != null;
        const stored = computeStoredInvoiceCapacityGapFields({
            row: {
                outstanding_debt: invoice.outstanding,
                customer_outstanding_debt: invoice.outstanding,
                limit_assessed_amount: invoice.limitAssessedAmount,
                limit_assessed_currency: null,
            },
            accountCurrency,
            isOpenWithPolicy,
        });
        invoice.capacityGapAmount = stored.capacity_gap_amount;
        invoice.capacityGapAmountLimit = stored.capacity_gap_amount_limit;
        invoice.inCapacityGap = stored.capacity_gap_amount_limit > 0;
    }
}

function snapshotFromState(
    date: string,
    invoices: Map<string, TimelineInvoiceState>,
    asOf: Date,
    config: CustomerDailyKpiTimelineConfig,
    retainedCapacityGap: number
): { snapshot: DailyKpiSnapshot; retainedCapacityGap: number } {
    const openInvoices = Array.from(invoices.values()).filter(
        (invoice) => invoice.outstanding > 0
    );
    const kpi = computeCustomerKpiSnapshotFromInvoices({
        openInvoices: openInvoices.map((invoice) => ({
            outstanding: invoice.outstanding,
            limitAssessedAmount: invoice.limitAssessedAmount,
            capacityGapAmount: invoice.capacityGapAmount,
            capacityGapAmountLimit: invoice.capacityGapAmountLimit,
            inCapacityGap: invoice.inCapacityGap,
            targetReportingDate: invoice.targetReportingDate,
            ctvPaymentTerm: invoice.ctvPaymentTerm,
            ctvCustomerOverdueMep: invoice.ctvCustomerOverdueMep,
        })),
        approvedLimit: config.approvedLimit,
        asOf,
        retainedCapacityGap,
    });

    return {
        snapshot: {
            date,
            totalAr: Math.round(kpi.totalAr),
            termBreach: Math.round(kpi.termBreach),
            capacity: Math.round(kpi.capacity),
            notInsured: Math.round(kpi.notInsured),
            healthIndex: Math.round(kpi.healthIndex * 100) / 100,
        },
        retainedCapacityGap: kpi.retainedCapacityGap,
    };
}

function openArForLimitStamp(
    invoiceState: Map<string, TimelineInvoiceState>,
    invoiceDate: Date,
    events: ReplayEvent[],
    currentEventIndex: number
): number {
    let openAr = sumOpenAr(invoiceState.values());
    const invoiceDayKey = calendarDayKey(invoiceDate);

    for (let index = currentEventIndex + 1; index < events.length; index++) {
        const event = events[index]!;
        if (calendarDayKey(event.date) !== invoiceDayKey) {
            break;
        }
        if (event.type !== "payment_apply") {
            continue;
        }

        const invoice = invoiceState.get(event.payload.invoiceNumber);
        if (!invoice) {
            continue;
        }

        openAr -= Math.min(
            Math.max(0, invoice.outstanding),
            Math.max(0, event.payload.amount)
        );
    }

    return Math.max(0, openAr);
}

function applyInvoiceOpen(
    invoiceState: Map<string, TimelineInvoiceState>,
    payload: TimelineReplayInvoiceInput,
    config: CustomerDailyKpiTimelineConfig,
    events: ReplayEvent[],
    eventIndex: number
): void {
    const invoiceDate =
        parseImportDateToLocalCalendarDate(payload.invoiceDate) ??
        payload.invoiceDate;
    const openArBefore = openArForLimitStamp(
        invoiceState,
        invoiceDate,
        events,
        eventIndex
    );
    const outstanding = Math.max(0, payload.netAmount);
    const limitAssessedAmount = computeLimitAssessedAmountForNewOpenInvoice({
        approvedLimit: config.approvedLimit,
        topUpTotal: config.topUpTotal ?? 0,
        openArOnPolicyBeforeInvoice: openArBefore,
        newInvoiceOutstanding: outstanding,
    });

    const dueDate =
        payload.dueDate != null
            ? parseImportDateToLocalCalendarDate(payload.dueDate) ?? payload.dueDate
            : null;
    const overdueBlockAtOpen = isCustomerOverdueBlockAsOf(
        invoiceState.values(),
        invoiceDate,
        config
    );

    const insurance = computeInvoiceInsuranceRowData({
        status: "Due",
        invoice_date: invoiceDate,
        due_date: dueDate,
        customer: {
            reporting_days:
                config.customerInsurance?.reportingDays ?? null,
            max_allowed_mep:
                config.customerInsurance?.maxAllowedMep ??
                GOLDEN_LOOP_DEFAULT_MAX_ALLOWED_MEP,
            max_payment_term:
                config.customerInsurance?.maxPaymentTerm ??
                GOLDEN_LOOP_DEFAULT_MAX_PAYMENT_TERM,
        },
        today: invoiceDate,
    });

    invoiceState.set(payload.invoiceNumber, {
        invoiceNumber: payload.invoiceNumber,
        netAmount: payload.netAmount,
        outstanding,
        limitAssessedAmount,
        capacityGapAmount: 0,
        capacityGapAmountLimit: 0,
        dueDate,
        targetReportingDate: insurance.target_reporting_date,
        ctvPaymentTerm: insurance.ctv_payment_term,
        ctvCustomerOverdueMep:
            computeCreatedTermsViolationCustomerOverdueMep(overdueBlockAtOpen),
        inCapacityGap: false,
    });
}

function applyPaymentApply(
    invoiceState: Map<string, TimelineInvoiceState>,
    payload: ReplayPaymentInput,
    config: CustomerDailyKpiTimelineConfig
): void {
    const invoice = invoiceState.get(payload.invoiceNumber);
    if (!invoice) {
        return;
    }

    invoice.outstanding = Math.max(0, invoice.outstanding - payload.amount);
    syncStoredInvoiceCapacityGaps(
        invoiceState.values(),
        config.accountCurrency ?? null
    );
}

function applyReplayEvent(
    event: ReplayEvent,
    invoiceState: Map<string, TimelineInvoiceState>,
    config: CustomerDailyKpiTimelineConfig,
    events: ReplayEvent[],
    eventIndex: number
): void {
    if (event.type === "invoice_open") {
        applyInvoiceOpen(
            invoiceState,
            event.payload as TimelineReplayInvoiceInput,
            config,
            events,
            eventIndex
        );
        syncStoredInvoiceCapacityGaps(
            invoiceState.values(),
            config.accountCurrency ?? null
        );
        return;
    }

    applyPaymentApply(invoiceState, event.payload, config);
}

function emitEventKpiLog(
    input: CustomerDailyKpiTimelineInput,
    expectedByDate: Map<string, GoldenExpectedKpiRow> | undefined,
    eventIndex: number,
    event: ReplayEvent,
    day: string,
    snapshot: DailyKpiSnapshot
): void {
    if (!input.onAfterEvent) {
        return;
    }

    const invoiceNumber =
        event.type === "invoice_open"
            ? event.payload.invoiceNumber
            : event.payload.invoiceNumber;
    const amount =
        event.type === "invoice_open"
            ? event.payload.netAmount
            : event.payload.amount;

    input.onAfterEvent(
        buildGoldenEventKpiLogEntry({
            eventIndex,
            eventType: event.type,
            date: day,
            invoiceNumber,
            amount,
            actual: snapshot,
            expectedByDate: expectedByDate ?? new Map(),
        })
    );
}

export function computeCustomerDailyKpiTimeline(
    input: CustomerDailyKpiTimelineInput
): CustomerDailyKpiTimeline {
    const events = buildReplayEvents(input.invoices, input.payments);
    const invoiceState = new Map<string, TimelineInvoiceState>();
    const days = enumerateCalendarDays(input.fromDate, input.toDate);
    const snapshots: DailyKpiSnapshot[] = [];
    const expectedByDate = input.expectedKpiRows
        ? indexExpectedKpiRowsByDate(input.expectedKpiRows)
        : undefined;

    let eventIndex = 0;
    let retainedCapacityGap = 0;
    for (const day of days) {
        const dayKey = calendarDayKey(parseIsoCalendarDate(day));
        while (eventIndex < events.length) {
            const event = events[eventIndex]!;
            if (calendarDayKey(event.date) > dayKey) {
                break;
            }
            applyReplayEvent(event, invoiceState, input.config, events, eventIndex);

            if (input.onAfterEvent) {
                const afterEvent = snapshotFromState(
                    day,
                    invoiceState,
                    parseIsoCalendarDate(day),
                    input.config,
                    retainedCapacityGap
                );
                emitEventKpiLog(
                    input,
                    expectedByDate,
                    eventIndex,
                    event,
                    day,
                    afterEvent.snapshot
                );
            }

            eventIndex += 1;
        }

        const endOfDay = snapshotFromState(
            day,
            invoiceState,
            parseIsoCalendarDate(day),
            input.config,
            retainedCapacityGap
        );
        retainedCapacityGap = endOfDay.retainedCapacityGap;
        snapshots.push(endOfDay.snapshot);
    }

    return {
        accountId: input.accountId,
        customerId: input.customerId,
        snapshots,
    };
}

export function goldenImportRowsToReplayInputs(
    invoices: GoldenInvoiceImportRow[],
    payments: GoldenPaymentImportRow[]
): {
    invoices: TimelineReplayInvoiceInput[];
    payments: ReplayPaymentInput[];
} {
    return {
        invoices: invoices.map((row) => ({
            invoiceNumber: row.invoice_number,
            invoiceDate: parseIsoCalendarDate(row.invoice_date),
            dueDate: row.due_date
                ? parseIsoCalendarDate(row.due_date)
                : undefined,
            netAmount: row.amount,
            customerNetAmount: row.customer_amount,
        })),
        payments: payments.map((row, index) => ({
            id: index + 1,
            invoiceNumber: row.invoice_number,
            paymentDate: parseIsoCalendarDate(row.payment_date),
            amount: row.amount ?? row.customer_amount,
            customerAmount: row.customer_amount,
        })),
    };
}

export async function computeCustomerDailyKpiTimelineFromDb(
    params: {
        accountId: number;
        customerId: number;
        fromDate: string;
        toDate: string;
        approvedLimit?: number;
        topUpTotal?: number;
        customerInsurance?: TimelineCustomerInsurance;
    }
): Promise<CustomerDailyKpiTimeline> {
    const { prisma } = await import("@/lib/prisma");
    const { loadEffectiveInsuranceForCustomers } = await import(
        "@/server/services/creditInsurance/loadEffectiveInsuranceForCustomers"
    );

    const [dbInvoices, dbPayments, insurance, effectiveInsurance, account] =
        await Promise.all([
        prisma.invoice.findMany({
            where: { customer_id: params.customerId },
            select: {
                invoice_number: true,
                invoice_date: true,
                due_date: true,
                net_amount: true,
                customer_net_amount: true,
            },
        }),
        prisma.invoicePayment.findMany({
            where: { customer_id: params.customerId },
            select: {
                id: true,
                invoice_number: true,
                payment_date: true,
                amount: true,
                customer_amount: true,
            },
        }),
        prisma.customerPolicy.findFirst({
            where: {
                customer_id: params.customerId,
                is_active: true,
            },
            select: { approved_limit: true },
            orderBy: { id: "desc" },
        }),
        loadEffectiveInsuranceForCustomers([params.customerId]),
        prisma.account.findUnique({
            where: { id: params.accountId },
            select: { currency: true },
        }),
    ]);

    const customerInsurance = effectiveInsurance.get(params.customerId);

    const replayInputs = goldenImportRowsToReplayInputs(
        dbInvoices
            .filter((inv) => inv.invoice_number && inv.invoice_date)
            .map((inv) => ({
                customer_number: String(params.customerId),
                invoice_number: inv.invoice_number!,
                invoice_date: toIsoDate(inv.invoice_date!),
                due_date: inv.due_date ? toIsoDate(inv.due_date) : undefined,
                amount: inv.net_amount ?? 0,
                customer_amount: inv.customer_net_amount ?? 0,
                customer_currency: "ILS",
            })),
        dbPayments
            .filter((payment) => payment.invoice_number)
            .map((payment) => ({
                customer_number: String(params.customerId),
                invoice_number: payment.invoice_number!,
                payment_date: toIsoDate(payment.payment_date),
                customer_amount: payment.customer_amount,
                customer_currency: "ILS",
                reference: String(payment.id),
                amount: payment.amount,
            }))
    );

    return computeCustomerDailyKpiTimeline({
        accountId: params.accountId,
        customerId: params.customerId,
        fromDate: params.fromDate,
        toDate: params.toDate,
        invoices: replayInputs.invoices,
        payments: replayInputs.payments,
        config: {
            approvedLimit:
                params.approvedLimit ??
                (insurance?.approved_limit != null
                    ? Number(insurance.approved_limit)
                    : 0),
            topUpTotal: params.topUpTotal,
            accountCurrency: account?.currency ?? null,
            customerInsurance: {
                maxPaymentTerm: customerInsurance?.max_payment_term,
                reportingDays: customerInsurance?.reporting_days,
                maxAllowedMep: customerInsurance?.max_allowed_mep,
                ...params.customerInsurance,
            },
        },
    });
}
