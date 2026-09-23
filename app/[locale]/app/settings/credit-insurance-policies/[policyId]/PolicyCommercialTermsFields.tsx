"use client";

import {
    Box,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from "@mui/material";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CreditInsuranceReadonlyField } from "@/app/[locale]/app/customers/[customerId]/CustomerGeneralInfo";
import { MonthEndFieldLabelWithTooltip } from "@/shared/creditInsurance/MonthEndFieldLabelWithTooltip";
import {
    type CommercialTermsFormInputs,
    type InsurancePolicyProductType,
    INSURANCE_POLICY_PRODUCT_TYPES,
} from "@/shared/creditInsurance/policyCommercialTerms";

export type PolicyCommercialTermsFieldsProps = {
    isEditing: boolean;
    disabled?: boolean;
    values: CommercialTermsFormInputs;
    errors: Record<string, string>;
    onChange: <K extends keyof CommercialTermsFormInputs>(
        field: K,
        value: CommercialTermsFormInputs[K]
    ) => void;
    clearError: (field: string) => void;
    modalTextFieldProps?: Record<string, unknown>;
    textFieldSx?: Record<string, unknown>;
    menuItemSx?: Record<string, unknown>;
    /** When true, omit the section title (e.g. modal already has a section header). */
    hideSectionTitle?: boolean;
    /** Dense 3-col grid matching policy detail; modal uses 2-col via false. */
    denseDetailGrid?: boolean;
    tCi: (key: string, options?: Record<string, unknown>) => string;
    sanitizeDecimalInput?: (value: string) => string;
    sanitizeIntegerInput?: (value: string) => string;
    decimalToInputString?: (value: unknown) => string;
};

