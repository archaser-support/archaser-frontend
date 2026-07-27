import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";
import { Account, AccountResponse } from "@/types/Account";
import { DisputeReason, DisputeReasonResponse } from "@/types/DisputeReason";
import { User, UserResponse } from "@/types/User";

// Fetch accounts with search, filter, and pagination
export const fetchCustomers: QueryFunction<AccountResponse> = async ({
    queryKey,
}) => {
    const [, { query, status, page, limit, sortField, sortDirection, lastId }] =
        queryKey as [
            string,
            {
                query: string;
                status: string;
                page: number;
                limit: number;
                sortField?: string;
                sortDirection?: string;
                lastId?: number | null;
            },
        ];

    try {
        const params: Record<string, string> = {
            page: page.toString(),
            limit: limit.toString(),
            search: query,
            status,
        };

        if (sortField) params.sortField = sortField;
        if (sortDirection) params.sortDirection = sortDirection;
        if (lastId !== undefined && lastId !== null) params.lastId = lastId.toString();

        const response = await api.get("/entities/accounts", {
            params,
        });

        return response.data;
    } catch (error: any) {
        // Handle authentication errors specifically
        if (error.response?.status === 401) {
            throw new Error("Authentication required. Please log in.");
        }

        throw new Error("Failed to fetch accounts");
    }
};

// Fetch an account by ID
export const fetchAccountById: QueryFunction<Account> = async ({
    queryKey,
}) => {
    const [, accountId] = queryKey as [string, number];

    try {
        const response = await api.get(`/entities/accounts/${accountId}`);
        return response.data;
    } catch (error: any) {
        // Handle authentication errors specifically
        if (error.response?.status === 401) {
            throw new Error("Authentication required. Please log in.");
        }

        if (error.response?.status === 404) {
            throw new Error(`Account with ID ${accountId} not found.`);
        }

        throw new Error(`Failed to fetch account with ID: ${accountId}`);
    }
};

// Fetch users with search, filter, and pagination
export const fetchUsersByAccountId: QueryFunction<UserResponse> = async ({
    queryKey,
}) => {
    const [, { accountId, page, limit }] = queryKey as [
        string,
        {
            accountId: number;
            page: number;
            limit: number;
        },
    ];

    try {
        const response = await api.get("/entities/users", {
            params: {
                page,
                limit,
                account_id: accountId,
            },
        });
        return response.data;
    } catch (error: any) {
        // Handle authentication errors specifically
        if (error.response?.status === 401) {
            throw new Error("Authentication required. Please log in.");
        }

        throw new Error("Failed to fetch users");
    }
};

export const fetchDisputeReasonsByAccountId: QueryFunction<
    DisputeReasonResponse
> = async ({ queryKey }) => {
    const [, { page, limit, status, editable }] = queryKey as [
        string,
        {
            page: number;
            limit: number;
            status: string;
            editable: string;
        },
    ];

    try {
        const response = await api.get("/operations/dispute-reasons", {
            params: {
                page,
                limit,
                status: status || "",
                editable: editable !== undefined ? editable.toString() : "true",
            },
        });
        return response.data;
    } catch (error: any) {
        // Handle authentication errors specifically
        if (error.response?.status === 401) {
            throw new Error("Authentication required. Please log in.");
        }

        throw new Error("Failed to fetch dispute reasons");
    }
};

export async function directFetchCustomerById(id: number) {
    try {
        const response = await api.get(`/entities/accounts/${id}`);
        return response.data as Account;
    } catch (error: any) {
        // Handle authentication errors specifically
        if (error.response?.status === 401) {
            throw new Error("Authentication required. Please log in.");
        }

        if (error.response?.status === 404) {
            throw new Error(`Account with ID ${id} not found.`);
        }

        throw new Error("Failed to fetch account by ID");
    }
}

export const fetchCustomerLocale = async (
    accountId: number
): Promise<string> => {
    try {
        const res = await api.get(`/entities/accounts/${accountId}`);
        const data = res.data;
        return data.locale || "en-US";
    } catch (error) {
        throw new Error("Failed to fetch account locale");
    }
};
