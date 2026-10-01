"use client";

import {
    Autocomplete,
    TextField,
    CircularProgress,
    Typography,
} from "@mui/material";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
    fetchCustomerForParentSelect,
    searchCustomersForParent,
} from "@/shared/services/customerService";

interface ParentCustomerAutocompleteProps {
    value: number | null;
    onChange: (value: number | null) => void;
    excludeId: number;
    error?: string;
    disabled?: boolean;
    label?: string;
    /** Seed from GET customer ParentCustomer so edit shows the current parent. */
    initialOption?: CustomerOption | null;
}

export interface CustomerOption {
    id: number;
    name: string;
    customer_number: string | null;
    type: "Person" | "Company";
}

const ParentCustomerAutocomplete: React.FC<ParentCustomerAutocompleteProps> = ({
    value,
    onChange,
    excludeId,
    error,
    disabled = false,
    label,
    initialOption = null,
}) => {
    const { t, i18n } = useTranslation(["customers", "common"]);
    const [searchTerm, setSearchTerm] = useState("");
    const [options, setOptions] = useState<CustomerOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState<CustomerOption | null>(
        () =>
            initialOption && value != null && initialOption.id === value
                ? initialOption
                : null
    );
    const [isOpen, setIsOpen] = useState(false);
    const hasLoadedInitialOptions = useRef(false);
    const loadRequestId = useRef(0);

    const handleSearch = useCallback(
        async (term: string) => {
            try {
                setLoading(true);
                const customers = await searchCustomersForParent(
                    term,
                    excludeId
                );
                const formattedOptions: CustomerOption[] = customers
                    .map((customer) => {
                        const name =
                            customer.name ||
                            customer.customer_number ||
                            `Customer ${customer.id}`;
                        return {
                            id: customer.id,
                            name,
                            customer_number: customer.customer_number,
                            type: customer.type,
                        };
                    })
                    .filter((option) => option.name);
                setOptions(formattedOptions);
            } catch {
                setOptions([]);
            } finally {
                setLoading(false);
            }
        },
        [excludeId]
    );

    const loadSelectedCustomer = useCallback(async (customerId: number) => {
        const requestId = ++loadRequestId.current;
        try {
            setLoading(true);
            const customer = await fetchCustomerForParentSelect(customerId);
            if (requestId !== loadRequestId.current) {
                return;
            }
            if (customer) {
                const name =
                    customer.name ||
                    customer.customer_number ||
                    `Customer ${customer.id}`;
                setSelectedOption({
                    id: customer.id,
                    name,
                    customer_number: customer.customer_number,
                    type: customer.type,
                });
            } else {
                setSelectedOption(null);
            }
        } catch {
            if (requestId === loadRequestId.current) {
                setSelectedOption(null);
            }
        } finally {
            if (requestId === loadRequestId.current) {
                setLoading(false);
            }
        }
    }, []);

    // Load initial options when dropdown opens
    useEffect(() => {
        if (
            isOpen &&
            !hasLoadedInitialOptions.current &&
            !loading &&
            searchTerm.trim().length === 0
        ) {
            hasLoadedInitialOptions.current = true;
            handleSearch("");
        }
        if (!isOpen) {
            hasLoadedInitialOptions.current = false;
        }
    }, [isOpen, loading, searchTerm, handleSearch]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length >= 2) {
                handleSearch(searchTerm.trim());
            } else if (searchTerm.trim().length === 0 && isOpen) {
                handleSearch("");
            } else if (searchTerm.trim().length === 0 && !isOpen) {
                setOptions([]);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
        };
    }, [searchTerm, isOpen, handleSearch]);

    // Hydrate selected parent when value changes (by id, not blank search page)
    useEffect(() => {
        if (!value) {
            setSelectedOption(null);
            return;
        }
        if (selectedOption?.id === value) {
            return;
        }
        if (initialOption?.id === value) {
            setSelectedOption(initialOption);
            return;
        }
        void loadSelectedCustomer(value);
    }, [value, selectedOption?.id, initialOption, loadSelectedCustomer]);

    const displayLabel =
        label || t("fields.parent_customer", { ns: "customers" });

    const isHebrew = i18n.language === "he";

    return (
        <Autocomplete
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
                onChange(newValue?.id || null);
            }}
            onInputChange={(_, newInputValue) => {
                setSearchTerm(newInputValue);
            }}
            getOptionLabel={(option) => {
                if (typeof option === "string") return option;
                const name = option.name || `Customer ${option.id}`;
                return option.customer_number
                    ? `${name} - ${option.customer_number}`
                    : name;
            }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={loading}
            disabled={disabled}
            filterOptions={(x) => x}
            dir={isHebrew ? "rtl" : "ltr"}
            {...(isHebrew && { "data-hebrew": true, "data-rtl": true })}
            renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                const displayText = option.customer_number
                    ? `${option.name} - ${option.customer_number}`
                    : option.name;

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
                            {displayText}
                        </Typography>
                    </li>
                );
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={displayLabel}
                    error={!!error}
                    helperText={error}
                    dir={isHebrew ? "rtl" : "ltr"}
                    {...(isHebrew && { "data-hebrew": true, "data-rtl": true })}
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
                        "& .MuiInputBase-root": {
                            height: "40px",
                            minHeight: "40px",
                        },
                    }}
                />
            )}
            sx={{
                direction: isHebrew ? "rtl" : "ltr",
            }}
        />
    );
};

export default ParentCustomerAutocomplete;
