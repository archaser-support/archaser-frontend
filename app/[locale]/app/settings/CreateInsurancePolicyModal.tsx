"use client";

import { AttachMoney as AttachMoneyIcon } from "@mui/icons-material";
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    MenuItem,
    Switch,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api";
import { isAxiosError } from "axios";
import moment from "moment";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    canSetInsurancePolicyStatusActive,
    isInsurancePolicyBeforeStartDate,
    shouldNotifyPolicyEligibleForActivation,
} from "@/shared/creditInsurance/insurancePolicyLifecycle";
import { filterTopUpParentPolicyOptions } from "@/shared/creditInsurance/topUpParentPolicy";
import {
    type MonthEndCutoffValidationErrorCode,
    validateMonthEndCutoffFormFields,
} from "@/shared/creditInsurance/monthEndCutoffFields";
import { getDatePickerFormat } from "@/utils/datetimeOperations";
import { CurrencySelect } from "@/components/LocationSelects";

const SCROLL_ID = "insurance-policy-modal-scroll";

function dateToDateInputValue(d: unknown): string {
    if (d === null || d === undefined || d === "") return "";
    const x =
        typeof d === "string"
            ? new Date(d)
            : d instanceof Date
              ? d
              : new Date(String(d));
    if (Number.isNaN(x.getTime())) return "";
    return x.toISOString().slice(0, 10);
}

function decimalToInputString(v: unknown): string {
    if (v === null || v === undefined || v === "") return "";
    return String(v);
}

function parseOptionalDecimal(value: string): number | null {
    const t = value.trim();
    if (!t) return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : null;
}

function parseOptionalInt(value: string): number | null {
    const t = value.trim();
    if (!t) return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
}

export interface CreateInsurancePolicyModalProps {
    open: boolean;
    onClose: () => void;
    accountId: number;
    /** When set, modal loads the policy and saves via PUT. */
    policyId?: number | null;
    /** Called after successful create/update (not used when `onCreated` handles create). */
    onSaved?: () => void;
    /** After successful create; use to navigate to the new policy details page. */
    onCreated?: (policyId: number) => void;
}

