"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    FileDownload as FileDownloadIcon,
    Receipt as ReceiptIcon,
} from "@mui/icons-material";
import {
    Box,
    Button,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Popover,
} from "@mui/material";
import type { GridRenderCellParams } from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { BulkActionButton } from "@/shared/components/BulkActionButton";
import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid/ViewBasedDataGrid";
import {
    buildCreditDashboardReportFilters,
    DASHBOARD_CREDIT_CUSTOMERS_CONTEXT,
    DASHBOARD_CREDIT_INVOICES_CONTEXT,
} from "@/shared/dashboard/creditDashboardReportFilters";
import { exportToExcel } from "@/shared/utility/exportToExcel";

import { BulkMarkInvoicesReportedDialog } from "./BulkMarkInvoicesReportedDialog";
import { MarkInvoiceReportedDialog } from "./MarkInvoiceReportedDialog";

interface CreditDashboardReportViewGridProps {
    type: string;
    policyId?: number | null;
    businessUnitId?: number | null;
    customerId?: number | null;
    includeNoPolicyExposure?: boolean;
    termsBreachReason?: string | null;
    termsOverdueOnly?: boolean;
    withinDays?: number | null;
    topUpReason?: string | null;
    viewportRecalcDependency?: unknown;
}

/**
 * Report-backed credit dashboard detail list (ViewBased).
 * Seeds with URL `type` system report but allows switching from selector.
 * Reporting / reported types include mark + bulk mark + bulk export actions.
 */
export const CreditDashboardReportViewGrid: React.FC<
    CreditDashboardReportViewGridProps
