import { describe, expect, it } from "vitest";

import {
    buildPolicyHistoryHeaderAuditSegment,
    resolveCustomerPolicyHistoryChipKind,
    resolveUserAuditDisplayName,
} from "@/shared/creditInsurance/customerPolicyHistoryPresentation";

describe("resolveUserAuditDisplayName", () => {
    it("prefers name, then full name, then email", () => {
        expect(
            resolveUserAuditDisplayName({
                name: "Display Name",
                first_name: "A",
                last_name: "B",
                email: "a@example.com",
            })
        ).toBe("Display Name");
        expect(
            resolveUserAuditDisplayName({
                first_name: "Ada",
                last_name: "Lovelace",
                email: "a@example.com",
            })
        ).toBe("Ada Lovelace");
        expect(
            resolveUserAuditDisplayName({
                email: "a@example.com",
            })
        ).toBe("a@example.com");
    });

    it("returns null when user is missing or empty", () => {
        expect(resolveUserAuditDisplayName(null)).toBeNull();
        expect(resolveUserAuditDisplayName({})).toBeNull();
    });
});

describe("resolveCustomerPolicyHistoryChipKind", () => {
    it("returns previous_version when policy ids match", () => {
        expect(
            resolveCustomerPolicyHistoryChipKind({
                inactiveInsurancePolicyId: 5,
                activeInsurancePolicyId: 5,
            })
        ).toBe("previous_version");
        expect(
            resolveCustomerPolicyHistoryChipKind({
                inactiveInsurancePolicyId: null,
                activeInsurancePolicyId: null,
            })
        ).toBe("previous_version");
    });

    it("returns previous_policy when policy ids differ", () => {
        expect(
            resolveCustomerPolicyHistoryChipKind({
                inactiveInsurancePolicyId: 5,
                activeInsurancePolicyId: 9,
            })
        ).toBe("previous_policy");
        expect(
            resolveCustomerPolicyHistoryChipKind({
                inactiveInsurancePolicyId: null,
                activeInsurancePolicyId: 9,
            })
        ).toBe("previous_policy");
    });
});

describe("buildPolicyHistoryHeaderAuditSegment", () => {
    const formatDate = (value: Date | string) => `FMT:${String(value)}`;

    it("returns formatted segment when both audit values exist", () => {
        expect(
            buildPolicyHistoryHeaderAuditSegment({
                modifiedAt: "2026-06-01T12:00:00.000Z",
                modifiedByDisplayName: "Jane Doe",
                formatDate,
            })
        ).toBe("FMT:2026-06-01T12:00:00.000Z · Jane Doe");
    });

    it("returns null when date or display name is missing", () => {
        expect(
            buildPolicyHistoryHeaderAuditSegment({
                modifiedAt: null,
                modifiedByDisplayName: "Jane Doe",
                formatDate,
            })
        ).toBeNull();
        expect(
            buildPolicyHistoryHeaderAuditSegment({
                modifiedAt: "2026-06-01T12:00:00.000Z",
                modifiedByDisplayName: "  ",
                formatDate,
            })
        ).toBeNull();
    });
});