export function CreateInsurancePolicyModal({
    open,
    onClose,
    accountId,
    policyId = null,
    onSaved,
    onCreated,
}: CreateInsurancePolicyModalProps) {
    const { t, i18n } = useTranslation(["settings", "common"]);
    const tCi = useCallback(
        (key: string, options?: Record<string, unknown>) =>
            t(key, { ns: "settings", ...options }),
        [t]
    );
    const { data: session } = useSession();
    const theme = useTheme();
    const isRTL = i18n.language === "he";
    const datePickerAdapterLocale = useMemo(
        () => (session?.user?.language === "Hebrew" ? "he" : "en-gb"),
        [session?.user?.language]
    );
    const qc = useQueryClient();
    const { error: toastError, info: toastInfo } = useToast();

    const [policyNumber, setPolicyNumber] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [currency, setCurrency] = useState("");
    const [status, setStatus] = useState<"Active" | "Inactive" | "Draft">(
        "Draft"
    );
    const [autoActivateOnTermStart, setAutoActivateOnTermStart] = useState(true);
    const [maxTotalCover, setMaxTotalCover] = useState("");
    const [maxTotalDclSdlCover, setMaxTotalDclSdlCover] = useState("");
    const [minCreditScore, setMinCreditScore] = useState("");
    const [scoreValidityPeriodMonths, setScoreValidityPeriodMonths] =
        useState("");
    const [maxDcl, setMaxDcl] = useState("");
    const [dclCustomerSinceMonths, setDclCustomerSinceMonths] = useState("");
    const [maxPaymentTerm, setMaxPaymentTerm] = useState("");
    const [maxAllowedMep, setMaxAllowedMep] = useState("");
    const [reportingDays, setReportingDays] = useState("");
    const [mepCutoffDayOfMonth, setMepCutoffDayOfMonth] = useState("");
    const [mepSubstituteDayOfMonth, setMepSubstituteDayOfMonth] = useState("");
    const [reportingCutoffDayOfMonth, setReportingCutoffDayOfMonth] =
        useState("");
    const [reportingSubstituteDayOfMonth, setReportingSubstituteDayOfMonth] =
        useState("");
    const [paymentTermCutoffDayOfMonth, setPaymentTermCutoffDayOfMonth] =
        useState("");
    const [paymentTermSubstituteDayOfMonth, setPaymentTermSubstituteDayOfMonth] =
        useState("");
    const [insurerName, setInsurerName] = useState("");
    const [policyKind, setPolicyKind] = useState<"Primary" | "TopUp">("Primary");
    const [parentInsurancePolicyId, setParentInsurancePolicyId] = useState<
        number | null
    >(null);
    const [allowConcurrentTopUps, setAllowConcurrentTopUps] = useState(true);
    const [costCalculationMethod, setCostCalculationMethod] = useState<
        "" | "ActualSales" | "Limit"
    >("");
    const [costPercent, setCostPercent] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const { data: availablePolicies } = useQuery({
        queryKey: ["insurance-policies", accountId, "active-primary-parents"],
        queryFn: async () => {
            const { data } = await api.get(
                "/api/entities/insurance-policies",
                { params: { account_id: accountId, assignable_only: 1 } }
            );
            return filterTopUpParentPolicyOptions(
                (data?.policies ?? []) as Array<{
                    id: number;
                    policy_number: string;
                    insurer_name?: string | null;
                    policy_kind?: string | null;
                    status?: string | null;
                    start_date?: string | null;
                    end_date?: string | null;
                }>
            );
        },
        enabled: open,
    });

    const isEditMode = Boolean(policyId);

    const {
        data: policyDetail,
        isLoading: isLoadingPolicy,
        isError: isPolicyLoadError,
    } = useQuery({
        queryKey: ["insurance-policy", accountId, policyId],
        queryFn: async () => {
            const { data } = await api.get(
                `/api/entities/insurance-policies/${policyId}`,
                { params: { account_id: accountId } }
            );
            return data;
        },
        enabled: Boolean(open && policyId),
        retry: 1,
    });

    useEffect(() => {
        if (!open) return;
        if (policyId) return;
        setPolicyNumber("");
        setStartDate("");
        setEndDate("");
        setCurrency("");
        setStatus("Draft");
        setAutoActivateOnTermStart(true);
        setMaxTotalCover("");
        setMaxTotalDclSdlCover("");
        setMinCreditScore("");
        setScoreValidityPeriodMonths("");
        setMaxDcl("");
        setDclCustomerSinceMonths("");
        setMaxPaymentTerm("");
        setMaxAllowedMep("");
        setReportingDays("");
        setMepCutoffDayOfMonth("");
        setMepSubstituteDayOfMonth("");
        setReportingCutoffDayOfMonth("");
        setReportingSubstituteDayOfMonth("");
        setPaymentTermCutoffDayOfMonth("");
        setPaymentTermSubstituteDayOfMonth("");
        setInsurerName("");
        setPolicyKind("Primary");
        setParentInsurancePolicyId(null);
        setAllowConcurrentTopUps(true);
        setCostCalculationMethod("");
        setCostPercent("");
        setFieldErrors({});
    }, [open, policyId]);

    useEffect(() => {
        if (!open || !policyId || !policyDetail) return;
        setPolicyNumber(String(policyDetail.policy_number ?? ""));
        setStartDate(dateToDateInputValue(policyDetail.start_date));
        setEndDate(dateToDateInputValue(policyDetail.end_date));
        setCurrency(String(policyDetail.currency ?? ""));
        setStatus(
            policyDetail.status === "Inactive"
                ? "Inactive"
                : policyDetail.status === "Draft"
                  ? "Draft"
                  : "Active"
        );
        setMaxTotalCover(decimalToInputString(policyDetail.max_total_cover));
        setMaxTotalDclSdlCover(
            decimalToInputString(policyDetail.max_total_dcl_sdl_cover)
        );
        setMinCreditScore(decimalToInputString(policyDetail.min_credit_score));
        setScoreValidityPeriodMonths(
            policyDetail.score_validity_period_months != null
                ? String(policyDetail.score_validity_period_months)
                : ""
        );
        setMaxDcl(decimalToInputString(policyDetail.max_dcl));
        setDclCustomerSinceMonths(
            policyDetail.dcl_customer_since_months != null
                ? String(policyDetail.dcl_customer_since_months)
                : ""
        );
        setMaxPaymentTerm(
            policyDetail.max_payment_term != null
                ? String(policyDetail.max_payment_term)
                : ""
        );
        setMaxAllowedMep(
            policyDetail.max_allowed_mep != null
                ? String(policyDetail.max_allowed_mep)
                : ""
        );
        setReportingDays(
            policyDetail.reporting_days != null
                ? String(policyDetail.reporting_days)
                : ""
        );
        setMepCutoffDayOfMonth(
            policyDetail.mep_cutoff_day_of_month != null
                ? String(policyDetail.mep_cutoff_day_of_month)
                : ""
        );
        setMepSubstituteDayOfMonth(
            policyDetail.mep_substitute_day_of_month != null
                ? String(policyDetail.mep_substitute_day_of_month)
                : ""
        );
        setReportingCutoffDayOfMonth(
            policyDetail.reporting_cutoff_day_of_month != null
                ? String(policyDetail.reporting_cutoff_day_of_month)
                : ""
        );
        setReportingSubstituteDayOfMonth(
            policyDetail.reporting_substitute_day_of_month != null
                ? String(policyDetail.reporting_substitute_day_of_month)
                : ""
        );
        setPaymentTermCutoffDayOfMonth(
            policyDetail.payment_term_cutoff_day_of_month != null
                ? String(policyDetail.payment_term_cutoff_day_of_month)
                : ""
        );
        setPaymentTermSubstituteDayOfMonth(
            policyDetail.payment_term_substitute_day_of_month != null
                ? String(policyDetail.payment_term_substitute_day_of_month)
                : ""
        );
        setInsurerName(String(policyDetail.insurer_name ?? ""));
        setPolicyKind(policyDetail.policy_kind === "TopUp" ? "TopUp" : "Primary");
        setAutoActivateOnTermStart(
            Boolean(policyDetail.auto_activate_on_term_start)
        );
        setParentInsurancePolicyId(
            policyDetail.parent_insurance_policy_id != null
                ? Number(policyDetail.parent_insurance_policy_id)
                : null
        );
        setAllowConcurrentTopUps(
            policyDetail.allow_concurrent_top_ups !== false
        );
        setCostCalculationMethod(
            policyDetail.cost_calculation_method === "Limit"
                ? "Limit"
                : policyDetail.cost_calculation_method === "ActualSales"
                  ? "ActualSales"
                  : ""
        );
        setCostPercent(decimalToInputString(policyDetail.cost_percent));
        setFieldErrors({});
    }, [open, policyId, policyDetail]);

    /** Global scrollbar hide — ensure modal scroll area shows a thumb (frontend-modals). */
    useEffect(() => {
        if (!open || typeof document === "undefined") return;
        const trackBg = alpha(theme.palette.primary.main, 0.1);
        const thumbBg = alpha(theme.palette.primary.main, 0.6);
        const thumbHover = theme.palette.primary.main;
        const styleId = "insurance-policy-modal-scrollbar-override";
        let el = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!el) {
            el = document.createElement("style");
            el.id = styleId;
            document.body.appendChild(el);
        }
        el.textContent = `
#${SCROLL_ID} { scrollbar-width: thin; scrollbar-color: ${thumbBg} ${trackBg}; }
#${SCROLL_ID}::-webkit-scrollbar { display: block !important; width: 12px !important; -webkit-appearance: none !important; }
#${SCROLL_ID}::-webkit-scrollbar-track { background-color: ${trackBg} !important; border-radius: 6px !important; }
#${SCROLL_ID}::-webkit-scrollbar-thumb { background-color: ${thumbBg} !important; border-radius: 6px !important; }
#${SCROLL_ID}::-webkit-scrollbar-thumb:hover { background-color: ${thumbHover} !important; }
`;
        return () => {
            const styleEl = document.getElementById(styleId);
            if (styleEl) styleEl.remove();
        };
    }, [open, theme.palette.primary.main]);

    const textFieldRtlProps = useMemo(
        () => ({
            ...(isRTL && { "data-hebrew": true as const }),
            dir: (isRTL ? "rtl" : "ltr") as "rtl" | "ltr",
        }),
        [isRTL]
    );

    const textFieldDirSx = useMemo(
        () => ({
            "& .MuiInputBase-input": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
                direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            },
            "& .MuiInputLabel-root": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
            },
        }),
        [isRTL]
    );

    const menuItemSx = useMemo(
        () => ({
            direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            textAlign: isRTL ? ("right" as const) : ("left" as const),
            justifyContent: isRTL ? ("flex-end" as const) : ("flex-start" as const),
        }),
        [isRTL]
    );

    const canSelectActiveStatus =
        policyKind === "TopUp" ||
        (!!startDate &&
            !!endDate &&
            canSetInsurancePolicyStatusActive(startDate, endDate));

    const showAutoActivateOnTermStart =
        policyKind === "Primary" &&
        status === "Inactive" &&
        Boolean(startDate) &&
        isInsurancePolicyBeforeStartDate(startDate);

    const clearFieldError = useCallback((field: string) => {
        setFieldErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }, []);

    const monthEndCutoffErrorMessage = useCallback(
        (code: MonthEndCutoffValidationErrorCode) => {
            switch (code) {
                case "invalid_integer":
                    return tCi("credit_insurance.validation.invalid_integer");
                case "out_of_range":
                    return tCi(
                        "credit_insurance.validation.day_of_month_out_of_range"
                    );
                case "cutoff_requires_substitute":
                    return tCi(
                        "credit_insurance.validation.cutoff_requires_substitute"
                    );
                case "substitute_requires_cutoff":
                    return tCi(
                        "credit_insurance.validation.substitute_requires_cutoff"
                    );
                default:
                    return tCi("credit_insurance.validation.invalid_integer");
            }
        },
        [tCi]
    );

    const saveMut = useMutation({
        mutationFn: async () => {
            const errors: Record<string, string> = {};
            if (!policyNumber.trim()) {
                errors.policy_number = tCi("credit_insurance.validation.policy_number_required");
            }
            const req = t("validation.required", { ns: "common" });
            if (policyKind !== "TopUp") {
                if (!startDate) {
                    errors.start_date = tCi("credit_insurance.validation.start_date_required");
                }
                if (!endDate) {
                    errors.end_date = tCi("credit_insurance.validation.end_date_required");
                }
                if (startDate && endDate && endDate < startDate) {
                    errors.end_date = tCi("credit_insurance.validation.end_before_start");
                }
                if (
                    status === "Active" &&
                    startDate &&
                    endDate &&
                    !canSetInsurancePolicyStatusActive(startDate, endDate)
                ) {
                    errors.status = tCi(
                        "credit_insurance.validation.cannot_activate_expired",
                        {
                            defaultValue:
                                "Cannot set status to Active when the policy term does not include today.",
                        }
                    );
                }
            }
            const cur = currency.trim();
            if (policyKind === "Primary" && !cur) {
                errors.currency = req;
            }

            const mtc = parseOptionalDecimal(maxTotalCover);
            const mtdc = parseOptionalDecimal(maxTotalDclSdlCover);
            const mcs = parseOptionalDecimal(minCreditScore);
            const mdcl = parseOptionalDecimal(maxDcl);
            const svpm = parseOptionalInt(scoreValidityPeriodMonths);
            const dcsm = parseOptionalInt(dclCustomerSinceMonths);
            const mpt = parseOptionalInt(maxPaymentTerm);
            const mam = parseOptionalInt(maxAllowedMep);
            const rd = parseOptionalInt(reportingDays);
            const costPct = parseOptionalDecimal(costPercent);

            if (policyKind === "Primary") {
                if (!maxTotalCover.trim()) {
                    errors.max_total_cover = req;
                }
                if (!minCreditScore.trim()) {
                    errors.min_credit_score = req;
                }
                if (!maxTotalDclSdlCover.trim()) {
                    errors.max_total_dcl_sdl_cover = req;
                }
                if (!scoreValidityPeriodMonths.trim()) {
                    errors.score_validity_period_months = req;
                }
                if (!maxDcl.trim()) {
                    errors.max_dcl = req;
                }
                if (!dclCustomerSinceMonths.trim()) {
                    errors.dcl_customer_since_months = req;
                }

                if (maxTotalCover.trim() && mtc === null) {
                    errors.max_total_cover = tCi("credit_insurance.validation.invalid_number");
                }
                if (minCreditScore.trim() && mcs === null) {
                    errors.min_credit_score = tCi("credit_insurance.validation.invalid_number");
                } else if (mcs !== null && mcs < 0) {
                    errors.min_credit_score = tCi("credit_insurance.validation.invalid_number");
                }
                if (maxDcl.trim() && mdcl === null) {
                    errors.max_dcl = tCi("credit_insurance.validation.invalid_number");
                }
                if (maxTotalDclSdlCover.trim() && mtdc === null) {
                    errors.max_total_dcl_sdl_cover = tCi(
                        "credit_insurance.validation.invalid_number"
                    );
                }
                if (mtc !== null && mdcl !== null && mdcl > mtc) {
                    errors.max_dcl = tCi(
                        "credit_insurance.validation.max_dcl_lte_max_total_cover"
                    );
                }
                if (scoreValidityPeriodMonths.trim() && svpm === null) {
                    errors.score_validity_period_months = tCi("credit_insurance.validation.invalid_integer");
                }
                if (dclCustomerSinceMonths.trim() && dcsm === null) {
                    errors.dcl_customer_since_months = tCi("credit_insurance.validation.invalid_integer");
                }

                if (!maxPaymentTerm.trim()) {
                    errors.max_payment_term = req;
                }
                if (!maxAllowedMep.trim()) {
                    errors.max_allowed_mep = req;
                }
                if (!reportingDays.trim()) {
                    errors.reporting_days = req;
                }
                if (maxPaymentTerm.trim() && mpt === null) {
                    errors.max_payment_term = tCi("credit_insurance.validation.invalid_integer");
                }
                if (maxAllowedMep.trim() && mam === null) {
                    errors.max_allowed_mep = tCi("credit_insurance.validation.invalid_integer");
                }
                if (reportingDays.trim() && rd === null) {
                    errors.reporting_days = tCi("credit_insurance.validation.invalid_integer");
                }

                const monthEndValidation = validateMonthEndCutoffFormFields({
                    mepCutoffRaw: mepCutoffDayOfMonth,
                    mepSubstituteRaw: mepSubstituteDayOfMonth,
                    reportingCutoffRaw: reportingCutoffDayOfMonth,
                    reportingSubstituteRaw: reportingSubstituteDayOfMonth,
                    paymentTermCutoffRaw: paymentTermCutoffDayOfMonth,
                    paymentTermSubstituteRaw: paymentTermSubstituteDayOfMonth,
                });
                for (const [field, code] of Object.entries(
                    monthEndValidation.errors
                )) {
                    errors[field] = monthEndCutoffErrorMessage(
                        code as MonthEndCutoffValidationErrorCode
                    );
                }
            }

            if (policyKind === "TopUp" && !parentInsurancePolicyId) {
                errors.parent_insurance_policy_id = tCi(
                    "credit_insurance.validation.parent_policy_required_for_top_up"
                );
            }

            if (policyKind === "Primary" && costCalculationMethod) {
                if (!costPercent.trim()) {
                    errors.cost_percent = tCi(
                        "credit_insurance.validation.cost_percent_required_when_method_set"
                    );
                } else if (costPct === null || costPct <= 0) {
                    errors.cost_percent = tCi("credit_insurance.validation.invalid_number");
                }
            }

            if (Object.keys(errors).length > 0) {
                setFieldErrors(errors);
                throw new Error("validation");
            }
            setFieldErrors({});

            const monthEndFields =
                policyKind === "TopUp"
                    ? {
                          mep_cutoff_day_of_month: null,
                          mep_substitute_day_of_month: null,
                          reporting_cutoff_day_of_month: null,
                          reporting_substitute_day_of_month: null,
                          payment_term_cutoff_day_of_month: null,
                          payment_term_substitute_day_of_month: null,
                      }
                    : validateMonthEndCutoffFormFields({
                          mepCutoffRaw: mepCutoffDayOfMonth,
                          mepSubstituteRaw: mepSubstituteDayOfMonth,
                          reportingCutoffRaw: reportingCutoffDayOfMonth,
                          reportingSubstituteRaw: reportingSubstituteDayOfMonth,
                          paymentTermCutoffRaw: paymentTermCutoffDayOfMonth,
                          paymentTermSubstituteRaw: paymentTermSubstituteDayOfMonth,
                      }).fields;

            const payload = {
                account_id: accountId,
                policy_number: policyNumber.trim(),
                start_date: startDate || null,
                end_date: endDate || null,
                status,
                currency: policyKind === "TopUp" ? null : cur || null,
                insurer_name: insurerName.trim() || null,
                policy_kind: policyKind,
                parent_insurance_policy_id: parentInsurancePolicyId,
                allow_concurrent_top_ups: policyKind === "TopUp" ? allowConcurrentTopUps : true,
                max_total_cover: policyKind === "TopUp" ? null : mtc,
                max_total_dcl_sdl_cover: policyKind === "TopUp" ? null : mtdc,
                min_credit_score: policyKind === "TopUp" ? null : mcs,
                score_validity_period_months: policyKind === "TopUp" ? null : svpm,
                max_dcl: policyKind === "TopUp" ? null : mdcl,
                dcl_customer_since_months: policyKind === "TopUp" ? null : dcsm,
                max_payment_term: policyKind === "TopUp" ? null : mpt,
                max_allowed_mep: policyKind === "TopUp" ? null : mam,
                reporting_days: policyKind === "TopUp" ? null : rd,
                ...monthEndFields,
                cost_calculation_method:
                    policyKind === "TopUp" ? null : costCalculationMethod || null,
                cost_percent:
                    policyKind === "TopUp" || !costCalculationMethod ? null : costPct,
                auto_activate_on_term_start:
                    policyKind === "Primary" ? autoActivateOnTermStart : false,
            };

            if (policyId) {
                const { data } = await api.put(
                    `/api/entities/insurance-policies/${policyId}`,
                    payload
                );
                return data as { id?: number };
            }
            const { data } = await api.post(
                "/api/entities/insurance-policies",
                payload
            );
            return data as { id?: number };
        },
        onSuccess: async (data: { id?: number } | undefined) => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: ["insurance-policies-grid"] }),
                qc.invalidateQueries({
                    queryKey: ["insurance-policies", accountId],
                }),
                qc.invalidateQueries({ queryKey: ["insurance-policy", accountId] }),
                qc.invalidateQueries({
                    queryKey: ["insurance-policies", accountId, "active"],
                }),
            ]);
            if (!policyId && data?.id != null) {
                if (onCreated) {
                    onCreated(Number(data.id));
                } else {
                    onSaved?.();
                }
            } else {
                onSaved?.();
            }
            onClose();
        },
        onError: (err: unknown) => {
            if (err instanceof Error && err.message === "validation") {
                return;
            }
            const msg =
                isAxiosError(err) && err.response?.data?.error
                    ? String(err.response.data.error)
                    : isEditMode
                      ? tCi("credit_insurance.save_failed")
                      : tCi("credit_insurance.create_failed");
            toastError(msg);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMut.mutate();
    };

    const formBusy = saveMut.isPending || (Boolean(policyId) && isLoadingPolicy);

    return (
        <AppDialog
            open={open}
            onClose={() => {
                if (!saveMut.isPending) onClose();
            }}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="560px"
            paperMaxHeight="90vh"
            title={tCi(isEditMode
                    ? "credit_insurance.modal_edit_title"
                    : "credit_insurance.modal_create_title")}
            titleIcon={<AttachMoneyIcon aria-hidden="true" />}
            ariaLabelledBy={
                isEditMode
                    ? "edit-insurance-policy-dialog-title"
                    : "create-insurance-policy-dialog-title"
            }
            ariaDescribedBy={
                isEditMode
                    ? "edit-insurance-policy-dialog-description"
                    : "create-insurance-policy-dialog-description"
            }
            scrollContainerId={SCROLL_ID}
            keepMounted
            disableEnforceFocus={false}
            disableAutoFocus={false}
            paperSx={{
                sx: {
                    "& > .MuiDialogTitle-root": {
                        flexShrink: 0,
                    },
                    "& > .MuiDialogContent-root": {
                        flex: "1 1 auto",
                        minHeight: 0,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        px: 0,
                    },
                    "& > .MuiDialogActions-root": {
                        flexShrink: 0,
                    },
                },
            }}
            actions={
                <>
                    <Button
                        type="button"
                        onClick={onClose}
                        disabled={formBusy}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        type="submit"
                        form="insurance-policy-form"
                        disabled={formBusy || (Boolean(policyId) && isPolicyLoadError)}
                        variant="contained"
                        size="small"
                        className="save-button"
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <Box
                component="form"
                id="insurance-policy-form"
                onSubmit={handleSubmit}
                noValidate
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "hidden",
                }}
                dir={isRTL ? "rtl" : "ltr"}
            >
                <ModalScrollBox id={SCROLL_ID} isRTL={isRTL} sx={{ px: 3 }}>
                    {Boolean(policyId) && isLoadingPolicy ? (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                py: 8,
                            }}
                        >
                            <CircularProgress />
                        </Box>
                    ) : Boolean(policyId) && isPolicyLoadError ? (
                        <Box sx={{ py: 4, px: 1 }}>
                            <Typography color="error" variant="body2">
                                {tCi("credit_insurance.load_policy_failed")}
                            </Typography>
                        </Box>
                    ) : (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: { xs: 1.5, sm: 2 },
                            pt: 1,
                            pb: 2,
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{ mb: 1, color: "primary.main" }}
                            >
                                {tCi("credit_insurance.sections.core")}
                            </Typography>
                            <LocalizationProvider
                                dateAdapter={AdapterMoment}
                                adapterLocale={datePickerAdapterLocale}
                            >
                                <Box
                                    sx={{
                                        display: "grid",
                                        gap: 2,
                                        gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "repeat(2, 1fr)",
                                        },
                                    }}
                                >
                                <TextField
                                    {...textFieldRtlProps}
                                    select
                                    fullWidth
                                    label={tCi("credit_insurance.fields.policy_kind")}
                                    value={policyKind}
                                    disabled={isEditMode}
                                    onChange={(e) => {
                                        const nextKind = e.target.value as
                                            | "Primary"
                                            | "TopUp";
                                        setPolicyKind(nextKind);
                                        if (nextKind === "TopUp") {
                                            setParentInsurancePolicyId(null);
                                            setCurrency("");
                                            setCostCalculationMethod("");
                                            setCostPercent("");
                                            clearFieldError("currency");
                                            clearFieldError("cost_percent");
                                        } else {
                                            setParentInsurancePolicyId(null);
                                        }
                                    }}
                                    sx={textFieldDirSx}
                                >
                                    <MenuItem value="Primary" sx={menuItemSx}>
                                        {tCi("credit_insurance.fields.policy_kind_primary")}
                                    </MenuItem>
                                    <MenuItem value="TopUp" sx={menuItemSx}>
                                        {tCi("credit_insurance.fields.policy_kind_top_up")}
                                    </MenuItem>
                                </TextField>
                                <TextField
                                    {...textFieldRtlProps}
                                    required
                                    label={tCi("credit_insurance.fields.policy_number")}
                                    value={policyNumber}
                                    onChange={(e) => {
                                        setPolicyNumber(e.target.value);
                                        clearFieldError("policy_number");
                                    }}
                                    error={!!fieldErrors.policy_number}
                                    helperText={fieldErrors.policy_number}
                                    fullWidth
                                    sx={{
                                        ...textFieldDirSx,
                                    }}
                                />
                                {policyKind !== "TopUp" && (
                                    <>
                                        <DatePicker
                                            label={tCi("credit_insurance.fields.start_date")}
                                            value={
                                                startDate
                                                    ? moment(startDate, "YYYY-MM-DD", true)
                                                    : null
                                            }
                                            onChange={(newValue) => {
                                                setStartDate(
                                                    newValue
                                                        ? newValue.format("YYYY-MM-DD")
                                                        : ""
                                                );
                                                clearFieldError("start_date");
                                            }}
                                            format={getDatePickerFormat(
                                                session,
                                                "DD/MM/YYYY"
                                            )}
                                            slotProps={{
                                                textField: {
                                                    ...textFieldRtlProps,
                                                    fullWidth: true,
                                                    required: true,
                                                    size: "small" as const,
                                                    error: !!fieldErrors.start_date,
                                                    helperText: fieldErrors.start_date,
                                                    sx: {
                                                        "& .MuiInputBase-root": {
                                                            minHeight: 40,
                                                        },
                                                        "& .MuiPickersSectionList-root, & .MuiInputBase-input":
                                                            {
                                                                fontSize: "0.875rem",
                                                            },
                                                    },
                                                },
                                            }}
                                        />
                                        <DatePicker
                                            label={tCi("credit_insurance.fields.end_date")}
                                            value={
                                                endDate
                                                    ? moment(endDate, "YYYY-MM-DD", true)
                                                    : null
                                            }
                                            onChange={(newValue) => {
                                                const previousEnd = endDate;
                                                const nextEnd = newValue
                                                    ? newValue.format("YYYY-MM-DD")
                                                    : "";
                                                setEndDate(nextEnd);
                                                clearFieldError("end_date");
                                                if (
                                                    shouldNotifyPolicyEligibleForActivation(
                                                        {
                                                            policyKind,
                                                            previousEndDate:
                                                                previousEnd,
                                                            nextEndDate: nextEnd,
                                                            startDate,
                                                            status,
                                                        }
                                                    )
                                                ) {
                                                    toastInfo(
                                                        tCi(
                                                            "credit_insurance.notifications.policy_eligible_for_activation",
                                                            {
                                                                defaultValue:
                                                                    "The policy term now includes today. Set status to Active when ready.",
                                                            }
                                                        )
                                                    );
                                                }
                                            }}
                                            format={getDatePickerFormat(
                                                session,
                                                "DD/MM/YYYY"
                                            )}
                                            slotProps={{
                                                textField: {
                                                    ...textFieldRtlProps,
                                                    fullWidth: true,
                                                    required: true,
                                                    size: "small" as const,
                                                    error: !!fieldErrors.end_date,
                                                    helperText: fieldErrors.end_date,
                                                    sx: {
                                                        "& .MuiInputBase-root": {
                                                            minHeight: 40,
                                                        },
                                                        "& .MuiPickersSectionList-root, & .MuiInputBase-input":
                                                            {
                                                                fontSize: "0.875rem",
                                                            },
                                                    },
                                                },
                                            }}
                                        />
                                    </>
                                )}
                                <TextField
                                    {...textFieldRtlProps}
                                    select
                                    fullWidth
                                    required
                                    label={tCi("credit_insurance.fields.status")}
                                    value={status}
                                    onChange={(e) => {
                                        const next = e.target.value as
                                            | "Active"
                                            | "Inactive"
                                            | "Draft";
                                        if (
                                            next === "Active" &&
                                            policyKind !== "TopUp" &&
                                            startDate &&
                                            endDate &&
                                            !canSetInsurancePolicyStatusActive(
                                                startDate,
                                                endDate
                                            )
                                        ) {
                                            toastError(
                                                tCi(
                                                    "credit_insurance.validation.cannot_activate_expired",
                                                    {
                                                        defaultValue:
                                                            "Cannot set status to Active when the policy term does not include today.",
                                                    }
                                                )
                                            );
                                            return;
                                        }
                                        setStatus(next);
                                    }}
                                    sx={textFieldDirSx}
                                >
                                    <MenuItem value="Draft" sx={menuItemSx}>
                                        {tCi("credit_insurance.status.draft")}
                                    </MenuItem>
                                    <MenuItem
                                        value="Active"
                                        disabled={!canSelectActiveStatus}
                                        sx={menuItemSx}
                                    >
                                        {tCi("credit_insurance.status.active")}
                                    </MenuItem>
                                    <MenuItem value="Inactive" sx={menuItemSx}>
                                        {tCi("credit_insurance.status.inactive")}
                                    </MenuItem>
                                </TextField>
                                {showAutoActivateOnTermStart ? (
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={autoActivateOnTermStart}
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
                                <TextField
                                    {...textFieldRtlProps}
                                    label={tCi("credit_insurance.fields.insurer_name")}
                                    value={insurerName}
                                    onChange={(e) => {
                                        setInsurerName(e.target.value);
                                        clearFieldError("insurer_name");
                                    }}
                                    fullWidth
                                    sx={textFieldDirSx}
                                />
                                {policyKind === "Primary" && (
                                    <>
                                        <TextField
                                            {...textFieldRtlProps}
                                            select
                                            fullWidth
                                            label={tCi(
                                                "credit_insurance.fields.cost_calculation_method"
                                            )}
                                            value={costCalculationMethod}
                                            onChange={(e) => {
                                                const next = e.target.value as
                                                    | ""
                                                    | "ActualSales"
                                                    | "Limit";
                                                setCostCalculationMethod(next);
                                                if (!next) {
                                                    setCostPercent("");
                                                    clearFieldError("cost_percent");
                                                }
                                                clearFieldError("cost_calculation_method");
                                            }}
                                            sx={textFieldDirSx}
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
                                        </TextField>
                                        <TextField
                                            {...textFieldRtlProps}
                                            label={tCi("credit_insurance.fields.cost_percent")}
                                            value={costPercent}
                                            onChange={(e) => {
                                                setCostPercent(e.target.value);
                                                clearFieldError("cost_percent");
                                            }}
                                            disabled={!costCalculationMethod}
                                            required={Boolean(costCalculationMethod)}
                                            inputMode="decimal"
                                            inputProps={{ min: 0, step: "any" }}
                                            error={!!fieldErrors.cost_percent}
                                            helperText={fieldErrors.cost_percent}
                                            fullWidth
                                            sx={textFieldDirSx}
                                        />
                                    </>
                                )}
                                {policyKind === "TopUp" && (
                                    <>
                                        <TextField
                                            {...textFieldRtlProps}
                                            select
                                            fullWidth
                                            required
                                            label={tCi(
                                                "credit_insurance.fields.parent_insurance_policy"
                                            )}
                                            value={parentInsurancePolicyId ?? ""}
                                            onChange={(e) => {
                                                setParentInsurancePolicyId(
                                                    e.target.value
                                                        ? Number(e.target.value)
                                                        : null
                                                );
                                                clearFieldError(
                                                    "parent_insurance_policy_id"
                                                );
                                            }}
                                            error={!!fieldErrors.parent_insurance_policy_id}
                                            helperText={
                                                fieldErrors.parent_insurance_policy_id
                                            }
                                            sx={{
                                                ...textFieldDirSx,
                                                gridColumn: {
                                                    xs: "span 1",
                                                    sm: "span 2",
                                                },
                                            }}
                                        >
                                            {(availablePolicies ?? [])
                                                .filter((p) => p.id !== policyId)
                                                .map((p) => (
                                                    <MenuItem
                                                        key={p.id}
                                                        value={p.id}
                                                        sx={menuItemSx}
                                                    >
                                                        {p.policy_number}
                                                        {p.insurer_name
                                                            ? ` — ${p.insurer_name}`
                                                            : ""}
                                                    </MenuItem>
                                                ))}
                                        </TextField>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={allowConcurrentTopUps}
                                                    onChange={(_, checked) =>
                                                        setAllowConcurrentTopUps(checked)
                                                    }
                                                    color="primary"
                                                />
                                            }
                                            label={tCi(
                                                "credit_insurance.fields.allow_concurrent_top_ups"
                                            )}
                                            sx={{
                                                gridColumn: {
                                                    xs: "span 1",
                                                    sm: "span 2",
                                                },
                                            }}
                                        />
                                    </>
                                )}
                                </Box>
                            </LocalizationProvider>
                        </Box>

                        {policyKind === "Primary" && (
                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{ mb: 1, color: "primary.main" }}
                            >
                                {tCi("credit_insurance.sections.limits")}
                            </Typography>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 2,
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        sm: "repeat(2, 1fr)",
                                    },
                                }}
                            >
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
                                    <CurrencySelect
                                        value={currency}
                                        onChange={(value) => {
                                            setCurrency(value);
                                            clearFieldError("currency");
                                        }}
                                        label={tCi("credit_insurance.fields.currency")}
                                        disabled={formBusy}
                                        error={!!fieldErrors.currency}
                                    />
                                    {fieldErrors.currency ? (
                                        <Typography
                                            variant="caption"
                                            color="error"
                                            sx={{ mt: 0.5, marginInlineStart: 1.5 }}
                                        >
                                            {fieldErrors.currency}
                                        </Typography>
                                    ) : (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                mt: 0.5,
                                                marginInlineStart: 1.5,
                                                display: "block",
                                            }}
                                        >
                                            {tCi("credit_insurance.hints.currency")}
                                        </Typography>
                                    )}
                                </Box>
                                <TextField
                                            {...textFieldRtlProps}
                                            required
                                            label={tCi("credit_insurance.fields.max_total_cover")}
                                            value={maxTotalCover}
                                            onChange={(e) => {
                                                setMaxTotalCover(e.target.value);
                                                clearFieldError("max_total_cover");
                                            }}
                                            error={!!fieldErrors.max_total_cover}
                                            helperText={fieldErrors.max_total_cover}
                                            fullWidth
                                            inputMode="decimal"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            required
                                            label={tCi("credit_insurance.fields.min_credit_score")}
                                            value={minCreditScore}
                                            onChange={(e) => {
                                                setMinCreditScore(e.target.value);
                                                clearFieldError("min_credit_score");
                                            }}
                                            error={!!fieldErrors.min_credit_score}
                                            helperText={fieldErrors.min_credit_score}
                                            fullWidth
                                            inputMode="decimal"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            required
                                            label={tCi(
                                                "credit_insurance.fields.max_total_dcl_sdl_cover"
                                            )}
                                            value={maxTotalDclSdlCover}
                                            onChange={(e) => {
                                                setMaxTotalDclSdlCover(e.target.value);
                                                clearFieldError("max_total_dcl_sdl_cover");
                                            }}
                                            error={!!fieldErrors.max_total_dcl_sdl_cover}
                                            helperText={fieldErrors.max_total_dcl_sdl_cover}
                                            fullWidth
                                            inputMode="decimal"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            required
                                            label={tCi("credit_insurance.fields.score_validity_period_months")}
                                            value={scoreValidityPeriodMonths}
                                            onChange={(e) => {
                                                setScoreValidityPeriodMonths(
                                                    e.target.value
                                                );
                                                clearFieldError(
                                                    "score_validity_period_months"
                                                );
                                            }}
                                            error={
                                                !!fieldErrors.score_validity_period_months
                                            }
                                            helperText={
                                                fieldErrors.score_validity_period_months
                                            }
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            required
                                            label={tCi("credit_insurance.fields.max_dcl")}
                                            value={maxDcl}
                                            onChange={(e) => {
                                                setMaxDcl(e.target.value);
                                                clearFieldError("max_dcl");
                                            }}
                                            error={!!fieldErrors.max_dcl}
                                            helperText={fieldErrors.max_dcl}
                                            fullWidth
                                            inputMode="decimal"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            required
                                            label={tCi(
                                                "credit_insurance.fields.dcl_customer_since_months"
                                            )}
                                            value={dclCustomerSinceMonths}
                                            onChange={(e) => {
                                                setDclCustomerSinceMonths(e.target.value);
                                                clearFieldError("dcl_customer_since_months");
                                            }}
                                            error={!!fieldErrors.dcl_customer_since_months}
                                            helperText={fieldErrors.dcl_customer_since_months}
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                            </Box>

                            <Typography
                                variant="subtitle2"
                                sx={{ mt: 2, mb: 1, color: "primary.main" }}
                            >
                                {tCi("credit_insurance.sections.payment_term")}
                            </Typography>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 2,
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        sm: "repeat(2, 1fr)",
                                    },
                                }}
                            >
                                        <TextField
                                            {...textFieldRtlProps}
                                            required
                                            label={tCi("credit_insurance.fields.max_payment_term")}
                                            value={maxPaymentTerm}
                                            onChange={(e) => {
                                                setMaxPaymentTerm(e.target.value);
                                                clearFieldError("max_payment_term");
                                            }}
                                            error={!!fieldErrors.max_payment_term}
                                            helperText={fieldErrors.max_payment_term}
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            label={tCi(
                                                "credit_insurance.fields.payment_term_cutoff_day_of_month"
                                            )}
                                            value={paymentTermCutoffDayOfMonth}
                                            onChange={(e) => {
                                                const nextCutoff = e.target.value;
                                                setPaymentTermCutoffDayOfMonth(nextCutoff);
                                                if (!nextCutoff.trim()) {
                                                    setPaymentTermSubstituteDayOfMonth("");
                                                    clearFieldError(
                                                        "payment_term_substitute_day_of_month"
                                                    );
                                                }
                                                clearFieldError(
                                                    "payment_term_cutoff_day_of_month"
                                                );
                                            }}
                                            error={
                                                !!fieldErrors.payment_term_cutoff_day_of_month
                                            }
                                            helperText={
                                                fieldErrors.payment_term_cutoff_day_of_month
                                            }
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            required={Boolean(
                                                paymentTermCutoffDayOfMonth.trim()
                                            )}
                                            label={tCi(
                                                "credit_insurance.fields.payment_term_substitute_day_of_month"
                                            )}
                                            value={paymentTermSubstituteDayOfMonth}
                                            onChange={(e) => {
                                                setPaymentTermSubstituteDayOfMonth(
                                                    e.target.value
                                                );
                                                clearFieldError(
                                                    "payment_term_substitute_day_of_month"
                                                );
                                            }}
                                            error={
                                                !!fieldErrors.payment_term_substitute_day_of_month
                                            }
                                            helperText={
                                                fieldErrors.payment_term_substitute_day_of_month
                                            }
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                            </Box>

                            <Typography
                                variant="subtitle2"
                                sx={{ mt: 2, mb: 1, color: "primary.main" }}
                            >
                                {tCi("credit_insurance.sections.mep")}
                            </Typography>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 2,
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        sm: "repeat(2, 1fr)",
                                    },
                                }}
                            >
                                        <TextField
                                            {...textFieldRtlProps}
                                            required
                                            label={tCi("credit_insurance.fields.max_allowed_mep")}
                                            value={maxAllowedMep}
                                            onChange={(e) => {
                                                setMaxAllowedMep(e.target.value);
                                                clearFieldError("max_allowed_mep");
                                            }}
                                            error={!!fieldErrors.max_allowed_mep}
                                            helperText={fieldErrors.max_allowed_mep}
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            label={tCi(
                                                "credit_insurance.fields.mep_cutoff_day_of_month"
                                            )}
                                            value={mepCutoffDayOfMonth}
                                            onChange={(e) => {
                                                const nextCutoff = e.target.value;
                                                setMepCutoffDayOfMonth(nextCutoff);
                                                if (!nextCutoff.trim()) {
                                                    setMepSubstituteDayOfMonth("");
                                                    clearFieldError(
                                                        "mep_substitute_day_of_month"
                                                    );
                                                }
                                                clearFieldError("mep_cutoff_day_of_month");
                                            }}
                                            error={!!fieldErrors.mep_cutoff_day_of_month}
                                            helperText={
                                                fieldErrors.mep_cutoff_day_of_month
                                            }
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            required={Boolean(mepCutoffDayOfMonth.trim())}
                                            label={tCi(
                                                "credit_insurance.fields.mep_substitute_day_of_month"
                                            )}
                                            value={mepSubstituteDayOfMonth}
                                            onChange={(e) => {
                                                setMepSubstituteDayOfMonth(
                                                    e.target.value
                                                );
                                                clearFieldError(
                                                    "mep_substitute_day_of_month"
                                                );
                                            }}
                                            error={
                                                !!fieldErrors.mep_substitute_day_of_month
                                            }
                                            helperText={
                                                fieldErrors.mep_substitute_day_of_month
                                            }
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                            </Box>

                            <Typography
                                variant="subtitle2"
                                sx={{ mt: 2, mb: 1, color: "primary.main" }}
                            >
                                {tCi("credit_insurance.sections.reporting")}
                            </Typography>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 2,
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        sm: "repeat(2, 1fr)",
                                    },
                                }}
                            >
                                        <TextField
                                            {...textFieldRtlProps}
                                            required
                                            label={tCi("credit_insurance.fields.reporting_days")}
                                            value={reportingDays}
                                            onChange={(e) => {
                                                setReportingDays(e.target.value);
                                                clearFieldError("reporting_days");
                                            }}
                                            error={!!fieldErrors.reporting_days}
                                            helperText={fieldErrors.reporting_days}
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            label={tCi(
                                                "credit_insurance.fields.reporting_cutoff_day_of_month"
                                            )}
                                            value={reportingCutoffDayOfMonth}
                                            onChange={(e) => {
                                                const nextCutoff = e.target.value;
                                                setReportingCutoffDayOfMonth(nextCutoff);
                                                if (!nextCutoff.trim()) {
                                                    setReportingSubstituteDayOfMonth("");
                                                    clearFieldError(
                                                        "reporting_substitute_day_of_month"
                                                    );
                                                }
                                                clearFieldError(
                                                    "reporting_cutoff_day_of_month"
                                                );
                                            }}
                                            error={
                                                !!fieldErrors.reporting_cutoff_day_of_month
                                            }
                                            helperText={
                                                fieldErrors.reporting_cutoff_day_of_month
                                            }
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                                        <TextField
                                            {...textFieldRtlProps}
                                            required={Boolean(
                                                reportingCutoffDayOfMonth.trim()
                                            )}
                                            label={tCi(
                                                "credit_insurance.fields.reporting_substitute_day_of_month"
                                            )}
                                            value={reportingSubstituteDayOfMonth}
                                            onChange={(e) => {
                                                setReportingSubstituteDayOfMonth(
                                                    e.target.value
                                                );
                                                clearFieldError(
                                                    "reporting_substitute_day_of_month"
                                                );
                                            }}
                                            error={
                                                !!fieldErrors.reporting_substitute_day_of_month
                                            }
                                            helperText={
                                                fieldErrors.reporting_substitute_day_of_month
                                            }
                                            fullWidth
                                            inputMode="numeric"
                                            sx={textFieldDirSx}
                                        />
                            </Box>
                        </Box>
                        )}
                    </Box>
                    )}
                </ModalScrollBox>
            </Box>
        </AppDialog>
    );
}
