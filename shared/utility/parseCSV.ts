import Papa from "papaparse";

export const parseCSV = (
    file: File
): Promise<{ data: Record<string, any>[]; headers: string[] }> => {
    return new Promise((resolve, reject) => {
        Papa.parse<Record<string, any>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
                // First, get headers from the header row (Papa.parse with header: true gives us this)
                const headerRow = result.meta.fields || [];
                const allHeaders = new Set<string>(headerRow);

                // Then add any additional headers found in data rows
                result.data.forEach((row) => {
                    Object.keys(row).forEach((key) => allHeaders.add(key));
                });

                resolve({
                    data: result.data,
                    headers: Array.from(allHeaders).sort(),
                });
            },
            error: (error) => reject(error),
        });
    });
};
