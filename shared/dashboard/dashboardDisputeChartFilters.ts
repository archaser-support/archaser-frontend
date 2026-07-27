/**
 * Operation dashboard dispute drill-down filter contract.
 *
 * Maps details URL params to locked report additionalFilters for
 * disputes-created / disputes-closed. Agent/owner/modified-by identity and
 * Customer owner scope are applied server-side on execute.
 */

import type { Filter } from "@/server/services/ReportExecutionService.types";

export const DASHBOARD_DISPUTES_CONTEXT = "dashboard_disputes";

export const DASHBOARD_DISPUTE_CHART_TYPES = [
    "disputes-created",
    "disputes-closed",
] as const;

export type DashboardDisputeChartType =
    (typeof DASHBOARD_DISPUTE_CHART_TYPES)[number];

export type DashboardDisputeChartFamily = "created" | "closed";

export const DASHBOARD_DISPUTE_SYSTEM_REPORT_UNIQUE_NAME =
    "dashboard_disputes_default" as const;

/** Marker expanded server-side into created/closed agent OR membership. */
export const DASHBOARD_DISPUTE_FAMILY_FILTER_FIELD =
    "__dashboard_dispute_family";

export const DASHBOARD_DISPUTE_CLOSED_STATUSES = [
    "Resolved",
    "Cancelled",
] as const;

export interface DashboardDisputeChartFilterInput {
    type: string;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    now?: Date;
}

export interface DashboardDisputeChartFilterResult {
    isDisputeShaped: boolean;
    family: DashboardDisputeChartFamily | null;
    systemReportUniqueName: string | null;
    additionalFilters: Filter[];
    isDisputeList: boolean;
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

export function resolveDisputeDrillDateRange(
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

export function isDashboardDisputeChartType(
    type: string
): type is DashboardDisputeChartType {
    return (DASHBOARD_DISPUTE_CHART_TYPES as readonly string[]).includes(type);
}

export function getDashboardDisputeChartFamily(
    type: string
): DashboardDisputeChartFamily | null {
    switch (type) {
        case "disputes-created":
            return "created";
        case "disputes-closed":
            return "closed";
        default:
            return null;
    }
}

export function getDashboardDisputeSystemReportUniqueName(
    type: string
): string | null {
    if (!getDashboardDisputeChartFamily(type)) return null;
    return DASHBOARD_DISPUTE_SYSTEM_REPORT_UNIQUE_NAME;
}

/**
 * Build locked additionalFilters for dispute-shaped operation-dashboard drills.
 */
export function buildDashboardDisputeChartFilters(
    input: DashboardDisputeChartFilterInput
): DashboardDisputeChartFilterResult {
    const family = getDashboardDisputeChartFamily(input.type);

    if (!family || !isDashboardDisputeChartType(input.type)) {
        return {
            isDisputeShaped: false,
            family: null,
            systemReportUniqueName: null,
            additionalFilters: [],
            isDisputeList: false,
        };
    }

    const range = resolveDisputeDrillDateRange(
        input.startDate,
        input.endDate,
        input.now
    );

    const additionalFilters: Filter[] = [
        filter(
            "Dispute",
            DASHBOARD_DISPUTE_FAMILY_FILTER_FIELD,
            "equals",
            family
        ),
    ];

    if (family === "created") {
        additionalFilters.push(
            filter("Dispute", "created_at", "between", [
                range.startYmd,
                range.endYmd,
            ])
        );
    } else {
        additionalFilters.push(
            filter("Dispute", "dispute_status", "in", [
                ...DASHBOARD_DISPUTE_CLOSED_STATUSES,
            ]),
            filter("Dispute", "closed_at", "between", [
                range.startYmd,
                range.endYmd,
            ])
        );
    }

    return {
        isDisputeShaped: true,
        family,
        systemReportUniqueName: DASHBOARD_DISPUTE_SYSTEM_REPORT_UNIQUE_NAME,
        additionalFilters,
        isDisputeList: true,
    };
}

export function shouldUseDashboardDisputeReportList(
    input: DashboardDisputeChartFilterInput
): boolean {
    const result = buildDashboardDisputeChartFilters(input);
    return result.isDisputeShaped && result.isDisputeList;
}

/**
 * Expand dispute family marker into Prisma extras matching getOperationDashboardDetails.
 */
export function expandDashboardDisputeFamilyWhere(
    family: DashboardDisputeChartFamily,
    options: {
        agentIds: string[];
        systemUserId: string;
        portalUserId: string;
    }
): Record<string, unknown> {
    const { agentIds, systemUserId, portalUserId } = options;
    const auditIds = [portalUserId, systemUserId];

    if (family === "created") {
        return {
            created_by: { notIn: auditIds },
            OR: [
                { created_by: { in: agentIds } },
                { owner_id: { in: agentIds } },
            ],
        };
    }

    return {
        OR: [
            { created_by: { in: agentIds } },
            { owner_id: { in: agentIds } },
            { modified_by: { in: agentIds } },
        ],
        modified_by: { notIn: auditIds },
    };
}
