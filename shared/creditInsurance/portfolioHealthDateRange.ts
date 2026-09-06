const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const PORTFOLIO_HEALTH_MAX_RANGE_DAYS = 366;
/** Show Generate guidance when the selected range exceeds this many days. */
export const PORTFOLIO_HEALTH_LARGE_RANGE_DAYS = 90;

export type ParsedPortfolioHealthDateRange = {
    from: string;
    to: string;
    fromDateUtc: Date;
    toDateUtc: Date;
    daysInRange: number;
};

function startOfUtcDayFromYmd(ymd: string): Date {
    const [year, month, day] = ymd.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function normalizeDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
}

/** Inclusive calendar-day count between YYYY-MM-DD bounds (UTC). */
export function countInclusiveCalendarDays(fromYmd: string, toYmd: string): number {
    const from = startOfUtcDayFromYmd(fromYmd);
    const to = startOfUtcDayFromYmd(toYmd);
    const ms = to.getTime() - from.getTime();
    return Math.floor(ms / 86_400_000) + 1;
}

/** Default range: calendar This Year (Jan 1–Dec 31, UTC year of `todayUtc`). */
export function defaultPortfolioHealthDateRange(
    todayUtc: Date = new Date(
        Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate()
        )
    )
): { from: string; to: string } {
    const year = todayUtc.getUTCFullYear();
    return {
        from: `${year}-01-01`,
        to: `${year}-12-31`,
    };
}

export function parsePortfolioHealthDateRange(
    fromRaw: string | undefined,
    toRaw: string | undefined
): ParsedPortfolioHealthDateRange | { error: string } {
    const defaults = defaultPortfolioHealthDateRange();
    const from = (fromRaw ?? "").trim() || defaults.from;
    const to = (toRaw ?? "").trim() || defaults.to;

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
        return { error: "Invalid from/to date; expected YYYY-MM-DD" };
    }

    const fromDateUtc = startOfUtcDayFromYmd(from);
    const toDateUtc = startOfUtcDayFromYmd(to);
    if (
        Number.isNaN(fromDateUtc.getTime()) ||
        Number.isNaN(toDateUtc.getTime())
    ) {
        return { error: "Invalid from/to date" };
    }
    if (fromDateUtc.getTime() > toDateUtc.getTime()) {
        return { error: "from must be on or before to" };
    }

    const daysInRange = countInclusiveCalendarDays(from, to);
    if (daysInRange > PORTFOLIO_HEALTH_MAX_RANGE_DAYS) {
        return {
            error: `Date range cannot exceed ${PORTFOLIO_HEALTH_MAX_RANGE_DAYS} days`,
        };
    }

    return { from, to, fromDateUtc, toDateUtc, daysInRange };
}

const MAX_PADDED_DAYS = PORTFOLIO_HEALTH_MAX_RANGE_DAYS;
const MAX_PADDED_MONTHS = 24;

function addUtcDays(ymd: string, days: number): string {
    const date = startOfUtcDayFromYmd(ymd);
    date.setUTCDate(date.getUTCDate() + days);
    return normalizeDateString(date);
}

function addUtcMonths(yearMonth: string, months: number): string {
    const [year, month] = yearMonth.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 + months, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * When the picker end is in the future (e.g. This Year → 31 Dec), clamp the
 * data window to `todayYmd` so charts and period totals stop at today.
 * Entirely-future ranges are left unchanged.
 */
export function clampPortfolioHealthRangeEnd(
    fromYmd: string,
    toYmd: string,
    todayYmd: string
): string {
    if (toYmd <= todayYmd) {
        return toYmd;
    }
    if (fromYmd > todayYmd) {
        return toYmd;
    }
    return todayYmd;
}

export function enumerateInclusiveUtcYmd(
    fromYmd: string,
    toYmd: string
): string[] {
    if (!DATE_RE.test(fromYmd) || !DATE_RE.test(toYmd) || fromYmd > toYmd) {
        return [];
    }
    const out: string[] = [];
    let cursor = fromYmd;
    while (cursor <= toYmd && out.length < MAX_PADDED_DAYS) {
        out.push(cursor);
        cursor = addUtcDays(cursor, 1);
    }
    return out;
}

export function enumerateInclusiveUtcMonths(
    fromYmd: string,
    toYmd: string
): string[] {
    if (!DATE_RE.test(fromYmd) || !DATE_RE.test(toYmd) || fromYmd > toYmd) {
        return [];
    }
    const fromMonth = fromYmd.slice(0, 7);
    const toMonth = toYmd.slice(0, 7);
    const out: string[] = [];
    let cursor = fromMonth;
    while (cursor <= toMonth && out.length < MAX_PADDED_MONTHS) {
        out.push(cursor);
        cursor = addUtcMonths(cursor, 1);
    }
    return out;
}

export type PaddedYmdPoint<T> = { ymd: string; point: T | null };
export type PaddedMonthPoint<T> = { month: string; point: T | null };

/** Empty `points` stays empty (no axis). Otherwise one slot per UTC day in range. */
export function padSeriesByUtcYmd<T>(
    points: T[],
    fromYmd: string,
    toYmd: string,
    getYmd: (point: T) => string
): PaddedYmdPoint<T>[] {
    if (points.length === 0) {
        return [];
    }
    const byDate = new Map<string, T>();
    for (const point of points) {
        byDate.set(getYmd(point), point);
    }
    return enumerateInclusiveUtcYmd(fromYmd, toYmd).map((ymd) => ({
        ymd,
        point: byDate.get(ymd) ?? null,
    }));
}

/** Empty `points` stays empty. Otherwise one slot per calendar month in range. */
export function padSeriesByUtcMonth<T>(
    points: T[],
    fromYmd: string,
    toYmd: string,
    getMonth: (point: T) => string
): PaddedMonthPoint<T>[] {
    if (points.length === 0) {
        return [];
    }
    const byMonth = new Map<string, T>();
    for (const point of points) {
        byMonth.set(getMonth(point), point);
    }
    return enumerateInclusiveUtcMonths(fromYmd, toYmd).map((month) => ({
        month,
        point: byMonth.get(month) ?? null,
    }));
}
