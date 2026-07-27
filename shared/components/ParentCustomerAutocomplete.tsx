"use client";

import {
    Autocomplete,
    TextField,
    CircularProgress,
    Typography,
} from "@mui/material";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { searchCustomersForParent } from "@/shared/services/customerService";

interface ParentCustomerAutocompleteProps {
    value: number | null;
    onChange: (value: number | null) => void;
    excludeId: number;
    error?: string;
    disabled?: boolean;
    label?: string;
}

interface CustomerOption {
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
}) => {
    const { t, i18n } = useTranslation(["customers", "common"]);
    const [searchTerm, setSearchTerm] = useState("");
    const [options, setOptions] = useState<CustomerOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState<CustomerOption | null>(
        null
    );
    const [isOpen, setIsOpen] = useState(false);
    const hasLoadedInitialOptions = useRef(false);

    // Define handleSearch before useEffects that use it
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

    const loadSelectedCustomer = useCallback(
        async (customerId: number) => {
            try {
                setLoading(true);
                const customers = await searchCustomersForParent("", excludeId);
                const customer = customers.find((c) => c.id === customerId);
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
                }
            } catch {
                // Error handled silently
            } finally {
                setLoading(false);
            }
        },
        [excludeId]
    );

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
                // Load initial options when search is cleared and dropdown is open
                handleSearch("");
            } else if (searchTerm.trim().length === 0 && !isOpen) {
                setOptions([]);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
        };
    }, [searchTerm, isOpen, handleSearch]);

    // Load selected customer when value changes
    useEffect(() => {
        if (value && !selectedOption) {
            loadSelectedCustomer(value);
        } else if (!value) {
            setSelectedOption(null);
        }
    }, [value, selectedOption, loadSelectedCustomer]);

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
            filterOptions={(x) => x} // Disable client-side filtering, we do it server-side
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
