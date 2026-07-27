import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";
import { PromiseToPayResponse } from "@/types/CustomerWithPromiseToPay";

export interface LegalCase {
    id: number;
    customer_id: number;
    customer: string;
    customer_number: string;
    amount_overdue: number;
    amount_formatted: string;
    days_past_due: number;
    customer_country: string;
    customer_state: string;
    customer_current_time: string;
    last_call: string | null;
    last_call_result: string | null;
    period_start_date: string;
    period_end_date: string | null;
    currency: string;
    date_moved_to_legal: string;
}

export interface LegalCasesResponse {
    legalCases: LegalCase[];
    totalRecords: number;
    currentPage: number;
    totalPages: number;
    currency: string;
    totalAmount: number;
    totalCustomers: number;
}

export interface LegalCasesParams {
    search?: string;
    page?: number;
    limit?: number;
    country?: string;
    outcome?: string;
    sortField?: string;
    sortDirection?: string;
}

export const fetchLegalCases: QueryFunction<LegalCasesResponse> = async ({
    queryKey,
}) => {
    const [, params] = queryKey as [string, LegalCasesParams];

    const {
        search = "",
        page = 1,
        limit = 10,
        country = "",
        sortField = "last_call",
        sortDirection = "desc",
    } = params;

    try {
        const response = await api.get("/operations/legal-cases", {
            params: {
                search,
                page,
                limit,
                country,
                sortField,
                sortDirection,
            },
        });
        return response.data;
    } catch (error) {
        // Error handling
        throw new Error("Failed to fetch legal cases");
    }
};

// Separate stats query for the stat cards (not affected by search)
export const fetchLegalStats: QueryFunction<LegalCasesResponse> = async () => {
    try {
        const response = await api.get("/operations/legal-cases/stats");
        return response.data;
    } catch (error) {
        // Error handling
        throw new Error("Failed to fetch legal stats");
    }
};
