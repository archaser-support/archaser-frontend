export type DatePreset =
    | "today"
    | "yesterday"
    | "this_week"
    | "last_week"
    | "this_month"
    | "last_month"
    | "this_year"
    | "last_year"
    | "custom";

function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date: Date): Date {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999
    );
}

function isSameLocalDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

/**
 * Infer which named preset (if any) matches a start/end pair.
 * This Year is Jan 1 through Dec 31, not "Jan 1 through any day this year".
 */
export function detectDateRangePreset(
    startDate: Date,
    endDate: Date,
    now: Date = new Date()
): DatePreset {
    const today = startOfLocalDay(now);
    const todayEnd = endOfLocalDay(today);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayEnd = endOfLocalDay(yesterday);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const thisWeekEnd = endOfLocalDay(
        new Date(
            thisWeekStart.getFullYear(),
            thisWeekStart.getMonth(),
            thisWeekStart.getDate() + 6
        )
    );

    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
    const lastWeekEnd = endOfLocalDay(
        new Date(
            lastWeekStart.getFullYear(),
            lastWeekStart.getMonth(),
            lastWeekStart.getDate() + 6
        )
    );

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = endOfLocalDay(
        new Date(today.getFullYear(), today.getMonth() + 1, 0)
    );

    const lastMonthStart = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
    );
    const lastMonthEnd = endOfLocalDay(
        new Date(today.getFullYear(), today.getMonth(), 0)
    );

    const thisYearStart = new Date(today.getFullYear(), 0, 1);
    const thisYearEnd = endOfLocalDay(new Date(today.getFullYear(), 11, 31));

    const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
    const lastYearEnd = endOfLocalDay(
        new Date(today.getFullYear() - 1, 11, 31)
    );

    const startDay = startOfLocalDay(startDate);

    if (
        startDay.getTime() === today.getTime() &&
        endDate.getTime() <= todayEnd.getTime() &&
        endDate.getTime() >= today.getTime()
    ) {
        return "today";
    }
    if (
        startDay.getTime() === yesterday.getTime() &&
        endDate.getTime() >= yesterday.getTime() &&
        endDate.getTime() <= yesterdayEnd.getTime()
    ) {
        return "yesterday";
    }
    if (
        startDay.getTime() === thisWeekStart.getTime() &&
        isSameLocalDay(endDate, thisWeekEnd)
    ) {
        return "this_week";
    }
    if (
        startDay.getTime() === lastWeekStart.getTime() &&
        endDate.getTime() >= lastWeekStart.getTime() &&
        endDate.getTime() <= lastWeekEnd.getTime()
    ) {
        return "last_week";
    }
    if (
        startDay.getTime() === thisMonthStart.getTime() &&
        isSameLocalDay(endDate, thisMonthEnd)
    ) {
        return "this_month";
    }
    if (
        startDay.getTime() === lastMonthStart.getTime() &&
        endDate.getTime() >= lastMonthStart.getTime() &&
        endDate.getTime() <= lastMonthEnd.getTime()
    ) {
        return "last_month";
    }
    if (
        startDay.getTime() === thisYearStart.getTime() &&
        isSameLocalDay(endDate, thisYearEnd)
    ) {
        return "this_year";
    }
    if (
        startDay.getTime() === lastYearStart.getTime() &&
        endDate.getTime() >= lastYearStart.getTime() &&
        endDate.getTime() <= lastYearEnd.getTime()
    ) {
        return "last_year";
    }
    return "custom";
}

/** Opening the calendar re-commits the same dates; do not leave Custom when that happens. */
export function resolvePresetAfterDateCommit(
    currentPreset: DatePreset,
    detectedPreset: DatePreset
): DatePreset {
    if (currentPreset === "custom") {
        return "custom";
    }
    return detectedPreset;
}

export function isSameLocalCalendarDay(a: Date, b: Date): boolean {
    return isSameLocalDay(a, b);
}
