/**
 * Stage 1B — typed Nest client for Amplify / Nest UI mode.
 * Prefer this for new call sites; existing axios/`apiFetch` remain supported.
 */
import { createNestClient } from "@archaser/openapi-client";
import { getNestAccessToken, getNestApiBaseUrl } from "@/utils/nestAuth";

let cached: ReturnType<typeof createNestClient> | null = null;

export function getNestOpenApiClient() {
    const baseUrl = getNestApiBaseUrl();
    if (!cached) {
        cached = createNestClient({
            baseUrl,
            tokens: {
                getAccessToken: () => getNestAccessToken(),
            },
        });
    }
    return cached;
}

export type NestOpenApiClient = ReturnType<typeof createNestClient>;
