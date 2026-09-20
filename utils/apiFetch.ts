import {
    getAxiosBaseUrl,
    resolveAuthorizationHeader,
} from "@/utils/apiClientConfig";
import { shouldAttachNestBearer } from "@/utils/amplifyMode";
import { getNestAccessToken, handleExpiredNestSession } from "@/utils/nestAuth";

/**
 * Join Nest product API base (`…/api`) with a path that may be `/api/foo` or `/foo`.
 */
export function resolveProductRequestUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    const base = getAxiosBaseUrl().replace(/\/$/, "");
    let path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    if (path === "/api" || path.startsWith("/api/")) {
        path = path === "/api" ? "" : path.slice(4);
    }
    if (!path.startsWith("/")) {
        path = `/${path}`;
    }
    return `${base}${path}`;
}

/** Strip a leading `/api` so axios baseURL (`…/api`) is not doubled. */
export function normalizeProductApiPath(path: string): string {
    if (!path.startsWith("/")) {
        return path;
    }
    if (path === "/api") {
        return "/";
    }
    if (path.startsWith("/api/")) {
        return path.slice(4);
    }
    return path;
}

/**
 * Browser `fetch` for product APIs — Nest base URL + Bearer in Nest UI mode.
 * Pass paths like `/api/entities/customers` or `/entities/customers`.
 *
 * Public portal leaves stay anonymous: do not attach the agent Bearer (and do
 * not trip global 401 → login handoff) when a customer is browsing the portal
 * while an agent session also exists in the same browser.
 */
function isPublicPortalProductPath(pathOrUrl: string): boolean {
    try {
        const path = (
            /^https?:\/\//i.test(pathOrUrl)
                ? new URL(pathOrUrl).pathname
                : pathOrUrl.split("?")[0]
        ).replace(/\/+$/, "") || "/";

        if (path === "/api/portal" || path.startsWith("/api/portal/")) {
            return true;
        }
        // After peel, relative product paths can look like `/portal/...`
        if (path === "/portal" || path.startsWith("/portal/")) {
            return true;
        }
        return /^\/(?:api\/)?customers\/[^/]+\/(portal-data|agent-portal|invoices|bank-details|banks|disputes|create-dispute|view-disputes|wrong-contact)$/.test(
            path
        );
    } catch {
        return false;
    }
}

export async function apiFetch(
    input: string,
    init: RequestInit = {}
): Promise<Response> {
    const url = resolveProductRequestUrl(input);
    const headers = new Headers(init.headers || {});
    const publicPortal =
        isPublicPortalProductPath(input) || isPublicPortalProductPath(url);

    const existing =
        headers.get("Authorization") || headers.get("authorization");
    const authorization = publicPortal
        ? existing || undefined
        : resolveAuthorizationHeader({
              existingAuthorization: existing,
              nestAccessToken: getNestAccessToken(),
              attachNestBearer: shouldAttachNestBearer(),
          });
    if (authorization) {
        headers.set("Authorization", authorization);
    }

    if (
        !shouldAttachNestBearer() &&
        typeof document !== "undefined" &&
        !headers.has("X-CSRF-Token")
    ) {
        const csrfToken = document.cookie
            .split("; ")
            .find((row) => row.startsWith("csrf-token="))
            ?.split("=")[1];
        if (csrfToken) {
            headers.set("X-CSRF-Token", csrfToken);
        }
    }

    const response = await fetch(url, {
        ...init,
        headers,
        credentials: shouldAttachNestBearer()
            ? init.credentials ?? "omit"
            : init.credentials ?? "include",
    });
    if (!publicPortal && shouldAttachNestBearer() && response.status === 401) {
        await handleExpiredNestSession();
    }
    return response;
}
