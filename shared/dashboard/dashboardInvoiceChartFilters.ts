/**
 * Dashboard invoice drill-down filter contract.
 *
 * Maps chart-details URL params to locked report additionalFilters so report
 * execute and (later) metric summaries share exact KPI membership rules with
 * legacy handleDashboardChartDetails / dashboardService helpers.
 *
 * Owner scope and URL businessUnitId are applied server-side on execute for
 * dashboard_invoices — they are intentionally not part of this client-safe filter set.
 */

import type { Filter } from "@/types/reports";

export const DASHBOARD_INVOICES_CONTEXT = "dashboard_invoices";

export const DASHBOARD_INVOICE_CHART_TYPES = [
    "overdue-invoices",
    "aging-portfolio",
    "total-due",
    "due-today",
    "due-this-week",
    "due-this-month",
    "due-next-month",
    "receivables-maturity-schedule",
] as const;

export type DashboardInvoiceChartType =
    (typeof DASHBOARD_INVOICE_CHART_TYPES)[number];

export type DashboardInvoiceChartFamily =
    | "overdue"
    | "aging"
    | "due"
    | "maturity";

/** Family-specific system reports so each KPI opens with the same columns as the old fixed lists. */
export const DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES = {
    overdue: "dashboard_invoices_overdue",
    aging: "dashboard_invoices_aging",
    due: "dashboard_invoices_due",
    maturity: "dashboard_invoices_maturity",
} as const;

/** @deprecated Prefer DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES by family. */
export const DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAME =
    DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES.overdue;

/** Unpaid statuses equivalent to Prisma `status: { notIn: ["Paid", "Void", "Cancelled"] }`. */
export const DASHBOARD_OVERDUE_INVOICE_STATUSES = [
    "Open",
    "Overdue",
    "Partially_Paid",
    "Under_Dispute",
    "Due",
    "Draft",
    "Sent",
    "Viewed",
] as const;

export const AGING_DAYS_RANGE_MAP: Record<
    string,
    { min: number; max: number }
> = {
    "0_7": { min: 0, max: 7 },
    "8_30": { min: 8, max: 30 },
    "31_60": { min: 31, max: 60 },
    "61_90": { min: 61, max: 90 },
    "91_180": { min: 91, max: 180 },
    "181_365": { min: 181, max: 365 },
    "365_2000": { min: 366, max: 9999 },
};

/** Maturity bucket labels from dashboardService.getInvoicesByMaturityRange. */
export const MATURITY_DAYS_RANGE_MAP: Record<
    string,
    { min: number; max: number }
> = {
    "0-7 days": { min: 0, max: 7 },
    "8-30 days": { min: 8, max: 30 },
    "31-60 days": { min: 31, max: 60 },
    "61-90 days": { min: 61, max: 90 },
    "91-180 days": { min: 91, max: 180 },
    "181-365 days": { min: 181, max: 365 },
    "365 days+": { min: 366, max: 9999 },
};

export interface DashboardInvoiceChartFilterInput {
    type: string;
    daysRange?: string | null;
    viewMode?: "child" | "parent" | string | null;
    /** Optional clock for deterministic unit tests (local calendar day). */
    now?: Date;
}

export interface DashboardInvoiceChartFilterResult {
    isInvoiceShaped: boolean;
    family: DashboardInvoiceChartFamily | null;
    systemReportUniqueName: string | null;
    /** Locked filters AND-merged with the selected report config. */
    additionalFilters: Filter[];
    /**
     * Maturity overview without daysRange returns bucket summary rows today —
     * not an invoice list. Invoice-level conversion requires a bucket.
     */
    isInvoiceList: boolean;
    /**
     * Parent view for maturity uses a special parent→child customer path that
     * is not expressible as flat Invoice filters. Child mode is filter-only;
     * parent remains deferred to the legacy path until a later slice.
     */
    parentViewModeRequiresSpecialHandling: boolean;
}

function filter(
    table: string,
    field: string,
    operator: string,
    value: unknown
): Filter {
    return { table, field, operator, value };
}

