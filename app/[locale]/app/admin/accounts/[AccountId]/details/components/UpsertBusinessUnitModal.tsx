"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Delete as DeleteIcon } from "@mui/icons-material";
import BusinessIcon from "@mui/icons-material/Business";
import InfoIcon from "@mui/icons-material/Info";
import {
    Autocomplete,
    Box,
    Button,
    FormControlLabel,
    IconButton,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";


interface BusinessUnit {
    id: number;
    name: string;
    parent_id?: number | null;
    external_id?: string | null;
    status: "Active" | "Inactive";
    is_primary?: boolean;
    Parent?: BusinessUnit | null;
}

interface UpsertBusinessUnitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    accountId: number;
    businessUnit: BusinessUnit | null;
}

export function UpsertBusinessUnitModal({
    isOpen,
    onClose,
    onSuccess,
    accountId,
    businessUnit,
}: UpsertBusinessUnitModalProps) {
    const { t, i18n } = useTranslation(["business_unit", "common", "bank_accounts"]);
    const theme = useTheme();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const isRTL = i18n.language === "he";
    const [formData, setFormData] = useState({
        name: "",
        parent_id: null as number | null,
        external_id: "",
        status: "Active" as "Active" | "Inactive",
    });

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [activeUserCount, setActiveUserCount] = useState<number | null>(null);
    const [pendingBanks, setPendingBanks] = useState<
        Array<{ id: number; bank_name?: string; account_number?: string; beneficiary_name?: string }>
    >([]);

    // Fetch active users for this business unit when editing
    const { data: activeUsersData } = useQuery({
        queryKey: ["business-unit-active-users", businessUnit?.id],
        queryFn: async () => {
            if (!businessUnit?.id) return { count: 0 };
            const response = await apiFetch(`/api/entities/users?business_unit_id=${businessUnit.id}&status=Active&limit=1`
            );
            if (!response.ok) return { count: 0 };
            const data = await response.json();
            return {
                count: data.total || 0,
            };
        },
        enabled: isOpen && !!businessUnit?.id,
    });

    useEffect(() => {
        if (activeUsersData) {
            const count = activeUsersData.count || 0;
            setActiveUserCount(count);
        }
    }, [activeUsersData]);

    // Fetch business units for parent dropdown
    const { data: businessUnitsData, isLoading: isLoadingBUs } = useQuery<
        BusinessUnit[]
    >({
        queryKey: ["business-units", accountId],
        queryFn: async () => {
            const response = await apiFetch(`/api/entities/accounts/${accountId}/business-units`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch business units");
            }
            const data = await response.json();
            // Handle both array response and wrapped response
            return Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                    ? data.data
                    : [];
        },
        enabled: isOpen,
    });

    const businessUnits = Array.isArray(businessUnitsData)
        ? businessUnitsData
        : [];

    // Fetch assigned bank accounts (edit mode only)
    const { data: assignedBanksData } = useQuery({
        queryKey: ["business-unit-banks", businessUnit?.id],
        queryFn: async () => {
            if (!businessUnit?.id) return [];
            const response = await apiFetch(`/api/entities/business-unit-banks/${businessUnit.id}`
            );
            if (!response.ok) throw new Error("Failed to fetch bank accounts");
            return response.json();
        },
        enabled: isOpen && !!businessUnit?.id,
    });

    const assignedBanks = Array.isArray(assignedBanksData) ? assignedBanksData : [];

    // Fetch available bank accounts for the account
    const { data: availableBanksData, isLoading: isLoadingBanks } = useQuery({
        queryKey: ["bank-accounts", accountId],
        queryFn: async () => {
            const response = await apiFetch(`/api/bank-accounts?accountId=${accountId}&include=Country`
            );
            if (!response.ok) throw new Error("Failed to fetch bank accounts");
            return response.json();
        },
        enabled: isOpen,
    });

    const availableBanks = Array.isArray(availableBanksData)
        ? availableBanksData
        : [];

    const isEditMode = !!businessUnit?.id;
    const filteredAvailableBanks = availableBanks.filter((bank: { id?: number }) => {
        if (isEditMode) {
            return !assignedBanks.some(
                (ab: { bank_account_id?: number; customer_bank_account_id?: number }) =>
                    (ab.bank_account_id ?? ab.customer_bank_account_id) === bank.id
            );
        }
        return !pendingBanks.some((pb) => pb.id === bank.id);
    });

    const displayBanks = isEditMode
        ? assignedBanks
        : pendingBanks.map((pb) => ({
            id: pb.id,
            CustomerBankAccount: {
                bank_name: pb.bank_name,
                account_number: pb.account_number,
                beneficiary_name: pb.beneficiary_name,
            },
        }));

    const addBankMutation = useMutation({
        mutationFn: async (bankAccountId: number) => {
            const response = await apiFetch(`/api/entities/business-unit-banks/${businessUnit!.id}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        bank_account_id: bankAccountId,
                        account_id: accountId,
                    }),
                }
            );
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to add bank account");
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["business-unit-banks", businessUnit?.id],
            });
            queryClient.invalidateQueries({
                queryKey: ["business-units", accountId],
            });
            showToast(t("messages.create_success", { ns: "bank_accounts" }), "success");
        },
        onError: (error: Error) => {
            showToast(error.message, "error");
        },
    });

    const deleteBankMutation = useMutation({
        mutationFn: async (junctionId: number) => {
            const response = await apiFetch(`/api/entities/business-unit-banks/${businessUnit!.id}/${junctionId}`,
                { method: "DELETE" }
            );
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to remove bank account");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["business-unit-banks", businessUnit?.id],
            });
            queryClient.invalidateQueries({
                queryKey: ["business-units", accountId],
            });
            showToast(t("messages.delete_success", { ns: "bank_accounts" }), "success");
        },
        onError: (error: Error) => {
            showToast(error.message, "error");
        },
    });

    // Filter out current BU and its descendants from parent options
    const availableParents = businessUnits.filter(
        (bu) => bu.id !== businessUnit?.id
    );

    const mutation = useMutation({
        mutationFn: async (data: {
            name: string;
            parent_id: number | null;
            external_id: string;
            status: "Active" | "Inactive";
            pendingBankIds?: number[];
        }) => {
            const url = businessUnit
                ? `/api/entities/business-units/${businessUnit.id}`
                : `/api/entities/business-units`;
            const response = await fetch(url, {
                method: businessUnit ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: data.name,
                    parent_id: data.parent_id,
                    external_id: data.external_id,
                    status: data.status,
                    account_id: accountId,
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to save business unit");
            }
            const createdBu = await response.json();
            if (!businessUnit && data.pendingBankIds && data.pendingBankIds.length > 0) {
                const newBuId = createdBu.id;
                for (const bankAccountId of data.pendingBankIds) {
                    const bankRes = await apiFetch(`/api/entities/business-unit-banks/${newBuId}`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                bank_account_id: bankAccountId,
                                account_id: accountId,
                            }),
                        }
                    );
                    if (!bankRes.ok) {
                        const err = await bankRes.json();
                        throw new Error(err.error || "Failed to add bank account");
                    }
                }
            }
            return createdBu;
        },
        onSuccess: () => {
            showToast(
                businessUnit
                    ? t("messages.update_success", { ns: "business_unit" })
                    : t("messages.create_success", { ns: "business_unit" }),
                "success"
            );
            onSuccess();
        },
        onError: (error: Error) => {
            showToast(
                error.message ||
                (businessUnit
                    ? t("messages.update_error", { ns: "business_unit" })
                    : t("messages.create_error", { ns: "business_unit" })),
                "error"
            );
        },
    });

    useEffect(() => {
        if (businessUnit) {
            setFormData({
                name: businessUnit.name || "",
                parent_id: businessUnit.is_primary
                    ? null
                    : businessUnit.parent_id || null,
                external_id: businessUnit.external_id || "",
                status: businessUnit.status || "Active",
            });
            setPendingBanks([]);
        } else {
            setFormData({
                name: "",
                parent_id: null,
                external_id: "",
                status: "Active",
            });
        }
        setFieldErrors({});
    }, [businessUnit, isOpen]);

    const validateForm = useCallback((): boolean => {
        const errors: Record<string, string> = {};

        if (!formData.name.trim()) {
            errors.name = t("validation.name_required", {
                ns: "business_unit",
            });
        }

        // Parent is required if not a primary business unit
        if (!businessUnit?.is_primary && !formData.parent_id) {
            errors.parent_id = t("validation.parent_required", {
                ns: "business_unit",
            });
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    }, [formData, t, businessUnit?.is_primary]);

    const handleSubmit = useCallback(() => {
        if (!validateForm()) {
            return;
        }

        mutation.mutate({
            name: formData.name.trim(),
            parent_id: businessUnit?.is_primary ? null : formData.parent_id,
            external_id: formData.external_id.trim() || "",
            status: formData.status,
            pendingBankIds: !businessUnit ? pendingBanks.map((pb) => pb.id) : undefined,
        });
    }, [formData, validateForm, mutation, businessUnit?.is_primary, pendingBanks]);

    const handleClose = useCallback(() => {
        if (!mutation.isPending) {
            setFormData({
                name: "",
                parent_id: null,
                external_id: "",
                status: "Active",
            });
            setFieldErrors({});
            setPendingBanks([]);
            onClose();
        }
    }, [mutation.isPending, onClose]);

    // Reset position when dialog closes
    const selectedParent = availableParents.find(
        (bu) => bu.id === formData.parent_id
    );

    return (
        <AppDialog
            open={isOpen}
            onClose={handleClose}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="420px"
            paperMaxHeight="90vh"
            title={
                businessUnit
                    ? t("sections.edit_business_unit", { ns: "business_unit" })
                    : t("sections.add_business_unit", { ns: "business_unit" })
            }
            titleIcon={<BusinessIcon aria-hidden="true" />}
            ariaLabelledBy="upsert-business-unit-dialog-title"
            ariaDescribedBy="upsert-business-unit-dialog-description"
            actions={
                <>
                    <Button
                        onClick={handleClose}
                        disabled={mutation.isPending}
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
                        onClick={handleSubmit}
                        variant="contained"
                        size="small"
                        disabled={mutation.isPending}
                        className="save-button"
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    pt: 2,
                }}
            >
                {/* Status Section */}
                <Box>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                            color: "primary.main",
                        }}
                    >
                        <Typography variant="subtitle2">
                            {t("fields.status", { ns: "common" })}
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            bgcolor: "background.default",
                            borderRadius: 1,
                            p: 1,
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.status === "Active"}
                                    onChange={(e) => {
                                        setFormData({
                                            ...formData,
                                            status: e.target.checked
                                                ? "Active"
                                                : "Inactive",
                                        });
                                    }}
                                    color="primary"
                                    disabled={
                                        mutation.isPending ||
                                        businessUnit?.is_primary ||
                                        (!!activeUserCount &&
                                            activeUserCount > 0 &&
                                            formData.status === "Active")
                                    }
                                    {...(isRTL && { "data-rtl": true })}
                                />
                            }
                            label={
                                <Typography
                                    variant="body2"
                                    sx={{ color: "text.secondary" }}
                                >
                                    {formData.status === "Active"
                                        ? t("values.status_active", {
                                            ns: "common",
                                        })
                                        : t("values.status_inactive", {
                                            ns: "common",
                                        })}
                                </Typography>
                            }
                            labelPlacement={isRTL ? "start" : "end"}
                            sx={{
                                margin: 0,
                                ml: isRTL ? "auto" : 0,
                                mr: isRTL ? 0 : "auto",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                "& .MuiFormControlLabel-label": {
                                    direction: isRTL ? "rtl" : "ltr",
                                },
                            }}
                        />
                    </Box>
                    {activeUserCount &&
                        activeUserCount > 0 &&
                        formData.status === "Active" && (
                            <Box sx={{ mt: 1 }}>
                                <Typography
                                    variant="body2"
                                    color="warning.main"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        textAlign: isRTL ? "right" : "left",
                                    }}
                                >
                                    <InfoIcon fontSize="small" />
                                    {t(
                                        "messages.cannot_disable_with_active_users",
                                        {
                                            ns: "business_unit",
                                            count: activeUserCount,
                                        }
                                    )}
                                </Typography>
                            </Box>
                        )}
                </Box>

                <TextField
                    fullWidth
                    label={t("fields.name", { ns: "business_unit" })}
                    value={formData.name}
                    onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                    }
                    error={!!fieldErrors.name}
                    helperText={fieldErrors.name}
                    required
                    disabled={mutation.isPending}
                    {...(isRTL && { "data-hebrew": true })}
                    dir={isRTL ? "rtl" : "ltr"}
                    {...(isRTL && { "data-rtl": true })}
                    sx={{
                        padding: 0,
                        margin: 0,
                        "& .MuiFormControl-root": {
                            padding: 0,
                            margin: 0,
                        },
                        "& .MuiInputLabel-root": {
                            whiteSpace: "nowrap",
                            overflow: "visible",
                            textOverflow: "clip",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            direction: isRTL ? "rtl" : "ltr",
                        },
                        "& .MuiOutlinedInput-root": {
                            display: "flex !important",
                            alignItems: "center !important",
                        },
                        "& .MuiOutlinedInput-input": {
                            paddingTop: "6px !important",
                            paddingBottom: "6px !important",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            direction: isRTL ? "rtl" : "ltr",
                        },
                        "& .MuiFormHelperText-root": {
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            direction: isRTL ? "rtl" : "ltr",
                        },
                    }}
                />

                <Autocomplete
                    options={availableParents}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) =>
                        option.id === value?.id
                    }
                    value={
                        businessUnit?.is_primary
                            ? null
                            : selectedParent || null
                    }
                    onChange={(_, newValue) =>
                        setFormData({
                            ...formData,
                            parent_id: newValue?.id || null,
                        })
                    }
                    loading={isLoadingBUs}
                    disabled={
                        mutation.isPending || businessUnit?.is_primary
                    }
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                            <Box
                                component="li"
                                key={key}
                                {...otherProps}
                                sx={{
                                    direction:
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                    pr: isRTL
                                        ? theme.spacing(2)
                                        : theme.spacing(1.75),
                                    pl: isRTL
                                        ? theme.spacing(1.75)
                                        : theme.spacing(2),
                                    "&.Mui-focused": {
                                        backgroundColor:
                                            theme.palette.action.hover,
                                    },
                                    "&:hover": {
                                        backgroundColor:
                                            theme.palette.action.hover,
                                    },
                                    "&.Mui-selected": {
                                        backgroundColor:
                                            theme.palette.action.selected,
                                        "&:hover": {
                                            backgroundColor:
                                                theme.palette.action
                                                    .selected,
                                        },
                                    },
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        textAlign: isRTL ? "right" : "left",
                                        width: "100%",
                                        color: theme.palette.text.primary,
                                    }}
                                >
                                    {option.name || ""}
                                </Typography>
                            </Box>
                        );
                    }}
                    sx={{
                        opacity: businessUnit?.is_primary ? 0.6 : 1,
                        pointerEvents: businessUnit?.is_primary
                            ? "none"
                            : "auto",
                        "& .MuiAutocomplete-inputRoot": {
                            direction: isRTL ? "rtl" : "ltr",
                            "& .MuiAutocomplete-input": {
                                textAlign: isRTL ? "right" : "left",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            },
                            "& input": {
                                textAlign: isRTL ? "right" : "left",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            },
                        },
                        "& .MuiAutocomplete-endAdornment": {
                            right: isRTL ? "auto" : undefined,
                            left: isRTL ? theme.spacing(1.5) : "auto",
                        },
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={t("fields.parent_business_unit", {
                                ns: "business_unit",
                            })}
                            placeholder={
                                businessUnit?.is_primary
                                    ? t(
                                        "fields.primary_business_unit_no_parent",
                                        { ns: "business_unit" }
                                    )
                                    : t("fields.select_parent", {
                                        ns: "business_unit",
                                    })
                            }
                            error={!!fieldErrors.parent_id}
                            helperText={fieldErrors.parent_id}
                            required={!businessUnit?.is_primary}
                            {...(i18n.language === "he" && {
                                "data-hebrew": true,
                            })}
                            dir={i18n.language === "he" ? "rtl" : "ltr"}
                            {...(i18n.language === "he" && {
                                "data-rtl": true,
                            })}
                            sx={{
                                padding: 0,
                                margin: 0,
                                "& .MuiFormControl-root": {
                                    padding: 0,
                                    margin: 0,
                                },
                                "& .MuiInputBase-root": {
                                    backgroundColor:
                                        businessUnit?.is_primary
                                            ? theme.palette.action
                                                .disabledBackground
                                            : "transparent",
                                },
                                "& .MuiInputLabel-root": {
                                    whiteSpace: "nowrap",
                                    overflow: "visible",
                                    textOverflow: "clip",
                                    textAlign: isRTL ? "right" : "left",
                                    direction:
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr",
                                },
                                "& .MuiOutlinedInput-root": {
                                    display: "flex !important",
                                    alignItems: "center !important",
                                },
                                "& .MuiOutlinedInput-input": {
                                    paddingTop: "6px !important",
                                    paddingBottom: "6px !important",
                                    textAlign: isRTL ? "right" : "left",
                                    direction:
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr",
                                },
                                "& .MuiFormHelperText-root": {
                                    textAlign: isRTL ? "right" : "left",
                                    direction:
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr",
                                },
                                "& .MuiInputBase-input.Mui-disabled": {
                                    WebkitTextFillColor:
                                        theme.palette.text.disabled,
                                    color: theme.palette.text.disabled,
                                },
                            }}
                        />
                    )}
                    dir={isRTL ? "rtl" : "ltr"}
                    {...(isRTL && { "data-rtl": true })}
                />

                <TextField
                    fullWidth
                    label={t("fields.external_id", { ns: "business_unit" })}
                    value={formData.external_id}
                    onChange={(e) =>
                        setFormData({
                            ...formData,
                            external_id: e.target.value,
                        })
                    }
                    error={!!fieldErrors.external_id}
                    helperText={fieldErrors.external_id}
                    disabled={mutation.isPending}
                    {...(isRTL && { "data-hebrew": true })}
                    dir={isRTL ? "rtl" : "ltr"}
                    {...(isRTL && { "data-rtl": true })}
                    sx={{
                        padding: 0,
                        margin: 0,
                        "& .MuiFormControl-root": {
                            padding: 0,
                            margin: 0,
                        },
                        "& .MuiInputLabel-root": {
                            whiteSpace: "nowrap",
                            overflow: "visible",
                            textOverflow: "clip",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            direction: isRTL ? "rtl" : "ltr",
                        },
                        "& .MuiOutlinedInput-root": {
                            display: "flex !important",
                            alignItems: "center !important",
                        },
                        "& .MuiOutlinedInput-input": {
                            paddingTop: "6px !important",
                            paddingBottom: "6px !important",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            direction: isRTL ? "rtl" : "ltr",
                        },
                        "& .MuiFormHelperText-root": {
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            direction: isRTL ? "rtl" : "ltr",
                        },
                    }}
                />

                {/* Bank Accounts Section */}
                <Box>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                            color: "primary.main",
                        }}
                    >
                        <Typography variant="subtitle2">
                            {t("sections.bank_info", {
                                ns: "bank_accounts",
                            })}
                        </Typography>
                    </Box>
                    <Autocomplete<{
                        id?: number;
                        bank_name?: string;
                        branch_name?: string;
                        branch_number?: string;
                        account_number?: string;
                        beneficiary_name?: string;
                    }>
                        options={filteredAvailableBanks}
                        getOptionLabel={(option) => {
                            const parts = [
                                option.bank_name,
                                option.branch_name || option.branch_number,
                                option.account_number,
                            ].filter(Boolean);
                            return parts.join(" · ") || t("fields.unknown", { ns: "common" });
                        }}
                        isOptionEqualToValue={(option, value) =>
                            option.id === value?.id
                        }
                        onChange={(_, newValue) => {
                            if (newValue?.id) {
                                const bankId =
                                    typeof newValue.id === "number"
                                        ? newValue.id
                                        : parseInt(String(newValue.id), 10);
                                if (isEditMode) {
                                    addBankMutation.mutate(bankId);
                                } else {
                                    setPendingBanks((prev) => [
                                        ...prev,
                                        {
                                            id: bankId,
                                            bank_name: newValue.bank_name,
                                            account_number: newValue.account_number,
                                            beneficiary_name: newValue.beneficiary_name,
                                        },
                                    ]);
                                }
                            }
                        }}
                        loading={isLoadingBanks}
                        disabled={
                            mutation.isPending ||
                            (isEditMode && addBankMutation.isPending) ||
                            filteredAvailableBanks.length === 0
                        }
                        value={null}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={t("actions.add_account", {
                                    ns: "bank_accounts",
                                })}
                                placeholder={
                                    filteredAvailableBanks.length === 0
                                        ? t("messages.no_accounts", {
                                            ns: "bank_accounts",
                                        })
                                        : undefined
                                }
                                dir={isRTL ? "rtl" : "ltr"}
                                {...(isRTL && { "data-rtl": true })}
                                sx={{
                                    padding: 0,
                                    margin: 0,
                                    "& .MuiFormControl-root": {
                                        padding: 0,
                                        margin: 0,
                                    },
                                    "& .MuiInputLabel-root": {
                                        whiteSpace: "nowrap",
                                        overflow: "visible",
                                        textOverflow: "clip",
                                    },
                                    "& .MuiOutlinedInput-root": {
                                        display: "flex !important",
                                        alignItems: "center !important",
                                    },
                                    "& .MuiOutlinedInput-input": {
                                        paddingTop: "6px !important",
                                        paddingBottom: "6px !important",
                                        textAlign: isRTL ? "right" : "left",
                                        direction: isRTL ? "rtl" : "ltr",
                                    },
                                }}
                            />
                        )}
                        sx={{
                            mb: 2,
                            "& .MuiAutocomplete-inputRoot": {
                                direction: isRTL ? "rtl" : "ltr",
                            },
                        }}
                    />
                    <Box
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            overflow: "hidden",
                            maxHeight: 200,
                            overflowY: "auto",
                        }}
                    >
                        {displayBanks.length === 0 ? (
                            <Box sx={{ p: 2, textAlign: "center" }}>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                        textAlign: isRTL ? "right" : "left",
                                        direction: isRTL ? "rtl" : "ltr",
                                    }}
                                >
                                    {t("messages.no_accounts", {
                                        ns: "bank_accounts",
                                    })}
                                </Typography>
                            </Box>
                        ) : (
                            <>
                                <Box
                                    sx={{
                                        display: "flex",
                                        px: 1.5,
                                        py: 1,
                                        borderBottom: "1px solid",
                                        borderColor: "divider",
                                        bgcolor: "action.hover",
                                        direction: isRTL ? "rtl" : "ltr",
                                    }}
                                >
                                    <Box sx={{ flex: "1 1 30%", px: 1 }}>
                                        <Typography variant="caption" fontWeight={600}>
                                            {t("fields.bank_name", {
                                                ns: "bank_accounts",
                                            })}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ flex: "1 1 25%", px: 1 }}>
                                        <Typography variant="caption" fontWeight={600}>
                                            {t("fields.account_number", {
                                                ns: "bank_accounts",
                                            })}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ flex: "1 1 25%", px: 1 }}>
                                        <Typography variant="caption" fontWeight={600}>
                                            {t("fields.beneficiary_name", {
                                                ns: "bank_accounts",
                                            })}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ flex: "0 0 60px", px: 1 }} />
                                </Box>
                                {displayBanks.map(
                                    (bank: {
                                        id: number;
                                        CustomerBankAccount?: {
                                            bank_name?: string | null;
                                            account_number?: string | null;
                                            beneficiary_name?: string | null;
                                        };
                                        AccountBankAccounts?: {
                                            bank_name?: string | null;
                                            account_number?: string | null;
                                            beneficiary_name?: string | null;
                                        };
                                    }) => {
                                        const acc =
                                            bank.CustomerBankAccount ??
                                            bank.AccountBankAccounts;
                                        return (
                                            <Box
                                                key={bank.id}
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    px: 1.5,
                                                    py: 1,
                                                    borderBottom: "1px solid",
                                                    borderColor: "divider",
                                                    "&:last-child": {
                                                        borderBottom: "none",
                                                    },
                                                    direction: isRTL ? "rtl" : "ltr",
                                                }}
                                            >
                                                <Box sx={{ flex: "1 1 30%", px: 1 }}>
                                                    <Typography variant="body2">
                                                        {acc?.bank_name ?? "-"}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ flex: "1 1 25%", px: 1 }}>
                                                    <Typography variant="body2">
                                                        {acc?.account_number ?? "-"}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ flex: "1 1 25%", px: 1 }}>
                                                    <Typography variant="body2">
                                                        {acc?.beneficiary_name ?? "-"}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ flex: "0 0 60px", px: 1 }}>
                                                    <Tooltip
                                                        title={t("tooltips.delete", {
                                                            ns: "bank_accounts",
                                                        })}
                                                        arrow
                                                        enterDelay={300}
                                                        leaveDelay={100}
                                                        placement="bottom"
                                                        PopperProps={{
                                                            sx: {
                                                                "& .MuiTooltip-tooltip": {
                                                                    direction:
                                                                        i18n.language === "he"
                                                                            ? "rtl"
                                                                            : "ltr",
                                                                },
                                                                "& .MuiTooltip-arrow": {
                                                                    ...(i18n.language ===
                                                                        "he" && {
                                                                        transform:
                                                                            "scaleX(-1)",
                                                                    }),
                                                                },
                                                            },
                                                        }}
                                                    >
                                                        <IconButton
                                                            size="small"
                                                            color="primary"
                                                            onClick={() =>
                                                                isEditMode
                                                                    ? deleteBankMutation.mutate(bank.id)
                                                                    : setPendingBanks((prev) =>
                                                                        prev.filter((pb) => pb.id !== bank.id)
                                                                    )
                                                            }
                                                            disabled={
                                                                isEditMode &&
                                                                deleteBankMutation.isPending
                                                            }
                                                            sx={{
                                                                "&.Mui-disabled": {
                                                                    color: "text.disabled",
                                                                },
                                                            }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </Box>
                                        );
                                    }
                                )}
                            </>
                        )}
                    </Box>
                </Box>
            </Box>
        </AppDialog>
    );
}
