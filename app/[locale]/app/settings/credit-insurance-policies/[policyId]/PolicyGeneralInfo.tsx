"use client";

import InfoIcon from "@mui/icons-material/Info";
import {
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    TextField,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import moment from "moment";
import { Session } from "next-auth";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CreditInsuranceReadonlyField } from "@/app/[locale]/app/customers/[customerId]/CustomerGeneralInfo";
import { CurrencySelect } from "@/components/LocationSelects";
import { shouldNotifyPolicyEligibleForActivation } from "@/shared/creditInsurance/insurancePolicyLifecycle";
import { getDatePickerFormat } from "@/utils/datetimeOperations";

export type PolicyGeneralInfoPolicyData = {
    insurer_name?: string | null;
    policy_kind?: "Primary" | "TopUp" | null;
    cost_calculation_method?: "ActualSales" | "Limit" | null;
    cost_percent?: string | number | null;
    ParentInsurancePolicy?: { policy_number: string } | null;
};

export type ParentPolicySelectOption = {
    id: number;
    policy_number: string;
    insurer_name?: string | null;
    disabled?: boolean;
};

export interface PolicyGeneralInfoProps {
    data: PolicyGeneralInfoPolicyData;
    isEditing: boolean;
    canEdit: boolean;
    isSaving: boolean;
    policyFormDisabled: boolean;
    policyFormErrors: Record<string, string>;
    session: Session | null;
    datePickerAdapterLocale: string;
    modalTextFieldProps: Record<string, unknown>;
    modalTextFieldSx: Record<string, unknown>;
    menuItemSx: Record<string, unknown>;
    insurerNameInput: string;
    setInsurerNameInput: (value: string) => void;
    costCalculationMethodInput: "" | "ActualSales" | "Limit";
    setCostCalculationMethodInput: (value: "" | "ActualSales" | "Limit") => void;
    costPercentInput: string;
    setCostPercentInput: (value: string) => void;
    policyKindInput: "Primary" | "TopUp";
    setPolicyKindInput: (value: "Primary" | "TopUp") => void;
    parentInsurancePolicyIdInput: number | null;
    setParentInsurancePolicyIdInput: (value: number | null) => void;
    parentPolicySelectOptions: ParentPolicySelectOption[];
    policyNumberInput: string;
    setPolicyNumberInput: (value: string) => void;
    statusValue: "Active" | "Inactive" | "Draft";
    handleStatusChange: (event: SelectChangeEvent<string>) => void;
    canSelectActiveStatus: boolean;
    showAutoActivateOnTermStart: boolean;
    autoActivateOnTermStart: boolean;
    setAutoActivateOnTermStart: (value: boolean) => void;
    startDateInput: string;
    setStartDateInput: (value: string) => void;
    endDateInput: string;
    setEndDateInput: (value: string) => void;
    currencyValue: string;
    handleCurrencyChange: (value: string) => void;
    maxTotalCoverInput: string;
    setMaxTotalCoverInput: (value: string) => void;
    minCreditScoreInput: string;
    setMinCreditScoreInput: (value: string) => void;
    scoreValidityMonthsInput: string;
    setScoreValidityMonthsInput: (value: string) => void;
    maxTotalDclSdlCoverInput: string;
    setMaxTotalDclSdlCoverInput: (value: string) => void;
    maxDclInput: string;
    setMaxDclInput: (value: string) => void;
    dclCustomerSinceMonthsInput: string;
    setDclCustomerSinceMonthsInput: (value: string) => void;
    maxPaymentTermInput: string;
    setMaxPaymentTermInput: (value: string) => void;
    paymentTermCutoffDayOfMonthInput: string;
    setPaymentTermCutoffDayOfMonthInput: (value: string) => void;
    paymentTermSubstituteDayOfMonthInput: string;
    setPaymentTermSubstituteDayOfMonthInput: (value: string) => void;
    maxAllowedMepInput: string;
    setMaxAllowedMepInput: (value: string) => void;
    mepCutoffDayOfMonthInput: string;
    setMepCutoffDayOfMonthInput: (value: string) => void;
    mepSubstituteDayOfMonthInput: string;
    setMepSubstituteDayOfMonthInput: (value: string) => void;
    reportingDaysInput: string;
    setReportingDaysInput: (value: string) => void;
    reportingCutoffDayOfMonthInput: string;
    setReportingCutoffDayOfMonthInput: (value: string) => void;
    reportingSubstituteDayOfMonthInput: string;
    setReportingSubstituteDayOfMonthInput: (value: string) => void;
    displayStartDate: string;
    displayEndDate: string;
    clearPolicyFormError: (key: string) => void;
    sanitizeDecimalInput: (value: string) => string;
    sanitizeIntegerInput: (value: string) => string;
    decimalToInputString: (value: unknown) => string;
    onEditClick: () => void;
    onCancelEdit: () => void;
    onSave: () => void;
    onEligibleForActivationToast: () => void;
    tCi: (key: string, options?: Record<string, unknown>) => string;
    tCommon: (key: string) => string;
}

