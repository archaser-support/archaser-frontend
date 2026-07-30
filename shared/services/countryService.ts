import { Country, State } from "@/types/db";
import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";

export const fetchCountries: QueryFunction<Country[]> = async ({
    queryKey,
}) => {
    try {
        const response = await api.get("/system/country");
        // Debug logging removed for production
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch data");
    }
};

export const fetchStates: QueryFunction<State[]> = async ({ queryKey }) => {
    const [, country_id] = queryKey as [string, string];
    try {
        const response = await api.get("/system/states", {
            params: { country_id },
        });
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch data");
    }
};
