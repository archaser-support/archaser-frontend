/**
 * Credit dashboard detail report `type` query values.
 * Kept in sync with CREDIT_DASHBOARD_REPORT_TYPES filter contract.
 */

import {
    CREDIT_DASHBOARD_REPORT_TYPES,
    type CreditDashboardReportType,
} from "@/shared/dashboard/creditDashboardReportFilters";

export type CreditReportType = CreditDashboardReportType;

export const CREDIT_REPORT_TYPES = CREDIT_DASHBOARD_REPORT_TYPES;

export function isCreditReportType(type: string): type is CreditReportType {
    return (CREDIT_REPORT_TYPES as readonly string[]).includes(type);
}
