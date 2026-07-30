/**
 * Dashboard customer drill-down filter contract.
 *
 * Maps chart-details URL params to locked report additionalFilters for
 * overdue-amount / overdue-customers / active-customers.
 */

import type { Filter } from "@/types/reports";

export const DASHBOARD_CUSTOMERS_CONTEXT = "dashboard_customers";

export const DASHBOARD_CUSTOMER_CHART_TYPES = [
    "overdue-customers",
    "overdue-amount",
    "active-customers",
] as const;

export type DashboardCustomerChartType =
    (typeof DASHBOARD_CUSTOMER_CHART_TYPES)[number];

export type DashboardCustomerChartFamily = "overdue" | "active_dynamics";

/** Family-specific system reports matching legacy chart-details column sets. */
export const DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES = {
    overdue: "dashboard_customers_overdue",
    active_dynamics: "dashboard_customers_active_dynamics",
} as const;

/** @deprecated Prefer DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES by family. */
export const DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAME =
    DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES.overdue;

/** Marker expanded server-side into Entered/Exited OR (exact chart-details parity). */
export const DASHBOARD_ACTIVE_DYNAMICS_FILTER_FIELD =
    "__dashboard_active_dynamics";

export interface DashboardCustomerChartFilterInput {
    type: string;
    period?: string | null;
    viewMode?: "child" | "parent" | string | null;
    now?: Date;
}

export interface DashboardCustomerChartFilterResult {
    isCustomerShaped: boolean;
    family: DashboardCustomerChartFamily | null;
    systemReportUniqueName: string | null;
    additionalFilters: Filter[];
    isCustomerList: boolean;
    parentViewModeRequiresSpecialHandling: boolean;
    /** When true, execute must not apply URL/session BU (encoded inside active OR). */
    skipBusinessUnitFilter: boolean;
}

function filter(
    table: string,
    field: string,
    operator: string,
    value: unknown
): Filter {
    return { table, field, operator, value };
}

export function isDashboardCustomerChartType(
    type: string
): type is DashboardCustomerChartType {
    return (DASHBOARD_CUSTOMER_CHART_TYPES as readonly string[]).includes(type);
}

export function getDashboardCustomerChartFamily(
    type: string
): DashboardCustomerChartFamily | null {
    switch (type) {
        case "overdue-customers":
        case "overdue-amount":
            return "overdue";
        case "active-customers":
            return "active_dynamics";
        default:
            return null;
    }
}

export function getDashboardCustomerSystemReportUniqueName(
    type: string
): string | null {
    const family = getDashboardCustomerChartFamily(type);
    if (!family) return null;
    return DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES[family];
}

/**
 * Period month for active-customers: future month adjusts to previous year
 * (legacy chart-details behavior).
 */
export function resolveActiveCustomersPeriodMonth(
    period: string | null | undefined,
    now = new Date()
): { year: number; monthIndex: number } | null {
    if (!period || !/^\d{4}-\d{2}/.test(period)) {
        return null;
    }
    const [yearStr, monthStr] = period.split("-");
    let year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;
    if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
        return null;
    }
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    if (
        year > currentYear ||
        (year === currentYear && monthIndex > currentMonth)
    ) {
        year = year - 1;
    }
    return { year, monthIndex };
}

export function activeCustomersPeriodDateRange(
    period: string | null | undefined,
    now = new Date()
): { start: Date; end: Date; startYmd: string; endYmd: string } | null {
    const resolved = resolveActiveCustomersPeriodMonth(period, now);
    if (!resolved) return null;
    const { year, monthIndex } = resolved;
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

function overdueBaseFilters(): Filter[] {
    // Open collection period with outstanding — matches getOverdueAmountData child mode.
    return [
        filter(
            "CustomerCollectionPeriod",
            "period_end_date",
            "is_empty",
            true
        ),
        filter(
            "CustomerCollectionPeriod",
            "total_outstanding_amount",
            "greater_than",
            0
        ),
    ];
}

/**
 * Build locked additionalFilters for customer-shaped financial chart-details types.
 */
export function buildDashboardCustomerChartFilters(
    input: DashboardCustomerChartFilterInput
): DashboardCustomerChartFilterResult {
    const family = getDashboardCustomerChartFamily(input.type);
    const viewMode =
        input.viewMode === "parent" || input.viewMode === "child"
            ? input.viewMode
            : "child";

    if (!family || !isDashboardCustomerChartType(input.type)) {
        return {
            isCustomerShaped: false,
            family: null,
            systemReportUniqueName: null,
            additionalFilters: [],
            isCustomerList: false,
            parentViewModeRequiresSpecialHandling: false,
            skipBusinessUnitFilter: false,
        };
    }

    const systemReportUniqueName =
        DASHBOARD_CUSTOMER_SYSTEM_REPORT_UNIQUE_NAMES[family];

    if (family === "overdue") {
        const parentViewModeRequiresSpecialHandling = viewMode === "parent";
        if (parentViewModeRequiresSpecialHandling) {
            return {
                isCustomerShaped: true,
                family,
                systemReportUniqueName,
                additionalFilters: [],
                isCustomerList: false,
                parentViewModeRequiresSpecialHandling: true,
                skipBusinessUnitFilter: false,
            };
        }
        return {
            isCustomerShaped: true,
            family,
            systemReportUniqueName,
            additionalFilters: overdueBaseFilters(),
            isCustomerList: true,
            parentViewModeRequiresSpecialHandling: false,
            skipBusinessUnitFilter: false,
        };
    }

    // active_dynamics
    const period = input.period || null;
    const range = activeCustomersPeriodDateRange(period, input.now);
    if (!range) {
        return {
            isCustomerShaped: true,
            family,
            systemReportUniqueName,
            additionalFilters: [],
            isCustomerList: false,
            parentViewModeRequiresSpecialHandling: false,
            skipBusinessUnitFilter: true,
        };
    }

    return {
        isCustomerShaped: true,
        family,
        systemReportUniqueName,
        additionalFilters: [
            filter(
                "Customer",
                DASHBOARD_ACTIVE_DYNAMICS_FILTER_FIELD,
                "equals",
                period!.slice(0, 7)
            ),
        ],
        isCustomerList: true,
        parentViewModeRequiresSpecialHandling: false,
        // BU is applied only on the Entered branch inside expansion (legacy asymmetry).
        skipBusinessUnitFilter: true,
    };
}

export function shouldUseDashboardCustomerReportList(
    input: DashboardCustomerChartFilterInput
): boolean {
    const result = buildDashboardCustomerChartFilters(input);
    return (
        result.isCustomerShaped &&
        result.isCustomerList &&
        !result.parentViewModeRequiresSpecialHandling
    );
}

/**
 * Expand active-dynamics marker into Prisma OR matching chart-details.
 * BU is applied only to the Entered (Active) branch.
 */
export function expandDashboardActiveDynamicsWhere(
    periodYyyyMm: string,
    options: {
        businessUnitFilter?: Record<string, unknown>;
        now?: Date;
    } = {}
): Record<string, unknown> | null {
    const range = activeCustomersPeriodDateRange(
        periodYyyyMm,
        options.now
    );
    if (!range) return null;

    const entered: Record<string, unknown> = {
        collection_status: "Active",
        created_at: { gte: range.start, lte: range.end },
    };
    if (
        options.businessUnitFilter &&
        Object.keys(options.businessUnitFilter).length > 0
    ) {
        Object.assign(entered, options.businessUnitFilter);
    }

    const exited: Record<string, unknown> = {
        collection_status: "Inactive",
        modified_at: { gte: range.start, lte: range.end },
    };

    return { OR: [entered, exited] };
}
