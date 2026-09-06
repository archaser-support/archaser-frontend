import * as ExcelJS from "exceljs";

import { formatDateForDisplay } from "@/utils/datetimeOperations";

export type ExportFormat = "excel" | "csv" | "pdf";

export interface ExportToExcelOptions {
    data: any[];
    selectedColumns: string[];
    fileName: string;
    columnHeaders: Record<string, string>;
    sortModel?: Array<{ field: string; sort: "asc" | "desc" }>;
    format?: ExportFormat;
    currencyColumns?: Record<
        string,
        { amountField: string; currencyField: string }
    >;
    /** BCP 47 locale for date/datetime cells (e.g. he-IL, en-US). */
    locale?: string;
    /** IANA timezone for datetime fields. */
    timezone?: string;
}

/** Raw ISO / Date values still need locale formatting; already-display strings do not. */
function formatCellForExport(
    value: unknown,
    columnField: string,
    locale?: string,
    timezone?: string
): unknown {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    const isRawDate =
        value instanceof Date ||
        (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.trim()));

    if (isRawDate && locale) {
        const field = columnField.toLowerCase();
        const asDateTime =
            field.includes("_at") ||
            field.endsWith("_time") ||
            field.includes("schedule_time") ||
            field.includes("call_time") ||
            field.includes("delivery_time") ||
            field.includes("sent_time");
        try {
            return formatDateForDisplay(
                value as Date | string,
                asDateTime ? "datetime" : "date",
                locale,
                timezone
            );
        } catch {
            return value instanceof Date ? value.toISOString() : value;
        }
    }

    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return value;
}

/**
 * Configuration for currency column splitting
 */
export interface CurrencyColumnConfig {
    amountField: string;
    currencyField: string;
}

/**
 * Configuration for currency columns mapping
 */
export type CurrencyColumnsConfig = Record<string, CurrencyColumnConfig>;

/**
 * Result of splitting a currency value
 */
export interface SplitCurrencyResult {
    amount: string;
    currency: string;
}

/** Pre-formatted amount strings that include a currency code or symbol (e.g. "7,000.00 ILS"). */
const looksLikeFormattedCurrency = (value: unknown): boolean => {
    if (typeof value !== "string") {
        return false;
    }
    const v = value.trim();
    if (!v) {
        return false;
    }
    return /[0-9]/.test(v) && /[A-Za-z₪$€£¥]/.test(v);
};

/** Policy identifiers must stay text in Excel (e.g. "6667", not "6,667.00"). */
const isPolicyIdentifierColumn = (columnField: string): boolean => {
    const f = columnField.toLowerCase();
    return (
        f === "policynumber" ||
        f.includes("policy_number") ||
        f.endsWith(".policy_number")
    );
};

/**
 * Count / day columns: whole numbers without decimal places.
 */
const isIntegerNumericColumn = (columnField: string): boolean => {
    if (isPolicyIdentifierColumn(columnField)) {
        return false;
    }
    return (
        columnField.includes("days") ||
        columnField.includes("Days") ||
        ((columnField.includes("count") || columnField.includes("Count")) &&
            !columnField.includes("amount") &&
            !columnField.includes("Amount"))
    );
};

/**
 * Helper function to detect if a column field represents numeric data
 * @param columnField - The column field name
 * @returns true if the column should be treated as numeric
 */
const isDateLikeColumn = (columnField: string): boolean => {
    const f = columnField.toLowerCase();
    return (
        f.includes("date") ||
        f.endsWith("_at") ||
        f.endsWith("_time") ||
        f.includes("schedule_time") ||
        f.includes("call_time") ||
        f.includes("delivery_time") ||
        f.includes("sent_time")
    );
};

