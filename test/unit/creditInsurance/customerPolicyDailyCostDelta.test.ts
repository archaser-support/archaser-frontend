import { describe, expect, it } from "vitest";

import type { CustomerDailyCostSnapshot } from "@/server/services/creditInsurance/customerPolicyDailyCost";
import {
    computeComponentDailyCostDelta,
    computeTotalDailyCostDelta,
    deriveDailyCostDeltaSnapshot,
    MAX_GAP_FILL_DAYS,
    resolveGapFillDates,
} from "@/server/services/creditInsurance/customerPolicyDailyCostDelta";

function utcDate(iso: string): Date {
    return new Date(iso);
}

function levelSnapshot(
    overrides: Partial<CustomerDailyCostSnapshot> = {}
): CustomerDailyCostSnapshot {
    return {
        policyDailyCost: null,
        policyCostCurrency: null,
        topUpDailyCost: null,
        topUpCostCurrency: null,
        totalDailyCost: null,
        costCalculationMethod: null,
        costPercent: null,
        ...overrides,
    };
}

describe("computeComponentDailyCostDelta", () => {
    it("returns null when today's level is null", () => {
        expect(
            computeComponentDailyCostDelta({
                todayAmount: null,
                todayCurrency: "USD",
                predecessorAmount: 100,
                predecessorCurrency: "USD",
                hasPredecessor: true,
            })
        ).toBeNull();
    });

    it("returns 0 when there is no predecessor row", () => {
        expect(
            computeComponentDailyCostDelta({
                todayAmount: 500,
                todayCurrency: "USD",
                predecessorAmount: null,
                predecessorCurrency: null,
                hasPredecessor: false,
            })
        ).toBe(0);
    });

    it("returns 0 when predecessor level is null", () => {
        expect(
            computeComponentDailyCostDelta({
                todayAmount: 500,
                todayCurrency: "USD",
                predecessorAmount: null,
                predecessorCurrency: "USD",
                hasPredecessor: true,
            })
        ).toBe(0);
    });

    it("returns null when currencies mismatch", () => {
        expect(
            computeComponentDailyCostDelta({
                todayAmount: 500,
                todayCurrency: "USD",
                predecessorAmount: 400,
                predecessorCurrency: "EUR",
                hasPredecessor: true,
            })
        ).toBeNull();
    });

    it("allows negative deltas when level decreases", () => {
        expect(
            computeComponentDailyCostDelta({
                todayAmount: 400,
                todayCurrency: "USD",
                predecessorAmount: 500,
                predecessorCurrency: "USD",
                hasPredecessor: true,
            })
        ).toBe(-100);
    });

    it("returns the level difference when currencies match", () => {
        expect(
            computeComponentDailyCostDelta({
                todayAmount: 550,
                todayCurrency: "usd",
                predecessorAmount: 500,
                predecessorCurrency: "USD",
                hasPredecessor: true,
            })
        ).toBe(50);
    });
});

describe("computeTotalDailyCostDelta", () => {
    it("sums policy and top-up deltas in the same currency", () => {
        expect(
            computeTotalDailyCostDelta(50, "USD", 10, "USD")
        ).toBe(60);
    });

    it("returns null when both components exist with different currencies", () => {
        expect(
            computeTotalDailyCostDelta(50, "USD", 10, "EUR")
        ).toBeNull();
    });

    it("returns policy delta when top-up delta is null", () => {
        expect(computeTotalDailyCostDelta(50, "USD", null, null)).toBe(50);
    });
});

