/** Report builder configuration persisted by the Nest reports API. */
import type { ReportFormula } from "@/shared/reportFormula/types";

/** One filter clause sent to the Nest report execution endpoint. */
export interface Filter {
    table: string;
    field: string;
    operator: string;
    value: any;
}

export interface ReportConfig {
    tables: string[];
    /**
     * Explicit report grain (Prisma root). Independent of column/field order.
     * Resolve with context override → primaryTable → tables[0] → Customer.
     */
    primaryTable?: string;
    joins?: Array<{
        type: "INNER" | "LEFT" | "RIGHT";
        from: string;
        to: string;
        on: string;
    }>;
    fields?: Array<{
        table: string;
        field: string;
        alias?: string;
        aggregation?: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
    }>;
    filters?: Array<{
        table: string;
        field: string;
        operator: string;
        value: any;
    }>;
    grouping?: string[];
    sorting?: Array<{
        field: string;
        direction: "ASC" | "DESC";
    }>;
    chart?: {
        type: "bar" | "line" | "pie" | "area" | "table";
        xAxis?: string;
        yAxis?: string;
        title?: string;
    };
    formulas?: ReportFormula[];
    /** Interleaved column order: field output keys and `formula:{id}` entries. */
    columnOrder?: string[];
    /** Viewer shows a fixed total row; missing = off. Needs at least one aggregation. */
    showTotalRow?: boolean;
}

/** One aggregated column in the execute `totals` response. */
export interface ReportTotalsCell {
    value: number | null;
    currency?: string;
    mixedCurrency?: boolean;
    formatted?: string;
}

/** Execute response `totals` (requested with `includeTotals`). */
export interface ReportTotals {
    cells: Record<string, ReportTotalsCell>;
    /** Column that carries the "Total" label; null when every column is aggregated. */
    labelKey: string | null;
}
