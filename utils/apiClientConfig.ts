import {
    resolveProductApiBaseUrl,
    shouldAttachNestBearer,
} from "@/utils/amplifyMode";

export type ApiAuthHeaderInput = {
    existingAuthorization?: string | null;
    nestAccessToken?: string | null;
    attachNestBearer?: boolean;
};

/** Pure helper for axios interceptor + unit tests. */
export function resolveAuthorizationHeader(
    input: ApiAuthHeaderInput
): string | undefined {
    if (input.existingAuthorization) {
        return input.existingAuthorization;
    }
    const attach =
        input.attachNestBearer ?? shouldAttachNestBearer();
    if (attach && input.nestAccessToken) {
        return `Bearer ${input.nestAccessToken}`;
    }
    return undefined;
}

export function getAxiosBaseUrl(): string {
    return resolveProductApiBaseUrl();
}

/**
 * Global overlay spinner tracks in-flight non-GET axios calls.
 * Billing integration actions already show button-level progress and must
 * not cover the page (backfill can run for a long time).
 */
export function shouldCountRequestForPageSpinner(input: {
    method?: string;
    url?: string;
}): boolean {
    const method = (input.method ?? "get").toLowerCase();
    if (method === "get") {
        return false;
    }
    const url = input.url ?? "";
    if (url.includes("/billing-connector")) {
        return false;
    }
    return true;
}
