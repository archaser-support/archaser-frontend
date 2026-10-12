import type { ReportTotals, ReportTotalsCell } from "@/types/reports";

const RESERVED_FOOTER_FIELDS = new Set(["__rowNumber", "checkbox"]);

export function formatTotalRowCellDisplay(
    cell: ReportTotalsCell | undefined,
    mixedCurrencyLabel: string
): string | number | null | undefined {
    if (!cell) {
        return undefined;
    }
    if (cell.mixedCurrency) {
        return mixedCurrencyLabel;
    }
    return cell.formatted ?? cell.value;
}

export function buildTotalFooterRow(args: {
    totals: ReportTotals;
    columnFields: string[];
    totalLabel: string;
    formatTotalWithValue: (value: string) => string;
    mixedCurrencyLabel: string;
}): Record<string, unknown> {
    const {
        totals,
        columnFields,
        totalLabel,
        formatTotalWithValue,
        mixedCurrencyLabel,
    } = args;
    const row: Record<string, unknown> = { id: "__report_total_row" };
    const dataFields = columnFields.filter(
        (field) => !RESERVED_FOOTER_FIELDS.has(field)
    );
    const firstDataField = dataFields[0];

    for (const field of dataFields) {
        const cellDisplay = formatTotalRowCellDisplay(
            totals.cells[field],
            mixedCurrencyLabel
        );
        if (totals.labelKey && field === totals.labelKey) {
            row[field] = totalLabel;
            continue;
        }
        if (!totals.labelKey && field === firstDataField) {
            row[field] = formatTotalWithValue(
                cellDisplay == null ? "" : String(cellDisplay)
            );
            continue;
        }
        if (cellDisplay !== undefined) {
            row[field] = cellDisplay;
        }
    }
    return row;
}
