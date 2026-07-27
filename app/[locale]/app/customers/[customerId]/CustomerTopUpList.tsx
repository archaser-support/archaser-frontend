"use client";

import AddIcon from "@mui/icons-material/Add";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import DeleteIcon from "@mui/icons-material/Delete";
import BlockIcon from "@mui/icons-material/Block";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api";
import { isAxiosError } from "axios";
import moment from "moment";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import { useSession } from "next-auth/react";

import { CurrencySelect } from "@/components/LocationSelects";
import EndlessScrollDataGrid, {
    createQueryFn,
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

import {
    formatDateForDisplay,
    getDatePickerFormat,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

const ADD_TOP_UP_SCROLL_ID = "add-top-up-modal-scroll";

interface TopUpRow {
    id: number;
    top_up_type: "Fixed" | "Percentage";
    top_up_value: number;
    currency: string | null;
    start_date: string;
    end_date: string | null;
    notes: string | null;
    cancelled_at: string | null;
    insurance_policy_id: number;
    policy_number: string;
    insurer_name: string | null;
    premium: number | null;
    premium_currency: string | null;
}

interface CustomerTopUpListProps {
    customerId: number;
    accountHasTopUpPolicies?: boolean;
    activePrimaryPolicyId?: number | null;
}

export function CustomerTopUpList({
    customerId,
    accountHasTopUpPolicies = false,
    activePrimaryPolicyId = null,
}: CustomerTopUpListProps) {
    const { t, i18n } = useTranslation(["customers", "common"]);
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { data: session } = useSession();
    const accountId =
        session?.user?.view_as_user_account_id ?? session?.user?.account_id;
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [deleteDialogRow, setDeleteDialogRow] = useState<TopUpRow | null>(null);

    const userLocale = useMemo(() => getUserDateLocale(session), [session]);
    const userTimezone = useMemo(() => getUserTimezone(session), [session]);

    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "start_date", sort: "desc" },
    ]);
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);

    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort || "desc";

    const queryKey = useMemo(
        () => [
            "customer-top-ups",
            {
                customerId,
                search: debouncedSearch,
                sortField,
                sortDirection,
                version: queryKeyVersion,
            },
        ],
        [customerId, debouncedSearch, sortField, sortDirection, queryKeyVersion]
    );

    const {
        data: apiData,
        totalRecords,
        isLoading,
        hasMore,
        loadMore,
        error,
    } = useVirtualInfiniteScroll<TopUpRow>({
        queryKey,
        queryFn: createQueryFn(
            `/api/customers/_/top-ups`,
            {
                customer_id: String(customerId),
                query: debouncedSearch,
                sortField: sortField || "start_date",
                sortDirection: sortDirection || "desc",
            },
            "data"
        ),
    });

    const prevDebouncedSearchRef = useRef(debouncedSearch);
    useEffect(() => {
        const searchChanged = prevDebouncedSearchRef.current !== debouncedSearch;
        if (searchChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            setQueryKeyVersion((prev) => prev + 1);
        }
    }, [debouncedSearch]);

    const rows = useMemo(() => {
        return (apiData || []).map((row) => ({
            id: row.id,
            top_up_type: row.top_up_type,
            top_up_value: Number(row.top_up_value),
            currency: row.currency,
            start_date: row.start_date,
            end_date: row.end_date,
            notes: row.notes,
            cancelled_at: row.cancelled_at,
            insurance_policy_id: row.insurance_policy_id,
            policy_number: row.policy_number,
            insurer_name: row.insurer_name,
            premium: row.premium != null ? Number(row.premium) : null,
            premium_currency: row.premium_currency,
        }));
    }, [apiData]);

    const cancelMut = useMutation({
        mutationFn: async (topUpId: number) => {
            await api.delete(`/api/customers/_/top-ups`, {
                params: { customer_id: customerId, id: topUpId },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["customer-top-ups", customerId] });
            setQueryKeyVersion((v) => v + 1);
            showToast(t("messages.customer_saved_success", { ns: "customers" }));
        },
        onError: () => {
            showToast(t("messages.error_message", { ns: "customers" }), "error");
        },
    });

    const handleDeleteDialogClose = useCallback(() => {
        setDeleteDialogRow(null);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        if (!deleteDialogRow?.id) return;
        cancelMut.mutate(deleteDialogRow.id, {
            onSuccess: () => {
                handleDeleteDialogClose();
            },
        });
    }, [deleteDialogRow?.id, cancelMut, handleDeleteDialogClose]);

    const formatCurrency = useCallback(
        (value: number, currency?: string | null) => {
            const cur = (currency || "").trim().toUpperCase();
            return cur ? `${value.toLocaleString()} ${cur}` : value.toLocaleString();
        },
        []
    );

    const formatDate = useCallback((dateStr: string | null) => {
        if (!dateStr) return "\u2014";
        return formatDateForDisplay(dateStr, "date", userLocale, userTimezone);
    }, [userLocale, userTimezone]);

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "top_up_type",
                headerName: t("credit_insurance.top_up_type", {
                    ns: "customers",
                    defaultValue: "Top-Up Type",
                }),
                flex: 0.8,
                minWidth: 110,
                hideable: false,
                disableColumnMenu: true,
                renderCell: (params) => {
                    const row = params.row as TopUpRow;
                    return (
                        <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                            {row.top_up_type === "Percentage"
                                ? t("credit_insurance.top_up_percentage", { ns: "customers" })
                                : t("credit_insurance.top_up_fixed", { ns: "customers" })}
                        </Typography>
                    );
                },
            },
            {
                field: "top_up_value",
                headerName: t("credit_insurance.top_up_value", { ns: "customers" }),
                flex: 1.2,
                minWidth: 150,
                renderCell: (params) => {
                    const row = params.row as TopUpRow;
                    return (
                        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
                            <Typography variant="body2" sx={{ fontSize: "0.875rem", fontWeight: 500 }}>
                                {row.top_up_type === "Percentage"
                                    ? `${row.top_up_value}%`
                                    : formatCurrency(row.top_up_value, row.currency)}
                            </Typography>
                        </Box>
                    );
                },
            },
            {
                field: "premium",
                headerName: t("credit_insurance.premium", { ns: "customers" }),
                flex: 0.8,
                minWidth: 100,
                renderCell: (params) => {
                    const row = params.row as TopUpRow;
                    if (row.premium == null) return "\u2014";
                    return (
                        <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                            {formatCurrency(row.premium, row.premium_currency)}
                        </Typography>
                    );
                },
            },
            {
                field: "start_date",
                headerName: t("fields.start_date", { ns: "customers" }),
                flex: 0.8,
                minWidth: 110,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {formatDate(params.value as string)}
                    </Typography>
                ),
            },
            {
                field: "end_date",
                headerName: t("fields.end_date", { ns: "customers" }),
                flex: 0.8,
                minWidth: 110,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {formatDate(params.value as string)}
                    </Typography>
                ),
            },
            {
                field: "notes",
                headerName: t("credit_insurance.top_up_notes", { ns: "customers" }),
                flex: 1,
                minWidth: 120,
                renderCell: (params) => (
                    <Typography
                        variant="body2"
                        sx={{
                            fontSize: "0.875rem",
                            color: params.value ? "text.primary" : "text.disabled",
                        }}
                    >
                        {params.value || "\u2014"}
                    </Typography>
                ),
            },
            {
                field: "cancelled_at",
                headerName: t("actions.actions", { ns: "common" }),
                width: 100,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                resizable: false,
                headerAlign: "right",
                align: "right",
                renderCell: (params) => {
                    const row = params.row as TopUpRow;
                    return row.cancelled_at ? (
                        <Chip
                            size="small"
                            icon={<BlockIcon />}
                            label={t("credit_insurance.cancelled", { ns: "customers" })}
                            variant="outlined"
                            color="default"
                        />
                    ) : (
                        <Tooltip
                            title={t("actions.delete", { ns: "common" })}
                        >
                            <IconButton
                                size="small"
                                color="primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteDialogRow(row);
                                }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    );
                },
            },
        ],
        [t, formatCurrency, formatDate]
    );

    const { data: topUpPoliciesForCustomer = [] } = useQuery({
        queryKey: ["top-up-policies", customerId, activePrimaryPolicyId, accountId],
        queryFn: async () => {
            if (!activePrimaryPolicyId || !accountId) {
                return [];
            }
            const { data } = await api.get("/api/entities/insurance-policies", {
                params: { account_id: accountId, effectively_active: 1 },
            });
            return ((data?.policies ?? []) as any[]).filter(
                (p: any) =>
                    p.policy_kind === "TopUp" &&
                    p.parent_insurance_policy_id === activePrimaryPolicyId
            );
        },
        enabled: accountHasTopUpPolicies && !!accountId,
    });

    const noTopUpPolicyDefined =
        !accountHasTopUpPolicies ||
        !activePrimaryPolicyId ||
        topUpPoliciesForCustomer.length === 0;
    const disableAddTopUp = noTopUpPolicyDefined;
    const disabledTopUpTooltip = noTopUpPolicyDefined
        ? "No Top up policy defined for the customer's policy"
        : t("credit_insurance.add_top_up", { ns: "customers" });

    const AddTopUpButton = useCallback(() => (
        <Tooltip
            title={disabledTopUpTooltip}
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
            <span>
                <IconButton
                    color="primary"
                    size="small"
                    onClick={() => setAddDialogOpen(true)}
                    className="toolbar-button"
                    disabled={disableAddTopUp}
                >
                    <AutoGraphIcon />
                    <AddIcon
                        sx={{
                            position: "absolute",
                            right: -4,
                            bottom: -4,
                            fontSize: "0.8rem",
                            backgroundColor: "primary.main",
                            color: "primary.contrastText",
                            borderRadius: "50%",
                            padding: 0.25,
                        }}
                    />
                </IconButton>
            </span>
        </Tooltip>
    ), [disableAddTopUp, disabledTopUpTooltip, i18n.language, t]);

    if (error) {
        return (
            <Box sx={{ py: 2, textAlign: "center" }}>
                <Typography color="error" variant="body2">
                    {t("messages.error_fetching_data", { ns: "common" })}
                </Typography>
            </Box>
        );
    }

    return (
        <Box id="top-up-cover" sx={{ mt: 2 }}>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    mt: 0.5,
                    mb: 0.5,
                    px: 0,
                    py: 0.5,
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                <Typography
                    sx={{
                        color: "#000",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                    }}
                >
                    {t("credit_insurance.top_ups", { ns: "customers" })}
                </Typography>
            </Box>

            <Box sx={{ position: "relative", isolation: "isolate" }}>
                <EndlessScrollDataGrid
                    key={`customer-top-ups-${customerId}-${debouncedSearch}-${queryKeyVersion}`}
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
                    searchPlaceholder={t("fields.search_placeholder", { ns: "common" })}
                    searchDebounceMs={500}
                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                    language={i18n.language}
                    fillViewport={false}
                    resizableColumns={true}
                    customButtons={<AddTopUpButton />}
                    noRowsMessage={
                        noTopUpPolicyDefined
                            ? "No Top up policy defined for the customer's policy"
                            : t("credit_insurance.no_top_ups", { ns: "customers" })
                    }
                    noRowsDescription=""
                />
            </Box>

            <DeleteDialog
                isOpen={Boolean(deleteDialogRow)}
                onClose={handleDeleteDialogClose}
                onConfirm={handleConfirmDelete}
                title={t("credit_insurance.delete_top_up_title", { ns: "customers" })}
                description={t("credit_insurance.delete_top_up_confirm", { ns: "customers" })}
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={cancelMut.isPending}
                type="delete"
                maxWidth="sm"
                locale={i18n.language}
            />

            <AddTopUpDialog
                open={addDialogOpen}
                onClose={() => setAddDialogOpen(false)}
                customerId={customerId}
                activePrimaryPolicyId={activePrimaryPolicyId}
                onSaved={() => {
                    queryClient.invalidateQueries({ queryKey: ["customer-top-ups", customerId] });
                    setQueryKeyVersion((v) => v + 1);
                    setAddDialogOpen(false);
                }}
            />
        </Box>
    );
}

