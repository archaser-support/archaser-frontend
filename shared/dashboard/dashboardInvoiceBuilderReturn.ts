/**
 * Helpers for opening the report builder from chart-details and returning after save.
 * Preserves drill URL params (type, period, daysRange, businessUnitId, viewMode).
 */

import AppUrls from "@/utils/appUrls";

export {
    DASHBOARD_INVOICES_CONTEXT,
    DASHBOARD_CUSTOMERS_CONTEXT,
    DASHBOARD_PAYMENTS_CONTEXT,
    DASHBOARD_REPORT_CONTEXTS,
    FINANCIAL_DASHBOARD_REPORT_CONTEXTS,
    isDashboardReportContext,
    isFinancialDashboardReportContext,
} from "./dashboardInvoiceReportAccess";

import {
    DASHBOARD_CUSTOMERS_CONTEXT,
    DASHBOARD_INVOICES_CONTEXT,
    DASHBOARD_PAYMENTS_CONTEXT,
    FINANCIAL_DASHBOARD_REPORT_CONTEXTS,
    isFinancialDashboardReportContext,
} from "./dashboardInvoiceReportAccess";

/** Query keys forwarded between chart-details and the report builder. */
export const DASHBOARD_CHART_DETAILS_RETURN_PARAM_KEYS = [
    "type",
    "period",
    "daysRange",
    "businessUnitId",
    "viewMode",
] as const;

export type DashboardChartDetailsReturnParamKey =
    (typeof DASHBOARD_CHART_DETAILS_RETURN_PARAM_KEYS)[number];

type SearchParamsLike = {
    get(name: string): string | null | undefined;
};

function currentPeriodYyyyMm(now = new Date()): string {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

type FinancialDashboardReportContext =
    (typeof FINANCIAL_DASHBOARD_REPORT_CONTEXTS)[number];

const DEFAULT_CHART_TYPE_BY_CONTEXT: Record<
    FinancialDashboardReportContext,
    string
> = {
    [DASHBOARD_INVOICES_CONTEXT]: "overdue-invoices",
    [DASHBOARD_CUSTOMERS_CONTEXT]: "overdue-customers",
    [DASHBOARD_PAYMENTS_CONTEXT]: "collected-mtd",
};

/**
 * Copy chart-details drill params onto a builder (or return) query string.
 */
export function appendDashboardChartDetailsReturnParams(
    target: URLSearchParams,
    source: SearchParamsLike
): void {
    for (const key of DASHBOARD_CHART_DETAILS_RETURN_PARAM_KEYS) {
        const value = source.get(key);
        if (value != null && value !== "") {
            target.set(key, value);
        }
    }
}

/**
 * Build chart-details URL after create/edit of a dashboard report.
 * Falls back to a context-appropriate type + current month when type/period missing.
 */
export function buildDashboardChartDetailsReturnPath(
    locale: string,
    source: SearchParamsLike,
    reportId: number,
    context: string | null | undefined = DASHBOARD_INVOICES_CONTEXT,
    now = new Date()
): string {
    const query = new URLSearchParams();
    appendDashboardChartDetailsReturnParams(query, source);

    if (!query.get("type")) {
        const defaultType =
            (isFinancialDashboardReportContext(context)
                ? DEFAULT_CHART_TYPE_BY_CONTEXT[
                      context as FinancialDashboardReportContext
                  ]
                : null) || "overdue-invoices";
        query.set("type", defaultType);
    }
    if (!query.get("period")) {
        query.set("period", currentPeriodYyyyMm(now));
    }
    query.set("reportId", String(reportId));

    return `/${locale}${AppUrls.DASHBOARD_CHART_DETAILS}?${query.toString()}`;
}

/**
 * @deprecated Prefer buildDashboardChartDetailsReturnPath with context.
 */
export function buildDashboardInvoiceChartDetailsReturnPath(
    locale: string,
    source: SearchParamsLike,
    reportId: number,
    now = new Date()
): string {
    return buildDashboardChartDetailsReturnPath(
        locale,
        source,
        reportId,
        DASHBOARD_INVOICES_CONTEXT,
        now
    );
}

export function isDashboardInvoicesReportContext(
    context: string | null | undefined
): boolean {
    return context === DASHBOARD_INVOICES_CONTEXT;
}

/** Any financial-dashboard report context that returns to chart-details. */
export function isDashboardChartDetailsReportContext(
    context: string | null | undefined
): boolean {
    return isFinancialDashboardReportContext(context);
}
