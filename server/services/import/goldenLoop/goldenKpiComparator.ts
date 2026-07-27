import { ImportService } from "@/server/services/ImportService";

import { readGoldenExcelRows } from "./readGoldenExcelRows";
import type {
    CustomerDailyKpiTimeline,
    GoldenExpectedKpiRow,
    GoldenKpiComparisonResult,
} from "./types";

export const GOLDEN_KPI_HEALTH_INDEX_TOLERANCE = 0;

function healthIndexMatches(expected: number, actual: number): boolean {
    return Math.round(expected * 100) === Math.round(actual * 100);
}

const EXPECTED_COLUMN_ALIASES: Record<
    keyof Omit<GoldenExpectedKpiRow, "date">,
    string[]
> = {
    totalAr: ["total_ar"],
    termBreach: ["term_breach"],
    capacity: ["capacity"],
    notInsured: ["not_insured"],
    healthIndex: ["helth_index", "health_index"],
};

function normalizeHeaderKey(header: string): string {
    return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    if (typeof value === "object" && value !== null && "result" in value) {
        return toNumber((value as { result: unknown }).result);
    }
    const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHealthIndexToUnitScale(value: number): number {
    if (value > 1) {
        return value / 100;
    }
    return value;
}

function resolveExpectedDate(value: unknown): string | null {
    const normalized = ImportService.normalizeDateInput(value);
    if (normalized === null || normalized === undefined || normalized === "") {
        return null;
    }
    return normalized;
}

function findRowValue(
    row: Record<string, unknown>,
    aliases: string[]
): unknown {
    for (const alias of aliases) {
        if (row[alias] !== undefined) {
            return row[alias];
        }
    }
    return undefined;
}

export function parseGoldenExpectedKpiRow(
    row: Record<string, unknown>
): GoldenExpectedKpiRow | null {
    const date = resolveExpectedDate(row.date);
    const totalAr = toNumber(findRowValue(row, EXPECTED_COLUMN_ALIASES.totalAr));
    const termBreach = toNumber(
        findRowValue(row, EXPECTED_COLUMN_ALIASES.termBreach)
    );
    const capacity = toNumber(findRowValue(row, EXPECTED_COLUMN_ALIASES.capacity));
    const notInsured = toNumber(
        findRowValue(row, EXPECTED_COLUMN_ALIASES.notInsured)
    );
    const healthIndexRaw = toNumber(
        findRowValue(row, EXPECTED_COLUMN_ALIASES.healthIndex)
    );

    if (
        date == null ||
        totalAr == null ||
        termBreach == null ||
        capacity == null ||
        notInsured == null ||
        healthIndexRaw == null
    ) {
        return null;
    }

    return {
        date,
        totalAr: Math.round(totalAr),
        termBreach: Math.round(termBreach),
        capacity: Math.round(capacity),
        notInsured: Math.round(notInsured),
        healthIndex: normalizeHealthIndexToUnitScale(healthIndexRaw),
    };
}

export async function loadGoldenExpectedKpiRows(
    expectedResultsPath: string
): Promise<GoldenExpectedKpiRow[]> {
    const rawRows = await readGoldenExcelRows(expectedResultsPath);
    return rawRows
        .map((row) => {
            const normalized: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(row)) {
                normalized[normalizeHeaderKey(key)] = value;
            }
            return parseGoldenExpectedKpiRow(normalized);
        })
        .filter((row): row is GoldenExpectedKpiRow => row !== null);
}

function snapshotByDate(
    timeline: CustomerDailyKpiTimeline
): Map<string, CustomerDailyKpiTimeline["snapshots"][number]> {
    return new Map(timeline.snapshots.map((snapshot) => [snapshot.date, snapshot]));
}

function valuesMatch(
    column: keyof Omit<GoldenExpectedKpiRow, "date">,
    expected: number,
    actual: number
): boolean {
    if (column === "healthIndex") {
        return healthIndexMatches(expected, actual);
    }
    return Math.round(expected) === Math.round(actual);
}

export function compareGoldenKpiTimeline(
    expectedRows: GoldenExpectedKpiRow[],
    timeline: CustomerDailyKpiTimeline
): GoldenKpiComparisonResult {
    const actualByDate = snapshotByDate(timeline);

    for (const expected of expectedRows) {
        const actual = actualByDate.get(expected.date);
        if (!actual) {
            return {
                match: false,
                firstMismatch: {
                    date: expected.date,
                    column: "totalAr",
                    expected: expected.totalAr,
                    actual: Number.NaN,
                },
            };
        }

        const columns: Array<keyof Omit<GoldenExpectedKpiRow, "date">> = [
            "totalAr",
            "termBreach",
            "capacity",
            "notInsured",
            "healthIndex",
        ];

        for (const column of columns) {
            if (!valuesMatch(column, expected[column], actual[column])) {
                return {
                    match: false,
                    firstMismatch: {
                        date: expected.date,
                        column,
                        expected: expected[column],
                        actual: actual[column],
                    },
                };
            }
        }
    }

    return { match: true };
}
