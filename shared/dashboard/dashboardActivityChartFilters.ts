/**
 * Operation dashboard activity drill-down filter contract.
 *
 * Maps details URL params to locked report additionalFilters so report execute
 * shares exact KPI membership with legacy getOperationDashboardDetails.
 *
 * Agent / system / portal / selectedUserId identity is applied server-side on
 * execute for dashboard_activities — encoded here as markers, not client IDs.
 */

import type { Filter } from "@/server/services/ReportExecutionService.types";

export const DASHBOARD_ACTIVITIES_CONTEXT = "dashboard_activities";

export const DASHBOARD_ACTIVITY_CHART_TYPES = [
    "manual-activities",
    "total-calls",
    "activity-success-rate",
    "system-activities",
    "portal-activities",
] as const;

export type DashboardActivityChartType =
    (typeof DASHBOARD_ACTIVITY_CHART_TYPES)[number];

export type DashboardActivityChartFamily =
    | "manual"
    | "total_calls"
    | "success_rate"
    | "system"
    | "portal";

export const DASHBOARD_ACTIVITY_SYSTEM_REPORT_UNIQUE_NAME =
    "dashboard_activities_default" as const;

/** Marker expanded server-side into created_by identity scope. */
export const DASHBOARD_ACTIVITY_IDENTITY_FILTER_FIELD =
    "__dashboard_activity_identity";

/** Marker expanded server-side into Call / Promise_to_pay / Dispute-"filed" OR. */
export const DASHBOARD_TOTAL_CALLS_FILTER_FIELD = "__dashboard_total_calls";

export type DashboardActivityIdentityMode =
    | "agents_excl_audit"
    | "all_agents_incl_audit"
    | "system"
    | "portal";

export interface DashboardActivityChartFilterInput {
    type: string;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    /** Optional clock for deterministic unit tests. */
    now?: Date;
}

export interface DashboardActivityChartFilterResult {
    isActivityShaped: boolean;
    family: DashboardActivityChartFamily | null;
    systemReportUniqueName: string | null;
    /** Locked filters AND-merged with the selected report config. */
    additionalFilters: Filter[];
    isActivityList: boolean;
    identityMode: DashboardActivityIdentityMode | null;
}

function filter(
    table: string,
    field: string,
    operator: string,
    value: unknown
): Filter {
    return { table, field, operator, value };
}

function toYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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

/**
 * Default details range when URL omits dates: last 30 days through now
 * (matches getOperationDashboardDetails).
 */
export function resolveActivityDrillDateRange(
    startDate?: string | Date | null,
    endDate?: string | Date | null,
    now = new Date()
): { start: Date; end: Date; startYmd: string; endYmd: string } {
    const start =
        parseDateInput(startDate) ??
        new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = parseDateInput(endDate) ?? now;
    return {
        start,
        end,
        startYmd: toYmd(start),
        endYmd: toYmd(end),
    };
}

export function isDashboardActivityChartType(
    type: string
): type is DashboardActivityChartType {
    return (DASHBOARD_ACTIVITY_CHART_TYPES as readonly string[]).includes(type);
}

export function getDashboardActivityChartFamily(
    type: string
): DashboardActivityChartFamily | null {
    switch (type) {
        case "manual-activities":
            return "manual";
        case "total-calls":
            return "total_calls";
        case "activity-success-rate":
            return "success_rate";
        case "system-activities":
            return "system";
        case "portal-activities":
            return "portal";
        default:
            return null;
    }
}

export function getDashboardActivityIdentityMode(
    type: string
): DashboardActivityIdentityMode | null {
    switch (getDashboardActivityChartFamily(type)) {
        case "manual":
        case "total_calls":
            return "agents_excl_audit";
        case "success_rate":
            return "all_agents_incl_audit";
        case "system":
            return "system";
        case "portal":
            return "portal";
        default:
            return null;
    }
}

export function getDashboardActivitySystemReportUniqueName(
    type: string
): string | null {
    if (!getDashboardActivityChartFamily(type)) return null;
    return DASHBOARD_ACTIVITY_SYSTEM_REPORT_UNIQUE_NAME;
}

/**
 * Build locked additionalFilters for activity-shaped operation-dashboard details types.
 */
export function buildDashboardActivityChartFilters(
    input: DashboardActivityChartFilterInput
): DashboardActivityChartFilterResult {
    const family = getDashboardActivityChartFamily(input.type);
    const identityMode = getDashboardActivityIdentityMode(input.type);

    if (!family || !identityMode || !isDashboardActivityChartType(input.type)) {
        return {
            isActivityShaped: false,
            family: null,
            systemReportUniqueName: null,
            additionalFilters: [],
            isActivityList: false,
            identityMode: null,
        };
    }

    const range = resolveActivityDrillDateRange(
        input.startDate,
        input.endDate,
        input.now
    );

    const additionalFilters: Filter[] = [
        filter("Activity", "created_at", "between", [
            range.startYmd,
            range.endYmd,
        ]),
        filter(
            "Activity",
            DASHBOARD_ACTIVITY_IDENTITY_FILTER_FIELD,
            "equals",
            identityMode
        ),
    ];

    if (family === "manual") {
        additionalFilters.push(
            filter("Activity", "system_generated", "equals", false)
        );
    }

    if (family === "total_calls") {
        additionalFilters.push(
            filter("Activity", DASHBOARD_TOTAL_CALLS_FILTER_FIELD, "equals", true)
        );
    }

    return {
        isActivityShaped: true,
        family,
        systemReportUniqueName: DASHBOARD_ACTIVITY_SYSTEM_REPORT_UNIQUE_NAME,
        additionalFilters,
        isActivityList: true,
        identityMode,
    };
}

/** Whether operation-dashboard details should render ViewBasedDataGrid for this drill. */
export function shouldUseDashboardActivityReportList(
    input: DashboardActivityChartFilterInput
): boolean {
    const result = buildDashboardActivityChartFilters(input);
    return result.isActivityShaped && result.isActivityList;
}

/**
 * Expand total-calls marker into Prisma OR matching getOperationDashboardDetails.
 */
export function expandDashboardTotalCallsWhere(): Record<string, unknown> {
    return {
        OR: [
            { type: { in: ["Call", "Promise_to_pay"] } },
            {
                AND: [
                    { type: "Dispute" },
                    {
                        title: {
                            contains: "filed",
                            mode: "insensitive",
                        },
                    },
                ],
            },
        ],
    };
}
