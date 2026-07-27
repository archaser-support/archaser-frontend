import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";
import { ActivityTemplateResponse } from "@/types/ActivitiesTemplate";

// Fetch customers with search, filter, and pagination
export const fetchActivityTemplates: QueryFunction<
    ActivityTemplateResponse
> = async ({ queryKey }) => {
    const [, { query, page, rowsPerPage, category, active }] = queryKey as [
        string,
        {
            query: string;
            page: number;
            rowsPerPage: number;
            category: string;
            active: string;
        },
    ];

    try {
        const response = await api.get("/activities/templates", {
            params: {
                page,
                rowsPerPage,
                query,
                category,
                active,
            },
        });

        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch activity templates");
    }
};
