/**
 * Report builder / execution helpers for daily policy cost **change** fields
 * stored on the latest {@link CustomerPolicyTrend} row per customer.
 *
 * Virtual report field names use the `*_change` suffix; underlying DB columns
 * (`policy_daily_cost`, etc.) hold day-over-day deltas.
 */

/** Virtual Customer fields resolved from latest CustomerPolicyTrend snapshot. */
export const TREND_COST_BACKED_REPORT_FIELDS = new Set([
    "policy_daily_cost_change",
    "policy_cost_currency",
    "top_up_daily_cost_change",
    "top_up_cost_currency",
    "total_daily_cost_change",
    "cost_calculation_method",
    "cost_percent",
    "policy_cost_snapshot_date",
    "top_up_total",
    "effective_approved_limit",
]);

const TREND_FIELD_TO_COLUMN: Record<string, string> = {
    policy_daily_cost_change: "policy_daily_cost",
    top_up_daily_cost_change: "top_up_daily_cost",
    total_daily_cost_change: "total_daily_cost",
    policy_cost_snapshot_date: "snapshot_date",
    top_up_total: "top_up_total",
    effective_approved_limit: "effective_approved_limit",
};

/** Human-readable labels for trend snapshot cost_calculation_method (no locale file dependency). */
const COST_CALCULATION_METHOD_LABELS: Record<string, string> = {
    Limit: "Limit",
    ActualSales: "Actual Sales",
};

type CustomerPolicyTrendRow = Record<string, unknown>;

function coerceReportNumeric(value: unknown): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "number") {
        return Number.isNaN(value) ? null : value;
    }
    if (typeof value === "object") {
        const obj = value as {
            toNumber?: () => number;
            toString?: () => string;
        };
        if (typeof obj.toNumber === "function") {
            const n = obj.toNumber();
            return typeof n === "number" && !Number.isNaN(n) ? n : null;
        }
        if (typeof obj.toString === "function") {
            const n = parseFloat(obj.toString());
            return Number.isNaN(n) ? null : n;
        }
    }
    const n = parseFloat(String(value));
    return Number.isNaN(n) ? null : n;
}

export function isTrendCostBackedReportField(field: string): boolean {
    return TREND_COST_BACKED_REPORT_FIELDS.has(field);
}

/** Maps a virtual report field to the CustomerPolicyTrend column used in Prisma filters. */
export function getTrendCostTrendColumn(field: string): string | null {
    if (!isTrendCostBackedReportField(field)) {
        return null;
    }
    return TREND_FIELD_TO_COLUMN[field] ?? field;
}

export function formatCostCalculationMethodLabel(
    value: unknown
): string | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const key = String(value);
    return COST_CALCULATION_METHOD_LABELS[key] ?? key;
}

export function getLatestCustomerPolicyTrendRow(
    row: unknown
): CustomerPolicyTrendRow | null {
    if (!row || typeof row !== "object") {
        return null;
    }

    const trend = (row as { CustomerPolicyTrend?: unknown }).CustomerPolicyTrend;
    if (!trend) {
        return null;
    }

    const rows = (Array.isArray(trend) ? trend : [trend]).filter(
        (entry): entry is CustomerPolicyTrendRow =>
            entry !== null && typeof entry === "object"
    );

    if (rows.length === 0) {
        return null;
    }

    if (rows.length === 1) {
        return rows[0];
    }

    return rows.reduce((latest, current) => {
        const latestDate = latest.snapshot_date;
        const currentDate = current.snapshot_date;
        if (!latestDate) {
            return current;
        }
        if (!currentDate) {
            return latest;
        }
        const latestTime = new Date(latestDate as string | Date).getTime();
        const currentTime = new Date(currentDate as string | Date).getTime();
        return currentTime > latestTime ? current : latest;
    });
}

export function extractCustomerTrendCostReportField(
    row: unknown,
    field: string
): unknown {
    if (!isTrendCostBackedReportField(field)) {
        return null;
    }

    const trendRow = getLatestCustomerPolicyTrendRow(row);
    if (!trendRow) {
        return null;
    }

    const column = TREND_FIELD_TO_COLUMN[field] ?? field;
    const raw = trendRow[column];
    if (raw === null || raw === undefined) {
        return null;
    }

    if (
        field === "policy_daily_cost_change" ||
        field === "top_up_daily_cost_change" ||
        field === "total_daily_cost_change" ||
        field === "cost_percent" ||
        field === "top_up_total" ||
        field === "effective_approved_limit"
    ) {
        return coerceReportNumeric(raw);
    }

    return raw;
}

function mergeTrendSelectField(
    target: Record<string, unknown>,
    field: string
): void {
    const column = TREND_FIELD_TO_COLUMN[field] ?? field;
    target[column] = true;
}

/**
 * Merge latest CustomerPolicyTrend into a Prisma select object (primary or nested Customer).
 */
export function mergeLatestCustomerPolicyTrendSelect(
    select: Record<string, unknown>,
    fields: string[]
): void {
    const trendSelect: Record<string, unknown> = { snapshot_date: true };
    for (const field of fields) {
        if (isTrendCostBackedReportField(field)) {
            mergeTrendSelectField(trendSelect, field);
        }
    }

    if (Object.keys(trendSelect).length <= 1) {
        return;
    }

    const existing = select.CustomerPolicyTrend as
        | {
              orderBy?: { snapshot_date?: "asc" | "desc" };
              take?: number;
              select?: Record<string, unknown>;
          }
        | undefined;

    if (!existing) {
        select.CustomerPolicyTrend = {
            orderBy: { snapshot_date: "desc" },
            take: 1,
            select: trendSelect,
        };
        return;
    }

    existing.orderBy = { snapshot_date: "desc" };
    existing.take = 1;
    if (!existing.select) {
        existing.select = {};
    }
    for (const [key, value] of Object.entries(trendSelect)) {
        existing.select![key] = value;
    }
}
