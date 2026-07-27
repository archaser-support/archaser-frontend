import { describe, expect, it } from "vitest";

import { deriveExcludedFromPolicy } from "@/shared/creditInsurance/policyExclusion";

type ExclusionRow = {
    excluded_from_policy: boolean;
    policy_exclusion_reason: string | null;
};

function reconcileExclusionRow(row: ExclusionRow): ExclusionRow {
    const normalizedReason =
        row.policy_exclusion_reason != null &&
        row.policy_exclusion_reason.trim() === ""
            ? null
            : row.policy_exclusion_reason;
    const derivedExcluded = deriveExcludedFromPolicy(normalizedReason);
    return {
        policy_exclusion_reason: normalizedReason,
        excluded_from_policy: derivedExcluded,
    };
}

describe("policy exclusion datafix reconciliation", () => {
    it("clears excluded_from_policy when reason is empty (orphan true + empty reason)", () => {
        const result = reconcileExclusionRow({
            excluded_from_policy: true,
            policy_exclusion_reason: "",
        });
        expect(result).toEqual({
            policy_exclusion_reason: null,
            excluded_from_policy: false,
        });
    });

    it("sets excluded_from_policy true when reason is non-empty (orphan false + reason)", () => {
        const result = reconcileExclusionRow({
            excluded_from_policy: false,
            policy_exclusion_reason: "Credit hold",
        });
        expect(result).toEqual({
            policy_exclusion_reason: "Credit hold",
            excluded_from_policy: true,
        });
    });

    it("trims whitespace-only reason to null and clears derived boolean", () => {
        const result = reconcileExclusionRow({
            excluded_from_policy: true,
            policy_exclusion_reason: "   ",
        });
        expect(result).toEqual({
            policy_exclusion_reason: null,
            excluded_from_policy: false,
        });
    });

    it("leaves consistent rows unchanged", () => {
        expect(
            reconcileExclusionRow({
                excluded_from_policy: false,
                policy_exclusion_reason: null,
            })
        ).toEqual({
            policy_exclusion_reason: null,
            excluded_from_policy: false,
        });
        expect(
            reconcileExclusionRow({
                excluded_from_policy: true,
                policy_exclusion_reason: "Pending review",
            })
        ).toEqual({
            policy_exclusion_reason: "Pending review",
            excluded_from_policy: true,
        });
    });
});
