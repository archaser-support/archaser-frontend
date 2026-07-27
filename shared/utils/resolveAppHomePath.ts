import type { AccountProducts } from "./accountProducts";
import {
    getDefaultLandingPage,
    getFirstAccessiblePage,
    isArchaserAdminAccount,
} from "./navigation";

const FALLBACK_HOME_PATH = "/app/dashboard";

/**
 * Default in-app landing path after login or from Access Denied "Go Home".
 * Mirrors post-login redirect in `login/page.tsx`.
 */
export function resolveAppHomePath(args: {
    accountId: number | string | null | undefined;
    permissions: string[];
    accountProducts?: AccountProducts;
}): string {
    const { accountId, permissions, accountProducts } = args;

    if (isArchaserAdminAccount(accountId)) {
        return getDefaultLandingPage(accountId);
    }

    return getFirstAccessiblePage(
        permissions,
        accountId ?? 0,
        accountProducts
    );
}

export const appHomePathFallback = FALLBACK_HOME_PATH;
