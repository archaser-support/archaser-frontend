"use client";

import {
    Box,
    FormControl,
    FormControlLabel,
    FormGroup,
    Grid,
    InputLabel,
    MenuItem,
    Select as MuiSelect,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { CurrencySelect, LocaleSelect } from "@/components/LocationSelects";

import { AccountDisplayData } from "../types";



interface GeneralInformationProps {
    customer: AccountDisplayData;
    onFieldChange: (key: string, value: any) => void;
    validationErrors?: Record<string, string>;
    REQUIRED_FIELDS?: string[];
    isArchaserAdmin?: boolean;
}

const GeneralInformation: React.FC<GeneralInformationProps> = ({
    customer,
    onFieldChange,
    validationErrors: _validationErrors = {},
    REQUIRED_FIELDS: _REQUIRED_FIELDS = [],
    isArchaserAdmin = false,
}) => {
    const { t } = useTranslation(["accounts", "common"]);

    const StatusOptions = [
        { value: "Active", label: t("values.status_active", { ns: "common" }) },
        { value: "Inactive", label: t("values.status_inactive", { ns: "common" }) },
    ];

    const BalanceEvaluationOptions = [
        { value: "Payment-Based", label: t("values.payment_based", { ns: "accounts" }) },
        { value: "Invoice-Based", label: t("values.invoice_based", { ns: "accounts" }) },
    ];

    return (
        <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        label={t("fields.name", { ns: "accounts" })}
                        value={customer.name || ""}
                        onChange={(e) => onFieldChange("name", e.target.value)}
                        required
                        error={!!_validationErrors.name}
                        helperText={_validationErrors.name}
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
                <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        label={t("fields.company_number", { ns: "accounts" })}
                        value={customer.company_number || ""}
                        onChange={(e) =>
                            onFieldChange("company_number", e.target.value)
                        }
                        required
                        error={!!_validationErrors.company_number}
                        helperText={_validationErrors.company_number}
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
                        <CurrencySelect
                            value={customer.currency || ""}
                            onChange={(value) =>
                                onFieldChange("currency", value)
                            }
                            label={`${t("fields.currency", { ns: "accounts" })} *`}
                        />
                        {_validationErrors.currency && (
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ mt: 0.5, ml: 1.5 }}
                            >
                                {_validationErrors.currency}
                            </Typography>
                        )}
                    </div>
                </Box>
                
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
                        <LocaleSelect
                            value={customer.locale || ""}
                            onChange={(value) => onFieldChange("locale", value)}
                            label={`${t("fields.locale", { ns: "accounts" })} *`}
                        />
                        {_validationErrors.locale && (
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ mt: 0.5, ml: 1.5 }}
                            >
                                {_validationErrors.locale}
                            </Typography>
                        )}
                    </div>
                </Box>
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <FormControl
                        fullWidth
                        size="small"
                        variant="outlined"
                        error={!!_validationErrors.balance_evaluation_method}
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
                            {t("fields.balance_evaluation_method", { ns: "accounts" })}
                        </InputLabel>
                        <MuiSelect
                            value={
                                customer.balance_evaluation_method ||
                                "Invoice-Based"
                            }
                            onChange={(e) =>
                                onFieldChange(
                                    "balance_evaluation_method",
                                    e.target.value
                                )
                            }
                            label={t("fields.balance_evaluation_method", { ns: "accounts" })}
                            variant="outlined"
                        >
                            {BalanceEvaluationOptions.map((option) => (
                                <MenuItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </MenuItem>
                            ))}
                        </MuiSelect>
                        {_validationErrors.balance_evaluation_method && (
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ mt: 0.5, ml: 1.5 }}
                            >
                                {_validationErrors.balance_evaluation_method}
                            </Typography>
                        )}
                    </FormControl>
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        type="number"
                        label={t("fields.promise_to_pay", { ns: "accounts" })}
                        value={customer.promise_to_pay || ""}
                        onChange={(e) =>
                            onFieldChange(
                                "promise_to_pay",
                                parseFloat(e.target.value) || 0
                            )
                        }
                        required
                        error={!!_validationErrors.promise_to_pay}
                        helperText={_validationErrors.promise_to_pay}
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
                        size="small"
                        variant="outlined"
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
                        <InputLabel>{t("fields.status", { ns: "common" })}</InputLabel>
                        <MuiSelect
                            value={customer.status || ""}
                            onChange={(e) =>
                                onFieldChange("status", e.target.value)
                            }
                            label={t("fields.status", { ns: "common" })}
                            variant="outlined"
                        >
                            {StatusOptions.map((option) => (
                                <MenuItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </MenuItem>
                            ))}
                        </MuiSelect>
                    </FormControl>
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        type="number"
                        label={t("fields.max_promise_to_pay_allowed_per_cycle", { ns: "accounts" })}
                        value={
                            customer.max_promise_to_pay_allowed_per_cycle || ""
                        }
                        onChange={(e) =>
                            onFieldChange(
                                "max_promise_to_pay_allowed_per_cycle",
                                parseFloat(e.target.value) || 0
                            )
                        }
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
            <Grid size={{ xs: 12 }}>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 1,
                        px: 1.5,
                        py: 1,
                    }}
                >
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        Products
                    </Typography>
                    <FormGroup row>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={!!customer.has_collection}
                                    onChange={(e) =>
                                        onFieldChange(
                                            "has_collection",
                                            e.target.checked
                                        )
                                    }
                                />
                            }
                            label="Collection"
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={!!customer.has_credit_insurance}
                                    onChange={(e) =>
                                        onFieldChange(
                                            "has_credit_insurance",
                                            e.target.checked
                                        )
                                    }
                                />
                            }
                            label="Credit Insurance"
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={customer.has_file_import !== false}
                                    onChange={(e) =>
                                        onFieldChange(
                                            "has_file_import",
                                            e.target.checked
                                        )
                                    }
                                />
                            }
                            label="File Import"
                        />
                        {isArchaserAdmin ? (
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={
                                            !!customer.enable_customer_checkpoints
                                        }
                                        onChange={(e) =>
                                            onFieldChange(
                                                "enable_customer_checkpoints",
                                                e.target.checked
                                            )
                                        }
                                    />
                                }
                                label="Customer checkpoints"
                            />
                        ) : null}
                    </FormGroup>
                </Box>
            </Grid>
        </Grid>
    );
};

export default GeneralInformation;
