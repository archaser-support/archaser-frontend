import { Country } from "@/types/db";
import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";
import { InvoiceStatus } from "@/types/InvoiceStatus";

export const fetchInvoiceStatus = async () => {
    try {
        const response = await api.get("/entities/invoices/status");
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch invoice status");
    }
};

// Orphan Credit Invoices functions - now using centralized backend service
export const fetchOrphanCreditInvoices = async (params: any = {}) => {
    try {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", params.page.toString());
        if (params.limit) queryParams.append("limit", params.limit.toString());
        if (params.sortField) queryParams.append("sortField", params.sortField);
        if (params.sortDirection)
            queryParams.append("sortDirection", params.sortDirection);
        if (params.query) queryParams.append("query", params.query);
        if (params.selectedUserId)
            queryParams.append("selectedUserId", params.selectedUserId);

        const response = await api.get(
            `/system/control-center?operation=orphan-credit-invoices&${queryParams.toString()}`
        );
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch orphan credit invoices");
    }
};

export const fetchAvailableInvoices = async (customerId: number) => {
    try {
        const response = await api.get(
            `/entities/invoices/available-for-credit/${customerId}`
        );
        const payload = response.data;
        return Array.isArray(payload) ? payload : payload?.items || [];
    } catch (error) {
        throw new Error("Failed to fetch available invoices");
    }
};

export const assignCreditToInvoice = async (
    creditInvoiceId: number,
    targetInvoiceId: number
) => {
    try {
        const response = await api.post("/entities/invoices/assign-credit", {
            creditInvoiceId,
            targetInvoiceId,
        });
        return response.data;
    } catch (error) {
        throw new Error("Failed to assign credit to invoice");
    }
};

export const updateInvoice = async (invoiceId: number, updates: any) => {
    try {
        const response = await api.put(`/entities/invoices/${invoiceId}`, updates);
        return response.data;
    } catch (error) {
        throw new Error("Failed to update invoice");
    }
};

// Invoices without customer function
export const fetchInvoicesWithoutCustomer = async (params: any = {}) => {
    try {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", params.page.toString());
        if (params.limit) queryParams.append("limit", params.limit.toString());
        if (params.sortField) queryParams.append("sortField", params.sortField);
        if (params.sortDirection)
            queryParams.append("sortDirection", params.sortDirection);
        if (params.query) queryParams.append("query", params.query);
        if (params.selectedUserId)
            queryParams.append("selectedUserId", params.selectedUserId);

        const response = await api.get(
            `/system/control-center?operation=invoices-without-customer&${queryParams.toString()}`
        );
        return response.data;
    } catch (error) {
        throw new Error("Failed to fetch invoices without customer");
    }
};