export function PolicyCommercialTermsFields({
    isEditing,
    disabled = false,
    values,
    errors,
    onChange,
    clearError,
    modalTextFieldProps = {},
    textFieldSx = {},
    menuItemSx = {},
    hideSectionTitle = false,
    denseDetailGrid = true,
    tCi,
    sanitizeDecimalInput = (v) => v,
    sanitizeIntegerInput = (v) => v,
    decimalToInputString = (v) =>
        v === null || v === undefined || v === "" ? "" : String(v),
}: PolicyCommercialTermsFieldsProps): React.ReactElement {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === "he";

    const fieldLabel = (fieldKey: string) => (
        <MonthEndFieldLabelWithTooltip
            label={tCi(`credit_insurance.fields.${fieldKey}`)}
            tooltip={tCi(`credit_insurance.tooltips.${fieldKey}`)}
            isRtl={isRTL}
        />
    );

    const productTypeLabel = (value: InsurancePolicyProductType | "" | null) => {
        if (value === "TailorMade") {
            return tCi("credit_insurance.fields.product_type_tailor_made");
        }
        if (value === "Commodity") {
            return tCi("credit_insurance.fields.product_type_commodity");
        }
        return undefined;
    };

    const formatPercentDisplay = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return undefined;
        return `${decimalToInputString(trimmed)}%`;
    };

    const formatMoneyDisplay = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return undefined;
        return decimalToInputString(trimmed);
    };

    const gridSx = useMemo(
        () => ({
            display: "grid",
            gridTemplateColumns: denseDetailGrid
                ? {
                      xs: "1fr",
                      sm: "repeat(2, 1fr)",
                      md: "repeat(3, 1fr)",
                  }
                : {
                      xs: "1fr",
                      sm: "repeat(2, 1fr)",
                  },
            gap: denseDetailGrid ? 1.5 : 2,
            direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            textAlign: isRTL ? ("right" as const) : ("left" as const),
        }),
        [denseDetailGrid, isRTL]
    );

    const sectionTitleSx = useMemo(
        () => ({
            gridColumn: "1 / -1" as const,
            mb: 0.5,
            mt: 0.5,
            py: 0.5,
            px: 0,
            direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            textAlign: isRTL ? ("right" as const) : ("left" as const),
        }),
        [isRTL]
    );

    if (!isEditing) {
        return (
            <Box sx={gridSx}>
                {!hideSectionTitle ? (
                    <Box sx={sectionTitleSx}>
                        <Typography
                            variant="subtitle2"
                            sx={{
                                color: "#000",
                                fontWeight: 700,
                                fontSize: "0.8rem",
                                textTransform: "uppercase",
                                letterSpacing: "0.8px",
                                textAlign: "inherit",
                                width: "100%",
                            }}
                        >
                            {tCi("credit_insurance.sections.commercial_terms")}
                        </Typography>
                    </Box>
                ) : null}
                <CreditInsuranceReadonlyField
                    label={fieldLabel("insured_percentage")}
                    value={formatPercentDisplay(values.insured_percentage)}
                />
                <CreditInsuranceReadonlyField
                    label={fieldLabel("non_qualifying_loss_threshold")}
                    value={formatMoneyDisplay(
                        values.non_qualifying_loss_threshold
                    )}
                />
                <CreditInsuranceReadonlyField
                    label={fieldLabel("minimum_premium")}
                    value={formatMoneyDisplay(values.minimum_premium)}
                />
                <CreditInsuranceReadonlyField
                    label={fieldLabel("minimum_premium_period_years")}
                    value={
                        values.minimum_premium_period_years.trim()
                            ? values.minimum_premium_period_years.trim()
                            : undefined
                    }
                />
                <CreditInsuranceReadonlyField
                    label={fieldLabel("aggregate_excess")}
                    value={formatMoneyDisplay(values.aggregate_excess)}
                />
                <CreditInsuranceReadonlyField
                    label={fieldLabel("sdl_excess")}
                    value={formatMoneyDisplay(values.sdl_excess)}
                />
                <CreditInsuranceReadonlyField
                    label={fieldLabel("ncb_zero_claims_bonus_percent")}
                    value={formatPercentDisplay(
                        values.ncb_zero_claims_bonus_percent
                    )}
                />
                <CreditInsuranceReadonlyField
                    label={fieldLabel("ncb_claims_ratio_threshold_percent")}
                    value={formatPercentDisplay(
                        values.ncb_claims_ratio_threshold_percent
                    )}
                />
                <CreditInsuranceReadonlyField
                    label={fieldLabel("ncb_up_to_threshold_bonus_percent")}
                    value={formatPercentDisplay(
                        values.ncb_up_to_threshold_bonus_percent
                    )}
                />
                <CreditInsuranceReadonlyField
                    label={fieldLabel("product_type")}
                    value={productTypeLabel(values.product_type)}
                />
            </Box>
        );
    }

    return (
        <Box sx={gridSx}>
            {!hideSectionTitle ? (
                <Box sx={sectionTitleSx}>
                    <Typography
                        variant="subtitle2"
                        sx={{
                            color: "#000",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.8px",
                            textAlign: "inherit",
                            width: "100%",
                        }}
                    >
                        {tCi("credit_insurance.sections.commercial_terms")}
                    </Typography>
                </Box>
            ) : null}
            <TextField
                {...modalTextFieldProps}
                label={fieldLabel("insured_percentage")}
                value={values.insured_percentage}
                onChange={(e) => {
                    onChange(
                        "insured_percentage",
                        sanitizeDecimalInput(e.target.value)
                    );
                    clearError("insured_percentage");
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                error={!!errors.insured_percentage}
                helperText={errors.insured_percentage}
                disabled={disabled}
                sx={textFieldSx}
            />
            <TextField
                {...modalTextFieldProps}
                label={fieldLabel("non_qualifying_loss_threshold")}
                value={values.non_qualifying_loss_threshold}
                onChange={(e) => {
                    onChange(
                        "non_qualifying_loss_threshold",
                        sanitizeDecimalInput(e.target.value)
                    );
                    clearError("non_qualifying_loss_threshold");
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                error={!!errors.non_qualifying_loss_threshold}
                helperText={errors.non_qualifying_loss_threshold}
                disabled={disabled}
                sx={textFieldSx}
            />
            <TextField
                {...modalTextFieldProps}
                label={fieldLabel("minimum_premium")}
                value={values.minimum_premium}
                onChange={(e) => {
                    onChange(
                        "minimum_premium",
                        sanitizeDecimalInput(e.target.value)
                    );
                    clearError("minimum_premium");
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                error={!!errors.minimum_premium}
                helperText={errors.minimum_premium}
                disabled={disabled}
                sx={textFieldSx}
            />
            <TextField
                {...modalTextFieldProps}
                label={fieldLabel("minimum_premium_period_years")}
                value={values.minimum_premium_period_years}
                onChange={(e) => {
                    onChange(
                        "minimum_premium_period_years",
                        sanitizeIntegerInput(e.target.value)
                    );
                    clearError("minimum_premium_period_years");
                }}
                size="small"
                fullWidth
                inputMode="numeric"
                error={!!errors.minimum_premium_period_years}
                helperText={errors.minimum_premium_period_years}
                disabled={disabled}
                sx={textFieldSx}
            />
            <TextField
                {...modalTextFieldProps}
                label={fieldLabel("aggregate_excess")}
                value={values.aggregate_excess}
                onChange={(e) => {
                    onChange(
                        "aggregate_excess",
                        sanitizeDecimalInput(e.target.value)
                    );
                    clearError("aggregate_excess");
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                error={!!errors.aggregate_excess}
                helperText={errors.aggregate_excess}
                disabled={disabled}
                sx={textFieldSx}
            />
            <TextField
                {...modalTextFieldProps}
                label={fieldLabel("sdl_excess")}
                value={values.sdl_excess}
                onChange={(e) => {
                    onChange("sdl_excess", sanitizeDecimalInput(e.target.value));
                    clearError("sdl_excess");
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                error={!!errors.sdl_excess}
                helperText={errors.sdl_excess}
                disabled={disabled}
                sx={textFieldSx}
            />
            <TextField
                {...modalTextFieldProps}
                label={fieldLabel("ncb_zero_claims_bonus_percent")}
                value={values.ncb_zero_claims_bonus_percent}
                onChange={(e) => {
                    onChange(
                        "ncb_zero_claims_bonus_percent",
                        sanitizeDecimalInput(e.target.value)
                    );
                    clearError("ncb_zero_claims_bonus_percent");
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                error={!!errors.ncb_zero_claims_bonus_percent}
                helperText={errors.ncb_zero_claims_bonus_percent}
                disabled={disabled}
                sx={textFieldSx}
            />
            <TextField
                {...modalTextFieldProps}
                label={fieldLabel("ncb_claims_ratio_threshold_percent")}
                value={values.ncb_claims_ratio_threshold_percent}
                onChange={(e) => {
                    onChange(
                        "ncb_claims_ratio_threshold_percent",
                        sanitizeDecimalInput(e.target.value)
                    );
                    clearError("ncb_claims_ratio_threshold_percent");
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                error={!!errors.ncb_claims_ratio_threshold_percent}
                helperText={errors.ncb_claims_ratio_threshold_percent}
                disabled={disabled}
                sx={textFieldSx}
            />
            <TextField
                {...modalTextFieldProps}
                label={fieldLabel("ncb_up_to_threshold_bonus_percent")}
                value={values.ncb_up_to_threshold_bonus_percent}
                onChange={(e) => {
                    onChange(
                        "ncb_up_to_threshold_bonus_percent",
                        sanitizeDecimalInput(e.target.value)
                    );
                    clearError("ncb_up_to_threshold_bonus_percent");
                }}
                size="small"
                fullWidth
                inputMode="decimal"
                error={!!errors.ncb_up_to_threshold_bonus_percent}
                helperText={errors.ncb_up_to_threshold_bonus_percent}
                disabled={disabled}
                sx={textFieldSx}
            />
            <FormControl
                fullWidth
                size="small"
                disabled={disabled}
                error={!!errors.product_type}
                sx={textFieldSx}
            >
                <InputLabel id="commercial-product-type-label">
                    {fieldLabel("product_type")}
                </InputLabel>
                <Select
                    labelId="commercial-product-type-label"
                    label={fieldLabel("product_type")}
                    value={values.product_type}
                    onChange={(e) => {
                        const next = e.target.value as
                            | ""
                            | InsurancePolicyProductType;
                        onChange("product_type", next);
                        clearError("product_type");
                    }}
                >
                    <MenuItem value="" sx={menuItemSx}>
                        —
                    </MenuItem>
                    {INSURANCE_POLICY_PRODUCT_TYPES.map((opt) => (
                        <MenuItem key={opt} value={opt} sx={menuItemSx}>
                            {productTypeLabel(opt)}
                        </MenuItem>
                    ))}
                </Select>
                {errors.product_type ? (
                    <FormHelperText>{errors.product_type}</FormHelperText>
                ) : null}
            </FormControl>
        </Box>
    );
}
