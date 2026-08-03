/**
 * Stage 1B — OpenAPI client wrapper smoke (no network).
 */
import { describe, expect, it } from "vitest";
import { createNestClient } from "@archaser/openapi-client";

describe("nestOpenApiClient / @archaser/openapi-client", () => {
    it("createNestClient exposes health + product helpers", () => {
        const client = createNestClient({
            baseUrl: "https://staging.archaser.com",
            tokens: { getAccessToken: () => null },
        });
        expect(typeof client.health).toBe("function");
        expect(typeof client.me).toBe("function");
        expect(typeof client.listCustomers).toBe("function");
        expect(typeof client.billingConnector.get).toBe("function");
        expect(typeof client.reports.execute).toBe("function");
        expect(typeof client.request).toBe("function");
    });
});
