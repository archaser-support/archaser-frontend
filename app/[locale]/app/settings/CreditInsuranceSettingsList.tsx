"use client";
import { apiFetch } from "@/utils/apiFetch";

import AddIcon from "@mui/icons-material/Add";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    Link as MuiLink,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import EndlessScrollDataGrid, {
    createQueryFn,
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { isPrimaryPolicyEffectivelyActive } from "@/shared/creditInsurance/insurancePolicyLifecycle";
import { ExportFormat } from "@/shared/utility/exportToExcel";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import { CreateInsurancePolicyModal } from "@/app/[locale]/app/settings/CreateInsurancePolicyModal";
import { ReplacePolicyModal } from "@/app/[locale]/app/settings/ReplacePolicyModal";

type PolicyApiRow = {
    id: number;
    policy_number: string;
    policy_kind?: "Primary" | "TopUp" | null;
    start_date: string;
    end_date: string;
    status: string;
    currency?: string | null;
    max_payment_term?: number | null;
    max_allowed_mep?: number | null;
    reporting_days?: number | null;
    cost_calculation_method?: "ActualSales" | "Limit" | null;
    cost_percent?: string | number | null;
    ParentInsurancePolicy?: {
        id: number;
        policy_number: string;
        status?: string | null;
        start_date?: string | null;
        end_date?: string | null;
    } | null;
};

const AddPolicyIcon = () => {
    const theme = useTheme();
    return (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
            <AttachMoneyIcon />
            <AddIcon
                sx={{
                    position: "absolute",
                    right: -4,
                    bottom: -4,
                    fontSize: "0.8rem",
                    backgroundColor: "primary.main",
                    color: "primary.contrastText",
                    borderRadius: "50%",
                    padding: theme.spacing(0.25),
                }}
            />
        </Box>
    );
};

export function CreditInsuranceSettingsList({
    accountId,
    canEdit,
}: {
    accountId: number;
    canEdit: boolean;
}) {
    const { t, i18n } = useTranslation(["settings", "common"]);
    const tCi = useCallback(
        (key: string, options?: Record<string, unknown>) =>
            t(key, { ns: "settings", ...options }),
        [t]
    );
    const { data: session } = useSession();
    const router = useRouter();
    const theme = useTheme();
    const isRTL = i18n.language === "he";

    const userLocale = useMemo(() => getUserDateLocale(session), [session]);
    const userTimezone = useMemo(() => getUserTimezone(session), [session]);

    const formatPolicyDate = useCallback(
        (value: unknown) => {
            if (value === null || value === undefined || value === "") {
                return "-";
            }
            return formatDateForDisplay(
                String(value),
                "date",
                userLocale,
                userTimezone
            );
        },
        [userLocale, userTimezone]
    );
    const [policyModalOpen, setPolicyModalOpen] = useState(false);
    const [policyModalPolicyId, setPolicyModalPolicyId] = useState<
        number | null
    >(null);
    const [replaceModalOpen, setReplaceModalOpen] = useState(false);

    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "policy_number", sort: "asc" },
    ]);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);

    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort || "asc";

    const queryKey = useMemo(
        () => [
            "insurance-policies-grid",
            {
                accountId,
                search: debouncedSearch,
                sortField,
                sortDirection,
                version: queryKeyVersion,
            },
        ],
        [accountId, debouncedSearch, sortField, sortDirection, queryKeyVersion]
    );

    const {
        data,
        totalRecords,
        isLoading,
        hasMore,
        loadMore,
        reset,
        error,
    } = useVirtualInfiniteScroll<PolicyApiRow>({
        queryKey,
        queryFn: createQueryFn(
            `/api/entities/insurance-policies`,
            {
                account_id: String(accountId),
                query: debouncedSearch,
                sortField: sortField || "policy_number",
                sortDirection: sortDirection || "asc",
            },
            "policies"
        ),
    });

    const prevDebouncedSearchRef = useRef(debouncedSearch);
    useEffect(() => {
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;
        if (searchChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            setQueryKeyVersion((v) => v + 1);
        }
    }, [debouncedSearch]);

    const mapPolicyToRow = useCallback((policy: PolicyApiRow) => {
        return {
            id: policy.id,
            policy_number: policy.policy_number || "",
            policy_kind: policy.policy_kind ?? "Primary",
            start_date: policy.start_date,
            end_date: policy.end_date,
            status: policy.status || "",
            currency: policy.currency ?? "",
            max_payment_term: policy.max_payment_term ?? null,
            max_allowed_mep: policy.max_allowed_mep ?? null,
            reporting_days: policy.reporting_days ?? null,
            cost_calculation_method: policy.cost_calculation_method ?? null,
            cost_percent: policy.cost_percent ?? null,
            raw: policy,
            parentPolicy: policy.ParentInsurancePolicy ?? null,
        };
    }, []);

    const rows = useMemo(() => {
        return (data || []).map(mapPolicyToRow);
    }, [data, mapPolicyToRow]);

    const handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            const params = new URLSearchParams({
                account_id: String(accountId),
                page: "1",
                limit: "10000",
                query: debouncedSearch,
                sortField: sortField || "policy_number",
                sortDirection: sortDirection || "asc",
            });
            const response = await apiFetch(`/api/entities/insurance-policies?${params.toString()}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const json = await response.json();
            const policies = (json.policies || []) as PolicyApiRow[];
            return policies.map((p) => ({
                id: p.id,
                policy_number: p.policy_number,
                policy_kind:
                    p.policy_kind === "TopUp"
                        ? tCi("credit_insurance.fields.policy_kind_top_up")
                        : tCi("credit_insurance.fields.policy_kind_primary"),
                start_date: formatPolicyDate(p.start_date),
                end_date: formatPolicyDate(p.end_date),
                status: p.status,
                currency: p.currency ?? "",
                max_payment_term:
                    p.max_payment_term != null ? String(p.max_payment_term) : "",
                max_allowed_mep:
                    p.max_allowed_mep != null ? String(p.max_allowed_mep) : "",
                reporting_days:
                    p.reporting_days != null ? String(p.reporting_days) : "",
                cost_calculation_method:
                    p.cost_calculation_method === "Limit"
                        ? tCi("credit_insurance.fields.cost_calculation_method_limit")
                        : p.cost_calculation_method === "ActualSales"
                          ? tCi(
                                "credit_insurance.fields.cost_calculation_method_actual_sales"
                            )
                          : "",
                cost_percent:
                    p.cost_percent != null && String(p.cost_percent).trim() !== ""
                        ? `${String(p.cost_percent)}%`
                        : "",
            }));
        },
        [
            accountId,
            debouncedSearch,
            sortField,
            sortDirection,
            formatPolicyDate,
            tCi,
        ]
    );

    const AddPolicyToolbarButton = React.memo(() => {
        if (!canEdit) return null;
        return (
            <Tooltip
                title={tCi("credit_insurance.new_policy")}
                arrow
                enterDelay={300}
                leaveDelay={100}
                placement="bottom"
                PopperProps={{
                    sx: {
                        "& .MuiTooltip-tooltip": {
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        },
                        "& .MuiTooltip-arrow": {
                            ...(i18n.language === "he" && {
                                transform: "scaleX(-1)",
                            }),
                        },
                    },
                }}
            >
                <IconButton
                    color="primary"
                    size="small"
                    onClick={() => {
                        setPolicyModalPolicyId(null);
                        setPolicyModalOpen(true);
                    }}
                    className="toolbar-button"
                >
                    <AddPolicyIcon />
                </IconButton>
            </Tooltip>
        );
    });
    AddPolicyToolbarButton.displayName = "AddPolicyToolbarButton";

    const ReplacePolicyToolbarButton = React.memo(() => {
        if (!canEdit) return null;
        return (
            <Tooltip
                title={tCi("credit_insurance.replace_policy")}
                arrow
                enterDelay={300}
                leaveDelay={100}
                placement="bottom"
            >
                <IconButton
                    color="primary"
                    size="small"
                    onClick={() => setReplaceModalOpen(true)}
                    className="toolbar-button"
                >
                    <SwapHorizIcon />
                </IconButton>
            </Tooltip>
        );
    });
    ReplacePolicyToolbarButton.displayName = "ReplacePolicyToolbarButton";

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "policy_number",
                headerName: tCi("credit_insurance.columns.policy"),
                flex: 1,
                minWidth: 140,
                renderCell: (params) => {
                    const policyHref = `/${i18n.language}/app/settings/credit-insurance-policies/${params.row.id}?backUrl=${encodeURIComponent(
                        "/app/settings?tab=creditInsurance"
                    )}`;
                    return (
                        <MuiLink
                            component={Link}
                            href={policyHref}
                            onClick={(e) => e.stopPropagation()}
                            sx={{ fontWeight: 500 }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ color: "inherit", fontSize: "0.875rem" }}
                            >
                                {params.value || "-"}
                            </Typography>
                        </MuiLink>
                    );
                },
            },
            {
                field: "policy_kind",
                headerName: tCi("credit_insurance.fields.policy_kind"),
                flex: 0.7,
                minWidth: 110,
                renderCell: (params) => {
                    const kind = String(params.value || "Primary");
                    const label =
                        kind === "TopUp"
                            ? tCi("credit_insurance.fields.policy_kind_top_up")
                            : tCi("credit_insurance.fields.policy_kind_primary");
                    const parent = params.row.parentPolicy as PolicyApiRow["ParentInsurancePolicy"];
                    const parentInactive =
                        kind === "TopUp" &&
                        parent != null &&
                        !isPrimaryPolicyEffectivelyActive({
                            status: parent.status,
                            startDate: parent.start_date ?? "",
                            endDate: parent.end_date ?? "",
                        });
                    return (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                                {label}
                            </Typography>
                            {parentInactive ? (
                                <Chip
                                    label={tCi(
                                        "credit_insurance.notifications.topup_parent_inactive_short",
                                        { defaultValue: "Parent inactive" }
                                    )}
                                    size="small"
                                    color="warning"
                                    sx={{ height: 22, fontSize: "0.7rem" }}
                                />
                            ) : null}
                        </Box>
                    );
                },
            },
            {
                field: "start_date",
                headerName: tCi("credit_insurance.columns.start"),
                flex: 0.9,
                minWidth: 120,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {formatPolicyDate(params.value)}
                    </Typography>
                ),
            },
            {
                field: "end_date",
                headerName: tCi("credit_insurance.columns.end"),
                flex: 0.9,
                minWidth: 120,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {formatPolicyDate(params.value)}
                    </Typography>
                ),
            },
            {
                field: "status",
                headerName: tCi("credit_insurance.columns.status"),
                flex: 0.7,
                minWidth: 100,
                renderCell: (params) => {
                    const statusValue = String(params.value || "");
                    const isActive = statusValue.toLowerCase() === "active";
                    const isDraft = statusValue.toLowerCase() === "draft";

                    if (isDraft) {
                        return (
                            <Chip
                                label="Draft"
                                size="small"
                                sx={{
                                    backgroundColor: alpha(
                                        theme.palette.text.primary,
                                        0.35
                                    ),
                                    color: "white",
                                    fontWeight: 500,
                                    fontSize: "0.75rem",
                                    height: "24px",
                                    borderRadius: `${theme.appButton.borderRadius}px`,
                                    boxShadow: "none",
                                }}
                            />
                        );
                    }

                    return (
                        <Chip
                            label={
                                isActive
                                    ? t("values.status_active", { ns: "common" })
                                    : t("values.status_inactive", {
                                          ns: "common",
                                      })
                            }
                            size="small"
                            data-status={isActive ? "active" : "inactive"}
                        />
                    );
                },
            },
            {
                field: "currency",
                headerName: tCi("credit_insurance.columns.currency"),
                flex: 0.6,
                minWidth: 90,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.value || "-"}
                    </Typography>
                ),
            },
            {
                field: "max_payment_term",
                headerName: tCi("credit_insurance.columns.max_payment_term"),
                flex: 0.65,
                minWidth: 110,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {params.value != null && params.value !== ""
                            ? String(params.value)
                            : "-"}
                    </Typography>
                ),
            },
            {
                field: "max_allowed_mep",
                headerName: tCi("credit_insurance.columns.max_mep"),
                flex: 0.55,
                minWidth: 90,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {params.value != null && params.value !== ""
                            ? String(params.value)
                            : "-"}
                    </Typography>
                ),
            },
            {
                field: "reporting_days",
                headerName: tCi("credit_insurance.columns.reporting_days"),
                flex: 0.55,
                minWidth: 100,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {params.value != null && params.value !== ""
                            ? String(params.value)
                            : "-"}
                    </Typography>
                ),
            },
            {
                field: "cost_calculation_method",
                headerName: tCi("credit_insurance.columns.cost_calculation_method"),
                flex: 0.75,
                minWidth: 140,
                renderCell: (params) => {
                    const method = String(params.value || "");
                    const label =
                        method === "Limit"
                            ? tCi("credit_insurance.fields.cost_calculation_method_limit")
                            : method === "ActualSales"
                              ? tCi(
                                    "credit_insurance.fields.cost_calculation_method_actual_sales"
                                )
                              : "-";
                    return (
                        <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                            {label}
                        </Typography>
                    );
                },
            },
            {
                field: "cost_percent",
                headerName: tCi("credit_insurance.columns.cost_percent"),
                flex: 0.5,
                minWidth: 90,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {params.value != null && params.value !== ""
                            ? `${String(params.value)}%`
                            : "-"}
                    </Typography>
                ),
            },
        ],
        [tCi, formatPolicyDate, theme, i18n.language]
    );

    if (isLoading && rows.length === 0) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: theme.spacing(50),
                }}
            >
                <CircularProgress size={40} />
            </Box>
        );
    }

    if (error) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: theme.spacing(50),
                    flexDirection: "column",
                    gap: theme.spacing(2),
                }}
            >
                <Typography color="error">
                    {tCi("credit_insurance.grid_error")}
                </Typography>
                <Button variant="outlined" color="primary" onClick={() => reset()}>
                    {t("actions.retry", { ns: "common" })}
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {canEdit && (
                <Box
                    sx={{
                        mb: 2,
                        display: { xs: "flex", md: "none" },
                        justifyContent: isRTL ? "flex-start" : "flex-end",
                        direction: isRTL ? "rtl" : "ltr",
                    }}
                >
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                            setPolicyModalPolicyId(null);
                            setPolicyModalOpen(true);
                        }}
                    >
                        {tCi("credit_insurance.new_policy")}
                    </Button>
                </Box>
            )}

            {canEdit && (
                <>
                    <CreateInsurancePolicyModal
                        open={policyModalOpen}
                        onClose={() => {
                            setPolicyModalOpen(false);
                            setPolicyModalPolicyId(null);
                        }}
                        onSaved={() => {
                            reset();
                        }}
                        onCreated={(newPolicyId: number) => {
                            reset();
                            router.push(
                                `/${i18n.language}/app/settings/credit-insurance-policies/${newPolicyId}?backUrl=${encodeURIComponent(
                                    "/app/settings?tab=creditInsurance"
                                )}`
                            );
                        }}
                        accountId={accountId}
                        policyId={policyModalPolicyId}
                    />
                    <ReplacePolicyModal
                        open={replaceModalOpen}
                        onClose={() => setReplaceModalOpen(false)}
                        accountId={accountId}
                        onSuccess={() => {
                            reset();
                            setQueryKeyVersion((v) => v + 1);
                        }}
                    />
                </>
            )}

            <Box
                sx={{
                    position: "relative",
                    isolation: "isolate",
                }}
            >
                <EndlessScrollDataGrid
                    key={`insurance-policies-${accountId}-${debouncedSearch}-${queryKeyVersion}`}
                    rows={rows}
                    columns={columns}
                    totalRecords={totalRecords}
                    isLoading={isLoading}
                    onLoadMore={loadMore}
                    hasMore={hasMore}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    searchValue={search}
                    onSearchChange={setSearch}
                    searchPlaceholder={t("fields.search_placeholder", {
                        ns: "common",
                    })}
                    searchDebounceMs={500}
                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                    language={i18n.language}
                    fillViewport={true}
                    resizableColumns={true}
                    customButtons={
                        <>
                            <AddPolicyToolbarButton />
                            <ReplacePolicyToolbarButton />
                        </>
                    }
                    onExport={handleExport}
                    exportContextInfo={{
                        pageName: "credit_insurance_policies",
                        customPrefix: "insurance_policies",
                    }}
                    noRowsMessage={tCi("credit_insurance.no_policies")}
                    noRowsDescription={tCi("credit_insurance.no_policies_hint")}
                />
            </Box>
        </Box>
    );
}
