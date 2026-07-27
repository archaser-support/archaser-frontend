import { describe, expect, it } from "vitest";

import {
    filterTopUpParentPolicyOptions,
    isEligibleTopUpParentPolicy,
} from "@/shared/creditInsurance/topUpParentPolicy";
import { startOfTodayUtc } from "@/shared/creditInsurance/insurancePolicyLifecycle";

const today = startOfTodayUtc(new Date("2026-06-21T15:00:00.000Z"));

describe("topUpParentPolicy", () => {
    it("accepts assignable Primary policies only", () => {
        expect(
            isEligibleTopUpParentPolicy(
                {
                    policy_kind: "Primary",
                    status: "Active",
                    start_date: "2026-06-01",
                    end_date: "2026-06-30",
                },
                today
            )
        ).toBe(true);
        expect(
            isEligibleTopUpParentPolicy(
                {
                    policy_kind: "TopUp",
                    status: "Active",
                    start_date: "2026-06-01",
                    end_date: "2026-06-30",
                },
                today
            )
        ).toBe(false);
        expect(
            isEligibleTopUpParentPolicy(
                {
                    policy_kind: "Primary",
                    status: "Inactive",
                    start_date: "2026-06-01",
                    end_date: "2026-06-30",
                },
                today
            )
        ).toBe(false);
        expect(
            isEligibleTopUpParentPolicy(
                {
                    policy_kind: "Primary",
                    status: "Active",
                    start_date: "2026-06-01",
                    end_date: "2026-06-20",
                },
                today
            )
        ).toBe(false);
    });

    it("falls back to Active Primary when dates are omitted", () => {
        expect(
            isEligibleTopUpParentPolicy({
                policy_kind: "Primary",
                status: "Active",
            })
        ).toBe(true);
        expect(
            isEligibleTopUpParentPolicy({
                policy_kind: "Primary",
                status: "Draft",
            })
        ).toBe(false);
    });

    it("filters parent options and excludes self", () => {
        const policies = [
            {
                id: 1,
                policy_kind: "Primary",
                status: "Active",
                start_date: "2026-06-01",
                end_date: "2026-06-30",
            },
            { id: 2, policy_kind: "TopUp", status: "Active" },
            {
                id: 3,
                policy_kind: "Primary",
                status: "Inactive",
                start_date: "2026-06-01",
                end_date: "2026-06-30",
            },
            {
                id: 4,
                policy_kind: "Primary",
                status: "Active",
                start_date: "2026-06-01",
                end_date: "2026-06-30",
            },
        ];
        expect(filterTopUpParentPolicyOptions(policies, { todayUtc: today })).toEqual([
            {
                id: 1,
                policy_kind: "Primary",
                status: "Active",
                start_date: "2026-06-01",
                end_date: "2026-06-30",
            },
            {
                id: 4,
                policy_kind: "Primary",
                status: "Active",
                start_date: "2026-06-01",
                end_date: "2026-06-30",
            },
        ]);
        expect(
            filterTopUpParentPolicyOptions(policies, {
                excludePolicyId: 4,
                todayUtc: today,
            })
        ).toEqual([
            {
                id: 1,
                policy_kind: "Primary",
                status: "Active",
                start_date: "2026-06-01",
                end_date: "2026-06-30",
            },
        ]);
    });
});
