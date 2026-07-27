import ExcelJS from "exceljs";

export const parseExcel = (
    file: File
): Promise<{ data: Record<string, any>[]; headers: string[] }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e: ProgressEvent<FileReader>) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(arrayBuffer);

                const worksheet = workbook.worksheets[0];
                if (!worksheet) {
                    throw new Error("No worksheet found in the Excel file");
                }

                const headerCols: string[] = [];
                const jsonData: Record<string, any>[] = [];

                // Get the first row as headers
                const headerRow = worksheet.getRow(1);
                headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    const value = cell.value;
                    if (value !== null && value !== undefined) {
                        headerCols.push(String(value));
                    } else {
                        headerCols.push(`Column_${colNumber}`);
                    }
                });

                // Parse data rows (starting from row 2)
                worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                    if (rowNumber === 1) return; // Skip header row

                    const rowData: Record<string, any> = {};
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        const header = headerCols[colNumber - 1] || `Column_${colNumber}`;
                        let cellValue = cell.value;

                        // Handle different cell types
                        if (cellValue && typeof cellValue === "object") {
                            if ("result" in cellValue) {
                                // Formula cell - use the result
                                cellValue = cellValue.result;
                            } else if ("text" in cellValue) {
                                // Rich text cell
                                cellValue = cellValue.text;
                            } else if (cellValue instanceof Date) {
                                cellValue = cellValue.toISOString();
                            }
                        }

                        if (cellValue !== null && cellValue !== undefined) {
                            rowData[header] = cellValue;
                        }
                    });

                    // Only add non-empty rows
                    if (Object.keys(rowData).length > 0) {
                        jsonData.push(rowData);
                    }
                });

                // Collect all headers from data
                const allHeaders = new Set<string>(headerCols);
                jsonData.forEach((row) => {
                    Object.keys(row).forEach((key) => allHeaders.add(key));
                });

                resolve({
                    data: jsonData,
                    headers: Array.from(allHeaders).sort(),
                });
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
};
