import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
    CUSTOMER_POLICY_VERSIONING_ALLOWLIST,
    hasMeaningfulCustomerPolicyFieldChange,
} from "@/server/services/creditInsurance/hasMeaningfulCustomerPolicyFieldChange";

const baseSnapshot = {
    insurance_policy_id: 5,
    customer_number_policy: "CN-1",
    limit_type: "DCL" as const,
    approved_limit: new Prisma.Decimal("10000"),
    approved_limit_currency: "USD",
    approved_limit_expiration_date: new Date("2027-06-01T00:00:00.000Z"),
    zero_limit_date: null,
    max_payment_term: 30,
    max_allowed_mep: 90,
    reporting_days: 7,
    excluded_from_policy: false,
    policy_exclusion_reason: null,
    credit_score: new Prisma.Decimal("75"),
    credit_score_input_date: new Date("2026-01-15T00:00:00.000Z"),
    active_customer_since: new Date("2020-03-01T00:00:00.000Z"),
};

describe("hasMeaningfulCustomerPolicyFieldChange", () => {
    it("returns false when snapshots are identical", () => {
        expect(
            hasMeaningfulCustomerPolicyFieldChange(baseSnapshot, {
                ...baseSnapshot,
            })
        ).toBe(false);
    });

    it("returns true when an allowlisted field changes", () => {
        expect(
            hasMeaningfulCustomerPolicyFieldChange(baseSnapshot, {
                ...baseSnapshot,
                approved_limit: new Prisma.Decimal("15000"),
            })
        ).toBe(true);
    });

    it("treats decimal string and Decimal as equal", () => {
        expect(
            hasMeaningfulCustomerPolicyFieldChange(baseSnapshot, {
                ...baseSnapshot,
                approved_limit: "10000",
            })
        ).toBe(false);
    });

    it("treats null and empty string as equal for strings", () => {
        expect(
            hasMeaningfulCustomerPolicyFieldChange(
                { ...baseSnapshot, policy_exclusion_reason: null },
                { ...baseSnapshot, policy_exclusion_reason: "" }
            )
        ).toBe(false);
    });

    it("detects trimmed string differences", () => {
        expect(
            hasMeaningfulCustomerPolicyFieldChange(baseSnapshot, {
                ...baseSnapshot,
                customer_number_policy: " CN-1 ",
            })
        ).toBe(false);
        expect(
            hasMeaningfulCustomerPolicyFieldChange(baseSnapshot, {
                ...baseSnapshot,
                customer_number_policy: "CN-2",
            })
        ).toBe(true);
    });

    it("compares dates by timestamp", () => {
        expect(
            hasMeaningfulCustomerPolicyFieldChange(baseSnapshot, {
                ...baseSnapshot,
                zero_limit_date: new Date("2026-05-01T00:00:00.000Z"),
            })
        ).toBe(true);
        expect(
            hasMeaningfulCustomerPolicyFieldChange(
                {
                    ...baseSnapshot,
                    zero_limit_date: new Date("2026-05-01T00:00:00.000Z"),
                },
                {
                    ...baseSnapshot,
                    zero_limit_date: "2026-05-01T00:00:00.000Z",
                }
            )
        ).toBe(false);
    });

    it("ignores fields outside the allowlist", () => {
        expect(
            hasMeaningfulCustomerPolicyFieldChange(
                { ...baseSnapshot, outdated_dcl: false } as typeof baseSnapshot,
                { ...baseSnapshot, outdated_dcl: true } as typeof baseSnapshot,
                CUSTOMER_POLICY_VERSIONING_ALLOWLIST
            )
        ).toBe(false);
    });

    it("respects a custom allowlist", () => {
        expect(
            hasMeaningfulCustomerPolicyFieldChange(
                baseSnapshot,
                { ...baseSnapshot, reporting_days: 14 },
                ["reporting_days"]
            )
        ).toBe(true);
        expect(
            hasMeaningfulCustomerPolicyFieldChange(
                baseSnapshot,
                { ...baseSnapshot, reporting_days: 14 },
                ["approved_limit"]
            )
        ).toBe(false);
    });

    it("detects month-end cutoff field changes", () => {
        expect(
            hasMeaningfulCustomerPolicyFieldChange(baseSnapshot, {
                ...baseSnapshot,
                mep_substitute_day_of_month: 3,
            })
        ).toBe(true);
        expect(
            hasMeaningfulCustomerPolicyFieldChange(
                { ...baseSnapshot, mep_cutoff_day_of_month: 24 },
                { ...baseSnapshot, mep_cutoff_day_of_month: 24 },
            )
        ).toBe(false);
        expect(
            hasMeaningfulCustomerPolicyFieldChange(baseSnapshot, {
                ...baseSnapshot,
                payment_term_cutoff_day_of_month: 24,
            })
        ).toBe(true);
    });
});
