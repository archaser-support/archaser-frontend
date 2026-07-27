/**
 * Operation dashboard promises-to-pay drill-down filter contract.
 *
 * Maps details URL params to locked report additionalFilters for
 * CustomerCollectionPeriod rows. Agent identity + Activity.some membership
 * are applied server-side on execute.
 */

import type { Filter } from "@/server/services/ReportExecutionService.types";
import { DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD } from "./dashboardPromisePeriodMembership";

export { DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD };

export const DASHBOARD_PROMISES_CONTEXT = "dashboard_promises";

export const DASHBOARD_PROMISE_CHART_TYPES = ["promises-to-pay"] as const;

export type DashboardPromiseChartType =
    (typeof DASHBOARD_PROMISE_CHART_TYPES)[number];

export const DASHBOARD_PROMISE_SYSTEM_REPORT_UNIQUE_NAME =
    "dashboard_promises_default" as const;

export interface DashboardPromiseChartFilterInput {
    type: string;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    now?: Date;
}

export interface DashboardPromiseChartFilterResult {
    isPromiseShaped: boolean;
    systemReportUniqueName: string | null;
    additionalFilters: Filter[];
    isPromiseList: boolean;
    /** Inclusive activity created_at window for server expansion. */
    activityDateRange: { start: Date; end: Date } | null;
}

function filter(
    table: string,
    field: string,
    operator: string,
    value: unknown
): Filter {
    return { table, field, operator, value };
}

function parseDateInput(
    value: string | Date | null | undefined
): Date | null {
    if (value == null || value === "") return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolvePromiseDrillDateRange(
    startDate?: string | Date | null,
    endDate?: string | Date | null,
    now = new Date()
): { start: Date; end: Date } {
    const start =
        parseDateInput(startDate) ??
        new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = parseDateInput(endDate) ?? now;
    return { start, end };
}

export function isDashboardPromiseChartType(
    type: string
): type is DashboardPromiseChartType {
    return (DASHBOARD_PROMISE_CHART_TYPES as readonly string[]).includes(type);
}

export function getDashboardPromiseSystemReportUniqueName(
    type: string
): string | null {
    if (!isDashboardPromiseChartType(type)) return null;
    return DASHBOARD_PROMISE_SYSTEM_REPORT_UNIQUE_NAME;
}

/**
 * Build locked additionalFilters for promises-to-pay operation-dashboard drills.
 * Membership (Activity.some + agent set) is expanded server-side from the marker.
 */
export function buildDashboardPromiseChartFilters(
    input: DashboardPromiseChartFilterInput
): DashboardPromiseChartFilterResult {
    if (!isDashboardPromiseChartType(input.type)) {
        return {
            isPromiseShaped: false,
            systemReportUniqueName: null,
            additionalFilters: [],
            isPromiseList: false,
            activityDateRange: null,
        };
    }

    const range = resolvePromiseDrillDateRange(
        input.startDate,
        input.endDate,
        input.now
    );

    return {
        isPromiseShaped: true,
        systemReportUniqueName: DASHBOARD_PROMISE_SYSTEM_REPORT_UNIQUE_NAME,
        additionalFilters: [
            filter(
                "CustomerCollectionPeriod",
                DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD,
                "equals",
                {
                    start: range.start.toISOString(),
                    end: range.end.toISOString(),
                }
            ),
        ],
        isPromiseList: true,
        activityDateRange: range,
    };
}

export function shouldUseDashboardPromiseReportList(
    input: DashboardPromiseChartFilterInput
): boolean {
    const result = buildDashboardPromiseChartFilters(input);
    return result.isPromiseShaped && result.isPromiseList;
}

export function parsePromiseActivityMarkerValue(
    value: unknown
): { start: Date; end: Date } | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const record = value as { start?: unknown; end?: unknown };
    const start = parseDateInput(
        typeof record.start === "string" || record.start instanceof Date
            ? record.start
            : null
    );
    const end = parseDateInput(
        typeof record.end === "string" || record.end instanceof Date
            ? record.end
            : null
    );
    if (!start || !end) return null;
    return { start, end };
}
