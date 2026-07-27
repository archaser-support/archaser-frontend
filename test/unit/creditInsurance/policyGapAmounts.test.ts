import { describe, expect, it } from "vitest";

import {
    readCapacityGapForDisplay,
    readUninsuredAmountForDisplay,
    resolveCapacityGapForAtRisk,
    resolveStoredCapacityGapSecondary,
    storedCapacityGapAmount,
    storedCapacityGapInCurrency,
    sumStoredCapacityGapInCurrency,
} from "@/server/services/creditInsurance/policyGapAmounts";

describe("policyGapAmounts read helpers", () => {
    it("storedCapacityGapAmount returns 0 when gap null but limit exists", () => {
        expect(
            storedCapacityGapAmount({
                approved_limit: 100,
                capacity_gap_amount: null,
            })
        ).toBe(0);
    });

    it("storedCapacityGapAmount returns 0 when no linked policy", () => {
        expect(
            storedCapacityGapAmount({
                approved_limit: 100,
                capacity_gap_amount: 500,
                insurance_policy_id: null,
            })
        ).toBe(0);
    });

    it("storedCapacityGapAmount returns 0 when excluded from policy", () => {
        expect(
            storedCapacityGapAmount({
                approved_limit: 100,
                capacity_gap_amount: 500,
                excluded_from_policy: true,
            })
        ).toBe(0);
    });

    it("resolveCapacityGapForAtRisk returns 0 when excluded even with invoice snapshots", () => {
        expect(
            resolveCapacityGapForAtRisk(
                {
                    approved_limit: 100,
                    capacity_gap_amount: 500,
                    excluded_from_policy: true,
                },
                20_000,
                { total: 1_000, hasMissingSnapshots: false }
            )
        ).toBe(0);
    });

    it("readUninsuredAmountForDisplay returns open AR when excluded", () => {
        expect(
            readUninsuredAmountForDisplay(
                {
                    approved_limit: 100,
                    uninsured_amount: 50,
                    excluded_from_policy: true,
                },
                12_500
            )
        ).toBe(12_500);
    });

    it("readCapacityGapForDisplay returns stored gap without AR or policy cap", () => {
        expect(
            readCapacityGapForDisplay({
                approved_limit: 100,
                capacity_gap_amount: 500,
            })
        ).toBe(500);
        expect(
            readCapacityGapForDisplay({
                approved_limit: 19_000,
                capacity_gap_amount: 2_000,
            })
        ).toBe(2_000);
    });

    it("resolveCapacityGapForAtRisk prefers invoice snapshots over stored gap", () => {
        const storedRow = {
            approved_limit: 100,
            capacity_gap_amount: 0,
        };
        expect(
            resolveCapacityGapForAtRisk(storedRow, 20_000, {
                total: 1_000,
                hasMissingSnapshots: false,
            })
        ).toBe(1_000);
        expect(
            resolveCapacityGapForAtRisk(storedRow, 500, {
                total: 1_000,
                hasMissingSnapshots: false,
            })
        ).toBe(1_000);
    });

    it("resolveCapacityGapForAtRisk falls back to stored gap when snapshots missing", () => {
        expect(
            resolveCapacityGapForAtRisk(
                { approved_limit: 100, capacity_gap_amount: 250 },
                1_000,
                { total: null, hasMissingSnapshots: true }
            )
        ).toBe(250);
    });

    it("readUninsuredAmountForDisplay floors at zero", () => {
        expect(
            readUninsuredAmountForDisplay({
                approved_limit: 100,
                uninsured_amount: -20,
            })
        ).toBe(0);
    });

    it("storedCapacityGapInCurrency reads bucket fields", () => {
        expect(
            storedCapacityGapInCurrency(
                {
                    capacity_gap_amount1: 40,
                    capacity_gap_currency1: "GBP",
                },
                "GBP"
            )
        ).toBe(40);
    });

    it("sumStoredCapacityGapInCurrency sums across rows", () => {
        expect(
            sumStoredCapacityGapInCurrency(
                [
                    {
                        capacity_gap_amount1: 600,
                        capacity_gap_currency1: "GBP",
                    },
                    {
                        capacity_gap_amount1: 400,
                        capacity_gap_currency1: "GBP",
                    },
                ],
                "GBP"
            )
        ).toBe(1000);
    });

    it("resolveStoredCapacityGapSecondary picks active row per policy", () => {
        expect(
            resolveStoredCapacityGapSecondary(
                [
                    {
                        insurance_policy_id: 1,
                        is_active: false,
                        capacity_gap_amount1: 100,
                        capacity_gap_currency1: "GBP",
                    },
                    {
                        insurance_policy_id: 1,
                        is_active: true,
                        capacity_gap_amount1: 600,
                        capacity_gap_currency1: "GBP",
                    },
                ],
                "GBP"
            )
        ).toBe(600);
    });
});
