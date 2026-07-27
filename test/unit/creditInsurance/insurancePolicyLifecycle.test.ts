import { describe, expect, it } from "vitest";

import {
    canSetInsurancePolicyStatusActive,
    effectivelyActivePrismaWhere,
    isInsurancePolicyBeforeStartDate,
    isInsurancePolicyPastEndDate,
    isPrimaryPolicyAssignable,
    isPrimaryPolicyEffectivelyActive,
    isPrimaryPolicyEligibleForManualActivation,
    isTopUpInsurancePolicyEffectivelyActive,
    isTodayWithinInsurancePolicyTerm,
    primaryEffectivelyActivePrismaWhere,
    resolveAutoActivateOnTermStart,
    resolveInsurancePolicyStatusOnCreate,
    resolveInsurancePolicyStatusOnUpdate,
    shouldNotifyPolicyEligibleForActivation,
    startOfTodayUtc,
    topUpEffectivelyActivePrismaWhere,
    validatePrimaryPolicyDateRange,
} from "@/shared/creditInsurance/insurancePolicyLifecycle";

const today = startOfTodayUtc(new Date("2026-06-21T15:00:00.000Z"));

describe("insurancePolicyLifecycle", () => {
    it("treats end_date as inclusive through that calendar day", () => {
        expect(isInsurancePolicyPastEndDate("2026-06-21", today)).toBe(false);
        expect(isInsurancePolicyPastEndDate("2026-06-20", today)).toBe(true);
    });

    it("detects future start dates", () => {
        expect(isInsurancePolicyBeforeStartDate("2026-06-22", today)).toBe(
            true
        );
        expect(isInsurancePolicyBeforeStartDate("2026-06-21", today)).toBe(
            false
        );
    });

    it("validates start/end ordering", () => {
        expect(() =>
            validatePrimaryPolicyDateRange("2026-06-22", "2026-06-01")
        ).toThrow(/end_date must be on or after start_date/);
    });

    it("detects today within policy term", () => {
        expect(
            isTodayWithinInsurancePolicyTerm(
                "2026-06-01",
                "2026-06-30",
                today
            )
        ).toBe(true);
        expect(
            isTodayWithinInsurancePolicyTerm(
                "2026-06-22",
                "2026-06-30",
                today
            )
        ).toBe(false);
    });

    it("requires full term for Active status", () => {
        expect(
            canSetInsurancePolicyStatusActive("2026-06-01", "2026-06-20", today)
        ).toBe(false);
        expect(
            canSetInsurancePolicyStatusActive("2026-06-01", "2026-06-21", today)
        ).toBe(true);
        expect(
            canSetInsurancePolicyStatusActive("2026-06-22", "2026-06-30", today)
        ).toBe(false);
    });

    it("does not auto-activate Inactive when end_date changes into valid term", () => {
        const resolved = resolveInsurancePolicyStatusOnUpdate({
            policyKind: "Primary",
            requestedStatus: "Inactive",
            startDate: "2026-01-01",
            endDate: "2026-12-31",
            todayUtc: today,
        });
        expect(resolved).toBe("Inactive");
    });

    it("resolves auto_activate_on_term_start for scheduled inactive policies", () => {
        expect(
            resolveAutoActivateOnTermStart({
                policyKind: "Primary",
                status: "Inactive",
                startDate: "2026-07-01",
            })
        ).toBe(true);
        expect(
            resolveAutoActivateOnTermStart({
                policyKind: "Primary",
                status: "Inactive",
                startDate: "2026-07-01",
                bodyFlag: false,
            })
        ).toBe(false);
        expect(
            resolveAutoActivateOnTermStart({
                policyKind: "Primary",
                status: "Inactive",
                startDate: "2026-06-01",
                endDate: "2026-12-31",
            })
        ).toBe(false);
        expect(
            resolveAutoActivateOnTermStart({
                policyKind: "TopUp",
                status: "Inactive",
                startDate: "2026-07-01",
            })
        ).toBe(false);
    });

    it("notifies when end_date extension makes Inactive policy eligible", () => {
        expect(
            shouldNotifyPolicyEligibleForActivation({
                policyKind: "Primary",
                previousEndDate: "2026-06-20",
                nextEndDate: "2026-12-31",
                startDate: "2026-01-01",
                status: "Inactive",
                todayUtc: today,
            })
        ).toBe(true);
    });

    it("throws when requesting Active before start_date", () => {
        expect(() =>
            resolveInsurancePolicyStatusOnCreate({
                policyKind: "Primary",
                requestedStatus: "Active",
                startDate: "2026-06-22",
                endDate: "2026-12-31",
                todayUtc: today,
            })
        ).toThrow(/start date/);
    });

    it("evaluates assignable primary policy", () => {
        expect(
            isPrimaryPolicyAssignable({
                status: "Active",
                startDate: "2026-06-01",
                endDate: "2026-06-30",
                todayUtc: today,
            })
        ).toBe(true);
        expect(
            isPrimaryPolicyAssignable({
                status: "Inactive",
                startDate: "2026-06-01",
                endDate: "2026-06-30",
                todayUtc: today,
            })
        ).toBe(false);
    });

    it("detects manual activation eligibility banner state", () => {
        expect(
            isPrimaryPolicyEligibleForManualActivation({
                policyKind: "Primary",
                status: "Inactive",
                startDate: "2026-06-01",
                endDate: "2026-12-31",
                todayUtc: today,
            })
        ).toBe(true);
        expect(
            isPrimaryPolicyEligibleForManualActivation({
                policyKind: "Primary",
                status: "Draft",
                startDate: "2026-06-01",
                endDate: "2026-12-31",
                todayUtc: today,
            })
        ).toBe(false);
    });

    it("evaluates parent effective active state", () => {
        expect(
            isPrimaryPolicyEffectivelyActive({
                status: "Active",
                startDate: "2026-06-01",
                endDate: "2026-06-30",
                todayUtc: today,
            })
        ).toBe(true);
    });

    it("evaluates top-up insurance policy effective active state", () => {
        expect(
            isTopUpInsurancePolicyEffectivelyActive({
                topUpStatus: "Active",
                parentPolicyId: 10,
                parentStatus: "Active",
                parentStartDate: "2026-06-01",
                parentEndDate: "2026-06-30",
                todayUtc: today,
            })
        ).toBe(true);
        expect(
            isTopUpInsurancePolicyEffectivelyActive({
                topUpStatus: "Inactive",
                parentPolicyId: 10,
                parentStatus: "Active",
                parentStartDate: "2026-06-01",
                parentEndDate: "2026-06-30",
                todayUtc: today,
            })
        ).toBe(false);
        expect(
            isTopUpInsurancePolicyEffectivelyActive({
                topUpStatus: "Active",
                parentPolicyId: 10,
                parentStatus: "Active",
                parentStartDate: "2026-06-01",
                parentEndDate: "2026-06-20",
                todayUtc: today,
            })
        ).toBe(false);
        expect(
            isTopUpInsurancePolicyEffectivelyActive({
                topUpStatus: "Active",
                parentPolicyId: null,
                parentStatus: "Active",
                parentStartDate: "2026-06-01",
                parentEndDate: "2026-06-30",
                todayUtc: today,
            })
        ).toBe(false);
    });

    it("builds Prisma where clauses for effective status", () => {
        expect(primaryEffectivelyActivePrismaWhere(today)).toEqual({
            policy_kind: "Primary",
            status: "Active",
            start_date: { lte: today },
            end_date: { gte: today },
        });
        expect(topUpEffectivelyActivePrismaWhere(today)).toEqual({
            policy_kind: "TopUp",
            status: "Active",
            ParentInsurancePolicy: {
                is: {
                    status: "Active",
                    start_date: { lte: today },
                    end_date: { gte: today },
                },
            },
        });
        expect(effectivelyActivePrismaWhere(today)).toEqual({
            OR: [
                primaryEffectivelyActivePrismaWhere(today),
                topUpEffectivelyActivePrismaWhere(today),
            ],
        });
    });
});
