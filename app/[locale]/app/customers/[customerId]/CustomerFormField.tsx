"use client";

import {
    Autocomplete,
    Box,
    MenuItem,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import React, { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
    CountrySelect,
    LanguageSelect,
    StateSelect,
} from "@/components/LocationSelects";
import ParentCustomerAutocomplete from "@/shared/components/ParentCustomerAutocomplete";

export interface CustomerFormData {
    customer_number: string | null;
    crn: string | null;
    phone: string | null;
    email: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    postal_code: string | null;
    country_id: number | null;
    state_id: number | null;
    owner_id: string | null;
    collection_status: "Inactive" | "Active";
    language: string;
    first_activity_delay_days: number | null;
    category_for_new_collection: string | null;
    sequence_container_id: number | null;
    // Name fields for editing
    customer_name: string | null;
    customer_type: "Person" | "Company";
    business_unit_id: number | null;
    parent_customer_id: number | null;
}

interface Country {
    id: number;
    name: string;
    emoji?: string | null;
    iso2?: string | null;
}

interface State {
    id: number;
    name: string;
}

interface User {
    id: string;
    first_name: string;
    last_name: string;
}

interface SequenceContainer {
    id: number;
    name: string;
    is_default?: boolean;
}

interface BusinessUnit {
    id: number;
    name: string;
}

interface CustomerFormFieldProps {
    field: keyof CustomerFormData | (string & {}) | null;
    value: string | null | undefined;
    isEditing: boolean;
    error?: string;
    onChange: (field: keyof CustomerFormData | string, value: unknown) => void;
    countries?: Country[];
    states?: State[];
    activeUsers?: User[];
    sequenceContainers?: SequenceContainer[];
    businessUnits?: BusinessUnit[];
    activePolicies?: { id: number; policy_number: string }[];
    t: (key: string, options?: Record<string, unknown>) => string;
    editedCustomer?: {
        id?: number;
        country_id?: number | null;
        ParentCustomer?: {
            id: number;
            type: "Person" | "Company";
            Person?: {
                first_name?: string | null;
                last_name?: string | null;
                full_name?: string | null;
            } | null;
            Company?: {
                name?: string | null;
            } | null;
            customer_number?: string | null;
        } | null;
    } | null;
    label?: string;
    icon?: React.ReactNode;
}

const CustomerFormField = memo<CustomerFormFieldProps>(
    ({
        field,
        value,
        isEditing,
        error,
        onChange,
        countries = [],
        states = [],
        activeUsers = [],
        sequenceContainers = [],
        businessUnits = [],
        activePolicies = [],
        editedCustomer,
        label,
        icon,
    }) => {
        const { t: tHook, i18n } = useTranslation(["customers", "common"]);
        const theme = useTheme();
        const isHebrew = i18n.language === "he";

        // RTL helper props
        const rtlProps = useMemo(
            () => ({
                dir: isHebrew ? "rtl" : ("ltr" as const),
                ...(isHebrew && { "data-hebrew": true, "data-rtl": true }),
            }),
            [isHebrew]
        );

        // Helper function to get country emoji
        const getCountryEmoji = useCallback(
            (country: Country | undefined): string => {
                if (!country) return "🏳️";
                if (country.emoji) return country.emoji;
                if (country.iso2) {
                    try {
                        const codePoints = country.iso2
                            .toUpperCase()
                            .split("")
                            .map((char) => 127397 + char.charCodeAt(0));
                        return String.fromCodePoint(...codePoints);
                    } catch {
                        return "🏳️";
                    }
                }
                return "🏳️";
            },
            []
        );

        // Helper function to get language flag emoji
        const getLanguageFlag = useCallback((language: string): string => {
            switch (language.toLowerCase()) {
                case "english":
                    return "🇺🇸";
                case "hebrew":
                    return "🇮🇱";
                case "german":
                    return "🇩🇪";
                case "spanish":
                    return "🇪🇸";
                case "french":
                    return "🇫🇷";
                case "italian":
                    return "🇮🇹";
                case "portuguese":
                    return "🇵🇹";
                default:
                    return "🌐";
            }
        }, []);

        // Move all useMemo hooks to top level to comply with Rules of Hooks
        const categoryOptions = useMemo(
            () => [
                {
                    value: "Automated",
                    label: tHook("values.category_automated"),
                },
                { value: "Agent", label: tHook("values.category_agent") },
                { value: "Legal", label: tHook("values.category_legal") },
            ],
            [tHook]
        );

        const selectedContainer = useMemo(
            () =>
                sequenceContainers.find(
                    (container) => container.id === Number(value)
                ) || null,
            [sequenceContainers, value]
        );

        const selectedBusinessUnit = useMemo(
            () => businessUnits.find((bu) => bu.id === Number(value)) || null,
            [businessUnits, value]
        );

        // Get translated value for specific fields
        const getTranslatedValue = useCallback(
            (field: string, value: string | null) => {
                if (!value) return "-";

                switch (field) {
                    case "language":
                        return tHook(
                            `common.languages.${value.toLowerCase()}`,
                            value
                        );
                    case "category_for_new_collection": {
                        const translationKey = `values.category_${value.toLowerCase()}`;
                        const translationResult = tHook(translationKey, value);
                        return translationResult;
                    }
                    case "country_id": {
                        const country = countries.find(
                            (c) => c.id === Number(value)
                        );
                        return country?.name || value || "-";
                    }
                    case "state_id": {
                        const state = states.find(
                            (s) => s.id === Number(value)
                        );
                        return state?.name || value || "-";
                    }
                    case "owner_id": {
                        if (!value) return "-";
                        const owner = activeUsers.find((u) => u.id === value);
                        return owner
                            ? `${owner.first_name} ${owner.last_name}`
                            : "-";
                    }
                    case "sequence_container_id": {
                        if (!value) {
                            return tHook("values.not_selected", {
                                ns: "customers",
                            });
                        }
                        const container = sequenceContainers.find(
                            (sc) => sc.id === Number(value)
                        );
                        return (
                            container?.name ||
                            tHook("values.not_selected", { ns: "customers" })
                        );
                    }
                    case "business_unit_id": {
                        if (!value) return "-";
                        const businessUnit = businessUnits.find(
                            (bu) => bu.id === Number(value)
                        );
                        return businessUnit?.name || "-";
                    }
                    case "parent_customer_id": {
                        if (!value) return "-";
                        const parentCustomer = editedCustomer?.ParentCustomer;
                        if (parentCustomer) {
                            if (parentCustomer.type === "Person") {
                                const firstName =
                                    parentCustomer.Person?.first_name || "";
                                const lastName =
                                    parentCustomer.Person?.last_name || "";
                                const fullName =
                                    parentCustomer.Person?.full_name;
                                const name =
                                    fullName ||
                                    `${firstName} ${lastName}`.trim() ||
                                    "";
                                return (
                                    name ||
                                    parentCustomer.customer_number ||
                                    "-"
                                );
                            } else {
                                return (
                                    parentCustomer.Company?.name ||
                                    parentCustomer.customer_number ||
                                    "-"
                                );
                            }
                        }
                        return value || "-";
                    }
                    case "policy_id": {
                        const ec = editedCustomer as {
                            InsurancePolicy?: { policy_number?: string };
                        } | null;
                        if (ec?.InsurancePolicy?.policy_number) {
                            return ec.InsurancePolicy.policy_number;
                        }
                        if (!value) {
                            return "-";
                        }
                        const pol = activePolicies.find(
                            (p) => p.id === Number(value)
                        );
                        return pol?.policy_number || String(value);
                    }
                    default:
                        return value;
                }
            },
            [
                countries,
                states,
                activeUsers,
                sequenceContainers,
                businessUnits,
                editedCustomer,
                activePolicies,
                tHook,
            ]
        );

        if (!isEditing || !field) {
            return (
                <Box>
                    {label && (
                        <Box
                            sx={{
                                mb: 0.5,
                                direction: isHebrew ? "rtl" : "ltr",
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    fontSize: theme.typography.caption.fontSize,
                                    fontWeight: 500,
                                    color: "text.secondary",
                                    direction: isHebrew ? "rtl" : "ltr",
                                    textAlign: isHebrew ? "right" : "left",
                                }}
                            >
                                {label}
                            </Typography>
                        </Box>
                    )}
                    <Typography
                        component="div"
                        sx={{
                            fontWeight: 400,
                            color: value ? "text.primary" : "text.secondary",
                            minHeight: "40px",
                            display: "flex",
                            alignItems: "center",
                            direction: isHebrew ? "rtl" : "ltr",
                            textAlign: isHebrew ? "right" : "left",
                        }}
                    >
                        {field === "language" && value ? (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    direction: isHebrew ? "rtl" : "ltr",
                                }}
                            >
                                <Box
                                    component="span"
                                    sx={{
                                        fontSize: "1.2rem",
                                        lineHeight: 1,
                                        display: "inline-block",
                                        width: "1.2rem",
                                        height: "1.2rem",
                                        textAlign: "center",
                                    }}
                                >
                                    {getLanguageFlag(value)}
                                </Box>
                                <Box component="span">
                                    {getTranslatedValue(
                                        field || "",
                                        value || ""
                                    )}
                                </Box>
                            </Box>
                        ) : field === "country_id" && value ? (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    direction: isHebrew ? "rtl" : "ltr",
                                    flexDirection: isHebrew
                                        ? "row-reverse"
                                        : "row",
                                }}
                            >
                                <Box component="span">
                                    {getTranslatedValue(
                                        field || "",
                                        value || ""
                                    )}
                                </Box>
                                <Box
                                    component="span"
                                    sx={{
                                        fontSize: "1.2rem",
                                        lineHeight: 1,
                                        display: "inline-block",
                                        width: "1.2rem",
                                        height: "1.2rem",
                                        textAlign: "center",
                                    }}
                                >
                                    {getCountryEmoji(
                                        countries.find((c) => c.id === Number(value))
                                    )}
                                </Box>
                            </Box>
                        ) : (
                            getTranslatedValue(field || "", value || "")
                        )}
                    </Typography>
                </Box>
            );
        }

        switch (field) {
            case "country_id":
                return (
                    <CountrySelect
                        value={
                            (countries.find((c) => c.id === Number(value)) ||
                                null) as any
                        }
                        onChange={(country) =>
                            onChange(field, country?.id || null)
                        }
                        label={label}
                        disabled={false}
                        error={!!error}
                        helperText={error}
                        required={true}
                    />
                );

            case "state_id": {
                // Check if the selected country is US or Canada
                // Use the current country_id value from editedCustomer
                const currentCountryId = editedCustomer?.country_id;

                // Only check country if countries array is loaded
                const selectedCountry =
                    countries.length > 0
                        ? countries.find((c) => c.id === currentCountryId)
                        : null;

                const isUSOrCanada =
                    countries.length > 0 &&
                    (selectedCountry?.name === "United States" ||
                        selectedCountry?.name === "Canada");

                return (
                    <StateSelect
                        countryId={currentCountryId || undefined}
                        value={
                            (isUSOrCanada
                                ? states.find((s) => s.id === Number(value)) ||
                                null
                                : null) as any
                        }
                        onChange={(state) => onChange(field, state?.id || null)}
                        label={label}
                        disabled={!isUSOrCanada}
                        error={!!error}
                        helperText={error}
                    />
                );
            }

            case "owner_id":
                return (
                    <TextField
                        select
                        fullWidth
                        label={label}
                        value={value || ""}
                        onChange={(e) =>
                            onChange(field, e.target.value || null)
                        }
                        error={!!error}
                        helperText={error}
                        {...rtlProps}
                        sx={{
                            "& .MuiInputBase-root": {
                                height: "40px",
                                minHeight: "40px",
                            },
                            "& .MuiOutlinedInput-root": {
                                height: "40px",
                                minHeight: "40px",
                            },
                        }}
                    >
                        {activeUsers.map((user: User) => (
                            <MenuItem
                                key={user.id}
                                value={user.id}
                                sx={{
                                    direction: isHebrew ? "rtl" : "ltr",
                                    textAlign: isHebrew ? "right" : "left",
                                    minHeight: "48px",
                                    padding: "8px 16px",
                                }}
                            >
                                {user.first_name} {user.last_name}
                            </MenuItem>
                        ))}
                    </TextField>
                );

            case "policy_id": {
                const selectedPolicy =
                    activePolicies.find(
                        (p) => p.id === Number(value)
                    ) || null;
                return (
                    <Autocomplete
                        options={activePolicies}
                        getOptionLabel={(o) => o.policy_number}
                        value={selectedPolicy}
                        onChange={(_, newVal) =>
                            onChange("policy_id", newVal?.id ?? null)
                        }
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={label}
                                error={!!error}
                                helperText={error}
                                sx={{
                                    "& .MuiInputBase-root": {
                                        minHeight: 40,
                                    },
                                    "& .MuiOutlinedInput-root": {
                                        minHeight: 40,
                                    },
                                }}
                            />
                        )}
                    />
                );
            }

            case "language":
                return (
                    <LanguageSelect
                        value={value || ""}
                        onChange={(language) => onChange(field, language)}
                        label={label}
                        disabled={false}
                    />
                );

            case "first_activity_delay_days":
                return (
                    <TextField
                        fullWidth
                        label={label}
                        type="number"
                        value={value || ""}
                        onChange={(e) =>
                            onChange(
                                field,
                                e.target.value ? parseInt(e.target.value) : null
                            )
                        }
                        error={!!error}
                        helperText={error}
                        required
                        inputProps={{ min: 0, step: 1 }}
                        {...(isHebrew && { "data-hebrew": true })}
                    />
                );

            case "category_for_new_collection": {
                const selectedCategory =
                    categoryOptions.find(
                        (option) => option.value === (value || "Automated")
                    ) || categoryOptions[0];

                return (
                    <Autocomplete
                        options={categoryOptions}
                        getOptionLabel={(option) => option.label}
                        value={selectedCategory}
                        onChange={(_, newValue) => {
                            onChange(field, newValue?.value || "Automated");
                        }}
                        {...rtlProps}
                        renderOption={(props, option) => {
                            const { key, ...otherProps } = props;
                            return (
                                <Box
                                    component="li"
                                    key={key}
                                    {...otherProps}
                                    sx={{
                                        direction: isHebrew ? "rtl" : "ltr",
                                        textAlign: isHebrew ? "right" : "left",
                                        display: "flex",
                                        alignItems: "center",
                                        minHeight: theme.spacing(6),
                                        padding: theme.spacing(1, 2),
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            direction: isHebrew ? "rtl" : "ltr",
                                            textAlign: isHebrew
                                                ? "right"
                                                : "left",
                                        }}
                                    >
                                        {option.label}
                                    </Typography>
                                </Box>
                            );
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={label}
                                error={!!error}
                                helperText={error}
                                required
                                {...rtlProps}
                                sx={{
                                    "& .MuiInputBase-root": {
                                        height: "40px",
                                        minHeight: "40px",
                                    },
                                }}
                            />
                        )}
                    />
                );
            }

            case "customer_name":
                return (
                    <TextField
                        fullWidth
                        label={label}
                        value={value || ""}
                        onChange={(e) => onChange(field, e.target.value)}
                        error={!!error}
                        helperText={error}
                        required
                        {...(isHebrew && { "data-hebrew": true })}
                    />
                );

            case "phone":
                return (
                    <TextField
                        fullWidth
                        label={label}
                        value={value || ""}
                        onChange={(e) => onChange(field, e.target.value)}
                        error={!!error}
                        helperText={error}
                        {...(isHebrew && { "data-hebrew": true })}
                    />
                );

            case "crn":
                return (
                    <TextField
                        fullWidth
                        label={label}
                        value={value || ""}
                        onChange={(e) => onChange(field, e.target.value)}
                        error={!!error}
                        helperText={error}
                        {...(isHebrew && { "data-hebrew": true })}
                    />
                );

            case "address_line1":
            case "address_line2":
            case "city":
            case "postal_code":
                return (
                    <TextField
                        fullWidth
                        label={label}
                        value={value || ""}
                        onChange={(e) => onChange(field, e.target.value)}
                        error={!!error}
                        helperText={error}
                        {...(isHebrew && { "data-hebrew": true })}
                    />
                );

            case "sequence_container_id": {
                return (
                    <Autocomplete
                        options={sequenceContainers}
                        getOptionLabel={(option: SequenceContainer) => {
                            const defaultText = option.is_default
                                ? ` (${tHook("fields.default", { ns: "common" })})`
                                : "";
                            return `${option.name}${defaultText}`;
                        }}
                        value={selectedContainer}
                        onChange={(_, newValue) => {
                            onChange(field, newValue?.id || null);
                        }}
                        {...rtlProps}
                        renderOption={(props, option: SequenceContainer) => {
                            const { key, ...otherProps } = props;
                            return (
                                <Box
                                    component="li"
                                    key={key}
                                    {...otherProps}
                                    sx={{
                                        direction: isHebrew ? "rtl" : "ltr",
                                        textAlign: isHebrew ? "right" : "left",
                                        display: "flex",
                                        alignItems: "center",
                                        minHeight: theme.spacing(6),
                                        padding: theme.spacing(1, 2),
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            direction: isHebrew ? "rtl" : "ltr",
                                            textAlign: isHebrew
                                                ? "right"
                                                : "left",
                                        }}
                                    >
                                        {option.name}
                                        {option.is_default && (
                                            <Box
                                                component="span"
                                                sx={{
                                                    ml: theme.spacing(1),
                                                    fontSize: "0.8em",
                                                    color: theme.palette.text.secondary,
                                                }}
                                            >
                                                (
                                                {tHook("fields.default", {
                                                    ns: "common",
                                                })}
                                                )
                                            </Box>
                                        )}
                                    </Typography>
                                </Box>
                            );
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={label}
                                error={!!error}
                                helperText={error}
                                required
                                {...rtlProps}
                                sx={{
                                    "& .MuiInputBase-root": {
                                        height: "40px",
                                        minHeight: "40px",
                                    },
                                }}
                            />
                        )}
                    />
                );
            }

            case "business_unit_id": {
                return (
                    <Autocomplete<BusinessUnit>
                        options={businessUnits || []}
                        getOptionLabel={(option) => option.name || ""}
                        value={selectedBusinessUnit}
                        onChange={(_, newValue) =>
                            onChange(field, newValue?.id || null)
                        }
                        {...rtlProps}
                        renderOption={(props, option: BusinessUnit) => {
                            const { key, ...otherProps } = props;
                            return (
                                <Box
                                    component="li"
                                    key={key}
                                    {...otherProps}
                                    sx={{
                                        direction: isHebrew ? "rtl" : "ltr",
                                        textAlign: isHebrew ? "right" : "left",
                                        display: "flex",
                                        alignItems: "center",
                                        minHeight: theme.spacing(6),
                                        padding: theme.spacing(1, 2),
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            direction: isHebrew ? "rtl" : "ltr",
                                            textAlign: isHebrew
                                                ? "right"
                                                : "left",
                                        }}
                                    >
                                        {option.name || ""}
                                    </Typography>
                                </Box>
                            );
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={label}
                                error={!!error}
                                helperText={error}
                                dir={isHebrew ? "rtl" : "ltr"}
                                {...(isHebrew && {
                                    "data-hebrew": true,
                                    "data-rtl": true,
                                })}
                                sx={{
                                    "& .MuiInputBase-root": {
                                        height: "40px",
                                        minHeight: "40px",
                                    },
                                }}
                            />
                        )}
                        disabled={false}
                    />
                );
            }

            case "parent_customer_id":
                return (
                    <ParentCustomerAutocomplete
                        value={value ? Number(value) : null}
                        onChange={(newValue) => onChange(field, newValue)}
                        excludeId={editedCustomer?.id || 0}
                        error={error}
                        disabled={!isEditing}
                        label={label}
                    />
                );

            default:
                return (
                    <TextField
                        fullWidth
                        label={label}
                        value={value || ""}
                        onChange={(e) => onChange(field, e.target.value)}
                        error={!!error}
                        helperText={error}
                        required
                        {...(isHebrew && { "data-hebrew": true })}
                    />
                );
        }
    }
);

CustomerFormField.displayName = "CustomerFormField";

export default CustomerFormField;