const PolicyGeneralInfo: React.FC<PolicyGeneralInfoProps> = (props) => {
    const {
        data,
        isEditing,
        canEdit,
        isSaving,
        policyFormDisabled,
        policyFormErrors,
        session,
        datePickerAdapterLocale,
        modalTextFieldProps,
        modalTextFieldSx,
        menuItemSx,
        insurerNameInput,
        setInsurerNameInput,
        costCalculationMethodInput,
        setCostCalculationMethodInput,
        costPercentInput,
        setCostPercentInput,
        policyKindInput,
        setPolicyKindInput,
        parentInsurancePolicyIdInput,
        setParentInsurancePolicyIdInput,
        parentPolicySelectOptions,
        policyNumberInput,
        setPolicyNumberInput,
        statusValue,
        handleStatusChange,
        canSelectActiveStatus,
        showAutoActivateOnTermStart,
        autoActivateOnTermStart,
        setAutoActivateOnTermStart,
        startDateInput,
        setStartDateInput,
        endDateInput,
        setEndDateInput,
        currencyValue,
        handleCurrencyChange,
        maxTotalCoverInput,
        setMaxTotalCoverInput,
        minCreditScoreInput,
        setMinCreditScoreInput,
        scoreValidityMonthsInput,
        setScoreValidityMonthsInput,
        maxTotalDclSdlCoverInput,
        setMaxTotalDclSdlCoverInput,
        maxDclInput,
        setMaxDclInput,
        dclCustomerSinceMonthsInput,
        setDclCustomerSinceMonthsInput,
        maxPaymentTermInput,
        setMaxPaymentTermInput,
        paymentTermCutoffDayOfMonthInput,
        setPaymentTermCutoffDayOfMonthInput,
        paymentTermSubstituteDayOfMonthInput,
        setPaymentTermSubstituteDayOfMonthInput,
        maxAllowedMepInput,
        setMaxAllowedMepInput,
        mepCutoffDayOfMonthInput,
        setMepCutoffDayOfMonthInput,
        mepSubstituteDayOfMonthInput,
        setMepSubstituteDayOfMonthInput,
        reportingDaysInput,
        setReportingDaysInput,
        reportingCutoffDayOfMonthInput,
        setReportingCutoffDayOfMonthInput,
        reportingSubstituteDayOfMonthInput,
        setReportingSubstituteDayOfMonthInput,
        displayStartDate,
        displayEndDate,
        clearPolicyFormError,
        sanitizeDecimalInput,
        sanitizeIntegerInput,
        decimalToInputString,
        onEditClick,
        onCancelEdit,
        onSave,
        onEligibleForActivationToast,
        tCi,
        tCommon,
    } = props;

    const theme = useTheme();
    const { i18n } = useTranslation();
    const isRTL = i18n.language === "he";

    const sectionHeaders = useMemo(() => {
        const base = {
            gridColumn: "1 / -1" as const,
            mb: 0.5,
            mt: 1.5,
            py: 0.5,
            px: 0,
            direction: isRTL ? "rtl" : "ltr",
            textAlign: isRTL ? "right" : "left",
        };
        return {
            first: { ...base, mt: 0.5 },
            standard: base,
            title: {
                color: "#000",
                fontWeight: 700,
                fontSize: "0.8rem",
                textTransform: "uppercase" as const,
                letterSpacing: "0.8px",
                textAlign: "inherit",
                width: "100%",
            },
        };
    }, [isRTL]);

    const creditInsuranceFieldSx = useMemo(
        () => ({
            "& .MuiInputBase-root": {
                minHeight: 40,
            },
            "& .MuiOutlinedInput-root": {
                minHeight: 40,
            },
        }),
        []
    );

    const editFieldSx = useMemo(
        () => ({
            ...(modalTextFieldSx as object),
            ...creditInsuranceFieldSx,
        }),
        [modalTextFieldSx, creditInsuranceFieldSx]
    );

    const gridSx = useMemo(
        () => ({
            display: "grid",
            gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
            },
            gap: 1.5,
            direction: isRTL ? "rtl" : "ltr",
            textAlign: isRTL ? "right" : "left",
        }),
        [isRTL]
    );

    return (
        <Card
            elevation={0}
            sx={{
                border: "none",
                borderRadius: `${theme.appButton.borderRadius}px`,
                boxShadow: "none",
                mb: 2,
            }}
        >
            <Box
                sx={{
                    p: { xs: 1, sm: 1.25 },
                    mb: theme.spacing(1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <InfoIcon
                        sx={{
                            color: "primary.main",
                            fontSize: { xs: 18, sm: 20 },
                        }}
                    />
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 500,
                            fontSize: { xs: "1rem", sm: "1.25rem" },
                        }}
                    >
                        {tCi("credit_insurance.policy_details_title")}
                    </Typography>
                </Box>
                {canEdit ? (
                    !isEditing ? (
                        <Button
                            variant="contained"
                            size="small"
                            onClick={onEditClick}
                            disabled={isSaving}
                        >
                            {tCommon("actions.edit")}
                        </Button>
                    ) : (
                        <Box
                            className="edit-action-button-group"
                            sx={{
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <Button
                                variant="outlined"
                                size="small"
                                className="cancel-button"
                                onClick={onCancelEdit}
                                disabled={policyFormDisabled}
                            >
                                {tCommon("actions.cancel")}
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                onClick={isSaving ? undefined : onSave}
                                className="save-button"
                                disabled={isSaving}
                            >
                                {tCommon("actions.save")}
                            </Button>
                        </Box>
                    )
                ) : null}
            </Box>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, pt: 0 }}>
                    {isEditing ? (
                        <LocalizationProvider
                            dateAdapter={AdapterMoment}
                            adapterLocale={datePickerAdapterLocale}
                        >
                            <Box
                                sx={gridSx}
                            >
                                <Box sx={sectionHeaders.first}>
                                    <Typography
                                        variant="subtitle2"
                                        sx={sectionHeaders.title}
                                    >
                                        {tCi("credit_insurance.sections.general_details")}
                                    </Typography>
                                </Box>
                                <TextField
                                    {...modalTextFieldProps}
                                    label={tCi("credit_insurance.fields.insurer_name")}
                                    value={insurerNameInput}
                                    onChange={(e) => {
                                        setInsurerNameInput(e.target.value);
                                        clearPolicyFormError("insurer_name");
                                    }}
                                    size="small"
                                    fullWidth
                                    error={!!policyFormErrors.insurer_name}
                                    helperText={policyFormErrors.insurer_name}
                                    disabled={policyFormDisabled}
                                    sx={editFieldSx}
                                />
                                {policyKindInput === "Primary" && (
                                    <>
                                        <FormControl
                                            fullWidth
                                            size="small"
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        >
                                            <InputLabel id="cost-calculation-method-select-label">
                                                {tCi("credit_insurance.fields.cost_calculation_method")}
                                            </InputLabel>
                                            <Select
                                                labelId="cost-calculation-method-select-label"
                                                label={tCi(
                                                    "credit_insurance.fields.cost_calculation_method"
                                                )}
                                                value={costCalculationMethodInput}
                                                onChange={(e) => {
                                                    const next = e.target.value as
                                                        | ""
                                                        | "ActualSales"
                                                        | "Limit";
                                                    setCostCalculationMethodInput(next);
                                                    if (!next) {
                                                        setCostPercentInput("");
                                                        clearPolicyFormError("cost_percent");
                                                    }
                                                }}
                                            >
                                                <MenuItem value="" sx={menuItemSx}>
                                                    —
                                                </MenuItem>
                                                <MenuItem value="ActualSales" sx={menuItemSx}>
                                                    {tCi(
                                                        "credit_insurance.fields.cost_calculation_method_actual_sales"
                                                    )}
                                                </MenuItem>
                                                <MenuItem value="Limit" sx={menuItemSx}>
                                                    {tCi(
                                                        "credit_insurance.fields.cost_calculation_method_limit"
                                                    )}
                                                </MenuItem>
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            {...modalTextFieldProps}
                                            label={tCi("credit_insurance.fields.cost_percent")}
                                            value={costPercentInput}
                                            onChange={(e) => {
                                                setCostPercentInput(e.target.value);
                                                clearPolicyFormError("cost_percent");
                                            }}
                                            disabled={!costCalculationMethodInput || policyFormDisabled}
                                            required={Boolean(costCalculationMethodInput)}
                                            inputMode="decimal"
                                            inputProps={{ min: 0, step: "any" }}
                                            size="small"
                                            fullWidth
                                            error={!!policyFormErrors.cost_percent}
                                            helperText={policyFormErrors.cost_percent}
                                            sx={editFieldSx}
                                        />
                                    </>
                                )}
                                <FormControl
                                    fullWidth
                                    size="small"
                                    required
                                    disabled
                                    sx={editFieldSx}
                                >
                                    <InputLabel id="policy-kind-select-label">
                                        {tCi("credit_insurance.fields.policy_kind")}
                                    </InputLabel>
                                    <Select
                                        labelId="policy-kind-select-label"
                                        label={tCi("credit_insurance.fields.policy_kind")}
                                        value={policyKindInput}
                                        disabled
                                        onChange={(e) => {
                                            const nextKind = e.target.value as "Primary" | "TopUp";
                                            setPolicyKindInput(nextKind);
                                            if (nextKind !== "TopUp") {
                                                setParentInsurancePolicyIdInput(null);
                                            }
                                        }}
                                    >
                                        <MenuItem value="Primary" sx={menuItemSx}>
                                            {tCi("credit_insurance.fields.policy_kind_primary")}
                                        </MenuItem>
                                        <MenuItem value="TopUp" sx={menuItemSx}>
                                            {tCi("credit_insurance.fields.policy_kind_top_up")}
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                                {policyKindInput === "TopUp" && (
                                    <FormControl
                                        fullWidth
                                        size="small"
                                        required
                                        disabled={policyFormDisabled}
                                        error={!!policyFormErrors.parent_insurance_policy_id}
                                        sx={editFieldSx}
                                    >
                                        <InputLabel id="parent-policy-select-label">
                                            {tCi("credit_insurance.fields.parent_insurance_policy")}
                                        </InputLabel>
                                        <Select
                                            labelId="parent-policy-select-label"
                                            label={tCi("credit_insurance.fields.parent_insurance_policy")}
                                            value={parentInsurancePolicyIdInput ?? ""}
                                            onChange={(e) => {
                                                setParentInsurancePolicyIdInput(
                                                    e.target.value ? Number(e.target.value) : null
                                                );
                                                clearPolicyFormError("parent_insurance_policy_id");
                                            }}
                                        >
                                            {parentPolicySelectOptions.map((p: any) => (
                                                    <MenuItem
                                                        key={p.id}
                                                        value={p.id}
                                                        disabled={Boolean(p.disabled)}
                                                        sx={menuItemSx}
                                                    >
                                                        {p.policy_number}
                                                        {p.insurer_name ? ` - ${p.insurer_name}` : ""}
                                                    </MenuItem>
                                                ))}
                                        </Select>
                                    </FormControl>
                                )}
                                <TextField
                                    {...modalTextFieldProps}
                                    required
                                    label={tCi("credit_insurance.fields.policy_number")}
                                    value={policyNumberInput}
                                    onChange={(e) => {
                                        setPolicyNumberInput(e.target.value);
                                        clearPolicyFormError("policy_number");
                                    }}
                                    size="small"
                                    fullWidth
                                    error={!!policyFormErrors.policy_number}
                                    helperText={policyFormErrors.policy_number}
                                    disabled={policyFormDisabled}
                                    sx={editFieldSx}
                                />
                                <Box>
                                    <FormControl
                                        fullWidth
                                        size="small"
                                        required
                                        disabled={policyFormDisabled}
                                        sx={editFieldSx}
                                    >
                                        <InputLabel id="policy-status-select-label">
                                            {tCi("credit_insurance.fields.status")}
                                        </InputLabel>
                                        <Select
                                            labelId="policy-status-select-label"
                                            label={tCi("credit_insurance.fields.status")}
                                            value={statusValue}
                                            onChange={handleStatusChange}
                                        >
                                            <MenuItem value="Draft">
                                                {tCi("credit_insurance.status.draft")}
                                            </MenuItem>
                                            <MenuItem value="Active" disabled={!canSelectActiveStatus} sx={menuItemSx}>
                                                {tCi("credit_insurance.status.active")}
                                            </MenuItem>
                                            <MenuItem value="Inactive">
                                                {tCi("credit_insurance.status.inactive")}
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                    {showAutoActivateOnTermStart ? (
                                        <FormControlLabel
                                            sx={{ mt: 0.5 }}
                                            control={
                                                <Checkbox
                                                    checked={autoActivateOnTermStart}
                                                    disabled={policyFormDisabled}
                                                    onChange={(e) =>
                                                        setAutoActivateOnTermStart(
                                                            e.target.checked
                                                        )
                                                    }
                                                />
                                            }
                                            label={tCi(
                                                "credit_insurance.fields.auto_activate_on_term_start",
                                                {
                                                    defaultValue:
                                                        "Automatically activate on start date",
                                                }
                                            )}
                                        />
                                    ) : null}
                                </Box>
                                {policyKindInput !== "TopUp" && (
                                    <>
                                <DatePicker
                                    label={tCi("credit_insurance.fields.start_date")}
                                    value={
                                        startDateInput
                                            ? moment(startDateInput, "YYYY-MM-DD", true)
                                            : null
                                    }
                                    onChange={(newValue) => {
                                        setStartDateInput(
                                            newValue
                                                ? newValue.format("YYYY-MM-DD")
                                                : ""
                                        );
                                        clearPolicyFormError("start_date");
                                    }}
                                    format={getDatePickerFormat(session)}
                                    disabled={policyFormDisabled}
                                    slotProps={{
                                        textField: {
                                            ...modalTextFieldProps,
                                            fullWidth: true,
                                            required: true,
                                            size: "small",
                                            InputLabelProps: { shrink: true },
                                            error: !!policyFormErrors.start_date,
                                            helperText: policyFormErrors.start_date,
                                            sx: editFieldSx,
                                        },
                                    }}
                                />
                                <DatePicker
                                    label={tCi("credit_insurance.fields.end_date")}
                                    value={
                                        endDateInput
                                            ? moment(endDateInput, "YYYY-MM-DD", true)
                                            : null
                                    }
                                    onChange={(newValue) => {
                                        const previousEnd = endDateInput;
                                        const nextEnd = newValue
                                            ? newValue.format("YYYY-MM-DD")
                                            : "";
                                        setEndDateInput(nextEnd);
                                        clearPolicyFormError("end_date");
                                        if (
                                            shouldNotifyPolicyEligibleForActivation({
                                                policyKind: policyKindInput,
                                                previousEndDate: previousEnd,
                                                nextEndDate: nextEnd,
                                                startDate: startDateInput,
                                                status: statusValue,
                                            })
                                        ) {
                                            onEligibleForActivationToast();
                                        }
                                    }}
                                    format={getDatePickerFormat(session)}
                                    disabled={policyFormDisabled}
                                    slotProps={{
                                        textField: {
                                            ...modalTextFieldProps,
                                            fullWidth: true,
                                            required: true,
                                            size: "small",
                                            InputLabelProps: { shrink: true },
                                            error: !!policyFormErrors.end_date,
                                            helperText: policyFormErrors.end_date,
                                            sx: editFieldSx,
                                        },
                                    }}
                                />
                                    </>
                                )}
                                {policyKindInput === "Primary" && (
                                <Box sx={creditInsuranceFieldSx}>
                                <CurrencySelect
                                    value={currencyValue}
                                    onChange={handleCurrencyChange}
                                    label={tCi("credit_insurance.fields.currency")}
                                    error={!!policyFormErrors.currency}
                                    helperText={policyFormErrors.currency}
                                    disabled={policyFormDisabled}
                                />
                                </Box>
                                )}
                                {policyKindInput !== "TopUp" && (
                                    <>
                                        <TextField
                                            {...modalTextFieldProps}
                                            required
                                            label={tCi("credit_insurance.fields.max_total_cover")}
                                            value={maxTotalCoverInput}
                                            onChange={(e) => {
                                                setMaxTotalCoverInput(
                                                    sanitizeDecimalInput(e.target.value)
                                                );
                                                clearPolicyFormError("max_total_cover");
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="decimal"
                                            error={!!policyFormErrors.max_total_cover}
                                            helperText={policyFormErrors.max_total_cover}
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            required
                                            label={tCi("credit_insurance.fields.min_credit_score")}
                                            value={minCreditScoreInput}
                                            onChange={(e) => {
                                                setMinCreditScoreInput(
                                                    sanitizeDecimalInput(e.target.value)
                                                );
                                                clearPolicyFormError("min_credit_score");
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="decimal"
                                            error={!!policyFormErrors.min_credit_score}
                                            helperText={policyFormErrors.min_credit_score}
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            required
                                            label={tCi("credit_insurance.fields.score_validity_period_months")}
                                            value={scoreValidityMonthsInput}
                                            onChange={(e) => {
                                                setScoreValidityMonthsInput(
                                                    sanitizeIntegerInput(e.target.value)
                                                );
                                                clearPolicyFormError("score_validity_period_months");
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={!!policyFormErrors.score_validity_period_months}
                                            helperText={
                                                policyFormErrors.score_validity_period_months
                                            }
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            required
                                            label={tCi(
                                                "credit_insurance.fields.max_total_dcl_sdl_cover"
                                            )}
                                            value={maxTotalDclSdlCoverInput}
                                            onChange={(e) => {
                                                setMaxTotalDclSdlCoverInput(
                                                    sanitizeDecimalInput(e.target.value)
                                                );
                                                clearPolicyFormError("max_total_dcl_sdl_cover");
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="decimal"
                                            error={!!policyFormErrors.max_total_dcl_sdl_cover}
                                            helperText={policyFormErrors.max_total_dcl_sdl_cover}
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            required
                                            label={tCi("credit_insurance.fields.max_dcl")}
                                            value={maxDclInput}
                                            onChange={(e) => {
                                                setMaxDclInput(sanitizeDecimalInput(e.target.value));
                                                clearPolicyFormError("max_dcl");
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="decimal"
                                            error={!!policyFormErrors.max_dcl}
                                            helperText={policyFormErrors.max_dcl}
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            required
                                            label={tCi(
                                                "credit_insurance.fields.dcl_customer_since_months"
                                            )}
                                            value={dclCustomerSinceMonthsInput}
                                            onChange={(e) => {
                                                setDclCustomerSinceMonthsInput(
                                                    sanitizeIntegerInput(e.target.value)
                                                );
                                                clearPolicyFormError("dcl_customer_since_months");
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={!!policyFormErrors.dcl_customer_since_months}
                                            helperText={policyFormErrors.dcl_customer_since_months}
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <Box sx={sectionHeaders.standard}>
                                            <Typography
                                                variant="subtitle2"
                                                sx={sectionHeaders.title}
                                            >
                                                {tCi("credit_insurance.sections.payment_term")}
                                            </Typography>
                                        </Box>
                                        <TextField
                                            {...modalTextFieldProps}
                                            required
                                            label={tCi("credit_insurance.fields.max_payment_term")}
                                            value={maxPaymentTermInput}
                                            onChange={(e) => {
                                                setMaxPaymentTermInput(
                                                    sanitizeIntegerInput(e.target.value)
                                                );
                                                clearPolicyFormError("max_payment_term");
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={!!policyFormErrors.max_payment_term}
                                            helperText={policyFormErrors.max_payment_term}
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            label={tCi(
                                                "credit_insurance.fields.payment_term_cutoff_day_of_month"
                                            )}
                                            value={paymentTermCutoffDayOfMonthInput}
                                            onChange={(e) => {
                                                const nextCutoff = sanitizeIntegerInput(
                                                    e.target.value
                                                );
                                                setPaymentTermCutoffDayOfMonthInput(
                                                    nextCutoff
                                                );
                                                if (!nextCutoff.trim()) {
                                                    setPaymentTermSubstituteDayOfMonthInput("");
                                                    clearPolicyFormError(
                                                        "payment_term_substitute_day_of_month"
                                                    );
                                                }
                                                clearPolicyFormError(
                                                    "payment_term_cutoff_day_of_month"
                                                );
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={
                                                !!policyFormErrors.payment_term_cutoff_day_of_month
                                            }
                                            helperText={
                                                policyFormErrors.payment_term_cutoff_day_of_month
                                            }
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            required={Boolean(
                                                paymentTermCutoffDayOfMonthInput.trim()
                                            )}
                                            label={tCi(
                                                "credit_insurance.fields.payment_term_substitute_day_of_month"
                                            )}
                                            value={paymentTermSubstituteDayOfMonthInput}
                                            onChange={(e) => {
                                                setPaymentTermSubstituteDayOfMonthInput(
                                                    sanitizeIntegerInput(e.target.value)
                                                );
                                                clearPolicyFormError(
                                                    "payment_term_substitute_day_of_month"
                                                );
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={
                                                !!policyFormErrors.payment_term_substitute_day_of_month
                                            }
                                            helperText={
                                                policyFormErrors.payment_term_substitute_day_of_month
                                            }
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <Box sx={sectionHeaders.standard}>
                                            <Typography
                                                variant="subtitle2"
                                                sx={sectionHeaders.title}
                                            >
                                                {tCi("credit_insurance.sections.mep")}
                                            </Typography>
                                        </Box>
                                        <TextField
                                            {...modalTextFieldProps}
                                            required
                                            label={tCi("credit_insurance.fields.max_allowed_mep")}
                                            value={maxAllowedMepInput}
                                            onChange={(e) => {
                                                setMaxAllowedMepInput(
                                                    sanitizeIntegerInput(e.target.value)
                                                );
                                                clearPolicyFormError("max_allowed_mep");
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={!!policyFormErrors.max_allowed_mep}
                                            helperText={policyFormErrors.max_allowed_mep}
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            label={tCi(
                                                "credit_insurance.fields.mep_cutoff_day_of_month"
                                            )}
                                            value={mepCutoffDayOfMonthInput}
                                            onChange={(e) => {
                                                const nextCutoff = sanitizeIntegerInput(
                                                    e.target.value
                                                );
                                                setMepCutoffDayOfMonthInput(nextCutoff);
                                                if (!nextCutoff.trim()) {
                                                    setMepSubstituteDayOfMonthInput("");
                                                    clearPolicyFormError(
                                                        "mep_substitute_day_of_month"
                                                    );
                                                }
                                                clearPolicyFormError(
                                                    "mep_cutoff_day_of_month"
                                                );
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={
                                                !!policyFormErrors.mep_cutoff_day_of_month
                                            }
                                            helperText={
                                                policyFormErrors.mep_cutoff_day_of_month
                                            }
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            required={Boolean(
                                                mepCutoffDayOfMonthInput.trim()
                                            )}
                                            label={tCi(
                                                "credit_insurance.fields.mep_substitute_day_of_month"
                                            )}
                                            value={mepSubstituteDayOfMonthInput}
                                            onChange={(e) => {
                                                setMepSubstituteDayOfMonthInput(
                                                    sanitizeIntegerInput(e.target.value)
                                                );
                                                clearPolicyFormError(
                                                    "mep_substitute_day_of_month"
                                                );
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={
                                                !!policyFormErrors.mep_substitute_day_of_month
                                            }
                                            helperText={
                                                policyFormErrors.mep_substitute_day_of_month
                                            }
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <Box sx={sectionHeaders.standard}>
                                            <Typography
                                                variant="subtitle2"
                                                sx={sectionHeaders.title}
                                            >
                                                {tCi("credit_insurance.sections.reporting")}
                                            </Typography>
                                        </Box>
                                        <TextField
                                            {...modalTextFieldProps}
                                            required
                                            label={tCi("credit_insurance.fields.reporting_days")}
                                            value={reportingDaysInput}
                                            onChange={(e) => {
                                                setReportingDaysInput(
                                                    sanitizeIntegerInput(e.target.value)
                                                );
                                                clearPolicyFormError("reporting_days");
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={!!policyFormErrors.reporting_days}
                                            helperText={policyFormErrors.reporting_days}
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            label={tCi(
                                                "credit_insurance.fields.reporting_cutoff_day_of_month"
                                            )}
                                            value={reportingCutoffDayOfMonthInput}
                                            onChange={(e) => {
                                                const nextCutoff = sanitizeIntegerInput(
                                                    e.target.value
                                                );
                                                setReportingCutoffDayOfMonthInput(
                                                    nextCutoff
                                                );
                                                if (!nextCutoff.trim()) {
                                                    setReportingSubstituteDayOfMonthInput("");
                                                    clearPolicyFormError(
                                                        "reporting_substitute_day_of_month"
                                                    );
                                                }
                                                clearPolicyFormError(
                                                    "reporting_cutoff_day_of_month"
                                                );
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={
                                                !!policyFormErrors.reporting_cutoff_day_of_month
                                            }
                                            helperText={
                                                policyFormErrors.reporting_cutoff_day_of_month
                                            }
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                        <TextField
                                            {...modalTextFieldProps}
                                            required={Boolean(
                                                reportingCutoffDayOfMonthInput.trim()
                                            )}
                                            label={tCi(
                                                "credit_insurance.fields.reporting_substitute_day_of_month"
                                            )}
                                            value={reportingSubstituteDayOfMonthInput}
                                            onChange={(e) => {
                                                setReportingSubstituteDayOfMonthInput(
                                                    sanitizeIntegerInput(e.target.value)
                                                );
                                                clearPolicyFormError(
                                                    "reporting_substitute_day_of_month"
                                                );
                                            }}
                                            size="small"
                                            fullWidth
                                            inputMode="numeric"
                                            error={
                                                !!policyFormErrors.reporting_substitute_day_of_month
                                            }
                                            helperText={
                                                policyFormErrors.reporting_substitute_day_of_month
                                            }
                                            disabled={policyFormDisabled}
                                            sx={editFieldSx}
                                        />
                                    </>
                                )}
                            </Box>
                        </LocalizationProvider>
                    ) : (
                        <Box
                            sx={gridSx}
                        >
                            <Box sx={sectionHeaders.first}>
                                <Typography
                                    variant="subtitle2"
                                    sx={sectionHeaders.title}
                                >
                                    {tCi("credit_insurance.sections.general_details")}
                                </Typography>
                            </Box>
                            <CreditInsuranceReadonlyField
                                label={tCi("credit_insurance.fields.insurer_name")}
                                value={data?.insurer_name}
                            />
                            {data?.policy_kind !== "TopUp" && (
                                <>
                            <CreditInsuranceReadonlyField
                                label={tCi("credit_insurance.fields.cost_calculation_method")}
                                value={
                                    data?.cost_calculation_method === "Limit"
                                        ? tCi(
                                              "credit_insurance.fields.cost_calculation_method_limit"
                                          )
                                        : data?.cost_calculation_method === "ActualSales"
                                          ? tCi(
                                                "credit_insurance.fields.cost_calculation_method_actual_sales"
                                            )
                                          : undefined
                                }
                            />
                            <CreditInsuranceReadonlyField
                                label={tCi("credit_insurance.fields.cost_percent")}
                                value={
                                    data?.cost_percent != null &&
                                    String(data.cost_percent).trim() !== ""
                                        ? `${decimalToInputString(data.cost_percent)}%`
                                        : undefined
                                }
                            />
                                </>
                            )}
                            <CreditInsuranceReadonlyField
                                label={tCi("credit_insurance.fields.policy_kind")}
                                value={
                                    data?.policy_kind === "TopUp"
                                        ? tCi("credit_insurance.fields.policy_kind_top_up")
                                        : tCi("credit_insurance.fields.policy_kind_primary")
                                }
                            />
                            {data?.policy_kind === "TopUp" && (
                                <CreditInsuranceReadonlyField
                                    label={tCi("credit_insurance.fields.parent_insurance_policy")}
                                    value={data?.ParentInsurancePolicy?.policy_number}
                                />
                            )}
                            <CreditInsuranceReadonlyField
                                label={tCi("credit_insurance.fields.policy_number")}
                                value={policyNumberInput}
                            />
                            <CreditInsuranceReadonlyField
                                label={tCi("credit_insurance.fields.status")}
                                value={
                                    statusValue === "Active"
                                        ? tCi("credit_insurance.status.active")
                                        : statusValue === "Inactive"
                                          ? tCi("credit_insurance.status.inactive")
                                          : tCi("credit_insurance.status.draft")
                                }
                            />
                            {data?.policy_kind !== "TopUp" && (
                                <>
                            <CreditInsuranceReadonlyField
                                label={tCi("credit_insurance.fields.start_date")}
                                value={displayStartDate}
                            />
                            <CreditInsuranceReadonlyField
                                label={tCi("credit_insurance.fields.end_date")}
                                value={displayEndDate}
                            />
                                </>
                            )}
                            {data?.policy_kind !== "TopUp" && (
                            <CreditInsuranceReadonlyField
                                label={tCi("credit_insurance.fields.currency")}
                                value={currencyValue}
                            />
                            )}
                            {data?.policy_kind !== "TopUp" && (
                                <>
                                    <CreditInsuranceReadonlyField
                                        label={tCi("credit_insurance.fields.max_total_cover")}
                                        value={maxTotalCoverInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi("credit_insurance.fields.min_credit_score")}
                                        value={minCreditScoreInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi(
                                            "credit_insurance.fields.score_validity_period_months"
                                        )}
                                        value={scoreValidityMonthsInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi(
                                            "credit_insurance.fields.max_total_dcl_sdl_cover"
                                        )}
                                        value={maxTotalDclSdlCoverInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi("credit_insurance.fields.max_dcl")}
                                        value={maxDclInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi(
                                            "credit_insurance.fields.dcl_customer_since_months"
                                        )}
                                        value={dclCustomerSinceMonthsInput}
                                    />
                                    <Box sx={sectionHeaders.standard}>
                                        <Typography
                                            variant="subtitle2"
                                            sx={sectionHeaders.title}
                                        >
                                            {tCi("credit_insurance.sections.payment_term")}
                                        </Typography>
                                    </Box>
                                    <CreditInsuranceReadonlyField
                                        label={tCi("credit_insurance.fields.max_payment_term")}
                                        value={maxPaymentTermInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi(
                                            "credit_insurance.fields.payment_term_cutoff_day_of_month"
                                        )}
                                        value={paymentTermCutoffDayOfMonthInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi(
                                            "credit_insurance.fields.payment_term_substitute_day_of_month"
                                        )}
                                        value={paymentTermSubstituteDayOfMonthInput}
                                    />
                                    <Box sx={sectionHeaders.standard}>
                                        <Typography
                                            variant="subtitle2"
                                            sx={sectionHeaders.title}
                                        >
                                            {tCi("credit_insurance.sections.mep")}
                                        </Typography>
                                    </Box>
                                    <CreditInsuranceReadonlyField
                                        label={tCi("credit_insurance.fields.max_allowed_mep")}
                                        value={maxAllowedMepInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi(
                                            "credit_insurance.fields.mep_cutoff_day_of_month"
                                        )}
                                        value={mepCutoffDayOfMonthInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi(
                                            "credit_insurance.fields.mep_substitute_day_of_month"
                                        )}
                                        value={mepSubstituteDayOfMonthInput}
                                    />
                                    <Box sx={sectionHeaders.standard}>
                                        <Typography
                                            variant="subtitle2"
                                            sx={sectionHeaders.title}
                                        >
                                            {tCi("credit_insurance.sections.reporting")}
                                        </Typography>
                                    </Box>
                                    <CreditInsuranceReadonlyField
                                        label={tCi("credit_insurance.fields.reporting_days")}
                                        value={reportingDaysInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi(
                                            "credit_insurance.fields.reporting_cutoff_day_of_month"
                                        )}
                                        value={reportingCutoffDayOfMonthInput}
                                    />
                                    <CreditInsuranceReadonlyField
                                        label={tCi(
                                            "credit_insurance.fields.reporting_substitute_day_of_month"
                                        )}
                                        value={reportingSubstituteDayOfMonthInput}
                                    />
                                </>
                            )}
                        </Box>
                    )}
            </CardContent>
        </Card>
    );
};

export default PolicyGeneralInfo;
