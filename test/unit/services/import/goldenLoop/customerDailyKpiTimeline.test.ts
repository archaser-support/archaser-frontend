import path from "path";
import { describe, expect, it } from "vitest";

import {
    compareGoldenKpiTimeline,
    loadGoldenExpectedKpiRows,
} from "@/server/services/import/goldenLoop/goldenKpiComparator";
import {
    computeCustomerDailyKpiTimeline,
    goldenImportRowsToReplayInputs,
} from "@/server/services/import/goldenLoop/customerDailyKpiTimeline";
import {
    defaultGoldenFixturePaths,
    preprocessGoldenImportFiles,
} from "@/server/services/import/goldenLoop/preprocessGoldenImportFiles";

const FIXTURES_DIR = path.join(
    process.cwd(),
    "test/fixtures/import-golden-loop"
);
const GOLDEN_FROM = "2026-01-01";
const GOLDEN_TO = "2026-01-27";
const GOLDEN_APPROVED_LIMIT = 10_000;

async function buildGoldenTimeline() {
    const fixtures = defaultGoldenFixturePaths(FIXTURES_DIR);
    const preprocessed = await preprocessGoldenImportFiles({
        invoicesPath: fixtures.invoicesPath,
        paymentsPath: fixtures.paymentsPath,
    });
    const replayInputs = goldenImportRowsToReplayInputs(
        preprocessed.invoices,
        preprocessed.payments
    );

    return computeCustomerDailyKpiTimeline({
        accountId: 1,
        customerId: 4567,
        fromDate: GOLDEN_FROM,
        toDate: GOLDEN_TO,
        invoices: replayInputs.invoices,
        payments: replayInputs.payments,
        config: { approvedLimit: GOLDEN_APPROVED_LIMIT },
    });
}

function snapshotForDate(
    timeline: Awaited<ReturnType<typeof buildGoldenTimeline>>,
    date: string
) {
    const snapshot = timeline.snapshots.find((row) => row.date === date);
    expect(snapshot).toBeDefined();
    return snapshot!;
}

describe("computeCustomerDailyKpiTimeline", () => {
    it("returns 27 snapshots for the golden date range", async () => {
        const timeline = await buildGoldenTimeline();
        expect(timeline.snapshots).toHaveLength(27);
        expect(timeline.snapshots[0]?.date).toBe(GOLDEN_FROM);
        expect(timeline.snapshots.at(-1)?.date).toBe(GOLDEN_TO);
    });

    it("matches Jan 1 golden row (total AR 250)", async () => {
        const timeline = await buildGoldenTimeline();
        expect(snapshotForDate(timeline, "2026-01-01")).toMatchObject({
            totalAr: 250,
            termBreach: 0,
            capacity: 0,
            notInsured: 0,
            healthIndex: 1,
        });
    });

    it("matches Jan 3 golden row after payment on invoice 5584561 (total AR 600)", async () => {
        const timeline = await buildGoldenTimeline();
        expect(snapshotForDate(timeline, "2026-01-03")).toMatchObject({
            totalAr: 600,
            termBreach: 0,
            capacity: 0,
            notInsured: 0,
            healthIndex: 1,
        });
    });

    it("matches Jan 14 golden row (capacity gap 600 when total AR is 10,600)", async () => {
        const timeline = await buildGoldenTimeline();
        expect(snapshotForDate(timeline, "2026-01-14")).toMatchObject({
            totalAr: 10_600,
            termBreach: 1000,
            capacity: 600,
            notInsured: 1600,
            healthIndex: 0.85,
        });
    });

    it("matches Jan 27 final golden row", async () => {
        const timeline = await buildGoldenTimeline();
        expect(snapshotForDate(timeline, "2026-01-27")).toMatchObject({
            totalAr: 7000,
            termBreach: 0,
            capacity: 0,
            notInsured: 0,
            healthIndex: 1,
        });
    });

    it("passes the full 27-day golden sweep against expected-results.xlsx", async () => {
        const fixtures = defaultGoldenFixturePaths(FIXTURES_DIR);
        const [timeline, expectedRows] = await Promise.all([
            buildGoldenTimeline(),
            loadGoldenExpectedKpiRows(fixtures.expectedResultsPath!),
        ]);

        expect(expectedRows).toHaveLength(27);
        const result = compareGoldenKpiTimeline(expectedRows, timeline);
        expect(result).toEqual({ match: true });
    });

    it("invokes onAfterEvent once per replayed invoice or payment", async () => {
        const fixtures = defaultGoldenFixturePaths(FIXTURES_DIR);
        const preprocessed = await preprocessGoldenImportFiles({
            invoicesPath: fixtures.invoicesPath,
            paymentsPath: fixtures.paymentsPath,
        });
        const replayInputs = goldenImportRowsToReplayInputs(
            preprocessed.invoices,
            preprocessed.payments
        );
        const expectedRows = await loadGoldenExpectedKpiRows(
            fixtures.expectedResultsPath!
        );

        const eventDates: string[] = [];
        computeCustomerDailyKpiTimeline({
            accountId: 1,
            customerId: 4567,
            fromDate: GOLDEN_FROM,
            toDate: GOLDEN_TO,
            invoices: replayInputs.invoices,
            payments: replayInputs.payments,
            config: { approvedLimit: GOLDEN_APPROVED_LIMIT },
            expectedKpiRows: expectedRows,
            onAfterEvent: (entry) => {
                eventDates.push(entry.date);
            },
        });

        expect(eventDates.length).toBe(
            preprocessed.invoices.length + preprocessed.payments.length
        );
    });
});
