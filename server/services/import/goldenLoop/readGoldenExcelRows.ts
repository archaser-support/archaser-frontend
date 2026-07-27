import ExcelJS from "exceljs";

function normalizeCellValue(value: unknown): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === "object") {
        if ("result" in value) {
            return (value as { result: unknown }).result;
        }
        if ("text" in value) {
            return (value as { text: unknown }).text;
        }
        if (value instanceof Date) {
            return value;
        }
    }

    return value;
}

function normalizeHeaderKey(header: string): string {
    return header.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Read the first worksheet of an Excel file into header-keyed row objects.
 * Header keys are trimmed and lowercased with spaces replaced by underscores.
 */
export async function readGoldenExcelRows(
    filePath: string
): Promise<Record<string, unknown>[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        throw new Error(`No worksheet found in ${filePath}`);
    }

    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const raw = cell.value;
        headers[colNumber - 1] =
            raw === null || raw === undefined
                ? `column_${colNumber}`
                : normalizeHeaderKey(String(raw));
    });

    const rows: Record<string, unknown>[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) {
            return;
        }

        const rowData: Record<string, unknown> = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (!header || header.startsWith("column_")) {
                return;
            }

            const cellValue = normalizeCellValue(cell.value);
            if (cellValue !== null && cellValue !== undefined && cellValue !== "") {
                rowData[header] = cellValue;
            }
        });

        if (Object.keys(rowData).length > 0) {
            rows.push(rowData);
        }
    });

    return rows;
}
