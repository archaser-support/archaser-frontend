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

/**
 * Shared utility function to calculate promise to pay date range
 * This eliminates code duplication between Portal and LogActivity components
 * 
 * @param promiseToPayLimit - The maximum number of days allowed for promise to pay (from Account.promise_to_pay)
 * @param currentPromiseCount - The current number of promises made in this cycle (from CustomerCollectionPeriod.promise_to_pay_count)
 * @param defaultLimit - Fallback limit if promiseToPayLimit is not provided (default: 2)
 * @returns Object containing minDate, maxDate, remainingDays, and isMaxedOut
 */
export interface PromiseToPayDateRange {
    minDate: Date;
    maxDate: Date;
    remainingDays: number;
    isMaxedOut: boolean;
    isValid: boolean;
}

export function calculatePromiseToPayDateRange(
    promiseToPayLimit: number | null | undefined,
    currentPromiseCount: number | null | undefined,
    defaultLimit: number = 2
): PromiseToPayDateRange {
    // Use provided limit or fallback to default
    const limit = promiseToPayLimit ?? defaultLimit;
    const usedCount = currentPromiseCount ?? 0;

    // Calculate remaining days
    const remainingDays = Math.max(0, limit - usedCount);

    // Check if maxed out
    const isMaxedOut = usedCount >= limit;

    // Calculate date range
    const today = moment();
    const minDate = moment().add(1, "day").toDate(); // Start from tomorrow
    const maxDate = moment().add(remainingDays, "days").toDate();

    return {
        minDate,
        maxDate,
        remainingDays,
        isMaxedOut,
        isValid: remainingDays > 0
    };
}

/**
 * Convenience function for Portal component
 * Uses the same logic as LogActivity but with simpler parameters
 */
export function calculatePortalPromiseToPayDateRange(
    promiseToPayLimit: number,
    currentPromiseCount: number = 0
): PromiseToPayDateRange {
    return calculatePromiseToPayDateRange(promiseToPayLimit, currentPromiseCount);
}

/**
 * Interface for customer data required for promise to pay calculations
 * Supports both single object and array formats for CustomerCollectionPeriod
 */
export interface CustomerForPromiseToPay {
    Account?: {
        promise_to_pay: number | null;
    } | null;
    CustomerCollectionPeriod?:
    | Array<{
        promise_to_pay_count: number | null;
    }>
    | {
        promise_to_pay_count: number | null;
    }
    | null;
}

/**
 * Convenience function for LogActivity component
 * Handles the complex customer object structure with proper typing
 */
export function calculateLogActivityPromiseToPayDateRange(
    customer: CustomerForPromiseToPay,
    defaultLimit: number = 2
): PromiseToPayDateRange {
    const promiseToPayLimit = customer?.Account?.promise_to_pay;

    // Handle both array and single object formats for CustomerCollectionPeriod
    let currentPromiseCount: number | null | undefined;
    if (Array.isArray(customer?.CustomerCollectionPeriod)) {
        currentPromiseCount = customer.CustomerCollectionPeriod[0]?.promise_to_pay_count;
    } else if (customer?.CustomerCollectionPeriod) {
        currentPromiseCount = customer.CustomerCollectionPeriod.promise_to_pay_count;
    }

    return calculatePromiseToPayDateRange(promiseToPayLimit, currentPromiseCount, defaultLimit);
}
