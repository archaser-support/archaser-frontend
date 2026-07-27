"use client";
import { apiFetch } from "@/utils/apiFetch";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import {
    Box,
    Button,
    FormControlLabel,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { State } from "@prisma/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { CountrySelect, StateSelect } from "@/components/LocationSelects";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

interface CountryType {
    id: number;
    name: string;
    emoji: string | null;
    iso2: string | null;
    iso3: string | null;
    numeric_code: string | null;
    phonecode: string | null;
    capital: string | null;
    currency: string | null;
    currency_name: string | null;
    currency_symbol: string | null;
    tld: string | null;
    native: string | null;
    region: string | null;
    subregion: string | null;
    timezones: string | null;
    translations: string | null;
    latitude: string | null;
    longitude: string | null;
    emojiU: string | null;
    wikiDataId: string | null;
}

interface BankAccount {
    id: number;
    created_at: Date;
    modified_at: Date;
    account_id: number;
    beneficiary_name?: string | null;
    branch_number?: string | null;
    account_number?: string | null;
    bank_name?: string | null;
    branch_name?: string | null;
    swift?: string | null;
    iban?: string | null;
    comments?: string | null;
    status: boolean;
    primary: boolean;
    address_line1?: string | null;
    city?: string | null;
    postal_code?: string | null;
    address_line2?: string | null;
    country_id?: number | null;
    state_id?: number | null;
}

interface UpsertBankModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    accountId: number;
    account: BankAccount | null;
}

