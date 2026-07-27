/**
 * Dashboard payment drill-down filter contract.
 *
 * Maps chart-details URL params to locked report additionalFilters for
 * collected-mtd (and legacy alias collected-vs-promise).
 */

import type { Filter } from "@/server/services/ReportExecutionService.types";

export const DASHBOARD_PAYMENTS_CONTEXT = "dashboard_payments";

export const DASHBOARD_PAYMENT_CHART_TYPES = [
    "collected-mtd",
    "collected-vs-promise",
] as const;

export type DashboardPaymentChartType =
    (typeof DASHBOARD_PAYMENT_CHART_TYPES)[number];

export type DashboardPaymentChartFamily = "collected_mtd";

export const DASHBOARD_PAYMENT_SYSTEM_REPORT_UNIQUE_NAMES = {
    collected_mtd: "dashboard_payments_collected_mtd",
} as const;

export interface DashboardPaymentChartFilterInput {
    type: string;
    period?: string | null;
    now?: Date;
}

export interface DashboardPaymentChartFilterResult {
    isPaymentShaped: boolean;
    family: DashboardPaymentChartFamily | null;
    systemReportUniqueName: string | null;
    additionalFilters: Filter[];
    isPaymentList: boolean;
}

function filter(
    table: string,
    field: string,
    operator: string,
    value: unknown
): Filter {
    return { table, field, operator, value };
}

export function isDashboardPaymentChartType(
    type: string
): type is DashboardPaymentChartType {
    return (DASHBOARD_PAYMENT_CHART_TYPES as readonly string[]).includes(type);
}

export function getDashboardPaymentChartFamily(
    type: string
): DashboardPaymentChartFamily | null {
    if (isDashboardPaymentChartType(type)) {
        return "collected_mtd";
    }
    return null;
}

export function getDashboardPaymentSystemReportUniqueName(
    type: string
): string | null {
    const family = getDashboardPaymentChartFamily(type);
    if (!family) return null;
    return DASHBOARD_PAYMENT_SYSTEM_REPORT_UNIQUE_NAMES[family];
}

/**
 * Period month window for collected MTD (no future-year adjustment — matches card).
 */
export function collectedMtdPeriodDateRange(
    period: string | null | undefined
): { start: Date; end: Date; startYmd: string; endYmd: string } | null {
    if (!period || !/^\d{4}-\d{2}/.test(period)) {
        return null;
    }
    const [yearStr, monthStr] = period.split("-");
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;
    if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
        return null;
    }
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const toYmd = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };
    return {
        start,
        end,
        startYmd: toYmd(start),
        endYmd: toYmd(end),
    };
}

/**
 * Build locked additionalFilters for payment-shaped financial chart-details types.
 * Membership: payment_date in period month + invoice_id not null (linked).
 * Owner/BU are intentionally omitted (card parity).
 */
export function buildDashboardPaymentChartFilters(
    input: DashboardPaymentChartFilterInput
): DashboardPaymentChartFilterResult {
    const family = getDashboardPaymentChartFamily(input.type);

    if (!family || !isDashboardPaymentChartType(input.type)) {
        return {
            isPaymentShaped: false,
            family: null,
            systemReportUniqueName: null,
            additionalFilters: [],
            isPaymentList: false,
        };
    }

    const systemReportUniqueName =
        DASHBOARD_PAYMENT_SYSTEM_REPORT_UNIQUE_NAMES[family];
    const range = collectedMtdPeriodDateRange(input.period);

    if (!range) {
        return {
            isPaymentShaped: true,
            family,
            systemReportUniqueName,
            additionalFilters: [],
            isPaymentList: false,
        };
    }

    return {
        isPaymentShaped: true,
        family,
        systemReportUniqueName,
        additionalFilters: [
            filter("InvoicePayment", "payment_date", "between", [
                range.startYmd,
                range.endYmd,
            ]),
            filter("InvoicePayment", "invoice_id", "is_not_empty", true),
        ],
        isPaymentList: true,
    };
}

export function shouldUseDashboardPaymentReportList(
    input: DashboardPaymentChartFilterInput
): boolean {
    const result = buildDashboardPaymentChartFilters(input);
    return result.isPaymentShaped && result.isPaymentList;
}
