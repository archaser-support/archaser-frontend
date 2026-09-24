"use client";

import { Add as AddIcon } from "@mui/icons-material";
import {
    Box,
    Chip,
    IconButton,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    GridColDef,
    GridRenderCellParams,
    GridSortModel,
} from "@/shared/layout-components/grid/gridColumnTypes";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import PageHeader from "@/components/PageHeader";
import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import EndlessScrollDataGrid, {
    BREAKPOINTS,
    createQueryFn,
    useVirtualInfiniteScroll,
    useWindowWidth,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import {
    CLAIM_STATUSES,
    claimCustomerDisplayName,
    type ClaimRecord,
} from "@/shared/services/claimsService";
import AppUrls from "@/utils/appUrls";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

import ClaimFormDialog from "./ClaimFormDialog";

type StatusFilterOption = {
    value: string;
    label: string;
};

function statusChipColor(
    status: string
): "default" | "info" | "warning" | "success" | "error" {
    switch (status) {
        case "Submitted":
            return "info";
        case "Under_Inquiry":
            return "warning";
        case "Approved":
        case "Paid":
            return "success";
        case "Rejected":
            return "error";
        default:
            return "default";
    }
}

function moneyNumber(value: number | string | null | undefined): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

export default function ClaimsList() {
    const { t, i18n } = useTranslation(["claims", "common"]);
    const theme = useTheme();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: session } = useSession();
    const windowWidth = useWindowWidth();
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const [statusFilter, setStatusFilter] = useState<StatusFilterOption | null>(
        null
    );
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "id", sort: "desc" },
    ]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingClaim, setEditingClaim] = useState<ClaimRecord | null>(null);

    const statusFilterOptions = useMemo<StatusFilterOption[]>(
        () => [
            {
                value: "",
                label: t("fields.all_statuses", { ns: "claims" }),
            },
            ...CLAIM_STATUSES.map((status) => ({
                value: status,
                label: t(`statuses.${status}`, { ns: "claims" }),
            })),
        ],
        [t]
    );

    const queryKey = useMemo(
        () => [
            "claims-virtual",
            {
                status: statusFilter?.value || "",
                refreshKey,
            },
        ],
        [statusFilter?.value, refreshKey]
    );

    const {
        data: claims,
        totalRecords,
        isLoading,
        hasMore,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey,
        queryFn: createQueryFn(
            "/api/entities/claims",
            {
                ...(statusFilter?.value
                    ? { status: statusFilter.value }
                    : {}),
            },
            "claims"
        ),
    });

    const prevStatusRef = useRef(statusFilter?.value || "");
    useEffect(() => {
        const next = statusFilter?.value || "";
        if (prevStatusRef.current !== next) {
            prevStatusRef.current = next;
            reset();
        }
    }, [statusFilter?.value, reset]);

    useEffect(() => {
        if (refreshKey > 0) {
            reset();
        }
    }, [refreshKey, reset]);

    const rows = useMemo(() => {
        return (claims as ClaimRecord[]).map((claim) => ({
            ...claim,
            customer_name: claimCustomerDisplayName(claim.Customer),
            customer_number: claim.Customer?.customer_number || "",
            invoice_number: claim.Invoice?.invoice_number || "",
            policy_number: claim.InsurancePolicy?.policy_number || "",
        }));
    }, [claims]);

    const columnVisibilityModel = useMemo(
        () => ({
            customer_number: windowWidth >= BREAKPOINTS.MOBILE,
            invoice_number: windowWidth >= BREAKPOINTS.MOBILE,
            policy_year: windowWidth >= BREAKPOINTS.TABLET,
            policy_number: windowWidth >= BREAKPOINTS.TABLET,
            submission_date: windowWidth >= BREAKPOINTS.TABLET,
        }),
        [windowWidth]
    );

    const openCreate = useCallback(() => {
        setEditingClaim(null);
        setDialogOpen(true);
    }, []);

    const openEdit = useCallback((claim: ClaimRecord) => {
        setEditingClaim(claim);
        setDialogOpen(true);
    }, []);

    const handleDialogSuccess = useCallback(() => {
        setRefreshKey((n) => n + 1);
        void queryClient.invalidateQueries({
            queryKey: ["claims", "policy-excess-summary"],
        });
    }, [queryClient]);

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "id",
                headerName: t("fields.id", { ns: "claims" }),
                flex: 0.5,
                minWidth: 90,
                renderCell: (params: GridRenderCellParams) => (
                    <Typography
                        variant="body2"
                        data-cell-link="true"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openEdit(params.row as ClaimRecord);
                        }}
                        sx={{
                            color: theme.palette.primary.main,
                            cursor: "pointer",
                            textDecoration: "underline",
                            textUnderlineOffset: "0.125em",
                        }}
                    >
                        {params.value}
                    </Typography>
                ),
            },
            {
                field: "status",
                headerName: t("fields.status", { ns: "claims" }),
                flex: 0.8,
                minWidth: 130,
                renderCell: (params: GridRenderCellParams) => {
                    const status = String(params.value || "");
                    return (
                        <Chip
                            size="small"
                            color={statusChipColor(status)}
                            label={t(`statuses.${status}`, {
                                ns: "claims",
                                defaultValue: status,
                            })}
                        />
                    );
                },
            },
            {
                field: "customer_name",
                headerName: t("fields.customer", { ns: "claims" }),
                flex: 1,
                minWidth: 160,
                renderCell: (params: GridRenderCellParams) => {
                    const customerId = params.row.customer_id as
                        | number
                        | null
                        | undefined;
                    const name = String(params.value || "");
                    if (!customerId || !name) {
                        return (
                            <Typography variant="body2">
                                {name || "—"}
                            </Typography>
                        );
                    }
                    return (
                        <Typography
                            variant="body2"
                            data-cell-link="true"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(
                                    AppUrls.Customer_DETAILS(customerId)
                                );
                            }}
                            sx={{
                                color: theme.palette.primary.main,
                                cursor: "pointer",
                                textDecoration: "underline",
                                textUnderlineOffset: "0.125em",
                            }}
                        >
                            {name}
                        </Typography>
                    );
                },
            },
            {
                field: "customer_number",
                headerName: t("fields.customer_number", { ns: "claims" }),
                flex: 0.7,
                minWidth: 120,
            },
            {
                field: "invoice_number",
                headerName: t("fields.invoice", { ns: "claims" }),
                flex: 0.8,
                minWidth: 120,
                renderCell: (params: GridRenderCellParams) => (
                    <Typography variant="body2">
                        {String(params.value || "—")}
                    </Typography>
                ),
            },
            {
                field: "recognized_loss",
                headerName: t("fields.recognized_loss", { ns: "claims" }),
                flex: 0.9,
                minWidth: 130,
                renderCell: (params: GridRenderCellParams) => {
                    const amount = moneyNumber(params.row.recognized_loss);
                    const currency = session?.user?.currency || "USD";
                    return (
                        <Typography variant="body2" fontWeight={600}>
                            {formatCurrencyWithRTLSupport(
                                amount,
                                currency,
                                getUserDateLocale(session),
                                i18n.language
                            )}
                        </Typography>
                    );
                },
            },
            {
                field: "policy_year",
                headerName: t("fields.policy_year", { ns: "claims" }),
                flex: 0.5,
                minWidth: 100,
            },
            {
                field: "policy_number",
                headerName: t("fields.policy_number", { ns: "claims" }),
                flex: 0.7,
                minWidth: 120,
            },
            {
                field: "submission_date",
                headerName: t("fields.submission_date", { ns: "claims" }),
                flex: 0.8,
                minWidth: 130,
                renderCell: (params: GridRenderCellParams) => {
                    if (!params.value) {
                        return <Typography variant="body2">—</Typography>;
                    }
                    return (
                        <Typography variant="body2">
                            {formatDateForDisplay(
                                params.value,
                                "date",
                                getUserDateLocale(session),
                                getUserTimezone(session)
                            )}
                        </Typography>
                    );
                },
            },
        ],
        [i18n.language, openEdit, router, session, t, theme.palette.primary.main]
    );

    const customButtons = useMemo(
        () => (
            <>
                <ToolbarDropdownFilter<StatusFilterOption>
                    value={
                        statusFilter ??
                        statusFilterOptions.find((o) => o.value === "") ??
                        null
                    }
                    onChange={(option) => {
                        if (!option || option.value === "") {
                            setStatusFilter(null);
                            return;
                        }
                        setStatusFilter(option);
                    }}
                    options={statusFilterOptions}
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(a, b) => a.value === b.value}
                    label={t("fields.status_filter", { ns: "claims" })}
                    disableListboxScroll
                />
                <Tooltip
                    title={t("actions.create", { ns: "claims" })}
                    arrow
                    placement="bottom"
                >
                    <IconButton
                        color="primary"
                        size="small"
                        onClick={openCreate}
                        className="toolbar-button"
                        aria-label={t("actions.create", { ns: "claims" })}
                    >
                        <AddIcon />
                    </IconButton>
                </Tooltip>
            </>
        ),
        [openCreate, statusFilter, statusFilterOptions, t]
    );

    return (
        <Box sx={{ bgcolor: "background.default", borderRadius: 2 }}>
            <PageHeader
                title={t("sections.title", { ns: "claims" })}
                description={t("sections.description", { ns: "claims" })}
            />

            <Box
                ref={tableContainerRef}
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    borderRadius: theme.shape.borderRadius,
                }}
            >
                <EndlessScrollDataGrid
                    rows={rows}
                    columns={columns}
                    totalRecords={totalRecords}
                    isLoading={isLoading}
                    onLoadMore={loadMore}
                    hasMore={hasMore}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    customButtons={customButtons}
                    searchDisabled
                    language={i18n.language}
                    fillViewport
                    resizableColumns
                    columnVisibilityModel={columnVisibilityModel}
                    onRowClick={(row) => openEdit(row as ClaimRecord)}
                    noRowsMessage={t("messages.no_claims", { ns: "claims" })}
                    noRowsDescription={t("messages.no_claims_description", {
                        ns: "claims",
                    })}
                />
            </Box>

            <ClaimFormDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSuccess={handleDialogSuccess}
                claim={editingClaim}
            />
        </Box>
    );
}
