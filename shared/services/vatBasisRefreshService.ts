import api from "@/app/api";

export type VatBasisRefreshStatusValue =
    | "idle"
    | "running"
    | "failed"
    | "complete";

export interface VatBasisRefreshStatus {
    status: VatBasisRefreshStatusValue;
    customersTotal: number;
    customersDone: number;
    lastError: string | null;
    requestedBy: string | null;
    startedAt: string | null;
    updatedAt: string | null;
    avgSecondsPerCustomer: number | null;
    estimatedSecondsRemaining: number | null;
}

function basePath(accountId: number | string): string {
    return `/api/entities/accounts/${accountId}/vat-basis-refresh`;
}

export async function fetchVatBasisRefreshStatus(
    accountId: number | string
): Promise<VatBasisRefreshStatus> {
    const response = await api.get(basePath(accountId));
    return response.data as VatBasisRefreshStatus;
}

export async function retryVatBasisRefresh(
    accountId: number | string
): Promise<VatBasisRefreshStatus> {
    const response = await api.post(`${basePath(accountId)}/retry`);
    return response.data as VatBasisRefreshStatus;
}
