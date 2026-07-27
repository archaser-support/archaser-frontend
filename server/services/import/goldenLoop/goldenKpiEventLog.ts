import type {
    DailyKpiSnapshot,
    GoldenExpectedKpiRow,
    GoldenEventKpiLogEntry,
} from "./types";

const KPI_COLUMNS: Array<{
    key: keyof Omit<GoldenExpectedKpiRow, "date">;
    label: string;
}> = [
    { key: "totalAr", label: "Total AR" },
    { key: "termBreach", label: "Term Breach" },
    { key: "capacity", label: "Capacity" },
    { key: "notInsured", label: "Not insured" },
    { key: "healthIndex", label: "Health Index" },
];

export function indexExpectedKpiRowsByDate(
    rows: GoldenExpectedKpiRow[]
): Map<string, GoldenExpectedKpiRow> {
    return new Map(rows.map((row) => [row.date, row]));
}

function healthIndexMatches(expected: number, actual: number): boolean {
    return Math.round(expected * 100) === Math.round(actual * 100);
}

function kpiValueMatches(
    column: keyof Omit<GoldenExpectedKpiRow, "date">,
    expected: number,
    actual: number
): boolean {
    if (column === "healthIndex") {
        return healthIndexMatches(expected, actual);
    }
    return Math.round(expected) === Math.round(actual);
}

export function formatHealthIndexPercent(unitScale: number): string {
    return `${Math.round(unitScale * 100)}%`;
}

function formatKpiValue(
    column: keyof Omit<GoldenExpectedKpiRow, "date">,
    value: number
): string {
    if (column === "healthIndex") {
        return formatHealthIndexPercent(value);
    }
    return String(Math.round(value));
}

export function describeGoldenReplayEvent(
    entry: Pick<
        GoldenEventKpiLogEntry,
        "eventType" | "invoiceNumber" | "amount"
    >
): string {
    if (entry.eventType === "invoice_open") {
        return `invoice_open invoice=${entry.invoiceNumber} amount=${entry.amount ?? 0}`;
    }
    return `payment_apply invoice=${entry.invoiceNumber} amount=${entry.amount ?? 0}`;
}

export function formatGoldenEventKpiMatrix(
    entry: GoldenEventKpiLogEntry
): string {
    const header = `[GOLDEN_KPI] #${entry.eventIndex + 1} ${describeGoldenReplayEvent(entry)} date=${entry.date}`;
    const lines = [header, "  KPI matrix (actual vs expected-results.xlsx):"];

    for (const { key, label } of KPI_COLUMNS) {
        const actual = entry.actual[key];
        const expectedRow = entry.expected;
        const actualText = formatKpiValue(key, actual);

        if (!expectedRow) {
            lines.push(`    ${label.padEnd(14)} actual=${actualText}  expected=N/A`);
            continue;
        }

        const expected = expectedRow[key];
        const expectedText = formatKpiValue(key, expected);
        const match = kpiValueMatches(key, expected, actual);
        lines.push(
            `    ${label.padEnd(14)} actual=${actualText.padStart(6)}  expected=${expectedText.padStart(6)}  ${match ? "OK" : "MISMATCH"}`
        );
    }

    return lines.join("\n");
}

export function logGoldenEventKpiMatrix(entry: GoldenEventKpiLogEntry): void {
    console.log(formatGoldenEventKpiMatrix(entry));
}

export function buildGoldenEventKpiLogEntry(args: {
    eventIndex: number;
    eventType: GoldenEventKpiLogEntry["eventType"];
    date: string;
    invoiceNumber: string;
    amount?: number;
    actual: DailyKpiSnapshot;
    expectedByDate: Map<string, GoldenExpectedKpiRow>;
}): GoldenEventKpiLogEntry {
    return {
        eventIndex: args.eventIndex,
        eventType: args.eventType,
        date: args.date,
        invoiceNumber: args.invoiceNumber,
        amount: args.amount,
        actual: args.actual,
        expected: args.expectedByDate.get(args.date) ?? null,
    };
}
