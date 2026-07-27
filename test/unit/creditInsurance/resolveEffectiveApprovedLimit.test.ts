import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isActiveTopUp, resolveTopUpMonetaryAmount } from "@/server/services/creditInsurance/resolveEffectiveApprovedLimit";

function utcDate(iso: string): Date {
    return new Date(iso);
}

describe("isActiveTopUp", () => {
    const asOf = new Date("2026-06-10T00:00:00.000Z");

    it("returns true when asOf is within the inclusive date window", () => {
        expect(isActiveTopUp(
            { start_date: utcDate("2026-06-01"), end_date: utcDate("2026-06-30"), cancelled_at: null },
            asOf,
        )).toBe(true);
    });

    it("returns true on start_date boundary", () => {
        expect(isActiveTopUp(
            { start_date: utcDate("2026-06-10"), end_date: utcDate("2026-06-30"), cancelled_at: null },
            asOf,
        )).toBe(true);
    });

    it("returns true on end_date boundary", () => {
        expect(isActiveTopUp(
            { start_date: utcDate("2026-06-01"), end_date: utcDate("2026-06-10"), cancelled_at: null },
            asOf,
        )).toBe(true);
    });

    it("returns false before start_date", () => {
        expect(isActiveTopUp(
            { start_date: utcDate("2026-06-11"), end_date: utcDate("2026-06-30"), cancelled_at: null },
            asOf,
        )).toBe(false);
    });

    it("returns false after end_date", () => {
        expect(isActiveTopUp(
            { start_date: utcDate("2026-06-01"), end_date: utcDate("2026-06-09"), cancelled_at: null },
            asOf,
        )).toBe(false);
    });

    it("returns false when cancelled", () => {
        expect(isActiveTopUp(
            {
                start_date: utcDate("2026-06-01"),
                end_date: utcDate("2026-06-30"),
                cancelled_at: utcDate("2026-06-05"),
            },
            asOf,
        )).toBe(false);
    });
});

describe("resolveTopUpMonetaryAmount", () => {
    it("returns top_up_value for Fixed type", () => {
        const result = resolveTopUpMonetaryAmount(
            { top_up_type: "Fixed", top_up_value: new Prisma.Decimal(50000) },
            new Prisma.Decimal(1000000),
        );
        expect(result).toBe(50000);
    });

    it("returns computed percentage for Percentage type", () => {
        const result = resolveTopUpMonetaryAmount(
            { top_up_type: "Percentage", top_up_value: new Prisma.Decimal(25) },
            new Prisma.Decimal(1000000),
        );
        expect(result).toBe(250000);
    });

    it("returns 0 when base limit is null", () => {
        const result = resolveTopUpMonetaryAmount(
            { top_up_type: "Percentage", top_up_value: new Prisma.Decimal(25) },
            null,
        );
        expect(result).toBe(0);
    });

    it("returns 0 when base limit is zero", () => {
        const result = resolveTopUpMonetaryAmount(
            { top_up_type: "Percentage", top_up_value: new Prisma.Decimal(25) },
            new Prisma.Decimal(0),
        );
        expect(result).toBe(0);
    });

    it("percentage tracks base limit changes", () => {
        const resultHigh = resolveTopUpMonetaryAmount(
            { top_up_type: "Percentage", top_up_value: new Prisma.Decimal(25) },
            new Prisma.Decimal(1000000),
        );
        expect(resultHigh).toBe(250000);

        const resultLow = resolveTopUpMonetaryAmount(
            { top_up_type: "Percentage", top_up_value: new Prisma.Decimal(25) },
            new Prisma.Decimal(800000),
        );
        expect(resultLow).toBe(200000);
    });

    it("Fixed type is unchanged when base declines", () => {
        const result1 = resolveTopUpMonetaryAmount(
            { top_up_type: "Fixed", top_up_value: new Prisma.Decimal(50000) },
            new Prisma.Decimal(1000000),
        );
        expect(result1).toBe(50000);

        const result2 = resolveTopUpMonetaryAmount(
            { top_up_type: "Fixed", top_up_value: new Prisma.Decimal(50000) },
            new Prisma.Decimal(500000),
        );
        expect(result2).toBe(50000);
    });
});
