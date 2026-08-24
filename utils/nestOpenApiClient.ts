/**
 * Stage 1B — typed Nest client for Amplify / Nest UI mode.
 * Prefer this for new call sites; existing axios/`apiFetch` remain supported.
 *
 * Product paths on this client already include `/api/...`. Use
 * `resolveProductApiOrigin()` (same-origin locally) so reports/SMS/connectors
 * still hit Next/nginx peels instead of main Nest.
 */
import { createNestClient } from "@archaser/openapi-client";
import { resolveProductApiOrigin } from "@/utils/amplifyMode";
import { getNestAccessToken } from "@/utils/nestAuth";

let cached: ReturnType<typeof createNestClient> | null = null;

export function getNestOpenApiClient() {
    if (!cached) {
        cached = createNestClient({
            baseUrl: resolveProductApiOrigin(),
            tokens: {
                getAccessToken: () => getNestAccessToken(),
            },
        });
    }
    return cached;
}

export type NestOpenApiClient = ReturnType<typeof createNestClient>;