describe("deriveDailyCostDeltaSnapshot", () => {
    it("stores zero deltas on the first configured day", () => {
        const result = deriveDailyCostDeltaSnapshot({
            todayLevels: levelSnapshot({
                policyDailyCost: 500,
                policyCostCurrency: "USD",
                topUpDailyCost: 25,
                topUpCostCurrency: "USD",
                totalDailyCost: 525,
                costCalculationMethod: "Limit",
                costPercent: 0.05,
            }),
            predecessorLevels: null,
        });

        expect(result).toEqual({
            policyDailyCost: 0,
            policyCostCurrency: "USD",
            topUpDailyCost: 0,
            topUpCostCurrency: "USD",
            totalDailyCost: 0,
            costCalculationMethod: "Limit",
            costPercent: 0.05,
        });
    });

    it("returns null deltas when today is ineligible", () => {
        const result = deriveDailyCostDeltaSnapshot({
            todayLevels: levelSnapshot({
                costCalculationMethod: "Limit",
                costPercent: 0.05,
            }),
            predecessorLevels: levelSnapshot({
                policyDailyCost: 500,
                policyCostCurrency: "USD",
            }),
        });

        expect(result.policyDailyCost).toBeNull();
        expect(result.topUpDailyCost).toBeNull();
        expect(result.totalDailyCost).toBeNull();
    });

    it("computes component and total deltas from predecessor levels", () => {
        const result = deriveDailyCostDeltaSnapshot({
            todayLevels: levelSnapshot({
                policyDailyCost: 600,
                policyCostCurrency: "USD",
                topUpDailyCost: 25,
                topUpCostCurrency: "USD",
                totalDailyCost: 625,
                costCalculationMethod: "Limit",
                costPercent: 0.06,
            }),
            predecessorLevels: levelSnapshot({
                policyDailyCost: 500,
                policyCostCurrency: "USD",
                topUpDailyCost: 25,
                topUpCostCurrency: "USD",
                totalDailyCost: 525,
            }),
        });

        expect(result.policyDailyCost).toBe(100);
        expect(result.topUpDailyCost).toBe(0);
        expect(result.totalDailyCost).toBe(100);
    });
});

describe("resolveGapFillDates", () => {
    it("returns no dates when there is no prior snapshot", () => {
        expect(
            resolveGapFillDates({
                lastSnapshotDate: null,
                todayUtc: utcDate("2026-06-30"),
            })
        ).toEqual({
            datesToSync: [],
            gapDays: 0,
            gapExceedsCap: false,
        });
    });

    it("returns no dates when the latest snapshot is yesterday", () => {
        expect(
            resolveGapFillDates({
                lastSnapshotDate: utcDate("2026-06-29"),
                todayUtc: utcDate("2026-06-30"),
            })
        ).toEqual({
            datesToSync: [],
            gapDays: 0,
            gapExceedsCap: false,
        });
    });

    it("returns three missing dates for a three-day gap", () => {
        const result = resolveGapFillDates({
            lastSnapshotDate: utcDate("2026-06-26"),
            todayUtc: utcDate("2026-06-30"),
        });

        expect(result.gapDays).toBe(3);
        expect(result.gapExceedsCap).toBe(false);
        expect(result.datesToSync.map((d) => d.toISOString().slice(0, 10))).toEqual(
            ["2026-06-27", "2026-06-28", "2026-06-29"]
        );
    });

    it("returns seven dates for a seven-day gap", () => {
        const result = resolveGapFillDates({
            lastSnapshotDate: utcDate("2026-06-22"),
            todayUtc: utcDate("2026-06-30"),
        });

        expect(result.gapDays).toBe(7);
        expect(result.gapExceedsCap).toBe(false);
        expect(result.datesToSync).toHaveLength(7);
        expect(result.datesToSync[0]!.toISOString().slice(0, 10)).toBe(
            "2026-06-23"
        );
        expect(result.datesToSync[6]!.toISOString().slice(0, 10)).toBe(
            "2026-06-29"
        );
    });

    it("caps gap-fill to the most recent seven days when gap exceeds the cap", () => {
        const result = resolveGapFillDates({
            lastSnapshotDate: utcDate("2026-06-15"),
            todayUtc: utcDate("2026-06-30"),
            maxDays: MAX_GAP_FILL_DAYS,
        });

        expect(result.gapDays).toBe(14);
        expect(result.gapExceedsCap).toBe(true);
        expect(result.datesToSync).toHaveLength(7);
        expect(result.datesToSync[0]!.toISOString().slice(0, 10)).toBe(
            "2026-06-23"
        );
        expect(result.datesToSync[6]!.toISOString().slice(0, 10)).toBe(
            "2026-06-29"
        );
    });

    it("returns no dates when the latest snapshot is today", () => {
        expect(
            resolveGapFillDates({
                lastSnapshotDate: utcDate("2026-06-30"),
                todayUtc: utcDate("2026-06-30"),
            })
        ).toEqual({
            datesToSync: [],
            gapDays: 0,
            gapExceedsCap: false,
        });
    });
});
