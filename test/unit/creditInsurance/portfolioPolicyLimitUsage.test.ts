import { describe, expect, it } from "vitest";

import {
    aggregatePortfolioPolicyLimitUsage,
    computeCustomerPolicyLimitUsageSegments,
    isApprovedLimitExpired,
    isEligiblePolicyLimitUsageRow,
    type PolicyLimitUsageRowInput,
} from "@/server/services/creditInsurance/portfolioPolicyLimitUsage";

function baseRow(
    overrides: Partial<PolicyLimitUsageRowInput> = {}
): PolicyLimitUsageRowInput {
    return {
        limitType: "Named",
        openArAccount: 100,
        approvedLimitAccount: 100,
        topUpTotalAccount: 0,
        isActive: true,
        isCollectionActive: true,
        excludedFromPolicy: false,
        outdatedDcl: false,
        approvedLimitExpirationDate: null,
        ...overrides,
    };
}

describe("computeCustomerPolicyLimitUsageSegments", () => {
    it("splits used, remaining, and uncovered without top-up", () => {
        const segments = computeCustomerPolicyLimitUsageSegments({
            openArAccount: 120,
            approvedLimitAccount: 100,
            topUpTotalAccount: 0,
        });
        expect(segments.usedWithinLimit).toBe(100);
        expect(segments.remaining).toBe(0);
        expect(segments.topUpCoveredExcess).toBe(0);
        expect(segments.uncoveredExposure).toBe(20);
    });

    it("keeps base usage uncovered at zero when top-up covers above-base AR", () => {
        const segments = computeCustomerPolicyLimitUsageSegments({
            openArAccount: 120,
            approvedLimitAccount: 100,
            topUpTotalAccount: 50,
        });
        expect(segments.usedWithinLimit).toBe(100);
        expect(segments.remaining).toBe(0);
        expect(segments.topUpCoveredExcess).toBe(20);
        expect(segments.uncoveredExposure).toBe(0);
    });
});

describe("isEligiblePolicyLimitUsageRow", () => {
    const asOf = new Date("2026-07-15T12:00:00.000Z");

    it("requires active policy, non-excluded, non-outdated, positive limit, Named or DCL (Active or Inactive collection)", () => {
        expect(isEligiblePolicyLimitUsageRow(baseRow(), asOf)).toBe(true);
        expect(
            isEligiblePolicyLimitUsageRow(
                baseRow({ isCollectionActive: false }),
                asOf
            )
        ).toBe(true);
        expect(
            isEligiblePolicyLimitUsageRow(baseRow({ isActive: false }), asOf)
        ).toBe(false);
        expect(
            isEligiblePolicyLimitUsageRow(
                baseRow({ excludedFromPolicy: true }),
                asOf
            )
        ).toBe(false);
        expect(
            isEligiblePolicyLimitUsageRow(baseRow({ outdatedDcl: true }), asOf)
        ).toBe(false);
        expect(
            isEligiblePolicyLimitUsageRow(
                baseRow({ approvedLimitAccount: 0 }),
                asOf
            )
        ).toBe(false);
        expect(
            isEligiblePolicyLimitUsageRow(
                baseRow({ approvedLimitAccount: -5 }),
                asOf
            )
        ).toBe(false);
        expect(
            isEligiblePolicyLimitUsageRow(baseRow({ limitType: null }), asOf)
        ).toBe(false);
    });

    it("excludes expired approved limits (UTC date before as-of)", () => {
        expect(
            isApprovedLimitExpired(new Date("2026-07-14T00:00:00.000Z"), asOf)
        ).toBe(true);
        expect(
            isApprovedLimitExpired(new Date("2026-07-15T00:00:00.000Z"), asOf)
        ).toBe(false);
        expect(
            isEligiblePolicyLimitUsageRow(
                baseRow({
                    approvedLimitExpirationDate: new Date(
                        "2026-07-01T00:00:00.000Z"
                    ),
                }),
                asOf
            )
        ).toBe(false);
    });
});

