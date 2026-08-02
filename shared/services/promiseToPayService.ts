import { QueryFunction } from "@tanstack/react-query";
import moment from "moment";

import api from "@/app/api";
import { PromiseToPayResponse } from "@/types/CustomerWithPromiseToPay";

export const fetchPromiseToPayList: QueryFunction<
    PromiseToPayResponse
> = async ({ queryKey }) => {
    const [, { page, limit, search, sortField, sortDirection }] = queryKey as [
        string,
        {
            page: number;
            limit: number;
            search: string;
            sortField?: string;
            sortDirection?: string;
        },
    ];

    try {
        const response = await api.get("/system/promise-to-pay", {
            params: {
                page,
                limit,
                search: search || "",
                sortField: sortField || "customer",
                sortDirection: sortDirection || "asc",
            },
        });
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch data");
    }
};

export const fetchDisputeWithPromiseToPayStats: QueryFunction<
    PromiseToPayResponse
> = async () => {
    try {
        const response = await api.get("/system/promise-to-pay/stats");
        return response.data;
    } catch (error) {
        // Error handling
        throw new Error("Failed to fetch data");
    }
};

export interface PromiseToPayDateRange {
    minDate: Date;
    maxDate: Date;
    /** Size of the selectable window in days. */
    windowDays: number;
    /** Promises still allowed this cycle, or null when no cap is configured. */
    remainingPromises: number | null;
    isMaxedOut: boolean;
    isValid: boolean;
}

/** Used when an account has no promise_to_pay window configured. */
export const DEFAULT_PROMISE_TO_PAY_WINDOW_DAYS = 7;

export interface PromiseToPayLimits {
    /** Account.promise_to_pay — how many days ahead a payment date may be set. */
    windowDays?: number | null;
    /** Account.max_promise_to_pay_allowed_per_cycle — promises allowed per cycle. */
    maxPerCycle?: number | null;
    /** CustomerCollectionPeriod.promise_to_pay_count — promises already made. */
    usedCount?: number | null;
}

/**
 * Two independent limits govern a promise to pay, and they must not be mixed:
 * `Account.promise_to_pay` is a length of time (how far ahead the customer may
 * promise to pay), while `Account.max_promise_to_pay_allowed_per_cycle` is a
 * quantity (how many promises are allowed in one collection cycle). Subtracting
 * the count from the window collapsed the calendar to a day or two and made the
 * feature unusable, so they are kept separate here.
 *
 * An unset cap means "not configured" rather than "zero allowed"; a cap only
 * applies when it is a positive number.
 */
export function calculatePromiseToPayDateRange({
    windowDays,
    maxPerCycle,
    usedCount,
}: PromiseToPayLimits): PromiseToPayDateRange {
    const days =
        windowDays != null && windowDays > 0
            ? windowDays
            : DEFAULT_PROMISE_TO_PAY_WINDOW_DAYS;
    const used = usedCount ?? 0;
    const cap = maxPerCycle != null && maxPerCycle > 0 ? maxPerCycle : null;
    const isMaxedOut = cap != null && used >= cap;

    return {
        minDate: moment().add(1, "day").startOf("day").toDate(),
        maxDate: moment().add(days, "days").endOf("day").toDate(),
        windowDays: days,
        remainingPromises: cap == null ? null : Math.max(0, cap - used),
        isMaxedOut,
        isValid: !isMaxedOut,
    };
}

/** Convenience wrapper for the customer portal. */
export function calculatePortalPromiseToPayDateRange(
    windowDays: number | null | undefined,
    usedCount: number = 0,
    maxPerCycle?: number | null
): PromiseToPayDateRange {
    return calculatePromiseToPayDateRange({
        windowDays,
        usedCount,
        maxPerCycle,
    });
}

/**
 * Interface for customer data required for promise to pay calculations
 * Supports both single object and array formats for CustomerCollectionPeriod
 */
export interface CustomerForPromiseToPay {
    Account?: {
        promise_to_pay: number | null;
        max_promise_to_pay_allowed_per_cycle?: number | null;
    } | null;
    CustomerCollectionPeriod?:
    | Array<{
        promise_to_pay_count: number | null;
        period_end_date?: Date | string | null;
    }>
    | {
        promise_to_pay_count: number | null;
        period_end_date?: Date | string | null;
    }
    | null;
}

/**
 * Convenience function for LogActivity component
 * Handles the complex customer object structure with proper typing
 */
export function calculateLogActivityPromiseToPayDateRange(
    customer: CustomerForPromiseToPay
): PromiseToPayDateRange {
    const periods = customer?.CustomerCollectionPeriod;
    // The count that matters is the open period's; a closed period's count is history.
    const openPeriod = Array.isArray(periods)
        ? (periods.find((p) => p?.period_end_date == null) ?? periods[0])
        : periods;

    return calculatePromiseToPayDateRange({
        windowDays: customer?.Account?.promise_to_pay,
        maxPerCycle: customer?.Account?.max_promise_to_pay_allowed_per_cycle,
        usedCount: openPeriod?.promise_to_pay_count,
    });
}