> = ({
    type,
    policyId = null,
    businessUnitId = null,
    customerId = null,
    includeNoPolicyExposure,
    termsBreachReason,
    termsOverdueOnly,
    withinDays,
    topUpReason,
    viewportRecalcDependency,
}) => {
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const queryClient = useQueryClient();
    const [searchValue, setSearchValue] = useState("");
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [bulkMenuPosition, setBulkMenuPosition] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const [bulkMarkOpen, setBulkMarkOpen] = useState(false);
    const [markDialogOpen, setMarkDialogOpen] = useState(false);
    const [markInvoice, setMarkInvoice] = useState<{ id: number } | null>(
        null
    );
    const [exportingSelected, setExportingSelected] = useState(false);
    const [rowsSnapshot, setRowsSnapshot] = useState<any[]>([]);

    const enableBulkActions = type === "reporting" || type === "reported";
    const enableMarkAction = type === "reporting";

    const filterContract = useMemo(
        () =>
            buildCreditDashboardReportFilters({
                type,
                policyId,
                customerId,
                includeNoPolicyExposure,
                termsBreachReason,
                termsOverdueOnly,
                withinDays,
                topUpReason,
            }),
        [
            type,
            policyId,
            customerId,
            includeNoPolicyExposure,
            termsBreachReason,
            termsOverdueOnly,
            withinDays,
            topUpReason,
        ]
    );

    const context =
        filterContract.context ??
        (filterContract.grain === "invoices"
            ? DASHBOARD_CREDIT_INVOICES_CONTEXT
            : DASHBOARD_CREDIT_CUSTOMERS_CONTEXT);

    const { data: systemReportId } = useQuery({
        queryKey: [
            "dashboard-credit-system-report",
            context,
            filterContract.systemReportUniqueName,
        ],
        queryFn: async () => {
            if (!filterContract.systemReportUniqueName) {
                return null;
            }
            const response = await apiFetch(`/api/reports?context=${context}`);
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            const reports = (data.reports || []) as Array<{
                id: number;
                unique_name?: string;
            }>;
            const match = reports.find(
                (r) =>
                    r.unique_name === filterContract.systemReportUniqueName
            );
            return match?.id ?? null;
        },
        enabled: !!filterContract.systemReportUniqueName,
        staleTime: 5 * 60 * 1000,
    });

    const bumpRefresh = useCallback(() => {
        void queryClient.invalidateQueries({
            queryKey: ["credit-insurance", "summary"],
        });
        setRefreshTrigger((v) => v + 1);
    }, [queryClient]);

    const bulkActionButton = useMemo(() => {
        if (!enableBulkActions) {
            return undefined;
        }
        return (
            <BulkActionButton
                selectedRowsCount={selectedRows.length}
                onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setBulkMenuPosition({
                        top: rect.bottom + window.scrollY,
                        left:
                            i18n.language === "he"
                                ? rect.right + window.scrollX
                                : rect.left + window.scrollX,
                    });
                }}
            />
        );
    }, [enableBulkActions, i18n.language, selectedRows.length]);

    const actionsColumn = useMemo(() => {
        if (!enableMarkAction) {
            return undefined;
        }
        return (params: GridRenderCellParams) => {
            const id = Number(params.row?.id ?? params.id);
            if (!Number.isFinite(id)) {
                return null;
            }
            return (
                <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => {
                        e.stopPropagation();
                        setMarkInvoice({ id });
                        setMarkDialogOpen(true);
                    }}
                >
                    {t("credit_insurance_dashboard.mark_reported")}
                </Button>
            );
        };
    }, [enableMarkAction, t]);

    const handleExportSelected = useCallback(async () => {
        if (selectedRows.length === 0 || exportingSelected) {
            return;
        }
        setExportingSelected(true);
        setBulkMenuPosition(null);
        try {
            const selected = rowsSnapshot.filter((row) =>
                selectedRows.includes(Number(row.id))
            );
            if (selected.length === 0) {
                return;
            }
            const columns = Object.keys(selected[0] || {}).filter(
                (k) => !k.startsWith("___") && k !== "checkbox"
            );
            const fileBase =
                type === "reporting"
                    ? t("credit_insurance_report.bulk_export_file_reporting")
                    : t("credit_insurance_report.bulk_export_file_reported");
            const stamp = new Date().toISOString().slice(0, 10);
            await exportToExcel({
                data: selected,
                selectedColumns: columns,
                fileName: `${fileBase}_${stamp}`,
                columnHeaders: Object.fromEntries(
                    columns.map((c) => [c, c])
                ),
                format: "excel",
            });
        } finally {
            setExportingSelected(false);
        }
    }, [exportingSelected, rowsSnapshot, selectedRows, t, type]);

    return (
        <Box
            sx={{
                position: "relative",
                isolation: "isolate",
            }}
        >
            <ViewBasedDataGrid
                context={context}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                defaultViewId={systemReportId}
                additionalFilters={filterContract.additionalFilters}
                businessUnitId={businessUnitId}
                fillViewport={true}
                exportDisabled={false}
                allowAddEditViews={false}
                reportSelector={true}
                viewportRecalcDependency={viewportRecalcDependency}
                bulkActionButton={bulkActionButton}
                actionsColumn={actionsColumn}
                actionsColumnConfig={
                    enableMarkAction
                        ? {
                              headerName: t(
                                  "credit_insurance_dashboard.mark_reported"
                              ),
                              minWidth: 140,
                          }
                        : undefined
                }
                enableMultiSelect={enableBulkActions}
                onSelectedRowsChange={
                    enableBulkActions ? setSelectedRows : undefined
                }
                selectedRows={enableBulkActions ? selectedRows : undefined}
                onRowsChange={enableBulkActions ? setRowsSnapshot : undefined}
                refreshTrigger={refreshTrigger}
            />
            {bulkMenuPosition && enableBulkActions && (
                <Popover
                    open
                    onClose={() => setBulkMenuPosition(null)}
                    anchorReference="anchorPosition"
                    anchorPosition={bulkMenuPosition}
                    anchorOrigin={{
                        vertical: "top",
                        horizontal: i18n.language === "he" ? "right" : "left",
                    }}
                    transformOrigin={{
                        vertical: "top",
                        horizontal: i18n.language === "he" ? "right" : "left",
                    }}
                    PaperProps={{
                        sx: {
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            minWidth: 260,
                            mt: 0.5,
                        },
                    }}
                >
                    {type === "reporting" && (
                        <MenuItem
                            disabled={selectedRows.length === 0}
                            onClick={() => {
                                setBulkMenuPosition(null);
                                setBulkMarkOpen(true);
                            }}
                        >
                            <ListItemIcon>
                                <ReceiptIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary={t(
                                    "credit_insurance_report.bulk_mark_title"
                                )}
                            />
                        </MenuItem>
                    )}
                    <MenuItem
                        disabled={
                            selectedRows.length === 0 || exportingSelected
                        }
                        onClick={() => void handleExportSelected()}
                    >
                        <ListItemIcon>
                            <FileDownloadIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                            primary={t(
                                "credit_insurance_report.bulk_export_selected"
                            )}
                        />
                    </MenuItem>
                </Popover>
            )}
            <BulkMarkInvoicesReportedDialog
                open={bulkMarkOpen}
                onClose={() => setBulkMarkOpen(false)}
                invoiceIds={selectedRows}
                onSuccess={() => {
                    bumpRefresh();
                    setSelectedRows([]);
                }}
            />
            <MarkInvoiceReportedDialog
                open={markDialogOpen}
                onClose={() => {
                    setMarkDialogOpen(false);
                    setMarkInvoice(null);
                }}
                invoice={markInvoice}
                onSuccess={bumpRefresh}
            />
        </Box>
    );
};