const isNumericColumn = (columnField: string): boolean => {
    if (isPolicyIdentifierColumn(columnField)) {
        return false;
    }
    // Avoid treating payment_date / overdue_date / etc. as numeric
    if (isDateLikeColumn(columnField)) {
        return false;
    }
    if (isIntegerNumericColumn(columnField)) {
        return true;
    }
    return (
        columnField.includes("amount") ||
        columnField.includes("Amount") ||
        columnField.includes("value") ||
        columnField.includes("Value") ||
        columnField.includes("quantity") ||
        columnField.includes("Quantity") ||
        columnField.includes("price") ||
        columnField.includes("Price") ||
        columnField.includes("total") ||
        columnField.includes("Total") ||
        columnField.includes("sum") ||
        columnField.includes("Sum") ||
        columnField.includes("balance") ||
        columnField.includes("Balance") ||
        columnField.includes("debt") ||
        columnField.includes("Debt") ||
        columnField.includes("payment") ||
        columnField.includes("Payment") ||
        columnField.includes("outstanding") ||
        columnField.includes("Outstanding") ||
        columnField.includes("overdue") ||
        columnField.includes("Overdue") ||
        columnField.includes("original") ||
        columnField.includes("Original") ||
        columnField.includes("promise") ||
        columnField.includes("Promise") ||
        // Include specific numeric patterns but exclude invoice / policy identifiers
        ((columnField.includes("number") || columnField.includes("Number")) &&
            !columnField.includes("invoice") &&
            !columnField.includes("Invoice") &&
            !columnField.includes("customer_number") &&
            !columnField.includes("CustomerNumber") &&
            !columnField.includes("policy"))
    );
};

/**
 * Generic function to split currency values into amount and currency
 * Handles both formats: "USD 1,234" (currency first) and "1,234 USD" (amount first)
 *
 * @param value - The currency value to split
 * @returns Object with amount and currency separated
 *
 * @example
 * splitCurrencyValue("USD 1,234") // { amount: "1,234", currency: "USD" }
 * splitCurrencyValue("1,234 USD") // { amount: "1,234", currency: "USD" }
 * splitCurrencyValue("$ 1,234") // { amount: "1,234", currency: "$" }
 * splitCurrencyValue("1,234.50 EUR") // { amount: "1,234.50", currency: "EUR" }
 */
export const splitCurrencyValue = (value: any): SplitCurrencyResult => {
    if (value === null || value === undefined || value === "") {
        return { amount: "", currency: "" };
    }

    const stringValue = String(value).trim();

    // Handle NaN values
    if (
        stringValue === "NaN" ||
        stringValue === "undefined" ||
        stringValue === "null"
    ) {
        return { amount: "", currency: "" };
    }

    // Match patterns like "USD 1,234", "EUR 2,345.67", "$ 1,234", "₪ 1,234" (currency first)
    // or "1,234 USD", "2,345.67 EUR" (amount first - English format)
    const currencyFirstMatch = stringValue.match(/^([A-Z₪$€£¥]+)\s+(.+)$/);
    const amountFirstMatch = stringValue.match(/^(.+)\s+([A-Z₪$€£¥]+)$/);

    if (currencyFirstMatch) {
        const currency = currencyFirstMatch[1];
        const amount = currencyFirstMatch[2];

        return {
            currency: currency,
            amount: amount,
        };
    }

    if (amountFirstMatch) {
        const amount = amountFirstMatch[1];
        const currency = amountFirstMatch[2];

        return {
            currency: currency,
            amount: amount,
        };
    }

    // If no currency pattern found, treat as amount only
    return {
        amount: stringValue,
        currency: "",
    };
};

/**
 * Safe amount converter that handles NaN, null, undefined values
 *
 * @param value - The value to convert
 * @param fieldName - Name of the field for logging (optional)
 * @returns Safe numeric value or 0
 *
 * @example
 * safeAmount(null) // 0
 * safeAmount("NaN") // 0
 * safeAmount(1234) // 1234
 * safeAmount("1234.56") // 1234.56
 */
export const safeAmount = (value: any, fieldName?: string): number => {
    if (value === null || value === undefined) {
        return 0;
    }

    if (value === "NaN" || value === "null" || value === "undefined") {
        return 0;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
        return 0;
    }

    return numValue;
};

/**
 * Format a numeric amount with currency code (English format: "1,234 USD")
 *
 * @param amount - The numeric amount
 * @param currencyCode - The currency code (e.g., "USD", "EUR")
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted currency string
 *
 * @example
 * formatCurrencyWithCode(1234, "USD") // "1,234 USD"
 * formatCurrencyWithCode(1234.56, "EUR") // "1,234.56 EUR"
 */
export const formatCurrencyWithCode = (
    amount: number,
    currencyCode: string,
    locale: string = "en-US"
): string => {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return `0.00 ${currencyCode}`;
    }

    const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return `${formatter.format(amount)} ${currencyCode}`;
};

