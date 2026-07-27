/**
 * Permission helpers for dashboard report contexts.
 * Execute/list/default allowed with the matching dashboard permission OR view_reports.
 */

import { DASHBOARD_ACTIVITIES_CONTEXT } from "./dashboardActivityChartFilters";
import { DASHBOARD_DISPUTES_CONTEXT } from "./dashboardDisputeChartFilters";
import { DASHBOARD_PROMISES_CONTEXT } from "./dashboardPromiseChartFilters";
import { DASHBOARD_INVOICES_CONTEXT } from "./dashboardInvoiceChartFilters";
import { DASHBOARD_CUSTOMERS_CONTEXT } from "./dashboardCustomerChartFilters";
import { DASHBOARD_PAYMENTS_CONTEXT } from "./dashboardPaymentChartFilters";
import {
    DASHBOARD_CREDIT_CUSTOMERS_CONTEXT,
    DASHBOARD_CREDIT_INVOICES_CONTEXT,
} from "./creditDashboardReportFilters";

export {
    DASHBOARD_ACTIVITIES_CONTEXT,
    DASHBOARD_DISPUTES_CONTEXT,
    DASHBOARD_PROMISES_CONTEXT,
    DASHBOARD_INVOICES_CONTEXT,
    DASHBOARD_CUSTOMERS_CONTEXT,
    DASHBOARD_PAYMENTS_CONTEXT,
    DASHBOARD_CREDIT_CUSTOMERS_CONTEXT,
    DASHBOARD_CREDIT_INVOICES_CONTEXT,
};

/** Contexts that financial-dashboard users may execute/list without view_reports. */
export const FINANCIAL_DASHBOARD_REPORT_CONTEXTS = [
    DASHBOARD_INVOICES_CONTEXT,
    DASHBOARD_CUSTOMERS_CONTEXT,
    DASHBOARD_PAYMENTS_CONTEXT,
] as const;

/** Contexts that operation-dashboard users may execute/list without view_reports. */
export const OPERATION_DASHBOARD_REPORT_CONTEXTS = [
    DASHBOARD_ACTIVITIES_CONTEXT,
    DASHBOARD_DISPUTES_CONTEXT,
    DASHBOARD_PROMISES_CONTEXT,
] as const;

/** Contexts that credit-dashboard users may execute/list without view_reports. */
export const CREDIT_DASHBOARD_REPORT_CONTEXTS = [
    DASHBOARD_CREDIT_CUSTOMERS_CONTEXT,
    DASHBOARD_CREDIT_INVOICES_CONTEXT,
] as const;

/** All dashboard report contexts with a permission exception. */
export const DASHBOARD_REPORT_CONTEXTS = [
    ...FINANCIAL_DASHBOARD_REPORT_CONTEXTS,
    ...OPERATION_DASHBOARD_REPORT_CONTEXTS,
    ...CREDIT_DASHBOARD_REPORT_CONTEXTS,
] as const;

export type DashboardReportContext = (typeof DASHBOARD_REPORT_CONTEXTS)[number];

export interface DashboardReportPermissionFlags {
    canViewReports: boolean;
    canViewFinancialDashboard?: boolean;
    canViewOperationDashboard?: boolean;
    canViewCreditDashboard?: boolean;
}

/** @deprecated Use DashboardReportPermissionFlags */
export type DashboardInvoiceReportPermissionFlags =
    DashboardReportPermissionFlags;

export function isFinancialDashboardReportContext(
    context: string | null | undefined
): boolean {
    return (
        !!context &&
        (FINANCIAL_DASHBOARD_REPORT_CONTEXTS as readonly string[]).includes(
            context
        )
    );
}

export function isOperationDashboardReportContext(
    context: string | null | undefined
): boolean {
    return (
        !!context &&
        (OPERATION_DASHBOARD_REPORT_CONTEXTS as readonly string[]).includes(
            context
        )
    );
}

export function isCreditDashboardReportContext(
    context: string | null | undefined
): boolean {
    return (
        !!context &&
        (CREDIT_DASHBOARD_REPORT_CONTEXTS as readonly string[]).includes(context)
    );
}

export function isDashboardReportContext(
    context: string | null | undefined
): context is DashboardReportContext {
    return (
        !!context &&
        (DASHBOARD_REPORT_CONTEXTS as readonly string[]).includes(context)
    );
}

export function canAccessDashboardInvoiceReportContext(
    context: string | null | undefined,
    flags: DashboardReportPermissionFlags
): boolean {
    if (flags.canViewReports) {
        return true;
    }
    return (
        isFinancialDashboardReportContext(context) &&
        !!flags.canViewFinancialDashboard
    );
}

/**
 * Whether the user may list/default/execute reports for the given context.
 * Other contexts still require view_reports.
 */
export function canAccessReportsForContext(
    context: string | null | undefined,
    flags: DashboardReportPermissionFlags
): boolean {
    if (flags.canViewReports) {
        return true;
    }
    if (
        isFinancialDashboardReportContext(context) &&
        flags.canViewFinancialDashboard
    ) {
        return true;
    }
    if (
        isOperationDashboardReportContext(context) &&
        flags.canViewOperationDashboard
    ) {
        return true;
    }
    if (
        isCreditDashboardReportContext(context) &&
        flags.canViewCreditDashboard
    ) {
        return true;
    }
    return false;
}
