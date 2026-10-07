import { nestFetch } from "@/utils/nestAuth";

/** Shared React Query key for the signed-in (effective) account shell payload. */
export function sessionAccountQueryKey(
    accountId: number | string | null | undefined
) {
    return ["session-account", accountId] as const;
}

const inflightByAccountId = new Map<string, Promise<any>>();

/**
 * Map Nest GET /auth/me into the account-shaped object AppShell / header expect.
 * Top-level product + sync fields are already effective-account (view-as aware).
 */
function sessionAccountFromMe(me: Record<string, unknown>) {
    return {
        id: me.effective_account_id ?? me.account_id,
        name: me.account_name ?? null,
        has_collection:
            me.has_collection !== undefined ? me.has_collection : true,
        has_credit_insurance: me.has_credit_insurance === true,
        is_demo: me.is_demo === true,
        last_sync_date: me.last_sync_date ?? null,
        primary_color: me.primary_color ?? null,
        secondary_color: me.secondary_color ?? null,
        chart_palette_color: me.chart_palette_color ?? null,
        currency: me.currency ?? null,
        effective_user_id: me.effective_user_id ?? null,
        effective_account_id: me.effective_account_id ?? null,
        effective_role: me.effective_role ?? null,
    };
}

/**
 * Single-flight GET for session shell via Nest GET /auth/me so AppShell /
 * header / theme providers that race on mount share one network request.
 * `accountId` remains the React Query cache key (effective account).
 */
export async function fetchSessionAccountById(
    accountId: number | string
): Promise<any> {
    const key = String(accountId);
    const existing = inflightByAccountId.get(key);
    if (existing) {
        return existing;
    }

    const request = nestFetch("/auth/me", { credentials: "include" })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error("Failed to load Nest profile");
            }
            return sessionAccountFromMe(
                (await response.json()) as Record<string, unknown>
            );
        })
        .finally(() => {
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