function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(date.getDate() + days);
    return next;
}

function lastDayOfMonth(year: number, monthIndex: number): Date {
    return new Date(year, monthIndex + 1, 0);
}

export function isDashboardInvoiceChartType(
    type: string
): type is DashboardInvoiceChartType {
    return (DASHBOARD_INVOICE_CHART_TYPES as readonly string[]).includes(type);
}

export function getDashboardInvoiceChartFamily(
    type: string
): DashboardInvoiceChartFamily | null {
    switch (type) {
        case "overdue-invoices":
            return "overdue";
        case "aging-portfolio":
            return "aging";
        case "total-due":
        case "due-today":
        case "due-this-week":
        case "due-this-month":
        case "due-next-month":
            return "due";
        case "receivables-maturity-schedule":
            return "maturity";
        default:
            return null;
    }
}

export function getDashboardInvoiceSystemReportUniqueName(
    type: string
): string | null {
    const family = getDashboardInvoiceChartFamily(type);
    if (!family) return null;
    return DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES[family];
}

export function normalizeMaturityDaysRange(
    daysRange: string | null | undefined
): string | null {
    if (!daysRange) return null;
    // URL may encode spaces as +. Preserve a trailing "+" (e.g. "365 days+").
    return daysRange.replace(/\+(?!$)/g, " ").trim();
}

function overdueBaseFilters(): Filter[] {
    return [
        filter(
            "Invoice",
            "status",
            "in",
            [...DASHBOARD_OVERDUE_INVOICE_STATUSES]
        ),
        filter("Customer", "collection_status", "equals", "Active"),
        filter("Invoice", "due_date", "less_than", {
            __datePreset: "today",
        }),
    ];
}

function dueBaseFilters(): Filter[] {
    // Legacy uses OR(outstanding_debt > 0, customer_outstanding_debt > 0).
    // Report filters are AND-only; customer_outstanding_debt matches the
    // unpaid-invoices system reports and covers the common case.
    return [
        filter("Invoice", "status", "equals", "Due"),
        filter("Customer", "collection_status", "in", ["Active", "Inactive"]),
        filter("Invoice", "customer_outstanding_debt", "greater_than", 0),
    ];
}

function agingBucketDueDateFilters(
    daysRange: string,
    today: Date
): Filter[] {
    const range = AGING_DAYS_RANGE_MAP[daysRange];
    if (!range) return [];

    const start = addDays(today, -range.max);
    const end = addDays(today, -range.min);
    return [
        filter("Invoice", "due_date", "between", [toYmd(start), toYmd(end)]),
    ];
}

function maturityBucketDueDateFilters(
    daysRange: string,
    today: Date
): Filter[] {
    const normalized = normalizeMaturityDaysRange(daysRange);
    if (!normalized) return [];
    const range = MATURITY_DAYS_RANGE_MAP[normalized];
    if (!range) return [];

    const start = addDays(today, range.min);
    const end = addDays(today, range.max);
    return [
        filter("Invoice", "due_date", "between", [toYmd(start), toYmd(end)]),
    ];
}

function dueWindowFilters(type: DashboardInvoiceChartType, today: Date): Filter[] {
    switch (type) {
        case "total-due":
            return [];
        case "due-today": {
            const ymd = toYmd(today);
            return [filter("Invoice", "due_date", "between", [ymd, ymd])];
        }
        case "due-this-week": {
            // Legacy: gte today, lt endOfWeek (Sunday week start + 7 days).
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const lastInclusive = addDays(weekStart, 6);
            return [
                filter("Invoice", "due_date", "between", [
                    toYmd(today),
                    toYmd(lastInclusive),
                ]),
            ];
        }
        case "due-this-month": {
            const end = lastDayOfMonth(today.getFullYear(), today.getMonth());
            return [
                filter("Invoice", "due_date", "between", [
                    toYmd(today),
                    toYmd(end),
                ]),
            ];
        }
        case "due-next-month": {
            const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const end = lastDayOfMonth(
                today.getFullYear(),
                today.getMonth() + 1
            );
            return [
                filter("Invoice", "due_date", "between", [
                    toYmd(start),
                    toYmd(end),
                ]),
            ];
        }
        default:
            return [];
    }
}

