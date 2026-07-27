import { afterEach, describe, expect, it } from "vitest";

import {
    decryptCredentials,
    encryptCredentials,
} from "@/server/utils/billingConnectorCrypto";

const TEST_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("billingConnectorCrypto", () => {
    const originalKey = process.env.BILLING_CONNECTOR_ENCRYPTION_KEY;

    afterEach(() => {
        if (originalKey === undefined) {
            delete process.env.BILLING_CONNECTOR_ENCRYPTION_KEY;
        } else {
            process.env.BILLING_CONNECTOR_ENCRYPTION_KEY = originalKey;
        }
    });

    it("round-trips credential objects", () => {
        process.env.BILLING_CONNECTOR_ENCRYPTION_KEY = TEST_KEY;
        const plain = { token: "pat-secret-value" };
        const encrypted = encryptCredentials(plain);
        expect(encrypted).not.toContain("pat-secret");
        expect(decryptCredentials(encrypted)).toEqual(plain);
    });

    it("throws when encryption key is missing", () => {
        delete process.env.BILLING_CONNECTOR_ENCRYPTION_KEY;
        expect(() => encryptCredentials({ token: "x" })).toThrow(
            /BILLING_CONNECTOR_ENCRYPTION_KEY/
        );
    });
});