export function UpsertBankModal({
    isOpen,
    onClose,
    onSuccess,
    accountId,
    account,
}: UpsertBankModalProps) {
    const { t, i18n } = useTranslation(["bank_accounts", "common"]);
    const theme = useTheme();
    const { showToast } = useToast();
    const isRTL = i18n.language === "he";
    const [formData, setFormData] = useState<Partial<BankAccount>>({
        bank_name: "",
        account_number: "",
        beneficiary_name: "",
        branch_number: "",
        branch_name: "",
        swift: "",
        iban: "",
        comments: "",
        status: true,
        primary: false,
        address_line1: "",
        address_line2: "",
        city: "",
        postal_code: "",
        country_id: null,
        state_id: null,
    });

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const triggerRef = React.useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            const activeElement = document.activeElement as HTMLElement;
            const triggerButton =
                activeElement.closest("button") || activeElement;
            triggerRef.current = triggerButton;
        }
    }, [isOpen]);

    const { data: countries } = useQuery<CountryType[]>({
        queryKey: ["countries"],
        queryFn: async () => {
            const response = await apiFetch("/api/country");
            if (!response.ok) {
                throw new Error("Failed to fetch countries");
            }
            return response.json();
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const { data: states } = useQuery<State[]>({
        queryKey: ["states", formData.country_id],
        queryFn: async () => {
            if (!formData.country_id) return [];
            const response = await apiFetch(`/api/state?country_id=${formData.country_id}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch states");
            }
            return response.json();
        },
        enabled: !!formData.country_id,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const mutation = useMutation({
        mutationFn: async (data: Partial<BankAccount>) => {
            const url = account
                ? `/api/entities/accounts/${accountId}/bank-accounts/${account.id}`
                : `/api/entities/accounts/${accountId}/bank-accounts`;
            const response = await fetch(url, {
                method: account ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error("Failed to save bank account");
        },
        onSuccess: () => {
            showToast(
                account
                    ? t("messages.update_success", { ns: "bank_accounts" })
                    : t("messages.create_success", { ns: "bank_accounts" }),
                "success"
            );
            onSuccess();
        },
        onError: () => {
            showToast(
                account
                    ? t("messages.update_error", { ns: "bank_accounts" })
                    : t("messages.create_error", { ns: "bank_accounts" }),
                "error"
            );
        },
    });

    // Initialize form data
    const getInitialFormData = useCallback((accountData: BankAccount | null): Partial<BankAccount> => {
        if (accountData) {
            return {
                bank_name: accountData.bank_name || "",
                account_number: accountData.account_number || "",
                beneficiary_name: accountData.beneficiary_name || "",
                branch_number: accountData.branch_number || "",
                branch_name: accountData.branch_name || "",
                swift: accountData.swift || "",
                iban: accountData.iban || "",
                comments: accountData.comments || "",
                status: accountData.status,
                primary: accountData.primary,
                address_line1: accountData.address_line1 || "",
                address_line2: accountData.address_line2 || "",
                city: accountData.city || "",
                postal_code: accountData.postal_code || "",
                country_id: accountData.country_id,
                state_id: accountData.state_id,
            };
        }
        return {
            bank_name: "",
            account_number: "",
            beneficiary_name: "",
            branch_number: "",
            branch_name: "",
            swift: "",
            iban: "",
            comments: "",
            status: true,
            primary: false,
            address_line1: "",
            address_line2: "",
            city: "",
            postal_code: "",
            country_id: null,
            state_id: null,
        };
    }, []);

    useEffect(() => {
        setFormData(getInitialFormData(account));
        setFieldErrors({});
    }, [account, getInitialFormData]);

    const handleChange = useCallback(
        (field: keyof BankAccount) =>
            (
                event:
                    | React.ChangeEvent<
                        HTMLInputElement | { name?: string; value: unknown }
                    >
                    | { target: { value: number; name: string } }
            ) => {
                const value =
                    "type" in event.target && event.target.type === "checkbox"
                        ? (event.target as HTMLInputElement).checked
                        : event.target.value;

                if (field === "primary" && value === true) {
                    setFormData((prev: Partial<BankAccount>) => ({
                        ...prev,
                        [field]: value,
                        status: true,
                    }));
                } else {
                    setFormData((prev: Partial<BankAccount>) => ({
                        ...prev,
                        [field]: value,
                    }));
                }

                // Clear error for this field when user starts typing
                if (fieldErrors[field]) {
                    setFieldErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors[field];
                        return newErrors;
                    });
                }
            },
        [fieldErrors]
    );

    const validateForm = useCallback(() => {
        const errors: Record<string, string> = {};

        if (!formData.bank_name?.trim()) {
            errors.bank_name = t("validation.bank_name_required", { ns: "bank_accounts" });
        }
        if (!formData.account_number?.trim()) {
            errors.account_number = t("validation.account_number_required", { ns: "bank_accounts" });
        }
        if (!formData.beneficiary_name?.trim()) {
            errors.beneficiary_name = t("validation.beneficiary_name_required", { ns: "bank_accounts" });
        }
        if (!formData.country_id) {
            errors.country_id = t("validation.country_required", { ns: "bank_accounts" });
        }
        if (!formData.address_line1?.trim()) {
            errors.address_line1 = t("validation.address_line1_required", { ns: "bank_accounts" });
        }
        if (!formData.city?.trim()) {
            errors.city = t("validation.city_required", { ns: "bank_accounts" });
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    }, [formData, t]);

    const handleSubmit = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (!validateForm()) return;

        try {
            await mutation.mutateAsync(formData);
        } catch (error) {
            // Error is already handled in the mutation's onError callback
        }
    }, [validateForm, mutation, formData]);

    const handleClose = useCallback(() => {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement?.blur) {
            activeElement.blur();
        }
        if (triggerRef.current) {
            triggerRef.current.focus();
        }
        onClose();
    }, [onClose]);

    // Memoized styling objects for performance
    const textFieldSx = useMemo(() => ({
        "& .MuiInputBase-input": {
            textAlign: isRTL ? "right" : "left",
            direction: isRTL ? "rtl" : "ltr",
        },
        "& .MuiInputLabel-root": {
            textAlign: isRTL ? "right" : "left",
            direction: isRTL ? "rtl" : "ltr",
        },
        "& .MuiOutlinedInput-root": {
            alignItems: "center",
        },
    }), [isRTL]);

    const multilineTextFieldSx = useMemo(() => ({
        "& .MuiInputBase-input": {
            textAlign: isRTL ? "right" : "left",
            direction: isRTL ? "rtl" : "ltr",
        },
        "& .MuiInputLabel-root": {
            textAlign: isRTL ? "right" : "left",
            direction: isRTL ? "rtl" : "ltr",
        },
        "& .MuiOutlinedInput-root": {
            alignItems: "flex-start",
        },
    }), [isRTL]);

    const formControlLabelSx = useMemo(() => ({
        direction: isRTL ? "rtl" : "ltr",
        justifyContent: isRTL ? "flex-end" : "flex-start",
        "& .MuiFormControlLabel-label": {
            marginLeft: isRTL ? 0 : theme.spacing(1),
            marginRight: isRTL ? theme.spacing(1) : 0,
        },
    }), [isRTL, theme.spacing]);

    const sectionHeaderSx = useMemo(() => ({
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        mb: theme.spacing(0.5),
        color: theme.palette.primary.main,
        direction: isRTL ? "rtl" : "ltr",
    }), [isRTL, theme.spacing]);

    const sectionTypographySx = useMemo(() => ({
        textAlign: isRTL ? "right" : "left",
        direction: isRTL ? "rtl" : "ltr",
    }), [isRTL]);

    const sectionGridSx = useMemo(() => ({
        display: "grid",
        gap: theme.spacing(1.5),
        bgcolor: theme.palette.background.default,
        borderRadius: theme.shape.borderRadius,
        direction: isRTL ? "rtl" : "ltr",
        "@media (min-width: 600px)": {
            gridTemplateColumns: "repeat(3, 1fr)",
            padding: theme.spacing(1),
        },
        "@media (max-width: 599px)": {
            gridTemplateColumns: "1fr",
            padding: theme.spacing(0.75),
        },
    }), [isRTL, theme]);

    const selectedCountry = useMemo(() =>
        countries?.find(c => c.id === formData.country_id) || null,
        [countries, formData.country_id]
    );

    const selectedState = useMemo(() =>
        states?.find(s => s.id === formData.state_id) || null,
        [states, formData.state_id]
    );

    const isUSOrCanada = useMemo(() =>
        selectedCountry?.name === "United States" || selectedCountry?.name === "Canada",
        [selectedCountry]
    );

    return (
        <AppDialog
            open={isOpen}
            onClose={() => {
                handleClose();
                if (triggerRef.current) {
                    setTimeout(() => triggerRef.current?.focus(), 0);
                }
            }}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="500px"
            paperMaxHeight="90vh"
            title={
                account
                    ? t("actions.edit_account", { ns: "bank_accounts" })
                    : t("actions.add_account", { ns: "bank_accounts" })
            }
            titleIcon={<AccountBalanceIcon aria-hidden="true" />}
            ariaLabelledBy="bank-account-dialog-title"
            ariaDescribedBy="bank-account-dialog-description"
            actions={
                <>
                    <Button
                        onClick={handleClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        fullWidth={false}
                        disabled={mutation.isPending}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        type="submit"
                        form="bank-form"
                        variant="contained"
                        size="small"
                        fullWidth={false}
                        className="save-button"
                        disabled={mutation.isPending}
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                            "& .MuiButton-endIcon": {
                                marginLeft: isRTL ? 0 : theme.spacing(1),
                                marginRight: isRTL ? theme.spacing(1) : 0,
                            },
                        }}
                    >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <form
                id="bank-form"
                onSubmit={handleSubmit}
                role="form"
                aria-label={t("fields.form_label", { ns: "bank_accounts" })}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: theme.spacing(0.5),
                        width: "100%",
                        direction: isRTL ? "rtl" : "ltr",
                    }}
                >
                    {/* Account Settings Section */}
                    <Box>
                        <Box sx={sectionHeaderSx}>
                            <Typography variant="subtitle2" sx={sectionTypographySx}>
                                {t("sections.status", { ns: "bank_accounts" })}
                            </Typography>
                        </Box>
                        <Box sx={{ display: "flex", gap: theme.spacing(2), flexWrap: "wrap" }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    flex: 1,
                                    minWidth: "200px",
                                }}
                            >
                                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                    {t("fields.primary", { ns: "bank_accounts" })}
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.primary}
                                            onChange={handleChange("primary")}
                                            color="primary"
                                            {...(isRTL && { "data-rtl": true })}
                                        />
                                    }
                                    label={
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: "text.secondary",
                                                textAlign: isRTL ? "right" : "left",
                                                direction: isRTL ? "rtl" : "ltr",
                                            }}
                                        >
                                            {formData.primary
                                                ? t("fields.yes", { ns: "common" })
                                                : t("fields.no", { ns: "common" })}
                                        </Typography>
                                    }
                                    labelPlacement={isRTL ? "start" : "end"}
                                    sx={formControlLabelSx}
                                />
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    flex: 1,
                                    minWidth: "200px",
                                }}
                            >
                                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                    {t("fields.status", { ns: "common" })}
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.status}
                                            onChange={handleChange("status")}
                                            color="primary"
                                            disabled={formData.primary}
                                            {...(isRTL && { "data-rtl": true })}
                                        />
                                    }
                                    label={
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: "text.secondary",
                                                textAlign: isRTL ? "right" : "left",
                                                direction: isRTL ? "rtl" : "ltr",
                                            }}
                                        >
                                            {formData.status
                                                ? t("values.status_active", { ns: "common" })
                                                : t("values.status_inactive", { ns: "common" })}
                                        </Typography>
                                    }
                                    labelPlacement={isRTL ? "start" : "end"}
                                    sx={formControlLabelSx}
                                />
                            </Box>
                        </Box>
                    </Box>

                    {/* Bank Information Section */}
                    <Box>
                        <Box sx={sectionHeaderSx}>
                            <Typography variant="subtitle2" sx={sectionTypographySx}>
                                {t("sections.bank_info", { ns: "bank_accounts" })}
                            </Typography>
                        </Box>
                        <Box sx={sectionGridSx}>
                            <TextField
                                label={`${t("fields.bank_name", { ns: "bank_accounts" })} *`}
                                value={formData.bank_name}
                                onChange={handleChange("bank_name")}
                                fullWidth
                                size="small"
                                error={!!fieldErrors.bank_name}
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                            <TextField
                                label={`${t("fields.account_number", { ns: "bank_accounts" })} *`}
                                value={formData.account_number}
                                onChange={handleChange("account_number")}
                                fullWidth
                                size="small"
                                error={!!fieldErrors.account_number}
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                            <TextField
                                label={`${t("fields.beneficiary_name", { ns: "bank_accounts" })} *`}
                                value={formData.beneficiary_name}
                                onChange={handleChange("beneficiary_name")}
                                fullWidth
                                size="small"
                                error={!!fieldErrors.beneficiary_name}
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                            <TextField
                                label={t("fields.branch_number", { ns: "bank_accounts" })}
                                value={formData.branch_number}
                                onChange={handleChange("branch_number")}
                                fullWidth
                                size="small"
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                            <TextField
                                label={t("fields.branch_name", { ns: "bank_accounts" })}
                                value={formData.branch_name}
                                onChange={handleChange("branch_name")}
                                fullWidth
                                size="small"
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                        </Box>
                    </Box>

                    {/* International Banking Section */}
                    <Box>
                        <Box sx={sectionHeaderSx}>
                            <Typography variant="subtitle2" sx={sectionTypographySx}>
                                {t("sections.international_banking", { ns: "bank_accounts" })}
                            </Typography>
                        </Box>
                        <Box sx={sectionGridSx}>
                            <TextField
                                label={t("fields.swift", { ns: "bank_accounts" })}
                                value={formData.swift}
                                onChange={handleChange("swift")}
                                fullWidth
                                size="small"
                                error={!!fieldErrors.swift}
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                            <TextField
                                label={t("fields.iban", { ns: "bank_accounts" })}
                                value={formData.iban}
                                onChange={handleChange("iban")}
                                fullWidth
                                size="small"
                                error={!!fieldErrors.iban}
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                        </Box>
                    </Box>

                    {/* Address Section */}
                    <Box>
                        <Box sx={sectionHeaderSx}>
                            <Typography variant="subtitle2" sx={sectionTypographySx}>
                                {t("sections.address", { ns: "bank_accounts" })}
                            </Typography>
                        </Box>
                        <Box sx={sectionGridSx}>
                            <TextField
                                label={`${t("fields.address_line1", { ns: "bank_accounts" })} *`}
                                value={formData.address_line1}
                                onChange={handleChange("address_line1")}
                                fullWidth
                                size="small"
                                error={!!fieldErrors.address_line1}
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                            <TextField
                                label={t("fields.address_line2", { ns: "bank_accounts" })}
                                value={formData.address_line2}
                                onChange={handleChange("address_line2")}
                                fullWidth
                                size="small"
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                            <TextField
                                label={`${t("fields.city", { ns: "bank_accounts" })} *`}
                                value={formData.city}
                                onChange={handleChange("city")}
                                fullWidth
                                size="small"
                                error={!!fieldErrors.city}
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                            <TextField
                                label={t("fields.postal_code", { ns: "bank_accounts" })}
                                value={formData.postal_code}
                                onChange={handleChange("postal_code")}
                                fullWidth
                                size="small"
                                error={!!fieldErrors.postal_code}
                                {...(isRTL && { "data-hebrew": true })}
                                sx={textFieldSx}
                            />
                            <Box>
                                <CountrySelect
                                    value={selectedCountry}
                                    onChange={(country) => {
                                        const isSelectedUSOrCanada =
                                            country?.name === "United States" ||
                                            country?.name === "Canada";

                                        setFormData((prev: Partial<BankAccount>) => ({
                                            ...prev,
                                            country_id: country?.id || null,
                                            state_id: isSelectedUSOrCanada ? prev.state_id : null,
                                        }));

                                        if (fieldErrors.country_id) {
                                            setFieldErrors((prev) => {
                                                const newErrors = { ...prev };
                                                delete newErrors.country_id;
                                                return newErrors;
                                            });
                                        }
                                    }}
                                    label={`${t("fields.country", { ns: "common" })} *`}
                                    disabled={false}
                                    error={!!fieldErrors.country_id}
                                />
                            </Box>
                            <Box>
                                <StateSelect
                                    value={selectedState}
                                    onChange={(state) => {
                                        setFormData((prev: Partial<BankAccount>) => ({
                                            ...prev,
                                            state_id: state?.id || null,
                                        }));
                                    }}
                                    label={t("fields.state", { ns: "bank_accounts" })}
                                    countryId={formData.country_id || undefined}
                                    disabled={!formData.country_id || !isUSOrCanada}
                                />
                            </Box>
                        </Box>
                    </Box>

                    {/* Additional Information Section */}
                    <Box>
                        <Box sx={sectionHeaderSx}>
                            <Typography variant="subtitle2" sx={sectionTypographySx}>
                                {t("sections.additional_info", { ns: "bank_accounts" })}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                p: { xs: theme.spacing(0.75), sm: theme.spacing(1) },
                                bgcolor: theme.palette.background.default,
                                borderRadius: theme.shape.borderRadius,
                            }}
                        >
                            <TextField
                                label={t("fields.comments", { ns: "bank_accounts" })}
                                value={formData.comments}
                                onChange={handleChange("comments")}
                                fullWidth
                                multiline
                                size="small"
                                minRows={2}
                                {...(isRTL && { "data-hebrew": true })}
                                sx={multilineTextFieldSx}
                            />
                        </Box>
                    </Box>
                </Box>
            </form>
        </AppDialog>
    );
}