/**
 * Exports data to Excel or CSV format with UTF-8 encoding
 * @param options - Export configuration options
 */
export const exportToExcel = async (
    options: ExportToExcelOptions
): Promise<void> => {
    const {
        data,
        selectedColumns,
        fileName,
        columnHeaders,
        sortModel,
        format = "excel",
        currencyColumns,
        locale,
        timezone,
    } = options;

    if (!data || data.length === 0) {
        throw new Error("No data to export");
    }

    if (!selectedColumns || selectedColumns.length === 0) {
        throw new Error("No columns selected for export");
    }

    // Apply sorting if provided
    const sortedData = [...data];
    if (sortModel && sortModel.length > 0) {
        const sortField = sortModel[0].field;
        const sortDirection = sortModel[0].sort;

        sortedData.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Handle null/undefined values
            if (aVal == null) aVal = "";
            if (bVal == null) bVal = "";

            // Handle different data types
            if (typeof aVal === "string" && typeof bVal === "string") {
                return sortDirection === "asc"
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
            }

            if (aVal instanceof Date && bVal instanceof Date) {
                return sortDirection === "asc"
                    ? aVal.getTime() - bVal.getTime()
                    : bVal.getTime() - aVal.getTime();
            }

            // Convert to string for comparison
            const aStr = String(aVal);
            const bStr = String(bVal);
            return sortDirection === "asc"
                ? aStr.localeCompare(bStr)
                : bStr.localeCompare(aStr);
        });
    }

    // Process currency columns if specified
    let processedColumns = [...selectedColumns];
    const processedColumnHeaders = { ...columnHeaders };

    if (currencyColumns) {
        // Add new columns for currency splits
        Object.entries(currencyColumns).forEach(([originalField, config]) => {
            if (selectedColumns.includes(originalField)) {
                // Add amount and currency fields to the columns list
                processedColumns = processedColumns.filter(
                    (col) => col !== originalField
                );
                processedColumns.push(config.amountField, config.currencyField);

                // Add headers for the new columns
                const originalHeader =
                    columnHeaders[originalField] || originalField;
                processedColumnHeaders[config.amountField] =
                    `${originalHeader} (Amount)`;
                processedColumnHeaders[config.currencyField] =
                    `${originalHeader} (Currency)`;
            }
        });
    }

    // Prepare data for export
    const exportData = sortedData.map((row, rowIndex) => {
        const exportRow: Record<string, any> = {};

        processedColumns.forEach((columnField) => {
            // Check if this is a currency split field
            const currencyConfig = Object.values(currencyColumns || {}).find(
                (config) =>
                    config.amountField === columnField ||
                    config.currencyField === columnField
            );

            if (currencyConfig) {
                // This is a split currency field
                const originalField = Object.keys(currencyColumns || {}).find(
                    (key) => currencyColumns![key] === currencyConfig
                );

                if (originalField) {
                    const originalValue = row[originalField];
                    const { amount, currency } =
                        splitCurrencyValue(originalValue);

                    if (columnField === currencyConfig.amountField) {
                        exportRow[columnField] = amount;
                    } else if (columnField === currencyConfig.currencyField) {
                        exportRow[columnField] = currency;
                    }
                }
            } else {
                exportRow[columnField] = formatCellForExport(
                    row[columnField],
                    columnField,
                    locale,
                    timezone
                );
            }
        });

        return exportRow;
    });

    if (format === "csv") {
        // Export as CSV
        exportToCSV(
            exportData,
            processedColumns,
            processedColumnHeaders,
            fileName
        );
    } else if (format === "pdf") {
        // Export as PDF
        exportToPDF(
            exportData,
            processedColumns,
            processedColumnHeaders,
            fileName
        );
    } else {
        // Export as Excel
        await exportToExcelFormat(
            exportData,
            processedColumns,
            processedColumnHeaders,
            fileName,
            locale
        );
    }
};

/**
 * Export data to PDF format.
 * Uses html2canvas to render an HTML table (browser handles Hebrew/RTL
 * perfectly via its Unicode layout engine), then embeds it into jsPDF.
 */
