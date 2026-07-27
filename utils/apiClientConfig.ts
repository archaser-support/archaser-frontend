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
