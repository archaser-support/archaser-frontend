import path from "path";
import { describe, expect, it } from "vitest";

import {
    compareGoldenKpiTimeline,
    loadGoldenExpectedKpiRows,
    parseGoldenExpectedKpiRow,
} from "@/server/services/import/goldenLoop/goldenKpiComparator";
import type { CustomerDailyKpiTimeline } from "@/server/services/import/goldenLoop/types";

const FIXTURES_DIR = path.join(
    process.cwd(),
    "test/fixtures/import-golden-loop"
);

function makeTimeline(
    snapshots: CustomerDailyKpiTimeline["snapshots"]
): CustomerDailyKpiTimeline {
    return {
        accountId: 1,
        customerId: 4567,
        snapshots,
    };
}

describe("goldenKpiComparator", () => {
    it("loads 27 expected rows from committed expected-results.xlsx", async () => {
        const rows = await loadGoldenExpectedKpiRows(
            path.join(FIXTURES_DIR, "expected-results.xlsx")
        );

        expect(rows).toHaveLength(27);
        expect(rows[0]).toMatchObject({
            date: "2026-01-01",
            totalAr: 250,
            healthIndex: 1,
        });
    });

    it("normalizes health index from 0-1 scale before compare", () => {
        const row = parseGoldenExpectedKpiRow({
            date: "2026-01-04",
            total_ar: 1600,
            term_breach: 1000,
            capacity: 0,
            not_insured: 1000,
            health_index: 37.5,
        });

        expect(row?.healthIndex).toBeCloseTo(0.375, 6);
    });

    it("reports date, column, expected, and actual on first mismatch", () => {
        const expected = [
            {
                date: "2026-01-01",
                totalAr: 250,
                termBreach: 0,
                capacity: 0,
                notInsured: 0,
                healthIndex: 1,
            },
            {
                date: "2026-01-02",
                totalAr: 750,
                termBreach: 0,
                capacity: 0,
                notInsured: 0,
                healthIndex: 1,
            },
        ];

        const timeline = makeTimeline([
            {
                date: "2026-01-01",
                totalAr: 250,
                termBreach: 0,
                capacity: 0,
                notInsured: 0,
                healthIndex: 1,
            },
            {
                date: "2026-01-02",
                totalAr: 700,
                termBreach: 0,
                capacity: 0,
                notInsured: 0,
                healthIndex: 1,
            },
        ]);

        expect(compareGoldenKpiTimeline(expected, timeline)).toEqual({
            match: false,
            firstMismatch: {
                date: "2026-01-02",
                column: "totalAr",
                expected: 750,
                actual: 700,
            },
        });
    });

    it("compares health index as integer percent (Excel display)", () => {
        const expected = [
            {
                date: "2026-01-14",
                totalAr: 10_600,
                termBreach: 1000,
                capacity: 600,
                notInsured: 1600,
                healthIndex: 0.85,
            },
        ];

        const timeline = makeTimeline([
            {
                date: "2026-01-14",
                totalAr: 10_600,
                termBreach: 1000,
                capacity: 600,
                notInsured: 1600,
                healthIndex: 0.8490566037735849,
            },
        ]);

        expect(compareGoldenKpiTimeline(expected, timeline)).toEqual({
            match: true,
        });
    });
});
