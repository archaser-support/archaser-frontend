"use client";

import { AccountBalance as AccountBalanceIcon } from "@mui/icons-material";
import {
    Autocomplete,
    Box,
    Button,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import api from "@/app/api";
import AppDialog from "@/shared/layout-components/modal/AppDialog";

import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { Customer } from "@/types/Customer";

interface BankOption {
    id: number | string;
    bank_name?: string;
    branch_name?: string;
    branch_number?: string;
    account_number?: string;
    beneficiary_name?: string;
}

interface AddBankToCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer;
    existingCustomerBanks?: any[];
    onSuccess?: () => void;
    onAvailableBanksChange?: (hasAvailableBanks: boolean) => void;
}

const AddBankToCustomerModal: React.FC<AddBankToCustomerModalProps> = ({
    isOpen,
    onClose,
    customer,
    existingCustomerBanks = [],
    onSuccess,
    onAvailableBanksChange,
}) => {
    const { t, i18n } = useTranslation(["bank_accounts", "common"]);
    const theme = useTheme();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const isRTL = i18n.language === "he";

    const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
    const [isSaving, setIsSaving] = useState(false);



    // Fetch available bank accounts
    const { data: availableBanks, isLoading: isLoadingBanksOptions } = useQuery({
        queryKey: ["bank-accounts", customer.account_id],
        queryFn: async () => {
            const response = await api.get(
                `/bank-accounts?accountId=${customer.account_id}&include=Country`
            );
            return response.data;
        },
        enabled: isOpen && !!customer.account_id,
        staleTime: 5 * 60 * 1000,
    });

    // Fetch customer's bank relationships directly to get customer_bank_account_id values
    // This is more reliable than using report data which may filter out ID fields
    const { data: customerBanksData } = useQuery({
        queryKey: ["customer-banks-relationships", customer.id],
        queryFn: async () => {
            const response = await api.get(
                `/entities/customer-banks/${customer.id}?limit=1000`
            );
            return response.data;
        },
        enabled: isOpen && !!customer.id,
        staleTime: 5 * 60 * 1000,
    });

    // Filter out banks already assigned to this customer
    // Use existingCustomerBanks prop from parent component (which uses view-execution query)
    const filteredAvailableBanks = useMemo(() => {
        if (!availableBanks || !Array.isArray(availableBanks)) return [];

        // Get list of bank account IDs that are already assigned to this customer
        // The report execution service formats fields as "Table.field" (e.g., "CustomerBanks.customer_bank_account_id")
        const assignedBankAccountIds = new Set<string | number>();

        // Use direct API call to get customer_bank_account_id values (more reliable than report data)
        // The report data may filter out ID fields, so we fetch the relationships directly
        if (customerBanksData?.data && Array.isArray(customerBanksData.data)) {
            customerBanksData.data.forEach((customerBank: any) => {
                // The API response should include customer_bank_account_id directly
                const bankAccountId =
                    customerBank.customer_bank_account_id ??
                    customerBank["customer_bank_account_id"];

                if (bankAccountId !== undefined && bankAccountId !== null) {
                    // Normalize to both string and number for comparison
                    const normalizedIdStr = String(bankAccountId);
                    const normalizedIdNum = Number(bankAccountId);

                    assignedBankAccountIds.add(normalizedIdStr);
                    if (!isNaN(normalizedIdNum)) {
                        assignedBankAccountIds.add(normalizedIdNum);
                    }
                }
            });
        }

        // Fallback: Also check existingCustomerBanks from report data (in case API call fails)
        // This is less reliable because ID fields may be filtered, but it's a backup
        if (assignedBankAccountIds.size === 0 && existingCustomerBanks && Array.isArray(existingCustomerBanks)) {
            existingCustomerBanks.forEach((customerBank: any) => {
                // Check raw field first (contains original data before filtering)
                let bankAccountId: any = undefined;

                if (customerBank.raw) {
                    bankAccountId =
                        customerBank.raw["CustomerBanks.customer_bank_account_id"] ??
                        customerBank.raw.customer_bank_account_id ??
                        customerBank.raw["customer_bank_account_id"];
                }

                // Fallback to formatted data
                if ((bankAccountId === undefined || bankAccountId === null)) {
                    bankAccountId =
                        customerBank["CustomerBanks.customer_bank_account_id"] ??
                        customerBank.customer_bank_account_id ??
                        customerBank["customer_bank_account_id"];
                }

                if (bankAccountId !== undefined && bankAccountId !== null) {
                    const normalizedIdStr = String(bankAccountId);
                    const normalizedIdNum = Number(bankAccountId);

                    assignedBankAccountIds.add(normalizedIdStr);
                    if (!isNaN(normalizedIdNum)) {
                        assignedBankAccountIds.add(normalizedIdNum);
                    }
                }
            });
        }


        // Filter out banks that are already assigned
        const filtered = availableBanks.filter((bank: { id?: number | string }) => {
            if (!bank.id) return false;

            // Normalize bank ID for comparison (try both string and number)
            const bankIdStr = String(bank.id);
            const bankIdNum = Number(bank.id);

            // Exclude banks that are already assigned to this customer
            const isAssigned = assignedBankAccountIds.has(bankIdStr) ||
                (!isNaN(bankIdNum) && assignedBankAccountIds.has(bankIdNum));

            return !isAssigned;
        });

        return filtered;
    }, [availableBanks, customerBanksData, existingCustomerBanks, isOpen]);

    // Notify parent when available banks count changes (use effect to avoid setState during render)
    useEffect(() => {
        if (onAvailableBanksChange && isOpen) {
            onAvailableBanksChange(filteredAvailableBanks.length > 0);
        }
    }, [filteredAvailableBanks.length, onAvailableBanksChange, isOpen]);

    const handleBankSelection = useCallback(
        (
            _: React.SyntheticEvent,
            newValue: BankOption | null
        ) => {
            setSelectedBank(newValue);
        },
        []
    );

    const handleAddBank = useCallback(async () => {
        if (!selectedBank || !selectedBank.id) {
            showToast(
                t("messages.create_error", { ns: "bank_accounts" }),
                "error"
            );
            return;
        }

        const bankAccountId =
            typeof selectedBank.id === "number"
                ? selectedBank.id
                : parseInt(selectedBank.id.toString(), 10);

        if (isNaN(bankAccountId)) {
            showToast(
                t("messages.create_error", { ns: "bank_accounts" }),
                "error"
            );
            return;
        }

        setIsSaving(true);
        try {
            await api.post(`/entities/customer-banks/${customer.id}`, {
                customer_bank_account_id: bankAccountId,
                account_id: customer.account_id,
            });

            // Reset selected bank
            setSelectedBank(null);

            // Invalidate view execution queries to refresh the list
            await queryClient.invalidateQueries({
                queryKey: ["view-execution"],
            });

            showToast(
                t("messages.create_success", { ns: "bank_accounts" }),
                "success"
            );

            // Close modal and call success callback (which will refresh the list)
            onClose();
            onSuccess?.();
        } catch (error: any) {
            const errorMessage =
                error?.response?.data?.error ||
                error?.message ||
                t("messages.create_error", { ns: "bank_accounts" });
            showToast(errorMessage, "error");
        } finally {
            setIsSaving(false);
        }
    }, [selectedBank, customer.id, customer.account_id, onClose, onSuccess, showToast, t, queryClient]);

    const handleClose = useCallback(() => {
        if (!isSaving) {
            setSelectedBank(null);
            onClose();
        }
    }, [isSaving, onClose]);

    // Reset selected bank when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedBank(null);
        }
    }, [isOpen]);

    // Memoized RTL styles
    const textFieldSx = useMemo(
        () => ({
            "& .MuiInputBase-input": {
                textAlign: isRTL ? "right" : "left",
                direction: isRTL ? "rtl" : "ltr",
            },
            "& .MuiInputLabel-root": {
                textAlign: isRTL ? "right" : "left",
                direction: isRTL ? "rtl" : "ltr",
            },
        }),
        [isRTL]
    );

    const tooltipPopperProps = useMemo(
        () => ({
            sx: {
                "& .MuiTooltip-tooltip": {
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                },
            },
        }),
        [isRTL]
    );

    return (
        <AppDialog
            open={isOpen}
            onClose={handleClose}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="400px"
            paperMaxHeight="90vh"
            title={t("actions.add_account", { ns: "bank_accounts" })}
            titleIcon={<AccountBalanceIcon aria-hidden="true" />}
            ariaLabelledBy="add-bank-dialog-title"
            ariaDescribedBy="add-bank-dialog-description"
            actions={
                <>
                    <Button
                        onClick={handleClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        fullWidth={false}
                        disabled={isSaving}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        onClick={handleAddBank}
                        variant="contained"
                        size="small"
                        className="save-button"
                        fullWidth={false}
                        disabled={!selectedBank || isSaving}
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
            <Autocomplete
                key={isOpen ? "modal-open" : "modal-closed"}
                value={selectedBank}
                onChange={handleBankSelection}
                options={filteredAvailableBanks}
                loading={isLoadingBanksOptions}
                noOptionsText={t("messages.no_options", {
                    ns: "common",
                })}
                getOptionLabel={(option: BankOption) => {
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
                size="small"
                dir={isRTL ? "rtl" : "ltr"}
                {...(isRTL && {
                    "data-hebrew": true,
                    "data-rtl": true,
                })}
                fullWidth
                selectOnFocus
                clearOnBlur={false}
                handleHomeEndKeys
                sx={{
                    "& .MuiAutocomplete-inputRoot": {
                        direction: isRTL ? "rtl" : "ltr",
                        "& .MuiAutocomplete-input": {
                            textAlign: isRTL ? "right !important" : "left",
                            direction: isRTL ? "rtl !important" : "ltr",
                        },
                        "& input": {
                            textAlign: isRTL ? "right !important" : "left",
                            direction: isRTL ? "rtl !important" : "ltr",
                        },
                    },
                    "& .MuiAutocomplete-endAdornment": {
                        right: isRTL ? "auto" : "9px",
                        left: isRTL ? "9px" : "auto",
                    },
                    ...(isRTL && {
                        "& .MuiAutocomplete-noOptions": {
                            direction: "rtl",
                            textAlign: "right",
                        },
                    }),
                }}
                renderOption={(props, option) => {
                    const { key, ...otherProps } = props;
                    const parts = [
                        option.bank_name,
                        option.branch_name || option.branch_number,
                        option.account_number,
                    ].filter(Boolean);
                    const displayText =
                        parts.join(" · ") || t("fields.unknown", { ns: "common" });

                    return (
                        <li
                            key={key}
                            {...otherProps}
                            style={{
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                                display: "flex",
                                alignItems: "center",
                                minHeight: "48px",
                                paddingRight: isRTL ? "16px" : "14px",
                                paddingLeft: isRTL ? "14px" : "16px",
                            }}
                        >
                            <Typography
                                sx={{
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                    width: "100%",
                                }}
                            >
                                {displayText}
                            </Typography>
                        </li>
                    );
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={t("fields.bank_name", { ns: "bank_accounts" })}
                        variant="outlined"
                        required
                        error={!selectedBank}
                        dir={isRTL ? "rtl" : "ltr"}
                        {...(isRTL && { "data-hebrew": true })}
                        sx={textFieldSx}
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: params.InputProps.endAdornment,
                        }}
                    />
                )}
            />
        </AppDialog>
    );
};

export default AddBankToCustomerModal;

