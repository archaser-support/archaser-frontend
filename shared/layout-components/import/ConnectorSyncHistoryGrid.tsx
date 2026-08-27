"use client";

import { Box, Typography } from "@mui/material";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import type { SyncRunSummary } from "@/shared/services/billingConnectorService";
import {
    toSyncHistoryGridRow,
    type SyncHistoryGridRow,
} from "@/shared/services/syncHistoryGrid";

function renderPlainCell(params: GridRenderCellParams) {
    const text = String(params.value ?? "—");
    return (
        <Typography variant="body2" noWrap title={text === "—" ? "" : text}>
            {text}
        </Typography>
    );
}

const SYNC_HISTORY_COLUMNS: GridColDef<SyncHistoryGridRow>[] = [
    {
        field: "started",
        headerName: "Started",
        flex: 1.2,
        minWidth: 160,
        sortable: false,
        renderCell: renderPlainCell,
    },
    {
        field: "status",
        headerName: "Status",
        flex: 0.8,
        minWidth: 100,
        sortable: false,
        renderCell: renderPlainCell,
    },
    {
        field: "mode",
        headerName: "Mode",
        flex: 0.8,
        minWidth: 100,
        sortable: false,
        renderCell: renderPlainCell,
    },
    {
        field: "trigger",
        headerName: "Trigger",
        flex: 0.8,
        minWidth: 100,
        sortable: false,
        renderCell: renderPlainCell,
    },
    {
        field: "duration",
        headerName: "Duration",
        flex: 0.6,
        minWidth: 90,
        sortable: false,
        renderCell: renderPlainCell,
    },
    {
        field: "error",
        headerName: "Error",
        flex: 1.4,
        minWidth: 140,
        sortable: false,
        renderCell: renderPlainCell,
    },
    {
        field: "customer",
        headerName: "Customer",
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: renderPlainCell,
    },
    {
        field: "contact",
        headerName: "Contact",
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: renderPlainCell,
    },
    {
        field: "invoice",
        headerName: "Invoice",
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: renderPlainCell,
    },
    {
        field: "payment",
        headerName: "Payment",
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: renderPlainCell,
    },
    {
        field: "linkPayments",
        headerName: "Link payments",
        flex: 1,
        minWidth: 130,
        sortable: false,
        renderCell: renderPlainCell,
    },
];

interface ConnectorSyncHistoryGridProps {
    runs: SyncRunSummary[];
    isLoading?: boolean;
}

export default function ConnectorSyncHistoryGrid({
    runs,
    isLoading = false,
}: ConnectorSyncHistoryGridProps) {
    const { i18n } = useTranslation();

    const rows = useMemo(
        () => runs.map((run) => toSyncHistoryGridRow(run)),
        [runs]
    );

    return (
        <Box
            sx={{
                width: "100%",
                bgcolor: "background.paper",
                borderRadius: 2,
                overflow: "hidden",
            }}
        >
            <EndlessScrollDataGrid
                rows={rows}
                columns={SYNC_HISTORY_COLUMNS}
                totalRecords={rows.length}
                isLoading={isLoading}
                onLoadMore={() => {}}
                hasMore={false}
                hideToolbar
                resizableColumns
                visibleRows={Math.min(Math.max(rows.length, 1), 8)}
                language={i18n.language}
                noRowsMessage="No sync history"
                noRowsDescription="Finished syncs will appear here after they complete."
            />
        </Box>
    );
}
