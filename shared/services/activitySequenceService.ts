import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";
import {
    ActivitySequence,
    ActivitySequenceResponse,
} from "@/types/ActivitiesSequence";

// Fetch customers with search, filter, and pagination
export const fetchActivitySequences: QueryFunction<
    ActivitySequenceResponse
> = async ({ queryKey }) => {
    const [, { query, page, rowsPerPage, activity_type, category, active }] =
        queryKey as [
            string,
            {
                query: string;
                status: string;
                page: number;
                rowsPerPage: number;
                activity_type: string;
                category: string;
                active: string;
            },
        ];

    try {
        const response = await api.get("/activities/sequences", {
            params: {
                page,
                limit: rowsPerPage,
                search: query,
                activity_type,
                category,
                active,
            },
        });
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch activity sequences");
    }
};
