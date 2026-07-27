/**
 * Shared date preset utilities for report filters.
 * Used by FilterBuilder (client) and ReportExecutionService (server).
 * Resolves presets like "this_month" to actual ISO date strings.
 */

export type DatePreset =
    | "today"
    | "yesterday"
    | "tomorrow"
    | "this_week"
    | "last_week"
    | "next_week"
    | "this_month"
    | "last_month"
    | "next_month"
    | "last_x_days"
    | "last_x_months"
    | "next_x_days"
    | "next_x_months";

export function isDatePresetValue(value: unknown): value is {
    __datePreset: DatePreset;
    __datePresetInput?: number;
} {
    return (
        typeof value === "object" &&
        value !== null &&
        "__datePreset" in value &&
        typeof (value as any).__datePreset === "string"
    );
}

/** Period presets return a range [start, end]; point presets return a single date */
const PERIOD_PRESETS: DatePreset[] = [
    "this_week",
    "last_week",
    "next_week",
    "this_month",
    "last_month",
    "next_month",
    "last_x_days",
    "last_x_months",
    "next_x_days",
    "next_x_months",
];

export function isPeriodPreset(preset: DatePreset): boolean {
    return PERIOD_PRESETS.includes(preset);
}

/** Resolve period preset to [startDate, endDate] as YYYY-MM-DD. Returns null for point presets. */
export function resolveDatePresetRange(
    preset: DatePreset,
    inputValue?: number,
    isDateTime = false
): [string, string] | null {
    const now = new Date();
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const toYMD = (d: Date): string => {
        if (isDateTime) {
            return d.toISOString();
        }
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    const lastDayOfMonth = (d: Date): Date => {
        const next = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return next;
    };

    let start: Date;
    let end: Date;

    switch (preset) {
        case "this_week": {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            start = weekStart;
            end = weekEnd;
            break;
        }
        case "last_week": {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay() - 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            start = weekStart;
            end = weekEnd;
            break;
        }
        case "next_week": {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay() + 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            start = weekStart;
            end = weekEnd;
            break;
        }
        case "this_month": {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = lastDayOfMonth(start);
            break;
        }
        case "last_month": {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = lastDayOfMonth(start);
            break;
        }
        case "next_month": {
            start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            end = lastDayOfMonth(start);
            break;
        }
        case "last_x_days": {
            const days = inputValue ?? 7;
            end = new Date(today);
            start = new Date(today);
            start.setDate(today.getDate() - days);
            break;
        }
        case "last_x_months": {
            const months = inputValue ?? 1;
            start = new Date(today.getFullYear(), today.getMonth() - months, 1);
            end = lastDayOfMonth(start);
            break;
        }
        case "next_x_days": {
            const days = inputValue ?? 7;
            start = new Date(today);
            end = new Date(today);
            end.setDate(today.getDate() + days);
            break;
        }
        case "next_x_months": {
            const months = inputValue ?? 1;
            start = new Date(today.getFullYear(), today.getMonth() + months, 1);
            end = lastDayOfMonth(start);
            break;
        }
        default:
            return null;
    }

    if (isDateTime) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    }
    return [toYMD(start), toYMD(end)];
}

export function resolveDatePreset(
    preset: DatePreset,
    inputValue?: number,
    isDateTime = false
): string {
    const now = new Date();
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
    let calculatedDate: Date;

    switch (preset) {
        case "today":
            calculatedDate = new Date(today);
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        case "yesterday":
            calculatedDate = new Date(today);
            calculatedDate.setDate(today.getDate() - 1);
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        case "tomorrow":
            calculatedDate = new Date(today);
            calculatedDate.setDate(today.getDate() + 1);
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        case "this_week": {
            calculatedDate = new Date(today);
            calculatedDate.setDate(today.getDate() - today.getDay());
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        }
        case "last_week": {
            calculatedDate = new Date(today);
            calculatedDate.setDate(today.getDate() - today.getDay() - 7);
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        }
        case "next_week": {
            calculatedDate = new Date(today);
            calculatedDate.setDate(today.getDate() - today.getDay() + 7);
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        }
        case "this_month": {
            calculatedDate = new Date(today.getFullYear(), today.getMonth(), 1);
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        }
        case "last_month": {
            calculatedDate = new Date(
                today.getFullYear(),
                today.getMonth() - 1,
                1
            );
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        }
        case "next_month": {
            calculatedDate = new Date(
                today.getFullYear(),
                today.getMonth() + 1,
                1
            );
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        }
        case "last_x_days": {
            const days = inputValue ?? 7;
            calculatedDate = new Date(today);
            calculatedDate.setDate(today.getDate() - days);
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        }
        case "last_x_months": {
            const months = inputValue ?? 1;
            calculatedDate = new Date(
                today.getFullYear(),
                today.getMonth() - months,
                1
            );
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        }
        case "next_x_days": {
            const days = inputValue ?? 7;
            calculatedDate = new Date(today);
            calculatedDate.setDate(today.getDate() + days);
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        }
        case "next_x_months": {
            const months = inputValue ?? 1;
            calculatedDate = new Date(
                today.getFullYear(),
                today.getMonth() + months,
                1
            );
            if (isDateTime) calculatedDate.setHours(0, 0, 0, 0);
            break;
        }
        default:
            return "";
    }

    if (isDateTime) {
        return calculatedDate.toISOString();
    }
    // For date-only fields (generic_date, date_of_birth): return YYYY-MM-DD
    // to avoid timezone mismatch with PostgreSQL DATE columns.
    const y = calculatedDate.getFullYear();
    const m = String(calculatedDate.getMonth() + 1).padStart(2, "0");
    const d = String(calculatedDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
