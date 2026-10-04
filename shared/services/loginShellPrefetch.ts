const LOGIN_SHELL_PREFETCH_KEY = "loginShellPrefetch";
export const CREDIT_DASHBOARD_SUMMARY_PREFETCH_KEY =
    "creditDashboardSummaryPrefetch";
const PREFETCH_TTL_MS = 30_000;

export type LoginShellPrefetch = {
    userId: string;
    accountId: number | string;
    role?: string | null;
    permissions: { permissions: string[] };
    sessionAccount: unknown;
    fetchedAt: number;
};

export function storeLoginShellPrefetch(
    payload: Omit<LoginShellPrefetch, "fetchedAt">
): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        const record: LoginShellPrefetch = {
            ...payload,
            fetchedAt: Date.now(),
        };
        sessionStorage.setItem(LOGIN_SHELL_PREFETCH_KEY, JSON.stringify(record));
    } catch {
        sessionStorage.removeItem(LOGIN_SHELL_PREFETCH_KEY);
    }
}

export function readLoginShellPrefetch(options: {
    userId?: string | number | null;
    accountId?: number | string | null;
}): LoginShellPrefetch | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    try {
        const raw = sessionStorage.getItem(LOGIN_SHELL_PREFETCH_KEY);
        if (!raw) {
            return undefined;
        }
        const record = JSON.parse(raw) as LoginShellPrefetch;
        if (
            typeof record.fetchedAt !== "number" ||
            Date.now() - record.fetchedAt > PREFETCH_TTL_MS
        ) {
            sessionStorage.removeItem(LOGIN_SHELL_PREFETCH_KEY);
            return undefined;
        }
        if (
            options.userId != null &&
            String(record.userId) !== String(options.userId)
        ) {
            return undefined;
        }
        if (
            options.accountId != null &&
            String(record.accountId) !== String(options.accountId)
        ) {
            return undefined;
        }
        if (!record.permissions || !Array.isArray(record.permissions.permissions)) {
            sessionStorage.removeItem(LOGIN_SHELL_PREFETCH_KEY);
            return undefined;
        }
        return record;
    } catch {
        sessionStorage.removeItem(LOGIN_SHELL_PREFETCH_KEY);
        return undefined;
    }
}

export function clearLoginShellPrefetch(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        sessionStorage.removeItem(LOGIN_SHELL_PREFETCH_KEY);
        sessionStorage.removeItem(CREDIT_DASHBOARD_SUMMARY_PREFETCH_KEY);
    } catch {
        // storage may be unavailable
    }
}