describe("aggregatePortfolioPolicyLimitUsage", () => {
    const asOf = new Date("2026-07-15T12:00:00.000Z");

    it("aggregates Named, DCL/SDL, and combined category totals", () => {
        const result = aggregatePortfolioPolicyLimitUsage(
            [
                baseRow({
                    limitType: "Named",
                    openArAccount: 120,
                    approvedLimitAccount: 100,
                }),
                baseRow({
                    limitType: "DCL",
                    openArAccount: 80,
                    approvedLimitAccount: 200,
                }),
            ],
            asOf
        );

        expect(result.named.openAr).toBe(120);
        expect(result.named.approvedLimit).toBe(100);
        expect(result.named.usedWithinLimit).toBe(100);
        expect(result.named.remaining).toBe(0);
        expect(result.named.uncoveredExposure).toBe(20);
        expect(result.named.usagePct).toBe(100);

        expect(result.dclSdl.openAr).toBe(80);
        expect(result.dclSdl.approvedLimit).toBe(200);
        expect(result.dclSdl.usedWithinLimit).toBe(80);
        expect(result.dclSdl.remaining).toBe(120);
        expect(result.dclSdl.usagePct).toBe(40);

        // Combined: sum of per-customer segments (Named over + DCL under).
        expect(result.combined.openAr).toBe(200);
        expect(result.combined.approvedLimit).toBe(300);
        expect(result.combined.usedWithinLimit).toBe(180);
        expect(result.combined.remaining).toBe(120);
        expect(result.combined.uncoveredExposure).toBe(20);
        expect(result.combined.usagePct).toBeCloseTo((180 / 300) * 100, 5);
    });

    it("sums per-customer used/remaining (does not net headroom across customers)", () => {
        const result = aggregatePortfolioPolicyLimitUsage(
            [
                baseRow({
                    limitType: "Named",
                    openArAccount: 150,
                    approvedLimitAccount: 100,
                }),
                baseRow({
                    limitType: "Named",
                    openArAccount: 40,
                    approvedLimitAccount: 100,
                }),
            ],
            asOf
        );

        // Used within 140 / limit 200 = 70% (open AR 190 is not the usage numerator).
        expect(result.named.openAr).toBe(190);
        expect(result.named.approvedLimit).toBe(200);
        expect(result.named.usagePct).toBe(70);
        expect(result.named.usedWithinLimit).toBe(140);
        expect(result.named.remaining).toBe(60);
        expect(result.named.uncoveredExposure).toBe(50);
    });

    it("includes Inactive collection customers; still omits policy-excluded", () => {
        // Named 5k+10k+5k; excluded 15k omitted.
        const result = aggregatePortfolioPolicyLimitUsage(
            [
                baseRow({
                    openArAccount: 6_600,
                    approvedLimitAccount: 5_000,
                }),
                baseRow({
                    isCollectionActive: false,
                    openArAccount: 0,
                    approvedLimitAccount: 10_000,
                }),
                baseRow({
                    openArAccount: 6_000,
                    approvedLimitAccount: 5_000,
                }),
                baseRow({
                    excludedFromPolicy: true,
                    openArAccount: 1_000,
                    approvedLimitAccount: 15_000,
                }),
            ],
            asOf
        );

        expect(result.named.openAr).toBe(12_600);
        expect(result.named.approvedLimit).toBe(20_000);
        expect(result.named.usagePct).toBe(50);
        // Per customer: 5k+0+5k used, 0+10k+0 remaining, 1.6k+0+1k uncovered.
        expect(result.named.usedWithinLimit).toBe(10_000);
        expect(result.named.remaining).toBe(10_000);
        expect(result.named.uncoveredExposure).toBe(2_600);
    });

    it("excludes inactive policy rows, excluded, outdated, expired, zero, and missing limits", () => {
        const result = aggregatePortfolioPolicyLimitUsage(
            [
                baseRow({ isActive: false, openArAccount: 999, approvedLimitAccount: 999 }),
                baseRow({
                    excludedFromPolicy: true,
                    openArAccount: 999,
                    approvedLimitAccount: 999,
                }),
                baseRow({
                    outdatedDcl: true,
                    limitType: "DCL",
                    openArAccount: 999,
                    approvedLimitAccount: 999,
                }),
                baseRow({
                    approvedLimitExpirationDate: new Date("2020-01-01T00:00:00.000Z"),
                    openArAccount: 999,
                    approvedLimitAccount: 999,
                }),
                baseRow({ approvedLimitAccount: 0, openArAccount: 50 }),
                baseRow({ limitType: null, openArAccount: 50, approvedLimitAccount: 50 }),
                baseRow({
                    limitType: "DCL",
                    openArAccount: 25,
                    approvedLimitAccount: 50,
                }),
            ],
            asOf
        );

        expect(result.combined.openAr).toBe(25);
        expect(result.combined.approvedLimit).toBe(50);
        expect(result.named.openAr).toBe(0);
        expect(result.dclSdl.openAr).toBe(25);
        expect(result.named.usagePct).toBe(0);
    });

    it("shows zero category totals when a category has no eligible rows", () => {
        const result = aggregatePortfolioPolicyLimitUsage(
            [
                baseRow({
                    limitType: "Named",
                    openArAccount: 50,
                    approvedLimitAccount: 100,
                }),
            ],
            asOf
        );
        expect(result.named.approvedLimit).toBe(100);
        expect(result.dclSdl.openAr).toBe(0);
        expect(result.dclSdl.approvedLimit).toBe(0);
        expect(result.dclSdl.usagePct).toBe(0);
    });

    it("allows usagePct below 100% when top-up expands effective approved capacity", () => {
        const result = aggregatePortfolioPolicyLimitUsage(
            [
                baseRow({
                    limitType: "DCL",
                    openArAccount: 120,
                    approvedLimitAccount: 100,
                    topUpTotalAccount: 50,
                }),
            ],
            asOf
        );
        expect(result.dclSdl.topUpTotal).toBe(50);
        expect(result.dclSdl.usagePct).toBe(100);
        expect(result.dclSdl.usedWithinLimit).toBe(100);
        expect(result.dclSdl.uncoveredExposure).toBe(0);
        expect(result.dclSdl.topUpCoveredExcess).toBe(20);
        expect(result.combined.usagePct).toBeCloseTo((100 / 150) * 100, 5);
    });

    it("covers top-up per customer instead of applying Σ top-up to net portfolio excess", () => {
        // Customer A over by 100 with 100 top-up; customer B under by 50 with unused top-up.
        // Portfolio net excess is only 50 — summing top-up capacity would over-cover.
        const result = aggregatePortfolioPolicyLimitUsage(
            [
                baseRow({
                    limitType: "Named",
                    openArAccount: 200,
                    approvedLimitAccount: 100,
                    topUpTotalAccount: 100,
                }),
                baseRow({
                    limitType: "Named",
                    openArAccount: 50,
                    approvedLimitAccount: 100,
                    topUpTotalAccount: 100,
                }),
            ],
            asOf
        );

        expect(result.named.openAr).toBe(250);
        expect(result.named.approvedLimit).toBe(200);
        expect(result.named.topUpTotal).toBe(200);
        // Named: base approved only → 150 / 200
        expect(result.named.usagePct).toBeCloseTo((150 / 200) * 100, 5);
        expect(result.named.usedWithinLimit).toBe(150);
        expect(result.named.remaining).toBe(50);
        expect(result.named.topUpCoveredExcess).toBe(100);
        expect(result.named.uncoveredExposure).toBe(0);
        // Not portfolio: min(max(0,250-200), 200) = 50.
        expect(result.named.topUpCoveredExcess).not.toBe(50);
        // Combined includes top-up: 150 / 400
        expect(result.combined.usagePct).toBeCloseTo((150 / 400) * 100, 5);
    });

    it("aligns multi-currency values only when both AR and limit are already in account currency", () => {
        // Caller responsibility: convert GBP AR and GBP limit before aggregation.
        const aligned = aggregatePortfolioPolicyLimitUsage(
            [
                baseRow({
                    openArAccount: 15_000,
                    approvedLimitAccount: 12_000,
                }),
            ],
            asOf
        );
        expect(aligned.named.usagePct).toBe(100);

        // Guard: mixing account-currency AR with foreign-limit units still caps used-within at limit.
        const misaligned = aggregatePortfolioPolicyLimitUsage(
            [
                baseRow({
                    openArAccount: 75_000,
                    approvedLimitAccount: 12_000,
                }),
            ],
            asOf
        );
        expect(misaligned.named.usagePct).toBe(100);
    });
});
