"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PersonIcon from "@mui/icons-material/Person";
import PublicIcon from "@mui/icons-material/Public";
import WarningIcon from "@mui/icons-material/Warning";
import {
    Box,
    Button,
    Breadcrumbs,
    CircularProgress,
    IconButton,
    Link,
    SelectChangeEvent,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { isAxiosError } from "axios";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";
import moment from "moment";
import "moment/locale/he";
import "moment/locale/en-gb";

import PageHeader from "@/components/PageHeader";
import PolicyGeneralInfo from "./PolicyGeneralInfo";
import CustomerHeaderNotificationBanner from "@/app/[locale]/app/customers/[customerId]/CustomerHeaderNotificationBanner";
import { CountrySelect } from "@/components/LocationSelects";
import CustomerNumberAutocomplete from "@/shared/components/CustomerNumberAutocomplete";
import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import Seo from "@/shared/layout-components/seo/seo";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { ExportFormat } from "@/shared/utility/exportToExcel";
import {
    canSetInsurancePolicyStatusActive,
    isInsurancePolicyBeforeStartDate,
    isInsurancePolicyPastEndDate,
    isPrimaryPolicyEffectivelyActive,
    isPrimaryPolicyEligibleForManualActivation,
} from "@/shared/creditInsurance/insurancePolicyLifecycle";
import {
    type MonthEndCutoffValidationErrorCode,
    validateMonthEndCutoffFormFields,
} from "@/shared/creditInsurance/monthEndCutoffFields";
import { filterTopUpParentPolicyOptions } from "@/shared/creditInsurance/topUpParentPolicy";
import {
    formatDateOnlyYmdForSession,
    formatDateForDisplay,
    getDatePickerFormat,
    getMomentAdapterLocale,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

type PolicyCountryRow = {
    id: string;
    country_id: number;
    payment_term_cap?: number | null;
    country_mep?: number | null;
    reporting_days?: number | null;
    country_max_limit?: string | number | null;
    Country?: { name?: string | null; iso2?: string | null };
};

type CountryLookup = {
    id: number;
    name: string;
    iso2?: string | null;
};

type CountryFormState = {
    payment_term_cap: string;
    country_mep: string;
    reporting_days: string;
    country_max_limit: string;
};

const POLICY_COUNTRY_MODAL_SCROLL_ID = "policy-country-modal-scroll";
const POLICY_NAMED_MODAL_SCROLL_ID = "policy-named-modal-scroll";

/** API may return ISO strings (`2026-05-22T00:00:00.000Z`), `Date`, or `YYYY-MM-DD`. */
function limitExpirationDateToYmd(raw: unknown): string | null {
    if (raw == null || raw === "") {
        return null;
    }
    if (typeof raw === "string") {
        const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : null;
    }
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        const y = raw.getFullYear();
        const mo = String(raw.getMonth() + 1).padStart(2, "0");
        const d = String(raw.getDate()).padStart(2, "0");
        return `${y}-${mo}-${d}`;
    }
    return null;
}

type NamedPolicyRow = {
    id: number;
    customer_number: string;
    customer_name?: string | null;
    customer_id?: number | null;
    max_payment_term?: number | null;
    customer_mep?: number | null;
    reporting_days?: number | null;
    customer_max_limit?: string | number | null;
    limit_expiration_date?: string | null;
};

type NamedFormState = {
    customer_number: string;
    max_payment_term: string;
    customer_mep: string;
    reporting_days: string;
    customer_max_limit: string;
    limit_expiration_date: string;
};

type PolicyDetail = {
    id: number;
    policy_number: string;
    start_date: string;
    end_date: string;
    status: string;
    currency?: string | null;
    max_total_cover?: string | number | null;
    max_total_dcl_sdl_cover?: string | number | null;
    min_credit_score?: string | number | null;
    score_validity_period_months?: number | null;
    max_dcl?: string | number | null;
    dcl_customer_since_months?: number | null;
    max_payment_term?: number | null;
    max_allowed_mep?: number | null;
    reporting_days?: number | null;
    mep_cutoff_day_of_month?: number | null;
    mep_substitute_day_of_month?: number | null;
    reporting_cutoff_day_of_month?: number | null;
    reporting_substitute_day_of_month?: number | null;
    payment_term_cutoff_day_of_month?: number | null;
    payment_term_substitute_day_of_month?: number | null;
    cost_calculation_method?: "ActualSales" | "Limit" | null;
    cost_percent?: string | number | null;
    InsurancePolicyCountry?: PolicyCountryRow[];
    NamedPolicy?: NamedPolicyRow[];
    insurer_name?: string | null;
    policy_kind?: "Primary" | "TopUp" | null;
    parent_insurance_policy_id?: number | null;
    ParentInsurancePolicy?: {
        id: number;
        policy_number: string;
        insurer_name?: string | null;
        status?: string | null;
        start_date?: string | null;
        end_date?: string | null;
    } | null;
    allow_concurrent_top_ups?: boolean;
    auto_activate_on_term_start?: boolean;
};

function displayMaybe(value: unknown): string {
    const displayValue =
        value &&
        typeof value === "object" &&
        "row" in value &&
        "field" in value &&
        "value" in value
            ? (value as { value: unknown }).value
            : value;

    if (displayValue === null || displayValue === undefined || displayValue === "") {
        return "-";
    }
    return String(displayValue);
}


function resolveLocalizedUrl(rawUrl: string, locale: string): string {
    if (!rawUrl) return `/${locale}/app/settings?tab=creditInsurance`;
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        return rawUrl;
    }
    if (rawUrl.startsWith(`/${locale}/`)) {
        return rawUrl;
    }
    if (rawUrl.startsWith("/")) {
        return `/${locale}${rawUrl}`;
    }
    return `/${locale}/${rawUrl}`;
}

