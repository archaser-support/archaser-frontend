import { useState, useCallback } from "react";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import {
    exportToExcel,
    createColumnHeaders,
    ExportFormat,
} from "../../../utility/exportToExcel";

interface UseExportOptions {
    columns: GridColDef[];
    sortModel?: GridSortModel;
    currencyColumns?: Record<
        string,
        { amountField: string; currencyField: string }
    >;
    onExport?: (
        selectedColumns: string[],
        fileName: string,
        format: ExportFormat
    ) => Promise<any[]>;
    exportDisabled?: boolean;
    totalRecords: number;
}

interface UseExportReturn {
    isExportDialogOpen: boolean;
    isExporting: boolean;
    handleExportClick: () => void;
    handleExport: (
        selectedColumns: string[],
        fileName: string,
        format: ExportFormat
    ) => Promise<void>;
    handleExportDialogClose: () => void;
    setIsExportDialogOpen: (open: boolean) => void;
}

/**
 * Hook to manage export functionality
 */
export const useExport = ({
    columns,
    sortModel,
    currencyColumns,
    onExport,
    exportDisabled = false,
    totalRecords,
}: UseExportOptions): UseExportReturn => {
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleExportClick = useCallback(() => {
        if (onExport && !exportDisabled && totalRecords > 0) {
            setIsExportDialogOpen(true);
        }
    }, [onExport, exportDisabled, totalRecords]);

    const handleExport = useCallback(
        async (
            selectedColumns: string[],
            fileName: string,
            format: ExportFormat
        ) => {
            if (!onExport) {
                throw new Error("Export function not provided");
            }

            setIsExporting(true);
            try {
                // Fetch all data for export
                const exportData = await onExport(
                    selectedColumns,
                    fileName,
                    format
                );



                // Create column headers mapping
                const columnHeaders = createColumnHeaders(columns);

                // Export to Excel or CSV
                exportToExcel({
                    data: exportData,
                    selectedColumns,
                    fileName,
                    columnHeaders,
                    sortModel: sortModel
                        ? sortModel
                            .filter((item) => item.sort)
                            .map((item) => ({
                                field: item.field,
                                sort: item.sort as "asc" | "desc",
                            }))
                        : undefined,
                    format,
                    currencyColumns,
                });
            } finally {
                setIsExporting(false);
            }
        },
        [onExport, columns, sortModel, currencyColumns]
    );

    const handleExportDialogClose = useCallback(() => {
        if (!isExporting) {
            setIsExportDialogOpen(false);
        }
    }, [isExporting]);

    return {
        isExportDialogOpen,
        isExporting,
        handleExportClick,
        handleExport,
        handleExportDialogClose,
        setIsExportDialogOpen,
    };
};
