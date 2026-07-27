import type { FormulaWarningSummary } from "@/shared/reportFormula/types";

export interface Filter {
    table: string;
    field: string;
    operator: string;
    value: any;
}

export interface FieldConfig {
    table: string;
    field: string;
    alias?: string;
    aggregation?: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
    width?: number; // Fixed width in pixels (if set, flex will be 0)
    flex?: number; // Flex value (default: 1 if width not set, 0 if width is set)
    minWidth?: number; // Minimum width in pixels (default: 150)
}

export interface SortConfig {
    relationName?: string;
    relationField?: string;
    relationTable?: string;
    sortDirection: "asc" | "desc";
    fieldConfig?: FieldConfig | null;
}

export interface OneToManyRelationTable {
    relationName: string;
    table: string;
}

export interface ExecuteReportParams {
    reportId: number;
    accountId: number;
    userId?: string;
    filters?: Filter[];
    /** When true and filters is a non-empty array, replace report config filters instead of merging as additional filters. */
    replaceConfigFilters?: boolean;
    page?: number;
    limit?: number;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    search?: string;
    locale?: string;
    /** Account/UI language (e.g. "English", "Hebrew") for text labels — separate from locale. */
    language?: string;
    timezone?: string;
    businessUnitFilter?: any; // Business unit filter from AccessControlService
    /**
     * Optional Customer-scoped access filter (e.g. owner OR null from getOwnerFilter).
     * Applied server-side for dashboard chart-details parity.
     */
    customerAccessFilter?: Record<string, unknown>;
    /**
     * Extra Prisma where fragment AND-merged after filters (e.g. active-customers OR).
     */
    primaryWhereExtras?: Record<string, unknown>;
    /** When true, merge Invoice credit-insurance violation booleans into the select (for UI column). */
    includeInvoiceCreditInsuranceViolationFields?: boolean;
    /** Credit dashboard policy scope (from __credit_dashboard_customer_scope marker). */
    creditDashboardPolicyId?: number;
    /** Credit dashboard top-up expiring window in days. */
    creditDashboardWithinDays?: number;
}

export interface ReportExecutionResult {
    data: any[];
    totalRecords: number;
    executionTimeMs: number;
    /** For grouped execution: sum of each COUNT column across all groups (full result set, not current page). */
    aggregationTotals?: Record<string, number>;
    /** Per-formula invalid row/group counts (no row-level detail). */
    formulaWarnings?: FormulaWarningSummary[];
}

export type Operator =
    | "="
    | "!="
    | ">"
    | ">="
    | "<"
    | "<="
    | "contains"
    | "in"
    | "between"
    | "equals"
    | "not_equals"
    | "greater_than"
    | "greater_than_or_equal"
    | "less_than"
    | "less_than_or_equal";

export type AggregationType = "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