const exportToPDF = (
    data: any[],
    selectedColumns: string[],
    columnHeaders: Record<string, string>,
    fileName: string
): void => {
    import("jspdf").then(({ default: jsPDF }) => {
        import("html2canvas").then(({ default: html2canvas }) => {
            // ------------------------------------------------------------------
            // 1. Build an off-screen HTML table with full styling
            // ------------------------------------------------------------------
            const container = document.createElement("div");
            container.style.cssText = [
                "position:fixed",
                "left:-9999px",
                "top:0",
                "background:#fff",
                "padding:16px",
                "font-family:Arial,Helvetica,sans-serif",
                "font-size:11px",
                "color:#111",
                "width:1400px",         // wide enough for landscape
            ].join(";");

            const table = document.createElement("table");
            table.style.cssText = [
                "width:100%",
                "border-collapse:collapse",
                "table-layout:fixed",
            ].join(";");

            // Header row
            const thead = document.createElement("thead");
            const headerTr = document.createElement("tr");
            selectedColumns.forEach((col) => {
                const th = document.createElement("th");
                th.textContent = columnHeaders[col] || col;
                th.style.cssText = [
                    "background:#4C1D95",
                    "color:#fff",
                    "padding:6px 8px",
                    "border:1px solid #6D28D9",
                    "text-align:center",
                    "font-weight:bold",
                    "overflow-wrap:break-word",
                    "word-break:break-word",
                ].join(";");
                headerTr.appendChild(th);
            });
            thead.appendChild(headerTr);
            table.appendChild(thead);

            // Body rows
            const tbody = document.createElement("tbody");
            data.forEach((row, rowIndex) => {
                const tr = document.createElement("tr");
                tr.style.background = rowIndex % 2 === 0 ? "#F8F9FA" : "#FFFFFF";
                selectedColumns.forEach((col) => {
                    const td = document.createElement("td");
                    const value = row[col];
                    let text = "";
                    if (value === null || value === undefined) {
                        text = "";
                    } else if (
                        typeof value === "object" &&
                        !(value instanceof Date)
                    ) {
                        text = JSON.stringify(value);
                    } else {
                        text = String(value);
                    }
                    td.textContent = text;
                    // Detect RTL content to set correct direction
                    const isRTL = /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(text);
                    td.style.cssText = [
                        "padding:5px 8px",
                        "border:1px solid #E5E7EB",
                        "overflow-wrap:break-word",
                        "word-break:break-word",
                        `direction:${isRTL ? "rtl" : "ltr"}`,
                        `text-align:${isRTL ? "right" : "left"}`,
                    ].join(";");
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            container.appendChild(table);
            document.body.appendChild(container);

            // ------------------------------------------------------------------
            // 2. Render to canvas, then slice into PDF pages
            // ------------------------------------------------------------------
            html2canvas(container, {
                scale: 2,           // retina quality
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
            }).then((canvas) => {
                document.body.removeChild(container);

                const imgData = canvas.toDataURL("image/png");

                // A4 landscape in mm: 297 × 210
                const pdfW = 297;
                const pdfH = 210;
                const margin = 8;
                const usableW = pdfW - margin * 2;
                const usableH = pdfH - margin * 2;

                // Scale canvas to fit PDF width
                const scaledH =
                    (canvas.height * usableW) / canvas.width;

                const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

                // If the table fits on one page
                if (scaledH <= usableH) {
                    doc.addImage(imgData, "PNG", margin, margin, usableW, scaledH);
                } else {
                    // Multi-page: slice the canvas into page-sized strips
                    const pageH = Math.floor(
                        (usableH / usableW) * canvas.width
                    );
                    let yOffset = 0;
                    let firstPage = true;
                    while (yOffset < canvas.height) {
                        if (!firstPage) doc.addPage();
                        firstPage = false;

                        const sliceH = Math.min(pageH, canvas.height - yOffset);

                        // Create a slice canvas
                        const slice = document.createElement("canvas");
                        slice.width = canvas.width;
                        slice.height = sliceH;
                        const ctx = slice.getContext("2d");
                        if (ctx) {
                            ctx.drawImage(
                                canvas,
                                0, yOffset,
                                canvas.width, sliceH,
                                0, 0,
                                canvas.width, sliceH
                            );
                        }
                        const sliceData = slice.toDataURL("image/png");
                        const sliceScaledH = (sliceH * usableW) / canvas.width;
                        doc.addImage(sliceData, "PNG", margin, margin, usableW, sliceScaledH);
                        yOffset += sliceH;
                    }
                }

                doc.save(`${fileName}.pdf`);
            }).catch((err) => {
                document.body.removeChild(container);
                console.error("PDF export failed:", err);
            });
        });
    });
};

/**
 * Export data to CSV format
 */
const exportToCSV = (
    data: any[],
    selectedColumns: string[],
    columnHeaders: Record<string, string>,
    fileName: string
): void => {
    // Create CSV headers
    const csvHeaders = selectedColumns.map((col) => columnHeaders[col] || col);

    // Create CSV rows
    const csvRows = data.map((row) =>
        selectedColumns.map((col) => {
            const value = row[col];
            // Escape CSV values (handle commas, quotes, newlines)
            if (value === null || value === undefined) return "";
            const stringValue = String(value);
            // If value contains comma, quote, or newline, wrap in quotes and escape quotes
            if (
                stringValue.includes(",") ||
                stringValue.includes('"') ||
                stringValue.includes("\n")
            ) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        })
    );

    // Combine headers and rows
    const csvContent = [csvHeaders, ...csvRows]
        .map((row) => row.join(","))
        .join("\n");

    // Add BOM for UTF-8 encoding
    const csvWithBOM = `\uFEFF${csvContent}`;

    // Create blob with proper MIME type
    const blob = new Blob([csvWithBOM], {
        type: "text/csv;charset=utf-8",
    });

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.csv`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

/**
 * Export data to Excel format with styled headers using ExcelJS
 */
const exportToExcelFormat = async (
    data: any[],
    selectedColumns: string[],
    columnHeaders: Record<string, string>,
    fileName: string,
    locale?: string
): Promise<void> => {
    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Add worksheet
    const worksheet = workbook.addWorksheet("Export");

    // Prepare data for export (dates already locale-formatted by formatCellForExport upstream)
    const exportData = data.map((row) => {
        const exportRow: Record<string, any> = {};
        selectedColumns.forEach((columnField) => {
            const value = row[columnField];

            if (typeof value === "string") {
                // Keep formatted currency strings intact (e.g. "7,000.00 ILS")
                if (
                    isNumericColumn(columnField) &&
                    value.trim() !== "" &&
                    !looksLikeFormattedCurrency(value)
                ) {
                    const numericValue = parseFloat(value.replace(/[,$]/g, ""));
                    if (!isNaN(numericValue)) {
                        exportRow[columnField] = numericValue;
                    } else {
                        exportRow[columnField] = value;
                    }
                } else {
                    exportRow[columnField] = value;
                }
            } else {
                exportRow[columnField] = value;
            }
        });
        return exportRow;
    });

    // Create headers array
    const headers = selectedColumns.map((col) => columnHeaders[col] || col);

    // Add header row with styling
    const headerRow = worksheet.addRow(headers);

    // Style the header row
    headerRow.eachCell((cell, colNumber) => {
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF6B46C1" }, // Purple background
        };
        cell.font = {
            bold: true,
            color: { argb: "FFFFFFFF" }, // White text
            size: 12,
            name: "Calibri",
        };
        cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
        };
        cell.border = {
            top: { style: "medium", color: { argb: "FF4C1D95" } },
            left: { style: "thin", color: { argb: "FF4C1D95" } },
            bottom: { style: "medium", color: { argb: "FF4C1D95" } },
            right: { style: "thin", color: { argb: "FF4C1D95" } },
        };
    });

    // Add data rows with alternating row colors
    exportData.forEach((row, rowIndex) => {
        const rowData = selectedColumns.map((col) => row[col]);
        const dataRow = worksheet.addRow(rowData);

        // Apply alternating row colors for better readability
        const isEvenRow = rowIndex % 2 === 0;
        dataRow.eachCell((cell, colNumber) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: isEvenRow ? "FFF8F9FA" : "FFFFFFFF" }, // Light gray alternating with white
            };
            cell.font = {
                size: 11,
                name: "Calibri",
            };
            cell.alignment = {
                vertical: "middle",
                wrapText: true,
            };
            cell.border = {
                top: { style: "thin", color: { argb: "FFE5E7EB" } },
                left: { style: "thin", color: { argb: "FFE5E7EB" } },
                bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                right: { style: "thin", color: { argb: "FFE5E7EB" } },
            };
        });
    });

    // Style specific columns based on data type
    selectedColumns.forEach((columnField, index) => {
        const column = worksheet.getColumn(index + 1);

        // Auto-size columns with some padding
        const headerLength = (columnHeaders[columnField] || columnField).length;
        const maxDataLength = Math.max(
            ...data.map((row) => String(row[columnField] || "").length)
        );
        column.width = Math.max(headerLength, maxDataLength, 12) + 2; // Add padding

        // Policy numbers: force text so Excel does not add decimals or grouping
        if (isPolicyIdentifierColumn(columnField)) {
            column.numFmt = "@";
            column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                if (rowNumber > 1 && cell.value != null && cell.value !== "") {
                    cell.value = String(cell.value);
                }
            });
        } else if (isNumericColumn(columnField)) {
            column.numFmt = isIntegerNumericColumn(columnField)
                ? "#,##0"
                : "#,##0.00";

            // Right-align numeric columns
            column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                if (rowNumber > 1) {
                    const cellValue = cell.value;
                    if (looksLikeFormattedCurrency(cellValue)) {
                        cell.value = String(cellValue);
                        cell.numFmt = "@";
                        cell.alignment = {
                            ...cell.alignment,
                            horizontal: "right",
                        };
                        return;
                    }
                    if (
                        typeof cellValue === "string" &&
                        cellValue.trim() !== ""
                    ) {
                        const numericValue = parseFloat(
                            cellValue.replace(/[,$]/g, "")
                        );
                        if (!isNaN(numericValue)) {
                            cell.value = isIntegerNumericColumn(columnField)
                                ? Math.round(numericValue)
                                : numericValue;
                        }
                    } else if (
                        typeof cellValue === "number" &&
                        isIntegerNumericColumn(columnField)
                    ) {
                        cell.value = Math.round(cellValue);
                    }

                    cell.alignment = {
                        ...cell.alignment,
                        horizontal: "right",
                    };
                }
            });
        }

        // Apply currency formatting for currency amount columns
        if (
            columnField.includes("Amount)") &&
            !columnField.includes("Currency)")
        ) {
            // Format as numbers with thousand separators for amount columns
            column.numFmt = "#,##0";

            // Right-align currency amount columns
            column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                if (rowNumber > 1) {
                    // Skip header row
                    cell.alignment = {
                        ...cell.alignment,
                        horizontal: "right",
                    };
                }
            });
        }

        // Locale-aware date display format (values are usually already formatted strings).
        // en-US is month-first; most other locales (incl. he-IL) are day-first.
        if (columnField.includes("date") || columnField.includes("Date")) {
            column.numFmt = locale === "en-US" ? "mm/dd/yyyy" : "dd/mm/yyyy";
        }
    });

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    // Create blob and download
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.xlsx`;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

/**
 * Helper function to create column headers mapping from GridColDef array
 * @param columns - Array of GridColDef objects
 * @returns Object mapping field names to header names
 */
export const createColumnHeaders = (columns: any[]): Record<string, string> => {
    const headers: Record<string, string> = {};

    columns.forEach((column) => {
        if (column.field && column.headerName) {
            headers[column.field] = column.headerName;
        }
    });

    return headers;
};

/**
 * Helper function to validate export data
 * @param data - Data array to validate
 * @param selectedColumns - Selected column fields
 * @returns Validation result
 */
export const validateExportData = (
    data: any[],
    selectedColumns: string[]
): { isValid: boolean; error?: string } => {
    if (!data || !Array.isArray(data)) {
        return { isValid: false, error: "Data must be an array" };
    }

    if (data.length === 0) {
        return { isValid: false, error: "No data to export" };
    }

    if (!selectedColumns || selectedColumns.length === 0) {
        return { isValid: false, error: "No columns selected" };
    }

    // Check if all selected columns exist in the data
    const firstRow = data[0];
    const missingColumns = selectedColumns.filter((col) => !(col in firstRow));

    if (missingColumns.length > 0) {
        return {
            isValid: false,
            error: `Missing columns: ${missingColumns.join(", ")}`,
        };
    }

    return { isValid: true };
};
