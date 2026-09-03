"use client";

import {
    Autocomplete,
    Box,
    CircularProgress,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { Info as InfoIcon } from "@mui/icons-material";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { searchBillingConnectorCustomers } from "@/shared/services/billingConnectorService";

export type BillingCustomerOption = {
    id: number;
    name: string;
    customer_number: string;
    type: string;
};

interface BillingCustomerAutocompleteProps {
    accountId: number;
    value: number | null;
    onChange: (value: number | null, option: BillingCustomerOption | null) => void;
    error?: string | null;
    disabled?: boolean;
    label?: string;
    helperTooltip?: string;
    isHebrew?: boolean;
}

function formatOptionLabel(option: BillingCustomerOption): string {
    const name = option.name || `Customer ${option.id}`;
    return option.customer_number
        ? `${name} - ${option.customer_number}`
        : name;
}

const BillingCustomerAutocomplete: React.FC<BillingCustomerAutocompleteProps> = ({
    accountId,
    value,
    onChange,
    error,
    disabled = false,
    label = "Customer",
    helperTooltip,
    isHebrew = false,
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [options, setOptions] = useState<BillingCustomerOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOption, setSelectedOption] =
        useState<BillingCustomerOption | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const hasLoadedInitialOptions = useRef(false);

    const handleSearch = useCallback(
        async (term: string) => {
            try {
                setLoading(true);
                const customers = await searchBillingConnectorCustomers(
                    accountId,
                    term
                );
                const formatted = customers
                    .map((customer) => ({
                        id: customer.id,
                        name:
                            customer.name ||
                            customer.customer_number ||
                            `Customer ${customer.id}`,
                        customer_number: customer.customer_number,
                        type: customer.type,
                    }))
                    .filter((option) => option.name);
                setOptions(formatted);
                return formatted;
            } catch {
                setOptions([]);
                return [];
            } finally {
                setLoading(false);
            }
        },
        [accountId]
    );

    const loadSelectedCustomer = useCallback(
        async (customerId: number) => {
            try {
                setLoading(true);
                const customers = await searchBillingConnectorCustomers(
                    accountId,
                    String(customerId)
                );
                const match =
                    customers.find((customer) => customer.id === customerId) ??
                    null;
                if (match) {
                    setSelectedOption({
                        id: match.id,
                        name:
                            match.name ||
                            match.customer_number ||
                            `Customer ${match.id}`,
                        customer_number: match.customer_number,
                        type: match.type,
                    });
                }
            } catch {
                // Keep prior selection if lookup fails.
            } finally {
                setLoading(false);
            }
        },
        [accountId]
    );

    useEffect(() => {
        if (
            isOpen &&
            !hasLoadedInitialOptions.current &&
            !loading &&
            searchTerm.trim().length === 0
        ) {
            hasLoadedInitialOptions.current = true;
            void handleSearch("");
        }
        if (!isOpen) {
            hasLoadedInitialOptions.current = false;
        }
    }, [isOpen, loading, searchTerm, handleSearch]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length >= 2) {
                void handleSearch(searchTerm.trim());
            } else if (searchTerm.trim().length === 0 && isOpen) {
                void handleSearch("");
            } else if (searchTerm.trim().length === 0 && !isOpen) {
                setOptions([]);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
        };
    }, [searchTerm, isOpen, handleSearch]);

    useEffect(() => {
        if (value && (!selectedOption || selectedOption.id !== value)) {
            void loadSelectedCustomer(value);
        } else if (!value) {
            setSelectedOption(null);
        }
    }, [value, selectedOption, loadSelectedCustomer]);

    return (
        <Box
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                width: 420,
                minWidth: 360,
            }}
        >
            <Autocomplete
                options={options}
                value={selectedOption}
                open={isOpen}
                onOpen={() => setIsOpen(true)}
                onClose={() => setIsOpen(false)}
                onChange={(_, newValue) => {
                    setSelectedOption(newValue);
                    onChange(newValue?.id ?? null, newValue);
                }}
                onInputChange={(_, newInputValue) => {
                    setSearchTerm(newInputValue);
                }}
                getOptionLabel={(option) => {
                    if (typeof option === "string") {
                        return option;
                    }
                    return formatOptionLabel(option);
                }}
                isOptionEqualToValue={(option, current) =>
                    option.id === current.id
                }
                loading={loading}
                disabled={disabled}
                filterOptions={(x) => x}
                size="small"
                dir={isHebrew ? "rtl" : "ltr"}
                {...(isHebrew && { "data-hebrew": true, "data-rtl": true })}
                renderOption={(props, option) => {
                    const { key, ...otherProps } = props;
                    return (
                        <li
                            key={key}
                            {...otherProps}
                            style={{
                                direction: isHebrew ? "rtl" : "ltr",
                                textAlign: isHebrew ? "right" : "left",
                                display: "flex",
                                alignItems: "center",
                                minHeight: "48px",
                                padding: "8px 16px",
                            }}
                        >
                            <Typography
                                sx={{
                                    direction: isHebrew ? "rtl" : "ltr",
                                    textAlign: isHebrew ? "right" : "left",
                                    width: "100%",
                                }}
                            >
                                {formatOptionLabel(option)}
                            </Typography>
                        </li>
                    );
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label}
                        error={Boolean(error)}
                        helperText={error ?? undefined}
                        size="small"
                        dir={isHebrew ? "rtl" : "ltr"}
                        {...(isHebrew && {
                            "data-hebrew": true,
                            "data-rtl": true,
                        })}
                        InputLabelProps={{
                            ...params.InputLabelProps,
                            shrink: true,
                        }}
                        InputProps={{
                            ...params.InputProps,
                            className: [
                                "input-toolbar-labeled",
                                params.InputProps.className,
                            ]
                                .filter(Boolean)
                                .join(" "),
                            endAdornment: (
                                <>
                                    {loading ? (
                                        <CircularProgress
                                            color="inherit"
                                            size={20}
                                        />
                                    ) : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        }}
                        sx={{
                            mb: 0,
                            "& .MuiFormHelperText-root": {
                                position: "absolute",
                                top: "100%",
                                mx: 0,
                            },
                        }}
                    />
                )}
                sx={{
                    flex: 1,
                    minWidth: 0,
                    direction: isHebrew ? "rtl" : "ltr",
                }}
            />
            {helperTooltip ? (
                <Tooltip
                    title={helperTooltip}
                    arrow
                    enterDelay={300}
                    leaveDelay={100}
                    placement="bottom"
                    PopperProps={{
                        sx: {
                            "& .MuiTooltip-tooltip": {
                                direction: isHebrew ? "rtl" : "ltr",
                            },
                        },
                    }}
                >
                    <InfoIcon
                        fontSize="small"
                        color="action"
                        sx={{ cursor: "help", flexShrink: 0 }}
                    />
                </Tooltip>
            ) : null}
        </Box>
    );
};

export default BillingCustomerAutocomplete;
