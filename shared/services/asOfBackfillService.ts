import api from "@/app/api";

export type AsOfBackfillStatusValue =
    | "idle"
    | "running"
    | "paused"
    | "failed"
    | "complete";

export interface AsOfBackfillStatus {
    accountId: number;
    status: AsOfBackfillStatusValue;
    fromDate: string | null;
    toDate: string | null;
    lastCheckpoint: string | null;
    daysDone: number;
    daysTotal: number;
    lastError: string | null;
    startedAt: string | null;
    updatedAt: string | null;
}

function basePath(accountId: number): string {
    return `/api/credit-insurance/as-of-backfill/${accountId}`;
}

export async function fetchAsOfBackfillStatus(
    accountId: number
): Promise<AsOfBackfillStatus> {
    const response = await api.get(basePath(accountId));
    return response.data as AsOfBackfillStatus;
}

async function postAction(
    accountId: number,
    action: "start" | "pause" | "resume"
): Promise<AsOfBackfillStatus> {
    const response = await api.post(basePath(accountId), { action });
    return response.data as AsOfBackfillStatus;
}

export const startAsOfBackfill = (accountId: number) =>
    postAction(accountId, "start");
export const pauseAsOfBackfill = (accountId: number) =>
    postAction(accountId, "pause");
export const resumeAsOfBackfill = (accountId: number) =>
    postAction(accountId, "resume");
