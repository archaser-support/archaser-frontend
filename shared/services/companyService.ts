import { Company, Country } from "@prisma/client";
import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";

export const fetchCompanies: QueryFunction<
    Pick<Company, "id" | "name">[]
> = async ({ queryKey }) => {
    try {
        const response = await api.get("/system/company");
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch data");
    }
};

// Create Company
export const createCompany = async (
    companyData: Pick<Company, "name" | "company_number">
): Promise<Company> => {
    try {
        const response = await api.post("/system/company", companyData);
        return response.data;
    } catch (error: any) {
        throw new Error(
            error?.response?.data?.error || "Failed to create company"
        );
    }
};
