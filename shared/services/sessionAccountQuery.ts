import api from "@/app/api";

/** Shared React Query key for the signed-in (effective) account shell payload. */
export function sessionAccountQueryKey(
    accountId: number | string | null | undefined
) {
    return ["session-account", accountId] as const;
}

const inflightByAccountId = new Map<string, Promise<any>>();

/**
 * Single-flight GET for session account so AppShell / header / theme
 * providers that race on mount share one network request.
 */
export async function fetchSessionAccountById(
    accountId: number | string
): Promise<any> {
    const key = String(accountId);
    const existing = inflightByAccountId.get(key);
    if (existing) {
        return existing;
    }

    const request = api
        .get(`/entities/accounts/${accountId}`)
        .then((response) => response.data)
        .finally(() => {
            // Clear on next tick so same-tick callers still join this promise.
            setTimeout(() => {
                if (inflightByAccountId.get(key) === request) {
                    inflightByAccountId.delete(key);
                }
            }, 0);
        });

    inflightByAccountId.set(key, request);
    return request;
}

export function accountProductsFromSessionAccount(account: any | undefined): {
    has_collection?: boolean;
    has_credit_insurance?: boolean;
    is_demo?: boolean;
} {
    if (!account) {
        return {
            has_collection: true,
            has_credit_insurance: false,
            is_demo: false,
        };
    }
    return {
        has_collection:
            account.has_collection !== undefined
                ? account.has_collection
                : true,
        has_credit_insurance: account.has_credit_insurance === true,
        is_demo: account.is_demo === true,
    };
}
