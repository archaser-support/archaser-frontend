"use client";

import { Edit as EditIcon } from "@mui/icons-material";
import {
    Box,
    CircularProgress,
    IconButton,
    Tooltip,
    Typography,
    Chip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useDebounce } from "use-debounce";
import api from "@/app/api";
import { useSession } from "next-auth/react";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    mergeWithDefaults,
    GENERIC_ENTITY_KEYS,
    GENERIC_FIELD_KEYS,
    getFieldType,
    type GenericEntityKey,
    type GenericFieldKey,
} from "@/utils/genericFieldUtils";

import type { GenericFieldRow } from "./UpsertGenericFieldModal";
import { UpsertGenericFieldModal } from "./UpsertGenericFieldModal";

const ENTITY_LABELS: Record<GenericEntityKey, string> = {
    customer: "values.entity_customer",
    contact: "values.entity_contact",
    invoice: "values.entity_invoice",
    payment: "values.entity_payment",
};

const FIELD_TYPE_LABELS: Record<string, string> = {
    string: "values.field_type_text",
    number: "values.field_type_number",
    date: "values.field_type_date",
};

interface GenericFieldsListProps {
    accountId: number;
}

function buildRows(
    config: ReturnType<typeof mergeWithDefaults>,
    t: (key: string, opts?: { ns?: string }) => string
): GenericFieldRow[] {
    const result: GenericFieldRow[] = [];
    let id = 0;
    for (const entity of GENERIC_ENTITY_KEYS) {
        for (const fieldKey of GENERIC_FIELD_KEYS) {
            const item = config[entity][fieldKey];
            result.push({
                id: `generic-${id++}`,
                entity,
                fieldKey,
                entityLabel: t(ENTITY_LABELS[entity], { ns: "generic_fields" }),
                fieldTypeLabel: t(FIELD_TYPE_LABELS[getFieldType(fieldKey)], {
                    ns: "generic_fields",
                }),
                label: item.label,
                enabled: item.enabled,
                read_only: item.read_only,
            });
        }
    }
    return result;
}