interface AddTopUpDialogProps {
    open: boolean;
    onClose: () => void;
    customerId: number;
    activePrimaryPolicyId?: number | null;
    onSaved: () => void;
}

function AddTopUpDialog({
    open,
    onClose,
    customerId,
    activePrimaryPolicyId = null,
    onSaved,
}: AddTopUpDialogProps) {
    const { t, i18n } = useTranslation(["customers", "common"]);
    const theme = useTheme();
    const isRTL = i18n.language === "he";
    const { showToast } = useToast();
    const { data: session } = useSession();
    const accountId =
        session?.user?.view_as_user_account_id ?? session?.user?.account_id;
    const [topUpType, setTopUpType] = useState<"Fixed" | "Percentage">("Fixed");
    const [topUpValue, setTopUpValue] = useState("");
    const [currency, setCurrency] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [premium, setPremium] = useState("");
    const [premiumCurrency, setPremiumCurrency] = useState("");
    const [notes, setNotes] = useState("");
    const [insurancePolicyId, setInsurancePolicyId] = useState<number | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const textFieldDirSx = useMemo(
        () => ({
            "& .MuiInputBase-input": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
                direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            },
            "& .MuiInputLabel-root": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
            },
        }),
        [isRTL]
    );

    const selectControlSx = useMemo(
        () => ({
            ...textFieldDirSx,
            direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            "& .MuiFormLabel-root": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
                left: isRTL ? "auto" : 0,
                right: isRTL ? 0 : "auto",
                transformOrigin: isRTL ? "top right" : "top left",
            },
            "& .MuiOutlinedInput-notchedOutline": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
            },
            "& .MuiSelect-select": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
            },
            "& .MuiAutocomplete-inputRoot": {
                direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            },
            "& .MuiAutocomplete-input": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
            },
            "& .MuiSelect-icon": {
                right: isRTL ? "auto" : "7px",
                left: isRTL ? "7px" : "auto",
            },
        }),
        [isRTL, textFieldDirSx]
    );

    const menuItemSx = useMemo(
        () => ({
            direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            textAlign: isRTL ? ("right" as const) : ("left" as const),
            justifyContent: isRTL ? ("flex-end" as const) : ("flex-start" as const),
        }),
        [isRTL]
    );

    useEffect(() => {
        if (!open || typeof document === "undefined") return;
        const trackBg = alpha(theme.palette.primary.main, 0.1);
        const thumbBg = alpha(theme.palette.primary.main, 0.6);
        const thumbHover = theme.palette.primary.main;
        const styleId = "add-top-up-scrollbar-override";
        let el = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!el) {
            el = document.createElement("style");
            el.id = styleId;
            document.body.appendChild(el);
        }
        el.textContent = `
#${ADD_TOP_UP_SCROLL_ID} { scrollbar-width: thin; scrollbar-color: ${thumbBg} ${trackBg}; }
#${ADD_TOP_UP_SCROLL_ID}::-webkit-scrollbar { display: block !important; width: 12px !important; -webkit-appearance: none !important; }
#${ADD_TOP_UP_SCROLL_ID}::-webkit-scrollbar-track { background-color: ${trackBg} !important; border-radius: 6px !important; }
#${ADD_TOP_UP_SCROLL_ID}::-webkit-scrollbar-thumb { background-color: ${thumbBg} !important; border-radius: 6px !important; }
#${ADD_TOP_UP_SCROLL_ID}::-webkit-scrollbar-thumb:hover { background-color: ${thumbHover} !important; }
`;
        return () => {
            const styleEl = document.getElementById(styleId);
            if (styleEl) styleEl.remove();
        };
    }, [open, theme.palette.primary.main]);

    const { data: topUpPolicies } = useQuery({
        queryKey: ["top-up-policies", customerId, activePrimaryPolicyId, accountId],
        queryFn: async () => {
            if (!activePrimaryPolicyId || !accountId) {
                return [];
            }
            const { data } = await api.get("/api/entities/insurance-policies", {
                params: { account_id: accountId, effectively_active: 1 },
            });
            return ((data?.policies ?? []) as any[]).filter(
                (p: any) =>
                    p.policy_kind === "TopUp" &&
                    p.parent_insurance_policy_id === activePrimaryPolicyId
            );
        },
        enabled: open && !!accountId,
    });

    const createMut = useMutation({
        mutationFn: async () => {
            if (!insurancePolicyId) throw new Error("Policy required");
            const payload: Record<string, unknown> = {
                insurancePolicyId,
                topUpType,
                topUpValue: parseFloat(topUpValue),
                currency: currency.trim() || null,
                startDate: startDate || null,
                endDate: endDate || null,
                notes: notes.trim() || null,
                premium: premium !== "" ? parseFloat(premium) : null,
                premiumCurrency: premium !== "" ? (premiumCurrency.trim() || null) : null,
            };
            await api.post(`/api/customers/_/top-ups`, payload, {
                params: { customer_id: customerId },
            });
        },
        onSuccess: () => {
            onSaved();
            setTopUpType("Fixed");
            setTopUpValue("");
            setCurrency("");
            setStartDate("");
            setEndDate("");
            setPremium("");
            setPremiumCurrency("");
            setNotes("");
            setInsurancePolicyId(null);
            setFieldErrors({});
        },
        onError: (err: unknown) => {
            const msg = isAxiosError(err)
                ? err.response?.data?.error || err.message
                : String(err);
            if (msg.includes("endDate must be on or after startDate")) {
                setFieldErrors((prev) => ({
                    ...prev,
                    endDate: msg,
                }));
                return;
            }
            showToast(msg, "error");
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errors: Record<string, string> = {};
        const req = t("validation.required", { ns: "common" });

        if (!insurancePolicyId) {
            errors.insurancePolicyId = req;
        }
        if (!topUpValue.trim()) {
            errors.topUpValue = req;
        } else if (Number(topUpValue) <= 0) {
            errors.topUpValue = t("credit_insurance.validation.invalid_number", {
                ns: "settings",
                defaultValue: "Must be a positive number",
            });
        }
        if (!startDate) {
            errors.startDate = req;
        }
        if (!endDate) {
            errors.endDate = req;
        }
        if (startDate && endDate && endDate < startDate) {
            errors.endDate = "endDate must be on or after startDate";
        }
        if (topUpType === "Fixed" && !currency.trim()) {
            errors.currency = req;
        }
        if (premium.trim() && Number(premium) < 0) {
            errors.premium = t("credit_insurance.validation.invalid_number", {
                ns: "settings",
                defaultValue: "Must be a positive number",
            });
        }
        if (premium.trim() && !premiumCurrency.trim()) {
            errors.premiumCurrency = req;
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});
        createMut.mutate();
    };

    const formBusy = createMut.isPending;
    const noTopUpAvailableForPolicy = (topUpPolicies ?? []).length === 0;

    return (
        <AppDialog
            open={open}
            onClose={() => {
                if (!formBusy) onClose();
            }}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="440px"
            paperMaxHeight="90vh"
            title={t("credit_insurance.add_top_up", { ns: "customers" })}
            titleIcon={<AutoGraphIcon />}
            ariaLabelledBy="add-top-up-dialog-title"
            ariaDescribedBy="add-top-up-dialog-description"
            scrollContainerId={ADD_TOP_UP_SCROLL_ID}
            paperSx={{
                sx: {
                    "& > .MuiDialogTitle-root": {
                        flexShrink: 0,
                    },
                    "& > .MuiDialogContent-root": {
                        flex: "1 1 auto",
                        minHeight: 0,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        px: 0,
                    },
                    "& > .MuiDialogActions-root": {
                        flexShrink: 0,
                    },
                },
            }}
            actions={
                <>
                    <Button
                        type="button"
                        onClick={onClose}
                        disabled={formBusy}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        type="submit"
                        form="add-top-up-form"
                        disabled={formBusy || noTopUpAvailableForPolicy}
                        variant="contained"
                        size="small"
                        className="save-button"
                     >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <Box
                component="form"
                id="add-top-up-form"
                onSubmit={handleSubmit}
                noValidate
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "hidden",
                }}
                dir={isRTL ? "rtl" : "ltr"}
            >
                <ModalScrollBox id={ADD_TOP_UP_SCROLL_ID} isRTL={isRTL} sx={{ px: 3 }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "repeat(2, 1fr)",
                            },
                            gap: 2,
                            pt: 1,
                            pb: 2,
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        <FormControl
                            fullWidth
                            size="small"
                            required
                            sx={selectControlSx}
                        >
                            <InputLabel id="top-up-policy-label">
                                {t("credit_insurance.top_up", { ns: "customers" })}
                            </InputLabel>
                            <Select
                                labelId="top-up-policy-label"
                                label={t("credit_insurance.top_up", { ns: "customers" })}
                                value={insurancePolicyId ?? ""}
                                disabled={noTopUpAvailableForPolicy}
                                onChange={(e) =>
                                    setInsurancePolicyId(
                                        e.target.value ? Number(e.target.value) : null
                                    )
                                }
                                error={!!fieldErrors.insurancePolicyId}
                            >
                                {noTopUpAvailableForPolicy ? (
                                    <MenuItem value="" disabled sx={menuItemSx}>
                                        No Topup available for the customer's policy
                                    </MenuItem>
                                ) : null}
                                {(topUpPolicies ?? []).map((p: any) => (
                                    <MenuItem key={p.id} value={p.id} sx={menuItemSx}>
                                        {p.policy_number}
                                        {p.insurer_name ? ` \u2014 ${p.insurer_name}` : ""}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small" required sx={selectControlSx}>
                            <InputLabel id="top-up-type-label">
                                {t("fields.type", {
                                    ns: "common",
                                    defaultValue: "Type",
                                })}
                            </InputLabel>
                            <Select
                                labelId="top-up-type-label"
                                label={t("fields.type", { ns: "common", defaultValue: "Type" })}
                                value={topUpType}
                                onChange={(e) =>
                                    setTopUpType(e.target.value as "Fixed" | "Percentage")
                                }
                            >
                                <MenuItem value="Fixed" sx={menuItemSx}>
                                    {t("credit_insurance.top_up_fixed", { ns: "customers" })}
                                </MenuItem>
                                <MenuItem value="Percentage" sx={menuItemSx}>
                                    {t("credit_insurance.top_up_percentage", {
                                        ns: "customers",
                                    })}
                                </MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            fullWidth
                            size="small"
                            required
                            label={t("credit_insurance.top_up_value", { ns: "customers" })}
                            type="number"
                            value={topUpValue}
                            onChange={(e) => setTopUpValue(e.target.value)}
                            inputProps={{
                                step: topUpType === "Percentage" ? "1" : "any",
                                min: 0,
                            }}
                            error={!!fieldErrors.topUpValue}
                            helperText={fieldErrors.topUpValue}
                            sx={textFieldDirSx}
                        />
                        {topUpType === "Fixed" ? (
                            <Box sx={{ ...selectControlSx, gridColumn: "span 1" }}>
                                <CurrencySelect
                                    value={currency}
                                    onChange={(value) => {
                                        setCurrency(value);
                                        setFieldErrors((prev) => {
                                            if (!prev.currency) return prev;
                                            const next = { ...prev };
                                            delete next.currency;
                                            return next;
                                        });
                                    }}
                                    label={t("fields.currency", { ns: "customers" })}
                                    error={!!fieldErrors.currency}
                                    helperText={fieldErrors.currency}
                                />
                            </Box>
                        ) : (
                            <Box sx={{ display: { xs: "none", sm: "block" } }} />
                        )}
                        <DatePicker
                            label={t("credit_insurance.top_up_start_date", { ns: "customers" })}
                            value={startDate ? moment(startDate) : null}
                            onChange={(newVal) => {
                                setStartDate(newVal ? newVal.format("YYYY-MM-DD") : "");
                                setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.startDate;
                                    return next;
                                });
                            }}
                            format={getDatePickerFormat(session ?? null, "DD/MM/YYYY")}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    size: "small",
                                    InputLabelProps: { shrink: true },
                                    error: !!fieldErrors.startDate,
                                    helperText: fieldErrors.startDate,
                                    sx: textFieldDirSx,
                                    ...(isRTL && {
                                        dir: "rtl",
                                        "data-hebrew": true as const,
                                    }),
                                },
                            }}
                        />
                        <DatePicker
                            label={t("credit_insurance.top_up_end_date", { ns: "customers" })}
                            value={endDate ? moment(endDate) : null}
                            onChange={(newVal) => {
                                setEndDate(newVal ? newVal.format("YYYY-MM-DD") : "");
                                setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.endDate;
                                    return next;
                                });
                            }}
                            format={getDatePickerFormat(session ?? null, "DD/MM/YYYY")}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    size: "small",
                                    InputLabelProps: { shrink: true },
                                    error: !!fieldErrors.endDate,
                                    helperText: fieldErrors.endDate,
                                    sx: textFieldDirSx,
                                    ...(isRTL && {
                                        dir: "rtl",
                                        "data-hebrew": true as const,
                                    }),
                                },
                            }}
                        />
                        <TextField
                            fullWidth
                            size="small"
                            label={t("credit_insurance.premium", { ns: "customers", defaultValue: "Premium" })}
                            type="number"
                            value={premium}
                            onChange={(e) => setPremium(e.target.value)}
                            inputProps={{
                                min: 0,
                                step: "any",
                            }}
                            error={!!fieldErrors.premium}
                            helperText={fieldErrors.premium}
                            sx={textFieldDirSx}
                        />
                        <Box sx={{ ...selectControlSx, gridColumn: "span 1" }}>
                            <CurrencySelect
                                value={premiumCurrency}
                                onChange={(value) => {
                                    setPremiumCurrency(value);
                                    setFieldErrors((prev) => {
                                        if (!prev.premiumCurrency) return prev;
                                        const next = { ...prev };
                                        delete next.premiumCurrency;
                                        return next;
                                    });
                                }}
                                label={t("credit_insurance.premium_currency", { ns: "customers", defaultValue: "Premium Currency" })}
                                error={!!fieldErrors.premiumCurrency}
                                helperText={fieldErrors.premiumCurrency}
                            />
                        </Box>
                        <TextField
                            fullWidth
                            size="small"
                            label={t("credit_insurance.top_up_notes", { ns: "customers" })}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            multiline
                            rows={2}
                            sx={{
                                ...textFieldDirSx,
                                gridColumn: {
                                    xs: "span 1",
                                    sm: "span 2",
                                },
                            }}
                        />
                    </Box>
                </ModalScrollBox>
            </Box>
        </AppDialog>
    );
}