/**
 * Build locked additionalFilters for an invoice-shaped financial chart-details type.
 */
export function buildDashboardInvoiceChartFilters(
    input: DashboardInvoiceChartFilterInput
): DashboardInvoiceChartFilterResult {
    const type = input.type;
    const family = getDashboardInvoiceChartFamily(type);
    const today = startOfLocalDay(input.now ?? new Date());
    const viewMode =
        input.viewMode === "parent" || input.viewMode === "child"
            ? input.viewMode
            : "child";

    if (!family || !isDashboardInvoiceChartType(type)) {
        return {
            isInvoiceShaped: false,
            family: null,
            systemReportUniqueName: null,
            additionalFilters: [],
            isInvoiceList: false,
            parentViewModeRequiresSpecialHandling: false,
        };
    }

    const systemReportUniqueName =
        DASHBOARD_INVOICE_SYSTEM_REPORT_UNIQUE_NAMES[family];

    if (family === "overdue") {
        return {
            isInvoiceShaped: true,
            family,
            systemReportUniqueName,
            additionalFilters: overdueBaseFilters(),
            isInvoiceList: true,
            parentViewModeRequiresSpecialHandling: false,
        };
    }

    if (family === "aging") {
        const daysRange =
            typeof input.daysRange === "string" ? input.daysRange : null;
        const bucketFilters = daysRange
            ? agingBucketDueDateFilters(daysRange, today)
            : [];
        return {
            isInvoiceShaped: true,
            family,
            systemReportUniqueName,
            // When a bucket is present, due_date between alone encodes the window
            // (QueryBuilder overwrites repeated field filters — do not also emit less_than).
            additionalFilters: [
                filter(
                    "Invoice",
                    "status",
                    "in",
                    [...DASHBOARD_OVERDUE_INVOICE_STATUSES]
                ),
                filter("Customer", "collection_status", "equals", "Active"),
                ...(bucketFilters.length > 0
                    ? bucketFilters
                    : [
                          filter("Invoice", "due_date", "less_than", {
                              __datePreset: "today",
                          }),
                      ]),
            ],
            isInvoiceList: true,
            parentViewModeRequiresSpecialHandling: false,
        };
    }

    if (family === "due") {
        return {
            isInvoiceShaped: true,
            family,
            systemReportUniqueName,
            additionalFilters: [
                ...dueBaseFilters(),
                ...dueWindowFilters(type, today),
            ],
            isInvoiceList: true,
            parentViewModeRequiresSpecialHandling: false,
        };
    }

    // maturity
    const maturityDaysRange = normalizeMaturityDaysRange(input.daysRange);
    const hasBucket =
        !!maturityDaysRange && !!MATURITY_DAYS_RANGE_MAP[maturityDaysRange];
    const parentViewModeRequiresSpecialHandling = viewMode === "parent";

    if (!hasBucket) {
        return {
            isInvoiceShaped: true,
            family,
            systemReportUniqueName,
            additionalFilters: [],
            isInvoiceList: false,
            parentViewModeRequiresSpecialHandling,
        };
    }

    return {
        isInvoiceShaped: true,
        family,
        systemReportUniqueName,
        additionalFilters: [
            ...dueBaseFilters(),
            // Bucket between already encodes future due_date window (do not also
            // emit gte today — QueryBuilder overwrites repeated due_date filters).
            ...maturityBucketDueDateFilters(maturityDaysRange!, today),
        ],
        isInvoiceList: true,
        parentViewModeRequiresSpecialHandling,
    };
}

/** Whether chart-details should render ViewBasedDataGrid for this drill. */
export function shouldUseDashboardInvoiceReportList(
    input: DashboardInvoiceChartFilterInput
): boolean {
    const result = buildDashboardInvoiceChartFilters(input);
    return (
        result.isInvoiceShaped &&
        result.isInvoiceList &&
        !result.parentViewModeRequiresSpecialHandling
    );
}
