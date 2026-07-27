import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";
import { resolveReportColumnOrder } from "@/shared/reportFormula/columnOrder";
import { getFormulaOutputKey } from "@/shared/reportFormula/types";
import { LogService } from "./LogService";
import type { Filter } from "./ReportExecutionService.types";
import { ReportExecutionService } from "./ReportExecutionService";

export class ReportExportService {
    private static instance: ReportExportService;
    private logService = LogService.getInstance();

    public static getInstance(): ReportExportService {
        if (!ReportExportService.instance) {
            ReportExportService.instance = new ReportExportService();
        }
        return ReportExportService.instance;
    }

    /**
     * Export report to specified format
     */
    async exportReport(
        reportId: number,
        accountId: number,
        format: "csv" | "excel" | "pdf",
        selectedColumns?: string[],
        locale?: string,
        options?: {
            filters?: Filter[];
            replaceConfigFilters?: boolean;
            search?: string;
            sortField?: string;
            sortDirection?: "ASC" | "DESC";
            userId?: string;
            businessUnitFilter?: unknown;
        }
    ): Promise<Buffer | string> {
        try {
            // Get report
            const report = await (prisma as any).report.findUnique({
                where: { id: reportId },
            });

            if (!report) {
                throw new Error("Report not found");
            }

            if (report.account_id !== accountId) {
                throw new Error("Unauthorized to export this report");
            }

            // Execute report to get data
            const executionService = ReportExecutionService.getInstance();
            const hasReplacementFilters =
                options?.replaceConfigFilters === true &&
                Array.isArray(options.filters) &&
                options.filters.length > 0;

            const result = await executionService.executeReport({
                reportId,
                accountId,
                userId: options?.userId,
                filters: hasReplacementFilters ? options?.filters : undefined,
                replaceConfigFilters: hasReplacementFilters,
                search: options?.search,
                sortField: options?.sortField,
                sortDirection: options?.sortDirection,
                limit: 10000,
                locale,
                businessUnitFilter: options?.businessUnitFilter,
            });

            // Import metadata to get field labels
            const { REPORT_METADATA } = await import("./reportMetadata");
            const metadata = REPORT_METADATA;
            const config = report.report_config as any;

            // ReportExecutionService already formats data with output keys: alias || `${table}.${field}`
            // We should use the data as-is instead of remapping it
            // Filter out internal metadata keys (__link_*, __currency_*, __automation_stuck_*), ID fields, and auto-added name field
            // This matches the same filtering logic used by generateViewColumns in the frontend

            // Get list of explicitly selected field keys from report config (matches frontend logic)
            const selectedFieldKeys = new Set<string>();
            if (config?.fields && Array.isArray(config.fields)) {
                config.fields.forEach((field: any) => {
                    const outputKey = field.alias || `${field.table || config.tables?.[0] || "Customer"}.${field.field}`;
                    selectedFieldKeys.add(outputKey);
                    // Also add just "name" if the field is "name" (for auto-name field detection)
                    if (field.field === "name") {
                        selectedFieldKeys.add("name");
                    }
                });
            }
            if (config?.formulas && Array.isArray(config.formulas)) {
                config.formulas.forEach((formula: any) => {
                    if (formula?.id) {
                        selectedFieldKeys.add(getFormulaOutputKey(formula.id));
                    }
                });
            }

            const resolvedColumnOrder = resolveReportColumnOrder(
                config.fields || [],
                config.formulas || [],
                config.columnOrder
            );

            const exportData = result.data.map((row: any) => {
                const formatted: any = {};
                // Copy all keys except internal metadata keys, ID fields, and auto-added name field
                Object.keys(row).forEach((key) => {
                    // Skip internal metadata keys
                    if (key.startsWith("__")) {
                        return;
                    }

                    // Skip ID fields (matches generateViewColumns logic)
                    const normalizedKey = key.toLowerCase();
                    const isIdField = normalizedKey === "id" || normalizedKey.endsWith("_id");
                    if (isIdField) {
                        return;
                    }

                    // Skip auto-added "name" field if it wasn't explicitly selected (matches frontend logic)
                    // ReportExecutionService auto-adds "name" for generic display, but we should only include it if it's in the config
                    const isAutoNameField = key === "name" && !selectedFieldKeys.has("name");
                    if (isAutoNameField) {
                        return;
                    }

                    // If selectedColumns is provided, only include those columns
                    if (selectedColumns && selectedColumns.length > 0) {
                        if (!selectedColumns.includes(key)) {
                            return;
                        }
                    }

                    const formattedKey = `___formatted_${key}`;
                    formatted[key] = row[formattedKey] ?? row[key];
                });
                if (resolvedColumnOrder.length > 0) {
                    const ordered: any = {};
                    for (const key of resolvedColumnOrder) {
                        if (formatted[key] !== undefined) {
                            ordered[key] = formatted[key];
                        }
                    }
                    for (const [key, value] of Object.entries(formatted)) {
                        if (!(key in ordered)) {
                            ordered[key] = value;
                        }
                    }
                    return ordered;
                }
                return formatted;
            });

            // Create column header mapping with translated labels
            // Use the same output key logic as ReportExecutionService: alias || `${table}.${field}`
            // Filter out ID fields (ReportExecutionService also skips them, but we filter here too for safety)
            const columnHeaders: Record<string, string> = {};
            if (config.fields) {
                config.fields.forEach((field: any) => {
                    // Skip ID fields (matches ReportExecutionService logic)
                    const normalizedFieldName = field.field.toLowerCase();
                    if (normalizedFieldName === "id" || normalizedFieldName.endsWith("_id")) {
                        return;
                    }

                    // Use the same output key format as ReportExecutionService
                    const outputKey = field.alias || `${field.table || config.tables?.[0] || "Customer"}.${field.field}`;

                    // If selectedColumns is provided, only include headers for selected columns
                    if (selectedColumns && selectedColumns.length > 0) {
                        if (!selectedColumns.includes(outputKey)) {
                            return;
                        }
                    }

                    // Get translated label from metadata
                    let label = field.field; // Default to field name

                    // Try to get label from metadata first
                    const tableName = field.table || config.tables?.[0] || "Customer";
                    const tableData = metadata.tables.find((t: any) => t.name === tableName);
                    if (tableData) {
                        const fieldData = tableData.fields.find((f: any) => f.name === field.field);
                        if (fieldData?.label) {
                            label = fieldData.label;
                        }
                    }

                    // If alias exists and doesn't look like a translation key, use it as fallback
                    if (field.alias && !field.alias.includes(".") && !field.alias.startsWith("fields.")) {
                        label = field.alias;
                    } else if (!tableData || !tableData.fields.find((f: any) => f.name === field.field)) {
                        // If not found in metadata, format the field name nicely
                        label = field.field
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase());
                    }

                    columnHeaders[outputKey] = label;
                });
                if (Array.isArray(config.formulas)) {
                    for (const formula of config.formulas) {
                        if (!formula?.id) continue;
                        const outputKey = getFormulaOutputKey(formula.id);
                        if (
                            selectedColumns &&
                            selectedColumns.length > 0 &&
                            !selectedColumns.includes(outputKey)
                        ) {
                            continue;
                        }
                        columnHeaders[outputKey] = formula.label || outputKey;
                    }
                }
            } else if (exportData.length > 0) {
                // If no fields config, use column names as-is
                Object.keys(exportData[0]).forEach((key) => {
                    // If selectedColumns is provided, only include headers for selected columns
                    if (selectedColumns && selectedColumns.length > 0) {
                        if (!selectedColumns.includes(key)) {
                            return;
                        }
                    }
                    columnHeaders[key] = key;
                });
            }

            // Export based on format
            switch (format) {
                case "csv":
                    return this.exportToCSV(exportData, columnHeaders);
                case "excel":
                    return this.exportToExcel(
                        exportData,
                        report.name,
                        columnHeaders
                    );
                case "pdf":
                    return this.exportToPDF(exportData, report, columnHeaders, selectedColumns);
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to export report ${reportId}: ${error instanceof Error ? error.message : String(error)}`,
                "ReportExportService",
                undefined,
                accountId
            );
            throw error;
        }
    }

    /**
     * Export to CSV
     */
    private exportToCSV(
        data: any[],
        columnHeaders: Record<string, string> = {}
    ): string {
        if (data.length === 0) {
            return "";
        }

        const headers = Object.keys(data[0]);
        const headerLabels = headers.map(
            (header) => columnHeaders[header] || header
        );
        const rows = data.map((row) =>
            headers.map((header) => {
                const value = row[header];
                if (
                    typeof value === "string" &&
                    (value.includes(",") || value.includes('"'))
                ) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value ?? "";
            })
        );

        const escapeHeader = (label: string) => {
            if (label.includes(",") || label.includes('"')) {
                return `"${label.replace(/"/g, '""')}"`;
            }
            return label;
        };

        return [
            headerLabels.map(escapeHeader).join(","),
            ...rows.map((row) => row.join(",")),
        ].join("\n");
    }

    /**
     * Export to Excel
     */
    private async exportToExcel(
        data: any[],
        _reportName: string,
        columnHeaders: Record<string, string> = {}
    ): Promise<Buffer> {
        const csv = this.exportToCSV(data, columnHeaders);
        return Buffer.from(csv, "utf-8");
    }

    /**
     * Export to PDF
     */
    private async exportToPDF(
        data: any[],
        report: any,
        columnHeaders: Record<string, string>,
        selectedColumns?: string[]
    ): Promise<Buffer> {
        const PDFDocument = (await import("pdfkit")).default;

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                margin: 50,
                size: "A4",
                info: {
                    Title: report.name || "Report",
                    Author: "Archaser",
                    Subject: report.description || "Report Export",
                }
            });
            const chunks: Buffer[] = [];

            doc.on("data", (chunk: Buffer) => {
                chunks.push(chunk);
            });

            doc.on("end", () => {
                resolve(Buffer.concat(chunks));
            });

            doc.on("error", (error: Error) => {
                reject(error);
            });

            // Add title with better styling - ensure black text
            doc.fontSize(24)
                .font("Helvetica")
                .fillColor("#000000") // Black color
                .text(report.name || "Report", {
                    align: "center",
                });
            doc.moveDown(0.5);

            // Add description if available
            if (report.description) {
                doc.fontSize(12)
                    .font("Helvetica")
                    .fillColor("#000000") // Black color
                    .text(report.description, {
                        align: "center",
                    });
                doc.moveDown(0.5);
            }

            // Add date with better styling
            doc.fontSize(10)
                .font("Helvetica")
                .fillColor("#000000") // Black color
                .text(`Generated: ${new Date().toLocaleString()}`, {
                    align: "center",
                });
            doc.moveDown(2);

            if (data.length === 0) {
                doc.fontSize(14)
                    .font("Helvetica")
                    .fillColor("#000000") // Black color
                    .text("No data available", {
                        align: "center",
                    });
                doc.end();
                return;
            }

            // Get column headers from first row, filtered and ordered by selectedColumns if provided
            const allColumns = Object.keys(data[0]);
            const columns = selectedColumns && selectedColumns.length > 0
                ? selectedColumns.filter(col => allColumns.includes(col)) // Filter and maintain selectedColumns order
                : allColumns;

            const pageWidth = doc.page.width - 100; // Available width
            const rowHeight = 25; // Increased row height
            const cellPadding = 8; // Increased padding
            const headerBackgroundColor = "#7C3AED"; // Purple header
            const headerTextColor = "#FFFFFF"; // White text
            const evenRowColor = "#F8F9FA"; // Light gray for alternating rows
            const oddRowColor = "#FFFFFF"; // White for alternating rows
            const borderColor = "#E2E8F0"; // Light border

            // Calculate column widths - distribute evenly but with min/max constraints
            const minColumnWidth = 70;
            const maxColumnWidth = 180;
            let totalCalculatedWidth = 0;
            const columnWidths: number[] = [];

            // First pass: calculate ideal widths based on content
            columns.forEach((col) => {
                // Use translated header for width calculation
                const headerText = columnHeaders[col] || col;
                let maxWidth = Math.max(
                    headerText.length * 7, // Header width (increased multiplier)
                    ...data.slice(0, 20).map((row) => {
                        const value = row[col];
                        const strValue = value === null || value === undefined
                            ? ""
                            : String(value);
                        // Don't truncate for width calculation, but cap it
                        return Math.min(strValue.length * 6, maxColumnWidth);
                    })
                );
                maxWidth = Math.max(minColumnWidth, Math.min(maxWidth, maxColumnWidth));
                columnWidths.push(maxWidth);
                totalCalculatedWidth += maxWidth;
            });

            // Scale columns if they exceed page width
            if (totalCalculatedWidth > pageWidth) {
                const scale = pageWidth / totalCalculatedWidth;
                columns.forEach((col, index) => {
                    columnWidths[index] = columnWidths[index] * scale;
                });
            }

            // Helper function to draw a table row
            const drawRow = (
                row: any | null,
                isHeader: boolean,
                startY: number,
                rowIndex?: number
            ): number => {
                let currentX = 50;
                let maxHeight = rowHeight;

                // Draw cells
                columns.forEach((col, colIndex) => {
                    const cellWidth = columnWidths[colIndex];
                    // Use translated header for header row, otherwise use data value
                    let cellValue = "";
                    if (isHeader) {
                        cellValue = columnHeaders[col] || col;
                    } else if (row) {
                        const value = row[col];

                        if (value === null || value === undefined) {
                            cellValue = "";
                        } else if (typeof value === "object") {
                            cellValue = JSON.stringify(value);
                        } else {
                            cellValue = String(value);
                        }
                    }

                    // Truncate long values (but allow more characters)
                    const maxLength = isHeader ? 40 : 35;
                    const displayValue = cellValue.length > maxLength
                        ? cellValue.substring(0, maxLength) + "..."
                        : cellValue;

                    // Calculate text height first (need font set for this)
                    if (isHeader) {
                        doc.fontSize(11).font("Helvetica");
                    } else {
                        doc.fontSize(9).font("Helvetica");
                    }

                    const textHeight = doc.heightOfString(displayValue, {
                        width: cellWidth - cellPadding * 2,
                    });

                    const cellHeight = Math.max(rowHeight, textHeight + cellPadding * 2);

                    // Draw cell background and border together
                    // Determine fill color based on row type
                    let fillColor: string;
                    if (isHeader) {
                        fillColor = headerBackgroundColor;
                    } else if (rowIndex !== undefined) {
                        fillColor = rowIndex % 2 === 0 ? evenRowColor : oddRowColor;
                    } else {
                        fillColor = oddRowColor; // Default to white
                    }

                    // Draw rectangle with both fill and stroke
                    doc.fillColor(fillColor)
                        .strokeColor(borderColor)
                        .lineWidth(0.5)
                        .rect(currentX, startY, cellWidth, cellHeight)
                        .fillAndStroke();

                    // NOW set font and text color (after background is drawn)
                    if (isHeader) {
                        doc.fontSize(11)
                            .font("Helvetica")
                            .fillColor("#FFFFFF"); // White text for header (on purple background)
                    } else {
                        doc.fontSize(9)
                            .font("Helvetica")
                            .fillColor("#000000"); // Black text for data rows
                    }

                    // Draw text (color is now set correctly)
                    doc.text(displayValue, currentX + cellPadding, startY + cellPadding, {
                        width: cellWidth - cellPadding * 2,
                        align: "left",
                        ellipsis: true,
                    });

                    maxHeight = Math.max(maxHeight, cellHeight);
                    currentX += cellWidth;
                });

                return maxHeight;
            };

            // Helper function to add page number
            const addPageNumber = (pageNum: number) => {
                const savedY = doc.y;
                doc.fontSize(8)
                    .font("Helvetica")
                    .fillColor("#000000") // Black color
                    .text(
                        `Page ${pageNum}`,
                        doc.page.width / 2,
                        doc.page.height - 30,
                        {
                            align: "center",
                        }
                    );
                doc.y = savedY; // Restore Y position
            };

            // Draw header
            let currentY = doc.y;
            const headerHeight = drawRow(null, true, currentY);
            currentY += headerHeight + 2; // Add small gap after header

            // Track page numbers manually
            let currentPage = 1;

            // Add page number to first page
            addPageNumber(currentPage);

            // Draw data rows
            data.forEach((row, rowIndex) => {
                // Check if we need a new page
                if (currentY > doc.page.height - 100) {
                    doc.addPage();
                    currentPage++;
                    currentY = 50;
                    // Redraw header on new page
                    const newHeaderHeight = drawRow(null, true, currentY);
                    currentY += newHeaderHeight + 2;
                    // Add page number to new page
                    addPageNumber(currentPage);
                }

                const rowHeight = drawRow(row, false, currentY, rowIndex);
                currentY += rowHeight;
            });

            // Finalize the PDF
            doc.end();
        });
    }
}
