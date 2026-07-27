import type {
    CustomerCheckpointRestoreSummary,
    CustomerCheckpointStatus,
} from "@/server/services/customerCheckpoint/types";

function checkpointUrl(customerId: number, action?: "save" | "restore"): string {
    const suffix =
        action === "save"
            ? "/save"
            : action === "restore"
              ? "/restore"
              : "";
    return `/api/customers/_/checkpoint${suffix}?customer_id=${customerId}`;
}

export function customerCheckpointQueryKey(customerId: number) {
    return ["customer-checkpoint", customerId] as const;
}

export async function fetchCustomerCheckpointStatus(
    customerId: number
): Promise<CustomerCheckpointStatus | null> {
    const response = await fetch(checkpointUrl(customerId));
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
            error?: string;
        };
        throw new Error(data.error || "Failed to fetch checkpoint status");
    }
    return response.json() as Promise<CustomerCheckpointStatus>;
}

export async function saveCustomerCheckpoint(
    customerId: number
): Promise<CustomerCheckpointStatus> {
    const response = await fetch(checkpointUrl(customerId, "save"), {
        method: "POST",
    });
    if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
            error?: string;
        };
        throw new Error(data.error || "Failed to save checkpoint");
    }
    return response.json() as Promise<CustomerCheckpointStatus>;
}

export async function restoreCustomerCheckpoint(
    customerId: number
): Promise<CustomerCheckpointRestoreSummary> {
    const response = await fetch(checkpointUrl(customerId, "restore"), {
        method: "POST",
    });
    if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
            error?: string;
        };
        throw new Error(data.error || "Failed to restore checkpoint");
    }
    return response.json() as Promise<CustomerCheckpointRestoreSummary>;
}
