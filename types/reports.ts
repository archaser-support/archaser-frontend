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
}