export function GenericFieldsList({ accountId }: GenericFieldsListProps) {
    const { t, i18n } = useTranslation(["generic_fields", "common"]);
    const { data: session } = useSession();
    const theme = useTheme();
    const [selectedField, setSelectedField] = useState<GenericFieldRow | null>(
        null
    );
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "entityLabel", sort: "asc" },
    ]);

    const queryKey = useMemo(
        () => [
            "generic-fields",
            accountId,
            {
                search: debouncedSearch,
                sortField: sortModel[0]?.field,
                sortDirection: sortModel[0]?.sort,
                refreshKey,
            },
        ],
        [
            accountId,
            debouncedSearch,
            sortModel[0]?.field,
            sortModel[0]?.sort,
            refreshKey,
        ]
    );

    const {
        data: rows,
        totalRecords,
        isLoading,
        hasMore,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey,
        queryFn: useCallback(
            async (page: number) => {
                const response = await api.get(
                    `/api/entities/accounts/${accountId}`
                );
                const config = mergeWithDefaults(
                    response.data?.generic_field_config
                );
                let allRows = buildRows(config, t);

                if (debouncedSearch) {
                    const lower = debouncedSearch.toLowerCase();
                    allRows = allRows.filter(
                        (r) =>
                            r.entityLabel.toLowerCase().includes(lower) ||
                            r.fieldTypeLabel.toLowerCase().includes(lower) ||
                            r.label.toLowerCase().includes(lower)
                    );
                }

                const sortField = sortModel[0]?.field || "entityLabel";
                const sortDirection = sortModel[0]?.sort || "asc";
                allRows = [...allRows].sort((a, b) => {
                    const aVal = (a as any)[sortField] ?? "";
                    const bVal = (b as any)[sortField] ?? "";
                    const cmp = String(aVal).localeCompare(String(bVal));
                    return sortDirection === "asc" ? cmp : -cmp;
                });

                return {
                    data: allRows,
                    totalRecords: allRows.length,
                    hasMore: false,
                };
            },
            [accountId, debouncedSearch, sortModel, t]
        ),
    });

    const handleEditClick = useCallback((row: GenericFieldRow) => {
        setSelectedField(row);
        setIsModalOpen(true);
    }, []);

    const handleModalClose = useCallback(() => {
        setIsModalOpen(false);
        setSelectedField(null);
    }, []);

    const handleSuccess = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
        reset();
        handleModalClose();
    }, [reset, handleModalClose]);

    const hasEditPermission = true; // view_settings allows edit per plan

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "entityLabel",
                headerName: t("fields.column_entity", { ns: "generic_fields" }),
                flex: 1,
                minWidth: 120,
            },
            {
                field: "fieldTypeLabel",
                headerName: t("fields.column_field_type", {
                    ns: "generic_fields",
                }),
                flex: 1,
                minWidth: 100,
            },
            {
                field: "label",
                headerName: t("fields.column_label", { ns: "generic_fields" }),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">{params.row.label}</Typography>
                ),
            },
            {
                field: "enabled",
                headerName: t("fields.column_status", { ns: "generic_fields" }),
                flex: 1,
                minWidth: 110,
                renderCell: (params) => {
                    const isActive = params.row.enabled;
                    return (
                        <Chip
                            label={
                                isActive
                                    ? t("values.status_active", {
                                          ns: "generic_fields",
                                      })
                                    : t("values.status_inactive", {
                                          ns: "generic_fields",
                                      })
                            }
                            size="small"
                            data-status={isActive ? "active" : "inactive"}
                        />
                    );
                },
            },
            {
                field: "read_only",
                headerName: t("fields.column_read_only", {
                    ns: "generic_fields",
                }),
                flex: 1,
                minWidth: 100,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.row.read_only
                            ? t("values.read_only_read_only", {
                                  ns: "generic_fields",
                                  defaultValue: "Read-Only",
                              })
                            : t("values.read_only_editable", {
                                  ns: "generic_fields",
                                  defaultValue: "Editable",
                              })}
                    </Typography>
                ),
            },
            {
                field: "actions",
                headerName: t("actions.actions", { ns: "common" }),
                sortable: false,
                filterable: false,
                width: 80,
                renderCell: (params) => (
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        {hasEditPermission && (
                            <Tooltip
                                title={t("tooltips.edit_field", {
                                    ns: "generic_fields",
                                })}
                                placement="bottom"
                            >
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClick(params.row);
                                    }}
                                    color="primary"
                                >
                                    <EditIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                ),
            },
        ],
        [
            t,
            theme,
            i18n.language,
            hasEditPermission,
            handleEditClick,
        ]
    );

    if (isLoading && !rows?.length) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 200,
                }}
            >
                <CircularProgress color="primary" />
            </Box>
        );
    }

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    overflow: "hidden",
                }}
            >
                <EndlessScrollDataGrid
                    rows={rows || []}
                    columns={columns}
                    totalRecords={totalRecords || 0}
                    isLoading={isLoading}
                    onLoadMore={loadMore}
                    hasMore={hasMore}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    searchValue={search}
                    onSearchChange={setSearch}
                    searchPlaceholder={t("fields.search_placeholder", {
                        ns: "common",
                        defaultValue: "Search...",
                    })}
                    searchDebounceMs={500}
                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                    language={i18n.language}
                    fillViewport={true}
                    resizableColumns={true}
                    noRowsMessage={t("messages.no_rows_found", {
                        ns: "common",
                        defaultValue: "No rows found",
                    })}
                    noRowsDescription={t("messages.try_adjusting_filters", {
                        ns: "common",
                        defaultValue: "Try adjusting your search or filters",
                    })}
                />
            </Box>
            <UpsertGenericFieldModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                field={selectedField}
                accountId={accountId}
                onSuccess={handleSuccess}
            />
        </Box>
    );
}
