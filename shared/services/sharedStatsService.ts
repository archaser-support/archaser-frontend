import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";

// Shared stat types that all pages can use
export interface SharedStats {
    total_accounts: number;
    total_amount: number;
    currency: string;
}

export interface CategoryStats {
    total_cases: number;
    total_accounts: number;
    total_amount: number;
    currency: string;
}

// 1. Shared Total Customers Stat - used by all pages
export const fetchTotalCustomersStats: QueryFunction<SharedStats> = async ({
    queryKey,
}) => {
    const [, params] = queryKey as [string, { search?: string }];

    try {
        const response = await api.get("/system/shared-stats/customers", {
            params: {
                search: params.search || "",
            },
        });
        return response.data;
    } catch (error) {
        // Error handling
        throw new Error("Failed to fetch total customers stats");
    }
};

// 2. Shared Total Amount Stat - used by all pages
export const fetchTotalAmountStats: QueryFunction<SharedStats> = async ({
    queryKey,
}) => {
    const [, params] = queryKey as [string, { search?: string }];

    try {
        const response = await api.get("/system/shared-stats/amount", {
            params: {
                search: params.search || "",
            },
        });
        return response.data;
    } catch (error) {
        // Error handling
        throw new Error("Failed to fetch total amount stats");
    }
};

// 3. Category-specific stats - one per category
export const fetchLegalCategoryStats: QueryFunction<CategoryStats> = async ({
    queryKey,
}) => {
    const [, params] = queryKey as [string, { search?: string }];

    try {
        const response = await api.get("/system/shared-stats/legal", {
            params: {
                search: params.search || "",
            },
        });
        return response.data;
    } catch (error) {
        // Error handling
        throw new Error("Failed to fetch legal category stats");
    }
};

export const fetchDisputeCategoryStats: QueryFunction<CategoryStats> = async ({
    queryKey,
}) => {
    const [, params] = queryKey as [string, { search?: string }];

    try {
        const response = await api.get("/system/shared-stats/dispute", {
            params: {
                search: params.search || "",
            },
        });
        return response.data;
    } catch (error) {
        // Error handling
        throw new Error("Failed to fetch dispute category stats");
    }
};

export const fetchAgentCategoryStats: QueryFunction<CategoryStats> = async ({
    queryKey,
}) => {
    const [, params] = queryKey as [string, { search?: string }];

    try {
        const response = await api.get("/system/shared-stats/agent", {
            params: {
                search: params.search || "",
            },
        });
        return response.data;
    } catch (error) {
        // Error handling
        throw new Error("Failed to fetch agent category stats");
    }
};

export const fetchPromiseToPayCategoryStats: QueryFunction<
    CategoryStats
> = async ({ queryKey }) => {
    const [, params] = queryKey as [string, { search?: string }];

    try {
        const response = await api.get("/system/shared-stats/promise-to-pay", {
            params: {
                search: params.search || "",
            },
        });
        return response.data;
    } catch (error) {
        // Error handling
        throw new Error("Failed to fetch promise to pay category stats");
    }
};
