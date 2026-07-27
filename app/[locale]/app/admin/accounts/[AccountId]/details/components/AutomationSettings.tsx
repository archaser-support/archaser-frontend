"use client";

import {
    Autocomplete,
    Box,
    FormControl,
    FormHelperText,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { LanguageSelect } from "@/components/LocationSelects";

import { AccountDisplayData, AccountFormData } from "../types";

interface AutomationSettingsProps {
    customer: AccountDisplayData;
    onFieldChange: (key: string, value: any) => void;
    validationErrors?: Record<string, string>;
}

const AutomationSettings: React.FC<AutomationSettingsProps> = ({
    customer,
    onFieldChange,
    validationErrors = {},
}) => {
    const { t, i18n } = useTranslation(["accounts", "common"]);

    const categoryAfterAutomatedOptions = [
        {
            value: "Agent",
            label: t("values.automation_agent", { ns: "accounts" }),
        },
        {
            value: "Legal",
            label: t("values.automation_legal", { ns: "accounts" }),
        },
    ];

    const categoryForNewCollectionOptions = [
        {
            value: "Automated",
            label: t("values.automation_automated", { ns: "accounts" }),
        },
        {
            value: "Agent",
            label: t("values.automation_agent", { ns: "accounts" }),
        },
        {
            value: "Legal",
            label: t("values.automation_legal", { ns: "accounts" }),
        },
    ];

    const customerLanguageOptions = [
        {
            value: "account_default",
            label: t("values.customer_language_account_default", {
                ns: "accounts",
            }),
        },
        {
            value: "country",
            label: t("values.customer_language_country", { ns: "accounts" }),
        },
    ];

    const handleNumberChange = (field: string, value: string) => {
        onFieldChange(field, parseFloat(value) || 0);
    };

    const handleTextChange = (field: string, value: string) => {
        onFieldChange(field, value);
    };

    const handleBooleanChange = (field: string, value: boolean) => {
        onFieldChange(field, value);
    };

    return (
        <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        type="number"
                        label={t("fields.default_first_activity_delay_days", {
                            ns: "accounts",
                        })}
                        value={customer.default_first_activity_delay_days || ""}
                        onChange={(e) =>
                            onFieldChange(
                                "default_first_activity_delay_days",
                                e.target.value ? parseInt(e.target.value) : null
                            )
                        }
                        size="small"
                        required
                        error={
                            !!validationErrors?.default_first_activity_delay_days
                        }
                        helperText={
                            validationErrors?.default_first_activity_delay_days
                        }
                        inputProps={{ min: 0, step: 1 }}
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
                            },
                        }}
                    />
                
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
                <FormControl
                        fullWidth
                        variant="outlined"
                        size="small"
                        error={!!validationErrors.category_after_automated}
                        sx={{
                            padding: 0,
                            margin: 0,
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
                            },
                        }}
                    >
                        <InputLabel>
                            {t("fields.category_after_automated", {
                                ns: "accounts",
                            })}{" "}
                            *
                        </InputLabel>
                        <Select
                            value={
                                categoryAfterAutomatedOptions.some(
                                    (opt) =>
                                        opt.value ===
                                        customer.category_after_automated
                                )
                                    ? customer.category_after_automated
                                    : ""
                            }
                            label={`${t("fields.category_after_automated", { ns: "accounts" })} *`}
                            onChange={(e) =>
                                handleTextChange(
                                    "category_after_automated",
                                    e.target.value || ""
                                )
                            }
                        >
                            {categoryAfterAutomatedOptions.map((option) => (
                                <MenuItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText
                            error={!!validationErrors.category_after_automated}
                        >
                            {validationErrors.category_after_automated || " "}
                        </FormHelperText>
                    </FormControl>
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <FormControl
                        fullWidth
                        variant="outlined"
                        size="small"
                        error={!!validationErrors.category_for_new_collection}
                        sx={{
                            padding: 0,
                            margin: 0,
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
                            },
                        }}
                    >
                        <InputLabel>
                            {t("fields.category_for_new_collection", {
                                ns: "accounts",
                            })}{" "}
                            *
                        </InputLabel>
                        <Select
                            value={
                                categoryForNewCollectionOptions.some(
                                    (opt) =>
                                        opt.value ===
                                        customer.category_for_new_collection
                                )
                                    ? customer.category_for_new_collection
                                    : "Automated"
                            }
                            label={`${t("fields.category_for_new_collection", { ns: "accounts" })} *`}
                            onChange={(e) =>
                                handleTextChange(
                                    "category_for_new_collection",
                                    e.target.value || ""
                                )
                            }
                        >
                            {categoryForNewCollectionOptions.map((option) => (
                                <MenuItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                        {validationErrors.category_for_new_collection && (
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ mt: 0.5, ml: 1.5 }}
                            >
                                {validationErrors.category_for_new_collection}
                            </Typography>
                        )}
                    </FormControl>
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <Box
                    sx={{
                        position: "relative",
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
                        },
                    }}
                >
                    <div style={{ flex: 1 }}>
                        <LanguageSelect
                            value={customer.default_language || ""}
                            onChange={(value) =>
                                handleTextChange(
                                    "default_language",
                                    value || ""
                                )
                            }
                            label={`${t("fields.default_language", { ns: "accounts" })} *`}
                        />
                        {validationErrors.default_language && (
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ mt: 0.5, ml: 1.5 }}
                            >
                                {validationErrors.default_language}
                            </Typography>
                        )}
                    </div>
                </Box>
            </Grid>

            {/* Customer Language Upon Creation */}
            <Grid size={{ xs: 12, md: 3 }}>
                <Autocomplete
                        value={
                            (customer as AccountFormData)
                                .use_customer_language === false ||
                                (customer as AccountFormData)
                                    .use_customer_language === null
                                ? customerLanguageOptions[0] // "Account Default Language"
                                : customerLanguageOptions[1] // "Customer Country Language"
                        }
                        onChange={(_, newValue) => {
                            if (newValue) {
                                // Map dropdown values to boolean
                                const useCustomerLanguage =
                                    newValue.value === "country";
                                handleBooleanChange(
                                    "use_customer_language",
                                    useCustomerLanguage
                                );
                            }
                        }}
                        options={customerLanguageOptions}
                        getOptionLabel={(option) => option.label}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={t(
                                    "fields.customer_language_upon_creation",
                                    { ns: "accounts" }
                                )}
                                variant="outlined"
                                size="small"
                                fullWidth
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
                                    },
                                }}
                            />
                        )}
                        disableClearable
                    />
                
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        type="number"
                        label={t("fields.wait_days_after_automated", {
                            ns: "accounts",
                        })}
                        value={customer.wait_days_after_automated ?? ""}
                        onChange={(e) =>
                            onFieldChange(
                                "wait_days_after_automated",
                                e.target.value
                                    ? parseInt(e.target.value, 10)
                                    : null
                            )
                        }
                        size="small"
                        required
                        error={!!validationErrors?.wait_days_after_automated}
                        helperText={validationErrors?.wait_days_after_automated}
                        inputProps={{ min: 0, step: 1 }}
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
                            },
                        }}
                    />
                
            </Grid>
        </Grid>
    );
};

export default AutomationSettings;
