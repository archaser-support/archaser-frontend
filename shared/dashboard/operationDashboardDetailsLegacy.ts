/**
 * Types that have moved from getOperationDashboardDetails → report-backed lists.
 * Legacy details API returns empty for these; EndlessScroll keeps orphan URLs only.
 */

import { shouldUseDashboardActivityReportList } from "./dashboardActivityChartFilters";
import { shouldUseDashboardDisputeReportList } from "./dashboardDisputeChartFilters";
import { shouldUseDashboardPromiseReportList } from "./dashboardPromiseChartFilters";

/** Orphan detail types still served by the legacy EndlessScroll + details API. */
export const OPERATION_DASHBOARD_ORPHAN_DETAIL_TYPES = [
    "automated-activities",
    "open-disputes",
    "undelivered-activities",
    "missing-contacts",
    "automation-stuck",
    "overdue-follow-ups",
] as const;

export type OperationDashboardOrphanDetailType =
    (typeof OPERATION_DASHBOARD_ORPHAN_DETAIL_TYPES)[number];

export function isOperationDashboardOrphanDetailType(
    type: string
): type is OperationDashboardOrphanDetailType {
    return (OPERATION_DASHBOARD_ORPHAN_DETAIL_TYPES as readonly string[]).includes(
        type
    );
}

/**
 * True when the drill is wired to a dashboard_* report context
 * (activities / disputes / promises).
 */
export function isConvertedOperationDashboardDetailType(type: string): boolean {
    return (
        shouldUseDashboardActivityReportList({ type }) ||
        shouldUseDashboardDisputeReportList({ type }) ||
        shouldUseDashboardPromiseReportList({ type })
    );
}