function parseOptionalDecimal(value: string): number | null {
    const text = value.trim();
    if (!text) return null;
    const parsed = Number(text.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInt(value: string): number | null {
    const text = value.trim();
    if (!text) return null;
    const parsed = parseInt(text, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeIntegerInput(value: string): string {
    return value.replace(/\D/g, "");
}

function sanitizeDecimalInput(value: string): string {
    const normalized = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
    const [whole = "", ...rest] = normalized.split(".");
    if (rest.length === 0) return whole;
    return `${whole}.${rest.join("")}`;
}

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

export default function CreditInsurancePolicyDetailPage() {
    const { t, i18n } = useTranslation(["settings", "common", "dashboard", "customers"]);
    const theme = useTheme();
    const tCi = useCallback(
        (key: string, options?: Record<string, unknown>) =>
            t(key, { ns: "settings", ...options }),
        [t]
    );
    const tCommon = useCallback(
        (key: string) => t(key, { ns: "common" }),
        [t]
    );
    const isRTL = i18n.language === "he";
    const { data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { error: toastError, info: toastInfo } = useToast();
    const policyId = Number(params?.policyId);
    const locale = (params?.locale as string) || "en";
    const accountId = session?.user?.account_id;

    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            session?.user?.account_id,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000,
    });
    const canEditPolicy = (userPermissionsData?.permissions || []).includes(
        "update_insurance_policy"
    );

    const headerRef = useRef<HTMLDivElement>(null);
    const backUrlRaw =
        searchParams?.get("backUrl") || "/app/settings?tab=creditInsurance";
    const backUrl = resolveLocalizedUrl(backUrlRaw, locale);

    const [countrySearch, setCountrySearch] = useState("");
    const [statusValue, setStatusValue] = useState<
        "Active" | "Inactive" | "Draft"
    >(
        "Active"
    );
    const [currencyValue, setCurrencyValue] = useState("");
    const [policyNumberInput, setPolicyNumberInput] = useState("");
    const [startDateInput, setStartDateInput] = useState("");
    const [endDateInput, setEndDateInput] = useState("");
    const [maxTotalCoverInput, setMaxTotalCoverInput] = useState("");
    const [maxTotalDclSdlCoverInput, setMaxTotalDclSdlCoverInput] = useState("");
    const [minCreditScoreInput, setMinCreditScoreInput] = useState("");
    const [scoreValidityMonthsInput, setScoreValidityMonthsInput] =
        useState("");
    const [maxDclInput, setMaxDclInput] = useState("");
    const [dclCustomerSinceMonthsInput, setDclCustomerSinceMonthsInput] =
        useState("");
    const [maxPaymentTermInput, setMaxPaymentTermInput] = useState("");
    const [maxAllowedMepInput, setMaxAllowedMepInput] = useState("");
    const [reportingDaysInput, setReportingDaysInput] = useState("");
    const [mepCutoffDayOfMonthInput, setMepCutoffDayOfMonthInput] = useState("");
    const [mepSubstituteDayOfMonthInput, setMepSubstituteDayOfMonthInput] =
        useState("");
    const [reportingCutoffDayOfMonthInput, setReportingCutoffDayOfMonthInput] =
        useState("");
    const [
        reportingSubstituteDayOfMonthInput,
        setReportingSubstituteDayOfMonthInput,
    ] = useState("");
    const [paymentTermCutoffDayOfMonthInput, setPaymentTermCutoffDayOfMonthInput] =
        useState("");
    const [
        paymentTermSubstituteDayOfMonthInput,
        setPaymentTermSubstituteDayOfMonthInput,
    ] = useState("");
    const [insurerNameInput, setInsurerNameInput] = useState("");
    const [costCalculationMethodInput, setCostCalculationMethodInput] = useState<
        "" | "ActualSales" | "Limit"
    >("");
    const [costPercentInput, setCostPercentInput] = useState("");
    const [policyKindInput, setPolicyKindInput] = useState<"Primary" | "TopUp">("Primary");
    const [parentInsurancePolicyIdInput, setParentInsurancePolicyIdInput] = useState<number | null>(null);
    const [autoActivateOnTermStart, setAutoActivateOnTermStart] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [policyFormErrors, setPolicyFormErrors] = useState<
        Record<string, string>
    >({});

    const menuItemSx = useMemo(
        () => ({
            direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            textAlign: isRTL ? ("right" as const) : ("left" as const),
            justifyContent: isRTL ? ("flex-end" as const) : ("flex-start" as const),
        }),
        [isRTL]
    );

    const { data: primaryPolicies = [] } = useQuery<any[]>({
        queryKey: ["primary-policies", accountId],
        queryFn: async () => {
            const response = await api.get("/api/entities/insurance-policies", {
                params: { account_id: accountId, assignable_only: 1 },
            });
            return filterTopUpParentPolicyOptions(
                (response.data?.policies ?? []) as Array<{
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
        enabled: !!accountId && isEditing,
    });
    const [countryModalOpen, setCountryModalOpen] = useState(false);
    const [editingCountryRow, setEditingCountryRow] =
        useState<PolicyCountryRow | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<any | null>(null);
    const [countryForm, setCountryForm] = useState<CountryFormState>({
        payment_term_cap: "",
        country_mep: "",
        reporting_days: "",
        country_max_limit: "",
    });
    const [countryFormErrors, setCountryFormErrors] = useState<
        Record<string, string>
    >({});
    const [deleteCountryDialogRow, setDeleteCountryDialogRow] =
        useState<PolicyCountryRow | null>(null);
    const [debouncedCountrySearch] = useDebounce(countrySearch, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "country", sort: "asc" },
    ]);

    const [namedSearch, setNamedSearch] = useState("");
    const [namedModalOpen, setNamedModalOpen] = useState(false);
    const [editingNamedRow, setEditingNamedRow] =
        useState<NamedPolicyRow | null>(null);
    const [namedForm, setNamedForm] = useState<NamedFormState>({
        customer_number: "",
        max_payment_term: "",
        customer_mep: "",
        reporting_days: "",
        customer_max_limit: "",
        limit_expiration_date: "",
    });
    const [namedFormErrors, setNamedFormErrors] = useState<
        Record<string, string>
    >({});
    const [deleteNamedDialogRow, setDeleteNamedDialogRow] =
        useState<NamedPolicyRow | null>(null);
    const [debouncedNamedSearch] = useDebounce(namedSearch, 500);
    const [namedSortModel, setNamedSortModel] = useState<GridSortModel>([
        { field: "customer_number", sort: "asc" },
    ]);

    const modalTextFieldProps = useMemo(
        () => ({
            ...(isRTL && { "data-hebrew": true as const }),
            dir: (isRTL ? "rtl" : "ltr") as "rtl" | "ltr",
        }),
        [isRTL]
    );
    const modalTextFieldSx = useMemo(
        () => ({
            "& .MuiInputBase-input": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
                direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            },
            "& .MuiInputLabel-root": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
                direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            },
        }),
        [isRTL]
    );

    const datePickerAdapterLocale = useMemo(
        () => getMomentAdapterLocale(session ?? null),
        [session]
    );

    const displayStartDate = useMemo(
        () => formatDateOnlyYmdForSession(startDateInput, session ?? null),
        [startDateInput, session]
    );
    const displayEndDate = useMemo(
        () => formatDateOnlyYmdForSession(endDateInput, session ?? null),
        [endDateInput, session]
    );

    const { data, isLoading, error } = useQuery<PolicyDetail>({
        queryKey: ["insurance-policy-details-page", accountId, policyId],
        queryFn: async () => {
            const response = await api.get(
                `/api/entities/insurance-policies/${policyId}`,
                {
                    params: { account_id: accountId },
                }
            );
            return response.data;
        },
        enabled: !!accountId && Number.isFinite(policyId),
        retry: 1,
    });

    const parentPolicySelectOptions = useMemo(() => {
        const eligible = (primaryPolicies ?? []).filter(
            (p: { id: number }) => p.id !== policyId
        );
        const currentParentId =
            parentInsurancePolicyIdInput ?? data?.parent_insurance_policy_id ?? null;
        if (
            currentParentId != null &&
            !eligible.some((p: { id: number }) => p.id === currentParentId) &&
            data?.ParentInsurancePolicy
        ) {
            return [
                {
                    id: currentParentId,
                    policy_number: data.ParentInsurancePolicy.policy_number,
                    insurer_name: data.ParentInsurancePolicy.insurer_name ?? null,
                    disabled: true,
                },
                ...eligible,
            ];
        }
        return eligible;
    }, [
        primaryPolicies,
        policyId,
        parentInsurancePolicyIdInput,
        data?.parent_insurance_policy_id,
        data?.ParentInsurancePolicy,
    ]);

    const { data: countriesLookup = [] } = useQuery<CountryLookup[]>({
        queryKey: ["countries-lookup"],
        queryFn: async () => {
            const response = await apiFetch("/api/country");
            if (!response.ok) {
                throw new Error("Failed to load countries");
            }
            return response.json();
        },
        staleTime: 5 * 60 * 1000,
    });

    const countryNameById = useMemo(() => {
        const map = new Map<string, string>();
        countriesLookup.forEach((country) => {
            map.set(String(country.id), country.name || country.iso2 || "");
        });
        return map;
    }, [countriesLookup]);

    const userLocale = getUserDateLocale(session ?? null);
    const userTimezone = getUserTimezone(session ?? null);
    const notificationBannerBorderRadius = `${theme.appButton.borderRadius}px`;

    const effectiveEndDateYmd = isEditing
        ? endDateInput
        : data?.end_date
          ? dateToDateInputValue(data.end_date)
          : "";

    const showPolicyExpiredBanner =
        (isEditing ? policyKindInput : data?.policy_kind) !== "TopUp" &&
        Boolean(effectiveEndDateYmd) &&
        isInsurancePolicyPastEndDate(effectiveEndDateYmd);

    const parentPolicyForBanner = data?.ParentInsurancePolicy;
    const showTopUpParentInactiveBanner =
        (isEditing ? policyKindInput : data?.policy_kind) === "TopUp" &&
        parentPolicyForBanner != null &&
        !isPrimaryPolicyEffectivelyActive({
            status: parentPolicyForBanner.status,
            startDate: parentPolicyForBanner.start_date ?? "",
            endDate: parentPolicyForBanner.end_date ?? "",
        });

    const canSelectActiveStatus =
        policyKindInput === "TopUp" ||
        (!!startDateInput &&
            !!endDateInput &&
            canSetInsurancePolicyStatusActive(startDateInput, endDateInput));

    const showAutoActivateOnTermStart =
        policyKindInput === "Primary" &&
        statusValue === "Inactive" &&
        Boolean(startDateInput) &&
        isInsurancePolicyBeforeStartDate(startDateInput);

    const showPolicyEligibleForActivationBanner =
        policyKindInput === "Primary" &&
        isPrimaryPolicyEligibleForManualActivation({
            policyKind: policyKindInput,
            status: statusValue,
            startDate: isEditing ? startDateInput : data?.start_date ?? "",
            endDate: isEditing ? endDateInput : data?.end_date ?? "",
        });

    const fillFormFromPolicy = useCallback((d: PolicyDetail) => {
        setStatusValue(
            d.status === "Inactive"
                ? "Inactive"
                : d.status === "Draft"
                  ? "Draft"
                  : "Active"
        );
        setCurrencyValue(d.currency ? String(d.currency) : "");
        setPolicyNumberInput(String(d.policy_number ?? ""));
        setStartDateInput(dateToDateInputValue(d.start_date));
        setEndDateInput(dateToDateInputValue(d.end_date));
        setInsurerNameInput(d.insurer_name ? String(d.insurer_name) : "");
        setPolicyKindInput(d.policy_kind === "TopUp" ? "TopUp" : "Primary");
        setParentInsurancePolicyIdInput(d.parent_insurance_policy_id ?? null);
        setAutoActivateOnTermStart(Boolean(d.auto_activate_on_term_start));
        setMaxTotalCoverInput(decimalToInputString(d.max_total_cover));
        setMaxTotalDclSdlCoverInput(
            decimalToInputString(d.max_total_dcl_sdl_cover)
        );
        setMinCreditScoreInput(decimalToInputString(d.min_credit_score));
        setScoreValidityMonthsInput(
            d.score_validity_period_months != null
                ? String(d.score_validity_period_months)
                : ""
        );
        setMaxDclInput(decimalToInputString(d.max_dcl));
        setDclCustomerSinceMonthsInput(
            d.dcl_customer_since_months != null
                ? String(d.dcl_customer_since_months)
                : ""
        );
        setMaxPaymentTermInput(
            d.max_payment_term != null ? String(d.max_payment_term) : ""
        );
        setMaxAllowedMepInput(
            d.max_allowed_mep != null ? String(d.max_allowed_mep) : ""
        );
        setReportingDaysInput(
            d.reporting_days != null ? String(d.reporting_days) : ""
        );
        setMepCutoffDayOfMonthInput(
            d.mep_cutoff_day_of_month != null
                ? String(d.mep_cutoff_day_of_month)
                : ""
        );
        setMepSubstituteDayOfMonthInput(
            d.mep_substitute_day_of_month != null
                ? String(d.mep_substitute_day_of_month)
                : ""
        );
        setReportingCutoffDayOfMonthInput(
            d.reporting_cutoff_day_of_month != null
                ? String(d.reporting_cutoff_day_of_month)
                : ""
        );
        setReportingSubstituteDayOfMonthInput(
            d.reporting_substitute_day_of_month != null
                ? String(d.reporting_substitute_day_of_month)
                : ""
        );
        setPaymentTermCutoffDayOfMonthInput(
            d.payment_term_cutoff_day_of_month != null
                ? String(d.payment_term_cutoff_day_of_month)
                : ""
        );
        setPaymentTermSubstituteDayOfMonthInput(
            d.payment_term_substitute_day_of_month != null
                ? String(d.payment_term_substitute_day_of_month)
                : ""
        );
        setCostCalculationMethodInput(
            d.cost_calculation_method === "Limit"
                ? "Limit"
                : d.cost_calculation_method === "ActualSales"
                  ? "ActualSales"
                  : ""
        );
        setCostPercentInput(decimalToInputString(d.cost_percent));
        setPolicyFormErrors({});
    }, []);

    useEffect(() => {
        if (data) {
            fillFormFromPolicy(data);
        }
    }, [data, fillFormFromPolicy]);

    const invalidatePolicyQueries = async () => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: ["insurance-policy-details-page", accountId, policyId],
            }),
            queryClient.invalidateQueries({
                queryKey: ["insurance-policies-grid"],
            }),
            queryClient.invalidateQueries({
                queryKey: ["insurance-policies", accountId],
            }),
            queryClient.invalidateQueries({
                queryKey: ["insurance-policy", accountId],
            }),
        ]);
    };

    const savePolicyMutation = useMutation({
        mutationFn: async () => {
            const errors: Record<string, string> = {};
            const requiredMessage = t("validation.required", { ns: "common" });
            const pn = policyNumberInput.trim();
            if (!pn) {
                errors.policy_number = tCi("credit_insurance.validation.policy_number_required");
            }
            if (policyKindInput !== "TopUp") {
                if (!startDateInput) {
                    errors.start_date = tCi("credit_insurance.validation.start_date_required");
                }
                if (!endDateInput) {
                    errors.end_date = tCi("credit_insurance.validation.end_date_required");
                }
                if (
                    startDateInput &&
                    endDateInput &&
                    endDateInput < startDateInput
                ) {
                    errors.end_date = tCi("credit_insurance.validation.end_before_start");
                }
                if (
                    statusValue === "Active" &&
                    startDateInput &&
                    endDateInput &&
                    !canSetInsurancePolicyStatusActive(
                        startDateInput,
                        endDateInput
                    )
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
            if (policyKindInput === "Primary" && !currencyValue.trim()) {
                errors.currency = requiredMessage;
            }

            const mtc = parseOptionalDecimal(maxTotalCoverInput);
            const mtdc = parseOptionalDecimal(maxTotalDclSdlCoverInput);
            const mcs = parseOptionalDecimal(minCreditScoreInput);
            const mdcl = parseOptionalDecimal(maxDclInput);
            const svpm = parseOptionalInt(scoreValidityMonthsInput);
            const dcsm = parseOptionalInt(dclCustomerSinceMonthsInput);

            if (policyKindInput === "TopUp") {
                if (!parentInsurancePolicyIdInput) {
                    errors.parent_insurance_policy_id = tCi("credit_insurance.validation.parent_policy_required", { defaultValue: "Parent policy is required" });
                }
            } else {
                if (!maxTotalCoverInput.trim()) {
                    errors.max_total_cover = requiredMessage;
                }
                if (!minCreditScoreInput.trim()) {
                    errors.min_credit_score = requiredMessage;
                }
                if (!maxTotalDclSdlCoverInput.trim()) {
                    errors.max_total_dcl_sdl_cover = requiredMessage;
                }
                if (!scoreValidityMonthsInput.trim()) {
                    errors.score_validity_period_months = requiredMessage;
                }
                if (!maxDclInput.trim()) {
                    errors.max_dcl = requiredMessage;
                }
                if (!dclCustomerSinceMonthsInput.trim()) {
                    errors.dcl_customer_since_months = requiredMessage;
                }

                if (maxTotalCoverInput.trim() && mtc === null) {
                    errors.max_total_cover = tCi("credit_insurance.validation.invalid_number");
                }
                if (minCreditScoreInput.trim() && mcs === null) {
                    errors.min_credit_score = tCi("credit_insurance.validation.invalid_number");
                } else if (mcs !== null && mcs < 0) {
                    errors.min_credit_score = tCi("credit_insurance.validation.invalid_number");
                }
                if (maxDclInput.trim() && mdcl === null) {
                    errors.max_dcl = tCi("credit_insurance.validation.invalid_number");
                }
                if (maxTotalDclSdlCoverInput.trim() && mtdc === null) {
                    errors.max_total_dcl_sdl_cover = tCi("credit_insurance.validation.invalid_number");
                }
                if (mtc !== null && mdcl !== null && mdcl > mtc) {
                    errors.max_dcl = tCi(
                        "credit_insurance.validation.max_dcl_lte_max_total_cover"
                    );
                }
                if (scoreValidityMonthsInput.trim() && svpm === null) {
                    errors.score_validity_period_months = tCi("credit_insurance.validation.invalid_integer");
                }
                if (dclCustomerSinceMonthsInput.trim() && dcsm === null) {
                    errors.dcl_customer_since_months = tCi("credit_insurance.validation.invalid_integer");
                }
            }

            const mpt = parseOptionalInt(maxPaymentTermInput);
            const mam = parseOptionalInt(maxAllowedMepInput);
            const rd = parseOptionalInt(reportingDaysInput);
            const costPct = parseOptionalDecimal(costPercentInput);

            if (policyKindInput === "Primary" && costCalculationMethodInput) {
                if (!costPercentInput.trim()) {
                    errors.cost_percent = tCi(
                        "credit_insurance.validation.cost_percent_required_when_method_set"
                    );
                } else if (costPct === null || costPct <= 0) {
                    errors.cost_percent = tCi("credit_insurance.validation.invalid_number");
                }
            }

            if (policyKindInput !== "TopUp") {
                if (!maxPaymentTermInput.trim()) {
                    errors.max_payment_term = requiredMessage;
                }
                if (!maxAllowedMepInput.trim()) {
                    errors.max_allowed_mep = requiredMessage;
                }
                if (!reportingDaysInput.trim()) {
                    errors.reporting_days = requiredMessage;
                }
                if (maxPaymentTermInput.trim() && mpt === null) {
                    errors.max_payment_term = tCi("credit_insurance.validation.invalid_integer");
                }
                if (maxAllowedMepInput.trim() && mam === null) {
                    errors.max_allowed_mep = tCi("credit_insurance.validation.invalid_integer");
                }
                if (reportingDaysInput.trim() && rd === null) {
                    errors.reporting_days = tCi("credit_insurance.validation.invalid_integer");
                }

                const monthEndValidation = validateMonthEndCutoffFormFields({
                    mepCutoffRaw: mepCutoffDayOfMonthInput,
                    mepSubstituteRaw: mepSubstituteDayOfMonthInput,
                    reportingCutoffRaw: reportingCutoffDayOfMonthInput,
                    reportingSubstituteRaw: reportingSubstituteDayOfMonthInput,
                    paymentTermCutoffRaw: paymentTermCutoffDayOfMonthInput,
                    paymentTermSubstituteRaw: paymentTermSubstituteDayOfMonthInput,
                });
                for (const [field, code] of Object.entries(
                    monthEndValidation.errors
                )) {
                    errors[field] = monthEndCutoffErrorMessage(
                        code as MonthEndCutoffValidationErrorCode
                    );
                }
            }

            if (Object.keys(errors).length > 0) {
                setPolicyFormErrors(errors);
                throw new Error("validation");
            }
            setPolicyFormErrors({});
            const monthEndFields =
                policyKindInput === "TopUp"
                    ? {
                          mep_cutoff_day_of_month: null,
                          mep_substitute_day_of_month: null,
                          reporting_cutoff_day_of_month: null,
                          reporting_substitute_day_of_month: null,
                          payment_term_cutoff_day_of_month: null,
                          payment_term_substitute_day_of_month: null,
                      }
                    : validateMonthEndCutoffFormFields({
                          mepCutoffRaw: mepCutoffDayOfMonthInput,
                          mepSubstituteRaw: mepSubstituteDayOfMonthInput,
                          reportingCutoffRaw: reportingCutoffDayOfMonthInput,
                          reportingSubstituteRaw:
                              reportingSubstituteDayOfMonthInput,
                          paymentTermCutoffRaw: paymentTermCutoffDayOfMonthInput,
                          paymentTermSubstituteRaw:
                              paymentTermSubstituteDayOfMonthInput,
                      }).fields;
            await api.put(`/api/entities/insurance-policies/${policyId}`, {
                account_id: accountId,
                policy_number: pn,
                start_date: policyKindInput === "TopUp" ? null : startDateInput || null,
                end_date: policyKindInput === "TopUp" ? null : endDateInput || null,
                status: statusValue,
                currency: policyKindInput === "TopUp" ? null : currencyValue || null,
                insurer_name: insurerNameInput.trim() || null,
                policy_kind: policyKindInput,
                parent_insurance_policy_id: policyKindInput === "TopUp" ? parentInsurancePolicyIdInput : null,
                allow_concurrent_top_ups: data?.allow_concurrent_top_ups !== false,
                max_total_cover: policyKindInput === "TopUp" ? null : mtc,
                max_total_dcl_sdl_cover: policyKindInput === "TopUp" ? null : mtdc,
                min_credit_score: policyKindInput === "TopUp" ? null : mcs,
                score_validity_period_months: policyKindInput === "TopUp" ? null : svpm,
                max_dcl: policyKindInput === "TopUp" ? null : mdcl,
                dcl_customer_since_months: policyKindInput === "TopUp" ? null : dcsm,
                max_payment_term: policyKindInput === "TopUp" ? null : mpt,
                max_allowed_mep: policyKindInput === "TopUp" ? null : mam,
                reporting_days: policyKindInput === "TopUp" ? null : rd,
                ...monthEndFields,
                cost_calculation_method:
                    policyKindInput === "TopUp" ? null : costCalculationMethodInput || null,
                cost_percent:
                    policyKindInput === "TopUp" || !costCalculationMethodInput
                        ? null
                        : costPct,
                auto_activate_on_term_start:
                    policyKindInput === "Primary"
                        ? autoActivateOnTermStart
                        : false,
            });
        },
        onSuccess: async () => {
            await invalidatePolicyQueries();
            setIsEditing(false);
        },
        onError: (err: unknown) => {
            if (err instanceof Error && err.message === "validation") {
                return;
            }
            const msg =
                isAxiosError(err) && err.response?.data?.error
                    ? String(err.response.data.error)
                    : tCi("credit_insurance.save_failed");
            toastError(msg);
        },
    });

    const saveCountryMutation = useMutation({
        mutationFn: async () => {
            if (!selectedCountry?.id) {
                throw new Error("country_required");
            }
            const selectedCountryId = String(selectedCountry.id);
            const editingCountryId = editingCountryRow
                ? String(editingCountryRow.country_id)
                : null;

            await api.put(
                `/api/entities/insurance-policies/${policyId}/countries/${selectedCountry.id}`,
                {
                    account_id: accountId,
                    payment_term_cap: parseOptionalInt(countryForm.payment_term_cap),
                    country_mep: parseOptionalDecimal(countryForm.country_mep),
                    reporting_days: parseOptionalInt(countryForm.reporting_days),
                    country_max_limit: parseOptionalDecimal(
                        countryForm.country_max_limit
                    ),
                }
            );

            // If country changed while editing, remove the previous country row.
            if (
                editingCountryRow &&
                editingCountryId &&
                editingCountryId !== selectedCountryId
            ) {
                await api.delete(
                    `/api/entities/insurance-policy-countries/${editingCountryRow.id}`,
                    {
                        params: { account_id: accountId },
                    }
                );
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["insurance-policy-details-page", accountId, policyId],
            });
            setCountryModalOpen(false);
        },
    });

    const deleteCountryMutation = useMutation({
        mutationFn: async (countryRowId: string) => {
            await api.delete(
                `/api/entities/insurance-policy-countries/${countryRowId}`,
                { params: { account_id: accountId } }
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["insurance-policy-details-page", accountId, policyId],
            });
            setDeleteCountryDialogRow(null);
        },
    });

    const saveNamedMutation = useMutation({
        mutationFn: async () => {
            if (!accountId) throw new Error("account");
            const payload = {
                account_id: accountId,
                customer_number: namedForm.customer_number.trim(),
                max_payment_term: parseOptionalInt(namedForm.max_payment_term),
                customer_mep: parseOptionalInt(namedForm.customer_mep),
                reporting_days: parseOptionalInt(namedForm.reporting_days),
                customer_max_limit: parseOptionalDecimal(
                    namedForm.customer_max_limit
                ),
                limit_expiration_date: namedForm.limit_expiration_date.trim() || null,
            };
            if (editingNamedRow) {
                await api.put(
                    `/api/entities/insurance-policies/${policyId}/named-policies/${editingNamedRow.id}`,
                    payload
                );
            } else {
                await api.post(
                    `/api/entities/insurance-policies/${policyId}/named-policies`,
                    payload
                );
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["insurance-policy-details-page", accountId, policyId],
            });
            setNamedModalOpen(false);
        },
    });

    const deleteNamedMutation = useMutation({
        mutationFn: async (namedRowId: number) => {
            await api.delete(
                `/api/entities/insurance-policy-named-policies/${namedRowId}`,
                { params: { account_id: accountId } }
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["insurance-policy-details-page", accountId, policyId],
            });
            setDeleteNamedDialogRow(null);
        },
    });

    const handleStatusChange = (event: SelectChangeEvent<string>) => {
        const nextStatus =
            event.target.value === "Inactive"
                ? "Inactive"
                : event.target.value === "Draft"
                  ? "Draft"
                  : "Active";
        if (
            nextStatus === "Active" &&
            policyKindInput !== "TopUp" &&
            startDateInput &&
            endDateInput &&
            !canSetInsurancePolicyStatusActive(startDateInput, endDateInput)
        ) {
            toastError(
                tCi("credit_insurance.validation.cannot_activate_expired", {
                    defaultValue:
                        "Cannot set status to Active when the policy term does not include today.",
                })
            );
            return;
        }
        setStatusValue(nextStatus);
    };

    const handleCurrencyChange = (nextCurrency: string) => {
        setCurrencyValue(nextCurrency);
        clearPolicyFormError("currency");
    };

    const clearPolicyFormError = useCallback((key: string) => {
        setPolicyFormErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
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

    const initialStatus =
        data && data.status === "Inactive"
            ? ("Inactive" as const)
            : data && data.status === "Draft"
              ? ("Draft" as const)
              : ("Active" as const);
    const initialCurrency =
        data && data.currency !== null && data.currency !== undefined
            ? String(data.currency)
            : "";
    const initialPolicyNumber =
        data?.policy_number != null ? String(data.policy_number) : "";
    const initialStartDate = data ? dateToDateInputValue(data.start_date) : "";
    const initialEndDate = data ? dateToDateInputValue(data.end_date) : "";
    const initialInsurerName = data?.insurer_name ? String(data.insurer_name) : "";
    const initialPolicyKind = data?.policy_kind === "TopUp" ? "TopUp" : "Primary";
    const initialParentPolicyId = data?.parent_insurance_policy_id ?? null;
    const initialMaxTotalCover = data
        ? decimalToInputString(data.max_total_cover)
        : "";
    const initialMaxTotalDclSdlCover = data
        ? decimalToInputString(data.max_total_dcl_sdl_cover)
        : "";
    const initialMinCreditScore = data
        ? decimalToInputString(data.min_credit_score)
        : "";
    const initialScoreValidityMonths =
        data?.score_validity_period_months != null
            ? String(data.score_validity_period_months)
            : "";
    const initialMaxDcl = data ? decimalToInputString(data.max_dcl) : "";
    const initialDclCustomerSinceMonths =
        data?.dcl_customer_since_months != null
            ? String(data.dcl_customer_since_months)
            : "";
    const initialMaxPaymentTerm =
        data?.max_payment_term != null ? String(data.max_payment_term) : "";
    const initialMaxAllowedMep =
        data?.max_allowed_mep != null ? String(data.max_allowed_mep) : "";
    const initialReportingDays =
        data?.reporting_days != null ? String(data.reporting_days) : "";
    const initialMepCutoffDayOfMonth =
        data?.mep_cutoff_day_of_month != null
            ? String(data.mep_cutoff_day_of_month)
            : "";
    const initialMepSubstituteDayOfMonth =
        data?.mep_substitute_day_of_month != null
            ? String(data.mep_substitute_day_of_month)
            : "";
    const initialReportingCutoffDayOfMonth =
        data?.reporting_cutoff_day_of_month != null
            ? String(data.reporting_cutoff_day_of_month)
            : "";
    const initialReportingSubstituteDayOfMonth =
        data?.reporting_substitute_day_of_month != null
            ? String(data.reporting_substitute_day_of_month)
            : "";
    const initialPaymentTermCutoffDayOfMonth =
        data?.payment_term_cutoff_day_of_month != null
            ? String(data.payment_term_cutoff_day_of_month)
            : "";
    const initialPaymentTermSubstituteDayOfMonth =
        data?.payment_term_substitute_day_of_month != null
            ? String(data.payment_term_substitute_day_of_month)
            : "";
    const initialCostCalculationMethod =
        data?.cost_calculation_method === "Limit"
            ? "Limit"
            : data?.cost_calculation_method === "ActualSales"
              ? "ActualSales"
              : "";
    const initialCostPercent = data ? decimalToInputString(data.cost_percent) : "";
    const showPrimaryOnlySections = isEditing
        ? policyKindInput !== "TopUp"
        : data?.policy_kind !== "TopUp";
    const isPolicyDirty =
        statusValue !== initialStatus ||
        currencyValue !== initialCurrency ||
        policyNumberInput !== initialPolicyNumber ||
        startDateInput !== initialStartDate ||
        endDateInput !== initialEndDate ||
        insurerNameInput !== initialInsurerName ||
        policyKindInput !== initialPolicyKind ||
        parentInsurancePolicyIdInput !== initialParentPolicyId ||
        maxTotalCoverInput !== initialMaxTotalCover ||
        maxTotalDclSdlCoverInput !== initialMaxTotalDclSdlCover ||
        minCreditScoreInput !== initialMinCreditScore ||
        scoreValidityMonthsInput !== initialScoreValidityMonths ||
        maxDclInput !== initialMaxDcl ||
        dclCustomerSinceMonthsInput !== initialDclCustomerSinceMonths ||
        maxPaymentTermInput !== initialMaxPaymentTerm ||
        maxAllowedMepInput !== initialMaxAllowedMep ||
        reportingDaysInput !== initialReportingDays ||
        mepCutoffDayOfMonthInput !== initialMepCutoffDayOfMonth ||
        mepSubstituteDayOfMonthInput !== initialMepSubstituteDayOfMonth ||
        reportingCutoffDayOfMonthInput !== initialReportingCutoffDayOfMonth ||
        reportingSubstituteDayOfMonthInput !==
            initialReportingSubstituteDayOfMonth ||
        paymentTermCutoffDayOfMonthInput !== initialPaymentTermCutoffDayOfMonth ||
        paymentTermSubstituteDayOfMonthInput !==
            initialPaymentTermSubstituteDayOfMonth ||
        costCalculationMethodInput !== initialCostCalculationMethod ||
        costPercentInput !== initialCostPercent;
    const policyFormDisabled = savePolicyMutation.isPending || !isEditing;
    const countryFormDisabled = saveCountryMutation.isPending;
    const namedFormDisabled = saveNamedMutation.isPending;

    const handleEligibleForActivationToast = useCallback(() => {
        toastInfo(
            tCi("credit_insurance.notifications.policy_eligible_for_activation", {
                defaultValue:
                    "The policy term now includes today. Set status to Active when ready.",
            })
        );
    }, [toastInfo, tCi]);

    const handleCancelChanges = () => {
        if (data) {
            fillFormFromPolicy(data);
        }
        setPolicyFormErrors({});
        setIsEditing(false);
    };

    const handleStartEdit = () => {
        setPolicyFormErrors({});
        setIsEditing(true);
    };

    const handleSaveChanges = () => {
        if (!isEditing || !accountId || savePolicyMutation.isPending) return;
        if (!isPolicyDirty) {
            setPolicyFormErrors({});
            setIsEditing(false);
            return;
        }
        savePolicyMutation.mutate();
    };

    const handleOpenAddCountryModal = () => {
        setEditingCountryRow(null);
        setSelectedCountry(null);
        setCountryForm({
            payment_term_cap: "",
            country_mep: "",
            reporting_days: "",
            country_max_limit: "",
        });
        setCountryFormErrors({});
        setCountryModalOpen(true);
    };

    const handleOpenEditCountryModal = useCallback(
        (row: PolicyCountryRow) => {
            const fallbackName =
                row.Country?.name ||
                countryNameById.get(String(row.country_id)) ||
                row.Country?.iso2 ||
                String(row.country_id);

            const selected =
                countriesLookup.find(
                    (country) => String(country.id) === String(row.country_id)
                ) || {
                    id: row.country_id,
                    name: fallbackName,
                    iso2: row.Country?.iso2 || null,
                };

            setEditingCountryRow(row);
            setSelectedCountry(selected);
            setCountryForm({
                payment_term_cap:
                    row.payment_term_cap !== null &&
                    row.payment_term_cap !== undefined
                        ? String(row.payment_term_cap)
                        : "",
                country_mep:
                    row.country_mep !== null && row.country_mep !== undefined
                        ? String(row.country_mep)
                        : "",
                reporting_days:
                    row.reporting_days !== null && row.reporting_days !== undefined
                        ? String(row.reporting_days)
                        : "",
                country_max_limit:
                    row.country_max_limit !== null &&
                    row.country_max_limit !== undefined
                        ? String(row.country_max_limit)
                        : "",
            });
            setCountryFormErrors({});
            setCountryModalOpen(true);
        },
        [countriesLookup, countryNameById]
    );

    const handleDeletePolicyCountryRow = useCallback(
        (row: PolicyCountryRow) => {
            if (!accountId) return;
            setDeleteCountryDialogRow(row);
        },
        [accountId]
    );

    const handleDeleteCountryDialogClose = useCallback(() => {
        if (deleteCountryMutation.isPending) return;
        setDeleteCountryDialogRow(null);
    }, [deleteCountryMutation.isPending]);

    const handleConfirmDeleteCountry = useCallback(() => {
        if (!accountId || !deleteCountryDialogRow?.id) return;
        deleteCountryMutation.mutate(deleteCountryDialogRow.id);
    }, [accountId, deleteCountryDialogRow?.id, deleteCountryMutation]);

    const deleteCountryLabel =
        deleteCountryDialogRow?.Country?.name ||
        deleteCountryDialogRow?.Country?.iso2 ||
        (deleteCountryDialogRow
            ? String(deleteCountryDialogRow.country_id)
            : "");

    const deleteNamedLabel =
        deleteNamedDialogRow?.customer_number != null
            ? String(deleteNamedDialogRow.customer_number)
            : "";

    const handleSaveCountry = () => {
        const validationErrors: Record<string, string> = {};
        const requiredMessage = t("validation.required", { ns: "common" });
        if (!selectedCountry?.id) {
            validationErrors.country = tCi("credit_insurance.validation.country_required");
        }

        if (
            selectedCountry?.id &&
            countryRows.some(
                (row) =>
                    row.country_id === selectedCountry.id &&
                    (!editingCountryRow || row.id !== editingCountryRow.id)
            )
        ) {
            validationErrors.country = tCi("credit_insurance.validation.country_already_exists");
        }

        if (!countryForm.payment_term_cap.trim()) {
            validationErrors.payment_term_cap = requiredMessage;
        }
        if (!countryForm.country_mep.trim()) {
            validationErrors.country_mep = requiredMessage;
        }
        if (!countryForm.reporting_days.trim()) {
            validationErrors.reporting_days = requiredMessage;
        }
        if (!countryForm.country_max_limit.trim()) {
            validationErrors.country_max_limit = requiredMessage;
        }

        if (
            countryForm.payment_term_cap.trim() &&
            parseOptionalInt(countryForm.payment_term_cap) === null
        ) {
            validationErrors.payment_term_cap = tCi("credit_insurance.validation.invalid_integer");
        }
        if (
            countryForm.reporting_days.trim() &&
            parseOptionalInt(countryForm.reporting_days) === null
        ) {
            validationErrors.reporting_days = tCi("credit_insurance.validation.invalid_integer");
        }
        if (
            countryForm.country_mep.trim() &&
            parseOptionalDecimal(countryForm.country_mep) === null
        ) {
            validationErrors.country_mep = tCi("credit_insurance.validation.invalid_number");
        }
        if (
            countryForm.country_max_limit.trim() &&
            parseOptionalDecimal(countryForm.country_max_limit) === null
        ) {
            validationErrors.country_max_limit = tCi("credit_insurance.validation.invalid_number");
        }

        setCountryFormErrors(validationErrors);
        if (Object.keys(validationErrors).length > 0) return;
        saveCountryMutation.mutate();
    };

    const countryRows = useMemo(() => {
        const base = (data?.InsurancePolicyCountry || []).map((row) => ({
            ...row,
            country:
                row.Country?.name ||
                row.Country?.iso2 ||
                countryNameById.get(String(row.country_id)) ||
                "-",
        }));
        const q = debouncedCountrySearch.trim().toLowerCase();
        const filtered = !q
            ? base
            : base.filter((r) => {
            const countryName = r.country || "";
            const iso2 = r.Country?.iso2 || "";
            return (
                countryName.toLowerCase().includes(q) ||
                iso2.toLowerCase().includes(q)
            );
        });
        const sortField = sortModel[0]?.field;
        const sortDirection = sortModel[0]?.sort || "asc";
        if (!sortField) return filtered;
        const sorted = [...filtered].sort((a, b) => {
            const va =
                sortField === "country"
                    ? a.country || ""
                    : String((a as any)[sortField] ?? "");
            const vb =
                sortField === "country"
                    ? b.country || ""
                    : String((b as any)[sortField] ?? "");
            const cmp = va.localeCompare(vb, undefined, { numeric: true });
            return sortDirection === "desc" ? -cmp : cmp;
        });
        return sorted;
    }, [countryNameById, data?.InsurancePolicyCountry, debouncedCountrySearch, sortModel]);

    const handleExportPolicyCountries = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            return (data?.InsurancePolicyCountry || []).map((row) => ({
                country:
                    row.Country?.name ||
                    row.Country?.iso2 ||
                    countryNameById.get(String(row.country_id)) ||
                    "-",
                payment_term_cap: displayMaybe(row.payment_term_cap),
                country_mep: displayMaybe(row.country_mep),
                reporting_days: displayMaybe(row.reporting_days),
                country_max_limit: displayMaybe(row.country_max_limit),
            }));
        },
        [countryNameById, data?.InsurancePolicyCountry]
    );

    const countryColumns: GridColDef<PolicyCountryRow>[] = useMemo(
        () => [
            {
                field: "country",
                headerName: tCi("credit_insurance.countries_columns.country"),
                flex: 1,
                minWidth: 170,
                renderCell: (params) => (
                    <Typography
                        component="button"
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditCountryModal(params.row as PolicyCountryRow);
                        }}
                        sx={{
                            p: 0,
                            m: 0,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            minWidth: 0,
                            textTransform: "none",
                            fontWeight: 500,
                            color: "primary.main",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            lineHeight: 1.4,
                            textDecoration: "none",
                            boxShadow: "none !important",
                            "&:hover": {
                                textDecoration: "underline",
                                background: "transparent",
                                boxShadow: "none !important",
                            },
                            "&:focus": {
                                outline: "none",
                                boxShadow: "none !important",
                            },
                            "&:focus-visible": {
                                outline: "none",
                                boxShadow: "none !important",
                            },
                        }}
                    >
                        {String(params.value ?? "-")}
                    </Typography>
                ),
            },
            {
                field: "payment_term_cap",
                headerName: tCi(
                    "credit_insurance.countries_columns.payment_term_cap"
                ),
                flex: 1,
                minWidth: 140,
                valueGetter: (value) => displayMaybe(value),
            },
            {
                field: "country_mep",
                headerName: tCi(
                    "credit_insurance.countries_columns.country_mep"
                ),
                flex: 1,
                minWidth: 120,
                valueGetter: (value) => displayMaybe(value),
            },
            {
                field: "reporting_days",
                headerName: tCi(
                    "credit_insurance.countries_columns.reporting_days"
                ),
                flex: 1,
                minWidth: 130,
                valueGetter: (value) => displayMaybe(value),
            },
            {
                field: "country_max_limit",
                headerName: tCi(
                    "credit_insurance.countries_columns.country_max_limit"
                ),
                flex: 1,
                minWidth: 150,
                valueGetter: (value) => displayMaybe(value),
            },
            {
                field: "actions",
                headerName: tCi("credit_insurance.columns.actions"),
                width: 64,
                minWidth: 64,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                align: "center",
                headerAlign: "center",
                renderCell: (params) => {
                    const busy =
                        deleteCountryMutation.isPending || saveCountryMutation.isPending;
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Tooltip title={t("actions.delete", { ns: "common" })}>
                                <span>
                                    <IconButton
                                        size="small"
                                        color="primary"
                                        disabled={busy}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeletePolicyCountryRow(
                                                params.row as PolicyCountryRow
                                            );
                                        }}
                                        aria-label={t("actions.delete", { ns: "common" })}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>
                    );
                },
            },
        ],
        [
            t,
            tCi,
            handleOpenEditCountryModal,
            handleDeletePolicyCountryRow,
            deleteCountryMutation.isPending,
            saveCountryMutation.isPending,
        ]
    );

    const handleOpenAddNamedModal = () => {
        setEditingNamedRow(null);
        setNamedForm({
            customer_number: "",
            max_payment_term: "",
            customer_mep: "",
            reporting_days: "",
            customer_max_limit: "",
            limit_expiration_date: "",
        });
        setNamedFormErrors({});
        setNamedModalOpen(true);
    };

    const handleOpenEditNamedModal = useCallback((row: NamedPolicyRow) => {
        setEditingNamedRow(row);
        setNamedForm({
            customer_number: row.customer_number ?? "",
            max_payment_term:
                row.max_payment_term != null ? String(row.max_payment_term) : "",
            customer_mep:
                row.customer_mep != null ? String(row.customer_mep) : "",
            reporting_days:
                row.reporting_days != null ? String(row.reporting_days) : "",
            customer_max_limit:
                row.customer_max_limit != null && row.customer_max_limit !== ""
                    ? String(row.customer_max_limit)
                    : "",
            limit_expiration_date: row.limit_expiration_date
                ? String(row.limit_expiration_date).slice(0, 10)
                : "",
        });
        setNamedFormErrors({});
        setNamedModalOpen(true);
    }, []);

    const handleDeleteNamedPolicyRow = useCallback(
        (row: NamedPolicyRow) => {
            if (!accountId) return;
            setDeleteNamedDialogRow(row);
        },
        [accountId]
    );

    const handleDeleteNamedDialogClose = useCallback(() => {
        if (deleteNamedMutation.isPending) return;
        setDeleteNamedDialogRow(null);
    }, [deleteNamedMutation.isPending]);

    const handleConfirmDeleteNamed = useCallback(() => {
        if (!accountId || deleteNamedDialogRow?.id == null) return;
        deleteNamedMutation.mutate(deleteNamedDialogRow.id);
    }, [accountId, deleteNamedDialogRow?.id, deleteNamedMutation]);

    const handleSaveNamed = () => {
        const validationErrors: Record<string, string> = {};
        const requiredMessage = t("validation.required", { ns: "common" });
        const cn = namedForm.customer_number.trim();
        if (!cn) {
            validationErrors.customer_number = requiredMessage;
        }

        if (!namedForm.max_payment_term.trim()) {
            validationErrors.max_payment_term = requiredMessage;
        }
        if (!namedForm.customer_mep.trim()) {
            validationErrors.customer_mep = requiredMessage;
        }
        if (!namedForm.reporting_days.trim()) {
            validationErrors.reporting_days = requiredMessage;
        }
        if (!namedForm.customer_max_limit.trim()) {
            validationErrors.customer_max_limit = requiredMessage;
        }

        if (
            namedForm.max_payment_term.trim() &&
            parseOptionalInt(namedForm.max_payment_term) === null
        ) {
            validationErrors.max_payment_term = tCi(
                "credit_insurance.validation.invalid_integer"
            );
        }
        if (
            namedForm.customer_mep.trim() &&
            parseOptionalInt(namedForm.customer_mep) === null
        ) {
            validationErrors.customer_mep = tCi(
                "credit_insurance.validation.invalid_integer"
            );
        }
        if (
            namedForm.reporting_days.trim() &&
            parseOptionalInt(namedForm.reporting_days) === null
        ) {
            validationErrors.reporting_days = tCi(
                "credit_insurance.validation.invalid_integer"
            );
        }
        if (
            namedForm.customer_max_limit.trim() &&
            parseOptionalDecimal(namedForm.customer_max_limit) === null
        ) {
            validationErrors.customer_max_limit = tCi(
                "credit_insurance.validation.invalid_number"
            );
        }

        setNamedFormErrors(validationErrors);
        if (Object.keys(validationErrors).length > 0) return;
        saveNamedMutation.mutate(undefined, {
            onError: (err: unknown) => {
                if (
                    isAxiosError(err) &&
                    err.response?.status === 409
                ) {
                    setNamedFormErrors((prev) => ({
                        ...prev,
                        customer_number: tCi(
                            "credit_insurance.validation.named_customer_number_exists"
                        ),
                    }));
                }
            },
        });
    };

    const excludeNamedCustomerNumbers = useMemo(
        () =>
            (data?.NamedPolicy || [])
                .map((row) => row.customer_number)
                .filter((customerNumber): customerNumber is string =>
                    Boolean(customerNumber?.trim())
                ),
        [data?.NamedPolicy]
    );

    const namedRows = useMemo(() => {
        const base = (data?.NamedPolicy || []).map((row) => ({
            ...row,
        }));
        const q = debouncedNamedSearch.trim().toLowerCase();
        const filtered = !q
            ? base
            : base.filter((r) => {
                  const customerNumber = String(r.customer_number ?? "").toLowerCase();
                  const customerName = String(r.customer_name ?? "").toLowerCase();
                  return customerNumber.includes(q) || customerName.includes(q);
              });
        const sortField = namedSortModel[0]?.field;
        const sortDirection = namedSortModel[0]?.sort || "asc";
        if (!sortField) return filtered;
        const sorted = [...filtered].sort((a, b) => {
            const va = String((a as Record<string, unknown>)[sortField] ?? "");
            const vb = String((b as Record<string, unknown>)[sortField] ?? "");
            const cmp = va.localeCompare(vb, undefined, { numeric: true });
            return sortDirection === "desc" ? -cmp : cmp;
        });
        return sorted;
    }, [data?.NamedPolicy, debouncedNamedSearch, namedSortModel]);

    const handleExportNamedPolicies = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            return (data?.NamedPolicy || []).map((row) => ({
                customer_number: displayMaybe(row.customer_number),
                customer_name: displayMaybe(row.customer_name),
                max_payment_term: displayMaybe(row.max_payment_term),
                customer_mep: displayMaybe(row.customer_mep),
                reporting_days: displayMaybe(row.reporting_days),
                customer_max_limit: displayMaybe(row.customer_max_limit),
                limit_expiration_date:
                    limitExpirationDateToYmd(row.limit_expiration_date) ?? "-",
            }));
        },
        [data?.NamedPolicy]
    );

    const namedColumns: GridColDef<NamedPolicyRow>[] = useMemo(
        () => [
            {
                field: "customer_number",
                headerName: tCi("credit_insurance.named_columns.customer_number"),
                flex: 1,
                minWidth: 160,
                renderCell: (params) => (
                    <Typography
                        component="button"
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditNamedModal(
                                params.row as NamedPolicyRow
                            );
                        }}
                        sx={{
                            p: 0,
                            m: 0,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            minWidth: 0,
                            textTransform: "none",
                            fontWeight: 500,
                            color: "primary.main",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            lineHeight: 1.4,
                            textDecoration: "underline",
                            textUnderlineOffset: "0.125em",
                            boxShadow: "none !important",
                            "&:hover": {
                                textDecoration: "underline",
                                color: "primary.dark",
                                background: "transparent",
                                boxShadow: "none !important",
                            },
                            "&:focus": {
                                outline: "none",
                                boxShadow: "none !important",
                            },
                            "&:focus-visible": {
                                outline: "none",
                                boxShadow: "none !important",
                            },
                        }}
                    >
                        {String(params.value ?? "-")}
                    </Typography>
                ),
            },
            {
                field: "customer_name",
                headerName: t("fields.name", { ns: "customers" }),
                flex: 1.5,
                minWidth: 180,
                valueGetter: (value) => displayMaybe(value),
                renderCell: (params) => {
                    const row = params.row as NamedPolicyRow;
                    const label = displayMaybe(params.value);
                    const customerId = row.customer_id;
                    if (!customerId || label === "-") {
                        return (
                            <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                                {label}
                            </Typography>
                        );
                    }
                    return (
                        <Link
                            href={`/${locale}/app/customers/${customerId}`}
                            sx={{
                                color: "primary.main",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                textDecoration: "underline",
                                textUnderlineOffset: "0.125em",
                                "&:hover": {
                                    textDecoration: "underline",
                                    color: "primary.dark",
                                },
                            }}
                        >
                            {label}
                        </Link>
                    );
                },
            },
            {
                field: "max_payment_term",
                headerName: tCi("credit_insurance.named_columns.max_payment_term"),
                flex: 1,
                minWidth: 140,
                valueGetter: (value) => displayMaybe(value),
            },
            {
                field: "customer_mep",
                headerName: tCi("credit_insurance.named_columns.customer_mep"),
                flex: 1,
                minWidth: 130,
                valueGetter: (value) => displayMaybe(value),
            },
            {
                field: "reporting_days",
                headerName: tCi("credit_insurance.named_columns.reporting_days"),
                flex: 1,
                minWidth: 130,
                valueGetter: (value) => displayMaybe(value),
            },
            {
                field: "customer_max_limit",
                headerName: tCi("credit_insurance.named_columns.customer_max_limit"),
                flex: 1,
                minWidth: 150,
                valueGetter: (value) => displayMaybe(value),
            },
            {
                field: "limit_expiration_date",
                headerName: tCi(
                    "credit_insurance.named_columns.limit_expiration_date",
                    { defaultValue: "Limit expiration date" }
                ),
                flex: 1,
                minWidth: 150,
                valueGetter: (params: { value: unknown }) =>
                    limitExpirationDateToYmd(params.value) ?? "",
                renderCell: (params) => {
                    const ymd = limitExpirationDateToYmd(
                        (params.row as NamedPolicyRow).limit_expiration_date
                    );
                    return (
                        <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                            {ymd
                                ? formatDateOnlyYmdForSession(
                                      ymd,
                                      session ?? null
                                  )
                                : "-"}
                        </Typography>
                    );
                },
            },
            {
                field: "actions",
                headerName: tCi("credit_insurance.columns.actions"),
                width: 64,
                minWidth: 64,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                align: "center",
                headerAlign: "center",
                renderCell: (params) => {
                    const busy =
                        deleteNamedMutation.isPending ||
                        saveNamedMutation.isPending;
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Tooltip title={t("actions.delete", { ns: "common" })}>
                                <span>
                                    <IconButton
                                        size="small"
                                        color="primary"
                                        disabled={busy}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteNamedPolicyRow(
                                                params.row as NamedPolicyRow
                                            );
                                        }}
                                        aria-label={t("actions.delete", {
                                            ns: "common",
                                        })}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>
                    );
                },
            },
        ],
        [
            t,
            tCi,
            locale,
            session,
            handleOpenEditNamedModal,
            handleDeleteNamedPolicyRow,
            deleteNamedMutation.isPending,
            saveNamedMutation.isPending,
        ]
    );

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: 320,
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    if (error || !data) {
        return (
            <Box sx={{ py: 4 }}>
                <Typography color="error">
                    {tCi("credit_insurance.load_policy_failed")}
                </Typography>
                <Button
                    sx={{ mt: 2 }}
                    variant="text"
                    onClick={() => router.push(backUrl)}
                >
                    {tCi("credit_insurance.back_to_policies")}
                </Button>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                bgcolor: "background.default",
                minHeight: "100vh",
                m: 0,
                p: 0,
                mt: { xs: -1, sm: -1.5 },
                mx: { xs: -1, sm: -1.5 },
                width: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
                maxWidth: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
                direction: i18n.language === "he" ? "rtl" : "ltr",
            }}
        >
            <Seo
                title={`${displayMaybe(data.policy_number)} - ${tCi("credit_insurance.policy_details_title")}`}
            />
            <Box
                ref={headerRef}
                sx={{
                    position: "sticky",
                    top: { xs: "-8px", sm: "-12px" },
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    bgcolor: "background.paper",
                    flexShrink: 0,
                    px: { xs: 1, sm: 1.5 },
                    m: 0,
                    mt: 0,
                    backgroundColor: "background.paper",
                    width: "100%",
                    maxWidth: "100%",
                    pt: { xs: 1, sm: 1.5 },
                }}
            >
                <Box>
                    <Breadcrumbs
                        sx={{
                            mb: 1,
                            width: "100%",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiBreadcrumbs-ol": {
                                flexWrap: "nowrap",
                                overflow: "hidden",
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                            },
                            "& .MuiBreadcrumbs-li": {
                                minWidth: 0,
                                flexShrink: 1,
                                maxWidth: "none",
                            },
                        }}
                    >
                        <Link
                            component="button"
                            variant="body1"
                            onClick={() =>
                                router.push(resolveLocalizedUrl("/app/settings", locale))
                            }
                            sx={{
                                textDecoration: "none",
                                color: "primary.main",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minWidth: 0,
                            }}
                        >
                            {t("fields.title", { ns: "settings" })}
                        </Link>
                        <Link
                            component="button"
                            variant="body1"
                            onClick={() => router.push(backUrl)}
                            sx={{
                                textDecoration: "none",
                                color: "primary.main",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minWidth: 0,
                            }}
                        >
                            {tCi("credit_insurance.list_title")}
                        </Link>
                        <Typography
                            color="text.primary"
                            sx={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minWidth: 0,
                            }}
                        >
                            {displayMaybe(data.policy_number)}
                        </Typography>
                    </Breadcrumbs>

                    <Box sx={{ "& .MuiPaper-root": { mb: 0 } }}>
                        <PageHeader
                            title={displayMaybe(data.policy_number)}
                            description={tCi("credit_insurance.edit_page_description")}
                            sticky={false}
                        />
                    </Box>
                </Box>
            </Box>

            {showPolicyExpiredBanner && effectiveEndDateYmd ? (
                <Box sx={{ px: { xs: 1, sm: 1.5 }, mb: 1 }}>
                    <CustomerHeaderNotificationBanner
                        variant="error"
                        borderRadius={notificationBannerBorderRadius}
                        icon={
                            <WarningIcon
                                sx={{ fontSize: 18, color: "error.main" }}
                            />
                        }
                        message={t("credit_insurance_dashboard.policy_expired_single", {
                            ns: "dashboard",
                            end_date: formatDateForDisplay(
                                effectiveEndDateYmd,
                                "date",
                                userLocale,
                                userTimezone
                            ),
                        })}
                    />
                </Box>
            ) : null}

            {showTopUpParentInactiveBanner && parentPolicyForBanner ? (
                <Box sx={{ px: { xs: 1, sm: 1.5 }, mb: 1 }}>
                    <CustomerHeaderNotificationBanner
                        variant="error"
                        borderRadius={notificationBannerBorderRadius}
                        icon={
                            <WarningIcon
                                sx={{ fontSize: 18, color: "error.main" }}
                            />
                        }
                        message={tCi(
                            "credit_insurance.notifications.topup_parent_inactive",
                            {
                                defaultValue:
                                    "This top-up policy is inactive because parent policy {{policy_number}} is not active.",
                                policy_number: parentPolicyForBanner.policy_number,
                            }
                        )}
                    />
                </Box>
            ) : null}

            {showPolicyEligibleForActivationBanner ? (
                <Box sx={{ px: { xs: 1, sm: 1.5 }, mb: 1 }}>
                    <CustomerHeaderNotificationBanner
                        variant="warning"
                        borderRadius={notificationBannerBorderRadius}
                        icon={
                            <InfoOutlinedIcon
                                sx={{ fontSize: 18, color: "warning.main" }}
                            />
                        }
                        message={tCi(
                            "credit_insurance.notifications.policy_eligible_for_activation",
                            {
                                defaultValue:
                                    "The policy term includes today. Set status to Active when ready.",
                            }
                        )}
                    />
                </Box>
            ) : null}

            <Box sx={{ px: { xs: 1, sm: 1.5 }, py: 0 }}>
                <PolicyGeneralInfo
                    data={data}
                    isEditing={isEditing}
                    canEdit={canEditPolicy}
                    isSaving={savePolicyMutation.isPending}
                    policyFormDisabled={policyFormDisabled}
                    policyFormErrors={policyFormErrors}
                    session={session ?? null}
                    datePickerAdapterLocale={datePickerAdapterLocale}
                    modalTextFieldProps={modalTextFieldProps}
                    modalTextFieldSx={modalTextFieldSx}
                    menuItemSx={menuItemSx}
                    insurerNameInput={insurerNameInput}
                    setInsurerNameInput={setInsurerNameInput}
                    costCalculationMethodInput={costCalculationMethodInput}
                    setCostCalculationMethodInput={setCostCalculationMethodInput}
                    costPercentInput={costPercentInput}
                    setCostPercentInput={setCostPercentInput}
                    policyKindInput={policyKindInput}
                    setPolicyKindInput={setPolicyKindInput}
                    parentInsurancePolicyIdInput={parentInsurancePolicyIdInput}
                    setParentInsurancePolicyIdInput={setParentInsurancePolicyIdInput}
                    parentPolicySelectOptions={parentPolicySelectOptions}
                    policyNumberInput={policyNumberInput}
                    setPolicyNumberInput={setPolicyNumberInput}
                    statusValue={statusValue}
                    handleStatusChange={handleStatusChange}
                    canSelectActiveStatus={canSelectActiveStatus}
                    showAutoActivateOnTermStart={showAutoActivateOnTermStart}
                    autoActivateOnTermStart={autoActivateOnTermStart}
                    setAutoActivateOnTermStart={setAutoActivateOnTermStart}
                    startDateInput={startDateInput}
                    setStartDateInput={setStartDateInput}
                    endDateInput={endDateInput}
                    setEndDateInput={setEndDateInput}
                    currencyValue={currencyValue}
                    handleCurrencyChange={handleCurrencyChange}
                    maxTotalCoverInput={maxTotalCoverInput}
                    setMaxTotalCoverInput={setMaxTotalCoverInput}
                    minCreditScoreInput={minCreditScoreInput}
                    setMinCreditScoreInput={setMinCreditScoreInput}
                    scoreValidityMonthsInput={scoreValidityMonthsInput}
                    setScoreValidityMonthsInput={setScoreValidityMonthsInput}
                    maxTotalDclSdlCoverInput={maxTotalDclSdlCoverInput}
                    setMaxTotalDclSdlCoverInput={setMaxTotalDclSdlCoverInput}
                    maxDclInput={maxDclInput}
                    setMaxDclInput={setMaxDclInput}
                    dclCustomerSinceMonthsInput={dclCustomerSinceMonthsInput}
                    setDclCustomerSinceMonthsInput={setDclCustomerSinceMonthsInput}
                    maxPaymentTermInput={maxPaymentTermInput}
                    setMaxPaymentTermInput={setMaxPaymentTermInput}
                    paymentTermCutoffDayOfMonthInput={paymentTermCutoffDayOfMonthInput}
                    setPaymentTermCutoffDayOfMonthInput={
                        setPaymentTermCutoffDayOfMonthInput
                    }
                    paymentTermSubstituteDayOfMonthInput={
                        paymentTermSubstituteDayOfMonthInput
                    }
                    setPaymentTermSubstituteDayOfMonthInput={
                        setPaymentTermSubstituteDayOfMonthInput
                    }
                    maxAllowedMepInput={maxAllowedMepInput}
                    setMaxAllowedMepInput={setMaxAllowedMepInput}
                    mepCutoffDayOfMonthInput={mepCutoffDayOfMonthInput}
                    setMepCutoffDayOfMonthInput={setMepCutoffDayOfMonthInput}
                    mepSubstituteDayOfMonthInput={mepSubstituteDayOfMonthInput}
                    setMepSubstituteDayOfMonthInput={setMepSubstituteDayOfMonthInput}
                    reportingDaysInput={reportingDaysInput}
                    setReportingDaysInput={setReportingDaysInput}
                    reportingCutoffDayOfMonthInput={reportingCutoffDayOfMonthInput}
                    setReportingCutoffDayOfMonthInput={setReportingCutoffDayOfMonthInput}
                    reportingSubstituteDayOfMonthInput={reportingSubstituteDayOfMonthInput}
                    setReportingSubstituteDayOfMonthInput={
                        setReportingSubstituteDayOfMonthInput
                    }
                    displayStartDate={displayStartDate}
                    displayEndDate={displayEndDate}
                    clearPolicyFormError={clearPolicyFormError}
                    sanitizeDecimalInput={sanitizeDecimalInput}
                    sanitizeIntegerInput={sanitizeIntegerInput}
                    decimalToInputString={decimalToInputString}
                    onEditClick={handleStartEdit}
                    onCancelEdit={handleCancelChanges}
                    onSave={handleSaveChanges}
                    onEligibleForActivationToast={handleEligibleForActivationToast}
                    tCi={tCi}
                    tCommon={tCommon}
                />

                {showPrimaryOnlySections && (
                    <>
                        <Box
                            sx={{
                                p: { xs: 1.5, sm: 2 },
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                                <PublicIcon
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
                                    {tCi("credit_insurance.policy_countries_title")}
                                </Typography>
                            </Box>
                            <Box sx={{ position: "relative", isolation: "isolate" }}>
                                <EndlessScrollDataGrid
                                    rows={countryRows}
                                    columns={countryColumns}
                                    totalRecords={countryRows.length}
                                    isLoading={false}
                                    onLoadMore={() => {}}
                                    hasMore={false}
                                    sortModel={sortModel}
                                    onSortModelChange={setSortModel}
                                    searchValue={countrySearch}
                                    onSearchChange={setCountrySearch}
                                    searchPlaceholder={t("fields.search_placeholder", {
                                        ns: "common",
                                    })}
                                    searchDebounceMs={500}
                                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                                    language={i18n.language}
                                    fillViewport={false}
                                    resizableColumns={true}
                                    onExport={handleExportPolicyCountries}
                                    exportContextInfo={{
                                        pageName: "credit_insurance_policy_countries",
                                        customPrefix: `policy_${policyId}_countries`,
                                    }}
                                    customButtons={
                                        <Tooltip
                                            title={tCi("credit_insurance.add_policy_country")}
                                        >
                                            <IconButton
                                                color="primary"
                                                size="small"
                                                onClick={handleOpenAddCountryModal}
                                                disabled={
                                                    saveCountryMutation.isPending ||
                                                    deleteCountryMutation.isPending
                                                }
                                                className="toolbar-button"
                                            >
                                                <AddIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    }
                                    noRowsMessage={tCi("credit_insurance.no_countries")}
                                />
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                p: { xs: 1.5, sm: 2 },
                                pt: 0,
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                                <PersonIcon
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
                                    {tCi("credit_insurance.named_policies_title")}
                                </Typography>
                            </Box>
                            <Box sx={{ position: "relative", isolation: "isolate" }}>
                                <EndlessScrollDataGrid
                                    rows={namedRows}
                                    columns={namedColumns}
                                    totalRecords={namedRows.length}
                                    isLoading={false}
                                    onLoadMore={() => {}}
                                    hasMore={false}
                                    sortModel={namedSortModel}
                                    onSortModelChange={setNamedSortModel}
                                    searchValue={namedSearch}
                                    onSearchChange={setNamedSearch}
                                    searchPlaceholder={t("fields.search_placeholder", {
                                        ns: "common",
                                    })}
                                    searchDebounceMs={500}
                                    searchDirection={
                                        i18n.language === "he" ? "rtl" : "ltr"
                                    }
                                    language={i18n.language}
                                    fillViewport={false}
                                    resizableColumns={true}
                                    onExport={handleExportNamedPolicies}
                                    exportContextInfo={{
                                        pageName: "credit_insurance_named_policies",
                                        customPrefix: `policy_${policyId}_named`,
                                    }}
                                    customButtons={
                                        <Tooltip
                                            title={tCi(
                                                "credit_insurance.add_named_policy"
                                            )}
                                        >
                                            <IconButton
                                                color="primary"
                                                size="small"
                                                onClick={handleOpenAddNamedModal}
                                                disabled={
                                                    saveNamedMutation.isPending ||
                                                    deleteNamedMutation.isPending
                                                }
                                                className="toolbar-button"
                                            >
                                                <AddIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    }
                                    noRowsMessage={tCi(
                                        "credit_insurance.no_named_policies"
                                    )}
                                />
                            </Box>
                        </Box>
                    </>
                )}

                <AppDialog
                    open={countryModalOpen}
                    onClose={() => {
                        if (!saveCountryMutation.isPending) {
                            setCountryModalOpen(false);
                        }
                    }}
                    drag
                    align
                    slide
                    isRTL={isRTL}
                    paperWidth="440px"
                    paperMaxHeight="90vh"
                    title={
                        editingCountryRow
                            ? tCi("credit_insurance.edit_policy_country")
                            : tCi("credit_insurance.add_policy_country")
                    }
                    ariaLabelledBy="policy-country-modal-title"
                    ariaDescribedBy="policy-country-modal-description"
                    scrollContainerId={POLICY_COUNTRY_MODAL_SCROLL_ID}
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
                                onClick={() => setCountryModalOpen(false)}
                                disabled={countryFormDisabled}
                                variant="outlined"
                            >
                                {t("actions.cancel", { ns: "common" })}
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSaveCountry}
                                disabled={countryFormDisabled}
                            >
                                {t("actions.save", { ns: "common" })}
                            </Button>
                        </>
                    }
                >
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            flex: "1 1 auto",
                            minHeight: 0,
                            overflow: "hidden",
                        }}
                        dir={isRTL ? "rtl" : "ltr"}
                    >
                        <ModalScrollBox
                            id={POLICY_COUNTRY_MODAL_SCROLL_ID}
                            isRTL={isRTL}
                            sx={{ px: 3 }}
                        >
                            <Box
                                id="policy-country-modal-description"
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        sm: "repeat(2, minmax(0, 1fr))",
                                    },
                                    gap: 2,
                                    pt: 1,
                                    pb: 2,
                                    direction: isRTL ? "rtl" : "ltr",
                                }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <CountrySelect
                                        value={selectedCountry}
                                        onChange={(value) => {
                                            setSelectedCountry(value);
                                            setCountryFormErrors((prev) => {
                                                if (!prev.country) return prev;
                                                const next = { ...prev };
                                                delete next.country;
                                                return next;
                                            });
                                        }}
                                        label={tCi(
                                            "credit_insurance.fields.country"
                                        )}
                                        required
                                        disabled={countryFormDisabled}
                                        error={!!countryFormErrors.country}
                                        helperText={countryFormErrors.country}
                                    />
                                </Box>
                                <TextField
                                    {...modalTextFieldProps}
                                    fullWidth
                                    required
                                    label={tCi(
                                        "credit_insurance.countries_columns.payment_term_cap"
                                    )}
                                    value={countryForm.payment_term_cap}
                                    onChange={(e) =>
                                        {
                                            setCountryForm((prev) => ({
                                                ...prev,
                                                payment_term_cap: sanitizeIntegerInput(
                                                    e.target.value
                                                ),
                                            }));
                                            setCountryFormErrors((prev) => {
                                                if (!prev.payment_term_cap) return prev;
                                                const next = { ...prev };
                                                delete next.payment_term_cap;
                                                return next;
                                            });
                                        }
                                    }
                                    error={!!countryFormErrors.payment_term_cap}
                                    helperText={countryFormErrors.payment_term_cap}
                                    inputMode="numeric"
                                    size="small"
                                    disabled={countryFormDisabled}
                                    sx={{
                                        ...modalTextFieldSx,
                                        minWidth: 0,
                                    }}
                                />
                                <TextField
                                    {...modalTextFieldProps}
                                    fullWidth
                                    required
                                    label={tCi(
                                        "credit_insurance.countries_columns.country_mep"
                                    )}
                                    value={countryForm.country_mep}
                                    onChange={(e) =>
                                        {
                                            setCountryForm((prev) => ({
                                                ...prev,
                                                country_mep: sanitizeDecimalInput(
                                                    e.target.value
                                                ),
                                            }));
                                            setCountryFormErrors((prev) => {
                                                if (!prev.country_mep) return prev;
                                                const next = { ...prev };
                                                delete next.country_mep;
                                                return next;
                                            });
                                        }
                                    }
                                    error={!!countryFormErrors.country_mep}
                                    helperText={countryFormErrors.country_mep}
                                    inputMode="decimal"
                                    size="small"
                                    disabled={countryFormDisabled}
                                    sx={{
                                        ...modalTextFieldSx,
                                        minWidth: 0,
                                    }}
                                />
                                <TextField
                                    {...modalTextFieldProps}
                                    fullWidth
                                    required
                                    label={tCi(
                                        "credit_insurance.countries_columns.reporting_days"
                                    )}
                                    value={countryForm.reporting_days}
                                    onChange={(e) =>
                                        {
                                            setCountryForm((prev) => ({
                                                ...prev,
                                                reporting_days: sanitizeIntegerInput(
                                                    e.target.value
                                                ),
                                            }));
                                            setCountryFormErrors((prev) => {
                                                if (!prev.reporting_days) return prev;
                                                const next = { ...prev };
                                                delete next.reporting_days;
                                                return next;
                                            });
                                        }
                                    }
                                    error={!!countryFormErrors.reporting_days}
                                    helperText={countryFormErrors.reporting_days}
                                    inputMode="numeric"
                                    size="small"
                                    disabled={countryFormDisabled}
                                    sx={{
                                        ...modalTextFieldSx,
                                        minWidth: 0,
                                    }}
                                />
                                <TextField
                                    {...modalTextFieldProps}
                                    fullWidth
                                    required
                                    label={tCi(
                                        "credit_insurance.countries_columns.country_max_limit"
                                    )}
                                    value={countryForm.country_max_limit}
                                    onChange={(e) =>
                                        {
                                            setCountryForm((prev) => ({
                                                ...prev,
                                                country_max_limit: sanitizeDecimalInput(
                                                    e.target.value
                                                ),
                                            }));
                                            setCountryFormErrors((prev) => {
                                                if (!prev.country_max_limit) return prev;
                                                const next = { ...prev };
                                                delete next.country_max_limit;
                                                return next;
                                            });
                                        }
                                    }
                                    error={!!countryFormErrors.country_max_limit}
                                    helperText={countryFormErrors.country_max_limit}
                                    inputMode="decimal"
                                    size="small"
                                    disabled={countryFormDisabled}
                                    sx={{
                                        ...modalTextFieldSx,
                                        minWidth: 0,
                                    }}
                                />
                            </Box>
                        </ModalScrollBox>
                    </Box>
                </AppDialog>

                <AppDialog
                    open={namedModalOpen}
                    onClose={() => {
                        if (!saveNamedMutation.isPending) {
                            setNamedModalOpen(false);
                        }
                    }}
                    drag
                    align
                    slide
                    isRTL={isRTL}
                    paperWidth="560px"
                    paperMaxHeight="90vh"
                    title={
                        editingNamedRow
                            ? tCi("credit_insurance.edit_named_policy")
                            : tCi("credit_insurance.add_named_policy")
                    }
                    ariaLabelledBy="policy-named-modal-title"
                    ariaDescribedBy="policy-named-modal-description"
                    scrollContainerId={POLICY_NAMED_MODAL_SCROLL_ID}
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
                                onClick={() => setNamedModalOpen(false)}
                                disabled={namedFormDisabled}
                                variant="outlined"
                            >
                                {t("actions.cancel", { ns: "common" })}
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSaveNamed}
                                disabled={namedFormDisabled}
                            >
                                {t("actions.save", { ns: "common" })}
                            </Button>
                        </>
                    }
                >
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            flex: "1 1 auto",
                            minHeight: 0,
                            overflow: "hidden",
                        }}
                        dir={isRTL ? "rtl" : "ltr"}
                    >
                        <ModalScrollBox
                            id={POLICY_NAMED_MODAL_SCROLL_ID}
                            isRTL={isRTL}
                            sx={{ px: 3 }}
                        >
                            <Box
                                id="policy-named-modal-description"
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        sm: "repeat(2, minmax(0, 1fr))",
                                    },
                                    gap: 2,
                                    pt: 1,
                                    pb: 2,
                                    direction: isRTL ? "rtl" : "ltr",
                                }}
                            >
                                <Box sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}>
                                    <CustomerNumberAutocomplete
                                        value={namedForm.customer_number}
                                        onChange={(customerNumber) => {
                                            setNamedForm((prev) => ({
                                                ...prev,
                                                customer_number: customerNumber,
                                            }));
                                            setNamedFormErrors((prev) => {
                                                if (!prev.customer_number)
                                                    return prev;
                                                const next = { ...prev };
                                                delete next.customer_number;
                                                return next;
                                            });
                                        }}
                                        label={tCi(
                                            "credit_insurance.named_columns.customer_number"
                                        )}
                                        error={namedFormErrors.customer_number}
                                        disabled={
                                            namedFormDisabled ||
                                            editingNamedRow != null
                                        }
                                        excludeCustomerNumbers={
                                            editingNamedRow
                                                ? undefined
                                                : excludeNamedCustomerNumbers
                                        }
                                        size="small"
                                        sx={{
                                            ...modalTextFieldSx,
                                            minWidth: 0,
                                        }}
                                    />
                                </Box>
                                <TextField
                                    {...modalTextFieldProps}
                                    fullWidth
                                    required
                                    label={tCi(
                                        "credit_insurance.named_columns.max_payment_term"
                                    )}
                                    value={namedForm.max_payment_term}
                                    onChange={(e) => {
                                        setNamedForm((prev) => ({
                                            ...prev,
                                            max_payment_term:
                                                sanitizeIntegerInput(
                                                    e.target.value
                                                ),
                                        }));
                                        setNamedFormErrors((prev) => {
                                            if (!prev.max_payment_term)
                                                return prev;
                                            const next = { ...prev };
                                            delete next.max_payment_term;
                                            return next;
                                        });
                                    }}
                                    error={!!namedFormErrors.max_payment_term}
                                    helperText={
                                        namedFormErrors.max_payment_term
                                    }
                                    inputMode="numeric"
                                    size="small"
                                    disabled={namedFormDisabled}
                                    sx={{
                                        ...modalTextFieldSx,
                                        minWidth: 0,
                                    }}
                                />
                                <TextField
                                    {...modalTextFieldProps}
                                    fullWidth
                                    required
                                    label={tCi(
                                        "credit_insurance.named_columns.customer_mep"
                                    )}
                                    value={namedForm.customer_mep}
                                    onChange={(e) => {
                                        setNamedForm((prev) => ({
                                            ...prev,
                                            customer_mep: sanitizeIntegerInput(
                                                e.target.value
                                            ),
                                        }));
                                        setNamedFormErrors((prev) => {
                                            if (!prev.customer_mep)
                                                return prev;
                                            const next = { ...prev };
                                            delete next.customer_mep;
                                            return next;
                                        });
                                    }}
                                    error={!!namedFormErrors.customer_mep}
                                    helperText={namedFormErrors.customer_mep}
                                    inputMode="numeric"
                                    size="small"
                                    disabled={namedFormDisabled}
                                    sx={{
                                        ...modalTextFieldSx,
                                        minWidth: 0,
                                    }}
                                />
                                <TextField
                                    {...modalTextFieldProps}
                                    fullWidth
                                    required
                                    label={tCi(
                                        "credit_insurance.named_columns.reporting_days"
                                    )}
                                    value={namedForm.reporting_days}
                                    onChange={(e) => {
                                        setNamedForm((prev) => ({
                                            ...prev,
                                            reporting_days:
                                                sanitizeIntegerInput(
                                                    e.target.value
                                                ),
                                        }));
                                        setNamedFormErrors((prev) => {
                                            if (!prev.reporting_days)
                                                return prev;
                                            const next = { ...prev };
                                            delete next.reporting_days;
                                            return next;
                                        });
                                    }}
                                    error={!!namedFormErrors.reporting_days}
                                    helperText={
                                        namedFormErrors.reporting_days
                                    }
                                    inputMode="numeric"
                                    size="small"
                                    disabled={namedFormDisabled}
                                    sx={{
                                        ...modalTextFieldSx,
                                        minWidth: 0,
                                    }}
                                />
                                <TextField
                                    {...modalTextFieldProps}
                                    fullWidth
                                    required
                                    label={tCi(
                                        "credit_insurance.named_columns.customer_max_limit"
                                    )}
                                    value={namedForm.customer_max_limit}
                                    onChange={(e) => {
                                        setNamedForm((prev) => ({
                                            ...prev,
                                            customer_max_limit:
                                                sanitizeDecimalInput(
                                                    e.target.value
                                                ),
                                        }));
                                        setNamedFormErrors((prev) => {
                                            if (!prev.customer_max_limit)
                                                return prev;
                                            const next = { ...prev };
                                            delete next.customer_max_limit;
                                            return next;
                                        });
                                    }}
                                    error={
                                        !!namedFormErrors.customer_max_limit
                                    }
                                    helperText={
                                        namedFormErrors.customer_max_limit
                                    }
                                    inputMode="decimal"
                                    size="small"
                                    disabled={namedFormDisabled}
                                    sx={{
                                        ...modalTextFieldSx,
                                        minWidth: 0,
                                    }}
                                />
                                <DatePicker
                                    label={tCi(
                                        "credit_insurance.named_columns.limit_expiration_date",
                                        { defaultValue: "Limit expiration date" }
                                    )}
                                    value={
                                        namedForm.limit_expiration_date
                                            ? moment(namedForm.limit_expiration_date, "YYYY-MM-DD", true)
                                            : null
                                    }
                                    onChange={(newValue) => {
                                        setNamedForm((prev) => ({
                                            ...prev,
                                            limit_expiration_date: newValue
                                                ? newValue.format("YYYY-MM-DD")
                                                : "",
                                        }));
                                    }}
                                    format={getDatePickerFormat(session)}
                                    disabled={namedFormDisabled}
                                    slotProps={{
                                        textField: {
                                            ...modalTextFieldProps,
                                            fullWidth: true,
                                            size: "small",
                                            InputLabelProps: { shrink: true },
                                            sx: {
                                                ...modalTextFieldSx,
                                                minWidth: 0,
                                                "& .MuiInputBase-root": {
                                                    minHeight: 40,
                                                },
                                                "& .MuiInputBase-input": {
                                                    fontSize: "0.875rem",
                                                },
                                            },
                                        },
                                    }}
                                />
                            </Box>
                        </ModalScrollBox>
                    </Box>
                </AppDialog>

                <DeleteDialog
                    isOpen={Boolean(deleteCountryDialogRow)}
                    onClose={handleDeleteCountryDialogClose}
                    onConfirm={handleConfirmDeleteCountry}
                    title={tCi("credit_insurance.delete_policy_country_title")}
                    description={tCi("credit_insurance.confirm_delete_policy_country", {
                        country: deleteCountryLabel,
                    })}
                    confirmLabel={t("actions.delete", { ns: "common" })}
                    cancelLabel={t("actions.cancel", { ns: "common" })}
                    isLoading={deleteCountryMutation.isPending}
                    type="delete"
                    maxWidth="sm"
                    locale={i18n.language}
                />

                <DeleteDialog
                    isOpen={Boolean(deleteNamedDialogRow)}
                    onClose={handleDeleteNamedDialogClose}
                    onConfirm={handleConfirmDeleteNamed}
                    title={tCi("credit_insurance.delete_named_policy_title")}
                    description={tCi(
                        "credit_insurance.confirm_delete_named_policy",
                        {
                            customerNumber: deleteNamedLabel,
                        }
                    )}
                    confirmLabel={t("actions.delete", { ns: "common" })}
                    cancelLabel={t("actions.cancel", { ns: "common" })}
                    isLoading={deleteNamedMutation.isPending}
                    type="delete"
                    maxWidth="sm"
                    locale={i18n.language}
                />
            </Box>
        </Box>
    );
}

