"use client";

import {
    Autocomplete,
    CircularProgress,
    SxProps,
    TextField,
    Theme,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { searchCustomers } from "@/shared/services/customerService";

interface CustomerNumberAutocompleteProps {
    value: string;
    onChange: (customerNumber: string) => void;
    error?: string;
    disabled?: boolean;
    label?: string;
    size?: "small" | "medium";
    sx?: SxProps<Theme>;
    /** Customer numbers to omit from search results (case-insensitive). */
    excludeCustomerNumbers?: string[];
}

interface CustomerOption {
    id: number;
    name: string;
    customer_number: string | null;
    type: "Person" | "Company";
}

function formatCustomerOption(customer: {
    id: number;
    name?: string;
    customer_number?: string | null;
    type?: "Person" | "Company";
}): CustomerOption {
    const name =
        customer.name ||
        customer.customer_number ||
        `Customer ${customer.id}`;
    return {
        id: customer.id,
        name,
        customer_number: customer.customer_number ?? null,
        type: customer.type ?? "Person",
    };
}

function getCustomerDisplayLabel(option: CustomerOption): string {
    const name = option.name || `Customer ${option.id}`;
    return option.customer_number
        ? `${name} - ${option.customer_number}`
        : name;
}

const CustomerNumberAutocomplete: React.FC<CustomerNumberAutocompleteProps> = ({
    value,
    onChange,
    error,
    disabled = false,
    label,
    size = "small",
    sx,
    excludeCustomerNumbers = [],
}) => {
    const { i18n } = useTranslation(["customers", "common"]);
    const theme = useTheme();
    const [searchTerm, setSearchTerm] = useState("");
    const [options, setOptions] = useState<CustomerOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOption, setSelectedOption] =
        useState<CustomerOption | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const hasLoadedInitialOptions = useRef(false);
    const lastResolvedValueRef = useRef<string | null>(null);

    const isHebrew = i18n.language === "he";

    const excludedCustomerNumbers = useMemo(() => {
        const excluded = new Set<string>();
        for (const customerNumber of excludeCustomerNumbers) {
            const trimmed = customerNumber.trim().toLowerCase();
            if (trimmed) {
                excluded.add(trimmed);
            }
        }
        return excluded;
    }, [excludeCustomerNumbers]);

    const filterExcludedOptions = useCallback(
        (options: CustomerOption[]) =>
            options.filter((option) => {
                const customerNumber = option.customer_number?.trim().toLowerCase();
                return !customerNumber || !excludedCustomerNumbers.has(customerNumber);
            }),
        [excludedCustomerNumbers]
    );

    const handleSearch = useCallback(async (term: string) => {
        try {
            setLoading(true);
            const customers = await searchCustomers(term);
            const formattedOptions = filterExcludedOptions(
                customers
                    .map((customer) => formatCustomerOption(customer))
                    .filter((option) => option.name)
            );
            setOptions(formattedOptions);
            return formattedOptions;
        } catch {
            setOptions([]);
            return [];
        } finally {
            setLoading(false);
        }
    }, [filterExcludedOptions]);

    const loadSelectedCustomer = useCallback(
        async (customerNumber: string) => {
            try {
                setLoading(true);
                const customers = await searchCustomers(customerNumber.trim());
                const match = customers.find(
                    (customer) =>
                        customer.customer_number?.trim().toLowerCase() ===
                        customerNumber.trim().toLowerCase()
                );
                if (match) {
                    setSelectedOption(formatCustomerOption(match));
                } else {
                    setSelectedOption(null);
                }
            } catch {
                setSelectedOption(null);
            } finally {
                setLoading(false);
            }
        },
        []
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
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            setSelectedOption(null);
            lastResolvedValueRef.current = null;
            return;
        }

        if (
            selectedOption?.customer_number?.trim().toLowerCase() ===
            trimmedValue.toLowerCase()
        ) {
            lastResolvedValueRef.current = trimmedValue;
            return;
        }

        if (lastResolvedValueRef.current === trimmedValue) {
            return;
        }

        let cancelled = false;
        void (async () => {
            await loadSelectedCustomer(trimmedValue);
            if (!cancelled) {
                lastResolvedValueRef.current = trimmedValue;
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [value, selectedOption?.customer_number, loadSelectedCustomer]);

    return (
        <Autocomplete
            fullWidth
            options={options}
            value={selectedOption}
            open={isOpen}
            onOpen={() => {
                setIsOpen(true);
            }}
            onClose={() => {
                setIsOpen(false);
            }}
            onChange={(_, newValue) => {
                setSelectedOption(newValue);
                const customerNumber = newValue?.customer_number?.trim() ?? "";
                lastResolvedValueRef.current = customerNumber || null;
                onChange(customerNumber);
            }}
            onInputChange={(_, newInputValue) => {
                setSearchTerm(newInputValue);
            }}
            getOptionLabel={(option) => {
                if (typeof option === "string") return option;
                return getCustomerDisplayLabel(option);
            }}
            isOptionEqualToValue={(option, currentValue) =>
                option.id === currentValue.id
            }
            loading={loading}
            disabled={disabled}
            filterOptions={(x) => x}
            size={size}
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
                            paddingRight: isHebrew ? "16px" : "14px",
                            paddingLeft: isHebrew ? "14px" : "16px",
                        }}
                    >
                        <Typography
                            sx={{
                                direction: isHebrew ? "rtl" : "ltr",
                                textAlign: isHebrew ? "right" : "left",
                                width: "100%",
                            }}
                        >
                            {getCustomerDisplayLabel(option)}
                        </Typography>
                    </li>
                );
            }}
            sx={{
                "& .MuiAutocomplete-inputRoot": {
                    direction: isHebrew ? "rtl" : "ltr",
                    "& .MuiAutocomplete-input": {
                        textAlign: isHebrew ? "right !important" : "left",
                        direction: isHebrew ? "rtl !important" : "ltr",
                    },
                    "& input": {
                        textAlign: isHebrew ? "right !important" : "left",
                        direction: isHebrew ? "rtl !important" : "ltr",
                    },
                },
                "& .MuiAutocomplete-endAdornment": {
                    right: isHebrew ? "auto" : undefined,
                    left: isHebrew ? theme.spacing(1.5) : "auto",
                },
                ...sx,
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    required
                    error={!!error}
                    helperText={error}
                    size={size}
                    dir={isHebrew ? "rtl" : "ltr"}
                    {...(isHebrew && {
                        "data-hebrew": true,
                        "data-rtl": true,
                    })}
                    InputProps={{
                        ...params.InputProps,
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
                        "& .MuiInputBase-input": {
                            textAlign: isHebrew ? "right" : "left",
                            direction: isHebrew ? "rtl" : "ltr",
                        },
                        "& .MuiInputLabel-root": {
                            textAlign: isHebrew ? "right" : "left",
                            direction: isHebrew ? "rtl" : "ltr",
                        },
                    }}
                />
            )}
            {...(isHebrew && { "data-rtl": true })}
        />
    );
};

export default CustomerNumberAutocomplete;
