/**
 * Helpers for opening the report builder from operation-dashboard details
 * and returning after save. Preserves drill URL params.
 */

import AppUrls from "@/utils/appUrls";

import {
    DASHBOARD_ACTIVITIES_CONTEXT,
    DASHBOARD_DISPUTES_CONTEXT,
    DASHBOARD_PROMISES_CONTEXT,
    isOperationDashboardReportContext,
} from "./dashboardInvoiceReportAccess";

export {
    DASHBOARD_ACTIVITIES_CONTEXT,
    DASHBOARD_DISPUTES_CONTEXT,
    DASHBOARD_PROMISES_CONTEXT,
    isOperationDashboardReportContext,
};

/** Query keys forwarded between operation details and the report builder. */
export const OPERATION_DASHBOARD_DETAILS_RETURN_PARAM_KEYS = [
    "type",
    "startDate",
    "endDate",
    "selectedUserId",
    "businessUnitId",
] as const;

export type OperationDashboardDetailsReturnParamKey =
    (typeof OPERATION_DASHBOARD_DETAILS_RETURN_PARAM_KEYS)[number];

type SearchParamsLike = {
    get(name: string): string | null | undefined;
};

const DEFAULT_DRILL_TYPE_BY_CONTEXT: Record<string, string> = {
    [DASHBOARD_ACTIVITIES_CONTEXT]: "manual-activities",
    [DASHBOARD_DISPUTES_CONTEXT]: "disputes-created",
    [DASHBOARD_PROMISES_CONTEXT]: "promises-to-pay",
};

/**
 * Copy operation-dashboard details drill params onto a builder (or return) query string.
 */
export function appendOperationDashboardDetailsReturnParams(
    target: URLSearchParams,
    source: SearchParamsLike
): void {
    for (const key of OPERATION_DASHBOARD_DETAILS_RETURN_PARAM_KEYS) {
        const value = source.get(key);
        if (value != null && value !== "") {
            target.set(key, value);
        }
    }
}

/**
 * Build operation-dashboard details URL after create/edit of an operation report.
 * Falls back to a context-appropriate type when missing.
 */
export function buildOperationDashboardDetailsReturnPath(
    locale: string,
    source: SearchParamsLike,
    reportId: number,
    context: string | null | undefined = DASHBOARD_ACTIVITIES_CONTEXT
): string {
    const query = new URLSearchParams();
    appendOperationDashboardDetailsReturnParams(query, source);

    if (!query.get("type")) {
        query.set(
            "type",
            (context && DEFAULT_DRILL_TYPE_BY_CONTEXT[context]) ||
                "manual-activities"
        );
    }
    query.set("reportId", String(reportId));

    return `/${locale}${AppUrls.OPERATION_DASHBOARD_DETAILS}?${query.toString()}`;
}

/** Operation-dashboard report contexts that return to details after builder save. */
export function isOperationDashboardDetailsReportContext(
    context: string | null | undefined
): boolean {
    return isOperationDashboardReportContext(context);
}
