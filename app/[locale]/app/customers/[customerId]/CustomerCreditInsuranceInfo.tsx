"use client";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ShieldIcon from "@mui/icons-material/Shield";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    FormControlLabel,
    MenuItem,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import moment from "moment";
import { useSession } from "next-auth/react";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    formatDateForDisplay,
    getDatePickerFormat,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import { getEffectivePolicyId, getActiveCustomerPolicyFromCustomer } from "@/shared/customerPolicyAdapter";
import {
    buildPolicyHistoryHeaderAuditSegment,
    resolveCustomerPolicyHistoryChipKind,
    resolveUserAuditDisplayName,
} from "@/shared/creditInsurance/customerPolicyHistoryPresentation";
import { POLICY_EXCLUSION_REASONS } from "@/shared/creditInsurance/policyExclusion";

import CustomerFormField from "./CustomerFormField";
import { CustomerTopUpList } from "./CustomerTopUpList";
import {
    CreditInsuranceReadonlyField,
    toTitleCaseLabel,
} from "./CustomerGeneralInfo";

type PolicyOption = { id: number; policy_number: string };

interface CustomerCreditInsuranceInfoProps {
    customer: any;
    isEditing: boolean;
    errors?: Record<string, string>;
    onChange: (field: string, value: any) => void;
    countries: any[];
    states: any[];
    activeUsers: any[];
    activePolicies?: PolicyOption[];
    onEditClick?: () => void;
    onCancelEdit?: () => void;
    onSave?: () => void;
    isSaving?: boolean;
    customerId?: number;
}

const CustomerCreditInsuranceInfo: React.FC<CustomerCreditInsuranceInfoProps> = ({
    customer,
    isEditing,
    errors = {},
    onChange,
    countries,
    states,
    activeUsers,
    activePolicies = [],
    onEditClick,
    onCancelEdit,
    onSave,
    isSaving = false,
    customerId,
}) => {
    const { t, i18n } = useTranslation(["customers", "common", "settings"]);
    const { data: session } = useSession();
    const theme = useTheme();
    const isRTL = i18n.language === "he";
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;
    const userLocale = useMemo(() => getUserDateLocale(session), [session]);
    const userTimezone = useMemo(() => getUserTimezone(session), [session]);

    /** Matches roles permissions accordion (RolePermissions.tsx). */
    const policyHistoryAccordionStyles = useMemo(
        () => ({
            accordion: {
                border: "1px solid",
                borderColor: "divider",
                borderRadius: pillRadiusPx,
                overflow: "hidden",
                "&:before": { display: "none" },
                "&:first-of-type, &:last-of-type, &:not(:first-of-type)": {
                    borderRadius: pillRadiusPx,
                },
                "&.Mui-expanded": {
                    margin: 0,
                },
            },
            summary: (isExpanded: boolean) => ({
                bgcolor: "background.paper",
                borderTopLeftRadius: pillRadiusPx,
                borderTopRightRadius: pillRadiusPx,
                borderBottomLeftRadius: isExpanded ? 0 : pillRadiusPx,
                borderBottomRightRadius: isExpanded ? 0 : pillRadiusPx,
                px: 2,
                py: 0.25,
                minHeight: 36,
                "& .MuiAccordionSummary-content": {
                    my: 0,
                    minWidth: 0,
                    overflow: "hidden",
                    "&.Mui-expanded": {
                        my: 0,
                    },
                },
                "&.Mui-expanded": {
                    minHeight: 36,
                    borderTopLeftRadius: pillRadiusPx,
                    borderTopRightRadius: pillRadiusPx,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                },
                "&:hover": {
                    bgcolor: "action.hover",
                },
            }),
            details: {
                p: 0,
                bgcolor: "background.paper",
                borderBottomLeftRadius: pillRadiusPx,
                borderBottomRightRadius: pillRadiusPx,
                "&.MuiAccordionDetails-root": {
                    padding: 0,
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            },
            detailsInner: {
                p: 0,
                direction: isRTL ? ("rtl" as const) : ("ltr" as const),
                bgcolor: "background.default",
            },
        }),
        [pillRadiusPx, isRTL]
    );

    const sectionHeaders = useMemo(() => {
        const isHebrew = i18n.language === "he";
        const base = {
            mb: 0.5,
            px: 0,
            py: 0.5,
            direction: isHebrew ? "rtl" : "ltr",
            textAlign: isHebrew ? "right" : "left",
        };
        return {
            title: {
                color: "#000",
                fontWeight: 700,
                fontSize: "0.8rem",
                textTransform: "uppercase" as const,
                letterSpacing: "0.8px",
                textAlign: "inherit",
                width: "100%",
            },
            /** Full-width subsection bar inside the grid (matches General tab section headers). */
            creditInsuranceSubsection: {
                ...base,
                gridColumn: "1 / -1" as const,
                mt: 0.5,
            },
            /** Same bar styling outside the grid (e.g. policy history block). */
            fullWidthSubsection: {
                ...base,
                width: "100%",
                mt: 0.5,
            },
        };
    }, [i18n.language]);

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

    /** Helper under Reporting days: small space below input, no extra bottom. */
    const reportingDaysFieldSx = useMemo(
        () => ({
            ...creditInsuranceFieldSx,
            mb: 0,
            "& .MuiFormHelperText-root": {
                marginTop: 0.5,
                marginBottom: 0,
            },
        }),
        [creditInsuranceFieldSx]
    );

    const fieldCellSx = useMemo(
        () => ({
            position: "relative" as const,
            direction: i18n.language === "he" ? ("rtl" as const) : ("ltr" as const),
            textAlign: (i18n.language === "he" ? "right" : "left") as "right" | "left",
        }),
        [i18n.language]
    );

    const creditInsuranceLabels = useMemo(
        () => ({
            insurancePolicy: toTitleCaseLabel(
                t("fields.insurance_policy", {
                    ns: "customers",
                    defaultValue: "Insurance policy",
                })
            ),
            customerNumberPolicy: toTitleCaseLabel(
                t("fields.customer_number_policy", {
                    ns: "customers",
                    defaultValue: "Policy customer number",
                })
            ),
            approvedLimit: toTitleCaseLabel(
                t("fields.approved_limit", {
                    ns: "customers",
                    defaultValue: "Approved limit",
                })
            ),
            limitType: toTitleCaseLabel(
                t("fields.limit_type", {
                    ns: "customers",
                    defaultValue: "Limit type",
                })
            ),
            maxPaymentTermDays: toTitleCaseLabel(
                t("fields.max_payment_term_days", {
                    ns: "customers",
                    defaultValue: "Max payment term (days)",
                })
            ),
            maxAllowedMepDays: toTitleCaseLabel(
                t("fields.max_allowed_mep_days", {
                    ns: "customers",
                    defaultValue: "Max allowed MEP (days)",
                })
            ),
            reportingDays: toTitleCaseLabel(
                t("fields.reporting_days", {
                    ns: "customers",
                    defaultValue: "Reporting days",
                })
            ),
            mepSection: t("credit_insurance.sections.mep", {
                ns: "settings",
                defaultValue: "MEP",
            }),
            reportingSection: t("credit_insurance.sections.reporting", {
                ns: "settings",
                defaultValue: "Reporting",
            }),
            paymentTermSection: t("credit_insurance.sections.payment_term", {
                ns: "settings",
                defaultValue: "Payment term",
            }),
            mepCutoffDayOfMonth: toTitleCaseLabel(
                t("credit_insurance.fields.mep_cutoff_day_of_month", {
                    ns: "settings",
                    defaultValue: "MEP cutoff day of month",
                })
            ),
            mepSubstituteDayOfMonth: toTitleCaseLabel(
                t("credit_insurance.fields.mep_substitute_day_of_month", {
                    ns: "settings",
                    defaultValue: "MEP substitute day of month",
                })
            ),
            reportingCutoffDayOfMonth: toTitleCaseLabel(
                t("credit_insurance.fields.reporting_cutoff_day_of_month", {
                    ns: "settings",
                    defaultValue: "Reporting cutoff day of month",
                })
            ),
            reportingSubstituteDayOfMonth: toTitleCaseLabel(
                t("credit_insurance.fields.reporting_substitute_day_of_month", {
                    ns: "settings",
                    defaultValue: "Reporting substitute day of month",
                })
            ),
            paymentTermCutoffDayOfMonth: toTitleCaseLabel(
                t("credit_insurance.fields.payment_term_cutoff_day_of_month", {
                    ns: "settings",
                    defaultValue: "Payment term cutoff day of month",
                })
            ),
            paymentTermSubstituteDayOfMonth: toTitleCaseLabel(
                t("credit_insurance.fields.payment_term_substitute_day_of_month", {
                    ns: "settings",
                    defaultValue: "Payment term substitute day of month",
                })
            ),
            creditScore: toTitleCaseLabel(
                t("fields.credit_score", {
                    ns: "customers",
                    defaultValue: "Credit score",
                })
            ),
            creditScoreInputDate: toTitleCaseLabel(
                t("fields.credit_score_input_date", {
                    ns: "customers",
                    defaultValue: "Credit score input date",
                })
            ),
            approvedLimitExpirationDate: toTitleCaseLabel(
                t("fields.approved_limit_expiration_date", {
                    ns: "customers",
                    defaultValue: "Approved limit expiration date",
                })
            ),
            zeroLimitDate: toTitleCaseLabel(
                t("fields.zero_limit_date", {
                    ns: "customers",
                    defaultValue: "Approve zero limit date",
                })
            ),
            activeCustomerSince: toTitleCaseLabel(
                t("fields.active_customer_since", {
                    ns: "customers",
                    defaultValue: "Active customer since",
                })
            ),
            outdatedDcl: toTitleCaseLabel(
                t("fields.outdated_dcl", {
                    ns: "customers",
                    defaultValue: "Outdated DCL",
                })
            ),
            policyExclusionReason: toTitleCaseLabel(
                t("fields.policy_exclusion_reason", {
                    ns: "customers",
                    defaultValue: "Policy exclusion reason",
                })
            ),
        }),
        [t]
    );

    const firstIssuedInvoiceDate = useMemo(() => {
        const invoices = Array.isArray(customer?.Invoice) ? customer.Invoice : [];
        if (!invoices.length) return null;
        const first = [...invoices]
            .filter((inv) => inv?.invoice_date)
            .sort(
                (a, b) =>
                    new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
            )[0];
        return first?.invoice_date || null;
    }, [customer?.Invoice]);

    /** When a policy is attached, policy-driven inputs show the required asterisk. */
    const policyRelatedRequired = Boolean(customer?.policy_id);
    const zeroLimitDateRequired =
        isEditing &&
        customer?.approved_limit != null &&
        Number(String(customer.approved_limit).trim()) === 0;
    const showDclFields = customer?.limit_type !== "Named";
    const approvedLimitWithCurrency = useMemo(() => {
        if (customer?.approved_limit == null) {
            return null;
        }
        const amount = String(customer.approved_limit);
        const currency =
            typeof customer?.approved_limit_currency === "string"
                ? customer.approved_limit_currency.trim().toUpperCase()
                : "";
        return currency ? `${amount} ${currency}` : amount;
    }, [customer?.approved_limit, customer?.approved_limit_currency]);

    const effectiveLimitBreakdown = useMemo(() => {
        const c = customer as {
            has_active_top_up?: boolean;
            effective_approved_limit?: unknown;
            base_approved_limit?: unknown;
            top_up_total?: unknown;
            approved_limit_currency?: string | null;
        } | null;
        if (!c?.has_active_top_up || c.effective_approved_limit == null) {
            return null;
        }
        const currency =
            typeof c.approved_limit_currency === "string"
                ? c.approved_limit_currency.trim().toUpperCase()
                : "";
        const amountLocale = i18n.language === "he" ? "he-IL" : "en-US";
        const effective = Number(c.effective_approved_limit);
        const effectiveDisplay = currency
            ? `${effective.toLocaleString(amountLocale)} ${currency}`
            : effective.toLocaleString(amountLocale);
        const topUpTotal = Number(c.top_up_total ?? 0);
        if (topUpTotal <= 0) {
            return { effectiveDisplay, inlineDisplay: effectiveDisplay };
        }
        const base = Number(c.base_approved_limit ?? 0);
        const baseStr = Number.isFinite(base)
            ? base.toLocaleString(amountLocale)
            : "—";
        const topUpStr = topUpTotal.toLocaleString(amountLocale);
        const secondary = currency
            ? `${baseStr} + ${topUpStr} ${currency}`
            : `${baseStr} + ${topUpStr}`;
        return {
            effectiveDisplay,
            inlineDisplay: `${effectiveDisplay} (${secondary})`,
        };
    }, [customer, i18n.language]);

    type PolicyHistoryRow = Record<string, unknown> & {
        id?: number | string;
        is_active?: boolean;
        insurance_policy_id?: number | null;
        modified_at?: string | Date | null;
        modified_by?: string | null;
        User_CustomerPolicy_modified_byToUser?: {
            name?: string | null;
            first_name?: string | null;
            last_name?: string | null;
            email?: string | null;
        } | null;
        InsurancePolicy?: { policy_number?: string } | null;
        capacity_gap_amount?: number | null;
        capacity_gap_amount1?: number | null;
        capacity_gap_currency1?: string | null;
    };

    const policyHistory = useMemo((): PolicyHistoryRow[] => {
        const rows = Array.isArray(customer?.customerPolicies)
            ? customer.customerPolicies
            : [];
        return [...rows].sort(
            (a, b) => Number(b.is_active) - Number(a.is_active)
        );
    }, [customer?.customerPolicies]);

    const inactivePolicyHistory = useMemo(
        () => policyHistory.filter((p) => !p.is_active),
        [policyHistory]
    );

    const activeInsurancePolicyId = useMemo(
        () => getEffectivePolicyId(customer) ?? null,
        [customer]
    );

    const activeCustomerPolicyRow = useMemo(
        () => getActiveCustomerPolicyFromCustomer(customer),
        [customer]
    );

    const policyLabelFromRow = useCallback(
        (row: PolicyHistoryRow) => {
            const fromRelation = row.InsurancePolicy?.policy_number;
            if (fromRelation) {
                return fromRelation;
            }
            if (row.is_active && customer?.InsurancePolicy?.policy_number) {
                return customer.InsurancePolicy.policy_number;
            }
            const pid =
                row.insurance_policy_id ??
                (row.is_active ? customer?.policy_id : null);
            if (pid != null) {
                const match = activePolicies.find((p) => p.id === Number(pid));
                if (match?.policy_number) {
                    return match.policy_number;
                }
                return String(pid);
            }
            return "—";
        },
        [customer?.InsurancePolicy?.policy_number, customer?.policy_id, activePolicies]
    );

    const policyAccordionKey = useCallback(
        (row: PolicyHistoryRow) =>
            String(row.id ?? policyLabelFromRow(row)),
        [policyLabelFromRow]
    );

    const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(
        () => new Set()
    );

    const handlePolicyAccordionChange = useCallback((key: string) => {
        setExpandedPolicies((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const allPoliciesExpanded =
        inactivePolicyHistory.length > 0 &&
        inactivePolicyHistory.every((row) =>
            expandedPolicies.has(policyAccordionKey(row))
        );

    const handleExpandAllPolicies = useCallback(() => {
        setExpandedPolicies(
            new Set(inactivePolicyHistory.map((row) => policyAccordionKey(row)))
        );
    }, [inactivePolicyHistory, policyAccordionKey]);

    const handleCollapseAllPolicies = useCallback(() => {
        setExpandedPolicies(new Set());
    }, []);

    const formatRowApprovedLimit = useCallback((row: PolicyHistoryRow) => {
        if (row.approved_limit == null || row.approved_limit === "") {
            return null;
        }
        const amount = String(row.approved_limit);
        const currency =
            typeof row.approved_limit_currency === "string"
                ? row.approved_limit_currency.trim().toUpperCase()
                : "";
        return currency ? `${amount} ${currency}` : amount;
    }, []);

    const formatRowDate = useCallback(
        (value: unknown) => {
            if (value == null || value === "") {
                return null;
            }
            return formatDateForDisplay(
                String(value),
                "date",
                userLocale,
                userTimezone
            );
        },
        [userLocale, userTimezone]
    );

    const formatRowDateTime = useCallback(
        (value: Date | string) =>
            formatDateForDisplay(value, "datetime", userLocale, userTimezone),
        [userLocale, userTimezone]
    );

    const formatRowYesNo = useCallback(
        (value: unknown) =>
            value
                ? t("fields.yes", { ns: "common" })
                : t("fields.no", { ns: "common" }),
        [t]
    );

    const formatRowLimitType = useCallback(
        (row: PolicyHistoryRow) => {
            const raw = row.limit_type;
            if (raw == null || String(raw).trim() === "") {
                return null;
            }
            const limitType = String(raw).trim();
            if (limitType === "DCL") {
                return t("fields.limit_type_dcl", {
                    ns: "customers",
                });
            }
            if (limitType === "Named") {
                return t("fields.limit_type_named", {
                    ns: "customers",
                });
            }
            return limitType;
        },
        [t]
    );

    const buildPolicyHistoryHeaderSummary = useCallback(
        (row: PolicyHistoryRow) => {
            const parts: string[] = [];
            const limitType = formatRowLimitType(row);
            if (limitType) {
                parts.push(limitType);
            }
            const approvedLimit = formatRowApprovedLimit(row);
            if (approvedLimit) {
                parts.push(approvedLimit);
            }
            const expirationDate = formatRowDate(row.approved_limit_expiration_date);
            if (expirationDate) {
                parts.push(
                    t("fields.policy_history_expiration_short", {
                        ns: "customers",
                        date: expirationDate,
                    })
                );
            }
            const auditSegment = buildPolicyHistoryHeaderAuditSegment({
                modifiedAt: row.modified_at,
                modifiedByDisplayName: resolveUserAuditDisplayName(
                    row.User_CustomerPolicy_modified_byToUser
                ),
                formatDate: formatRowDateTime,
            });
            if (auditSegment) {
                parts.push(auditSegment);
            }
            return parts;
        },
        [formatRowApprovedLimit, formatRowDate, formatRowDateTime, formatRowLimitType, t]
    );

    const resolvePolicyHistoryChipLabel = useCallback(
        (row: PolicyHistoryRow) => {
            const chipKind = resolveCustomerPolicyHistoryChipKind({
                inactiveInsurancePolicyId: row.insurance_policy_id,
                activeInsurancePolicyId,
            });
            if (chipKind === "previous_version") {
                return t("fields.previous_version", { ns: "customers" });
            }
            return t("fields.previous_policy", { ns: "customers" });
        },
        [activeInsurancePolicyId, t]
    );

    const renderHistoricalPolicyReadonlyGrid = (row: PolicyHistoryRow) => (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(3, 1fr)",
                },
                columnGap: 1.5,
                rowGap: 1,
                direction: isRTL ? "rtl" : "ltr",
                textAlign: isRTL ? "right" : "left",
            }}
        >
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.insurancePolicy}
                value={policyLabelFromRow(row)}
            />
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.customerNumberPolicy}
                value={
                    row.customer_number_policy != null
                        ? String(row.customer_number_policy)
                        : null
                }
            />
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.limitType}
                value={row.limit_type != null ? String(row.limit_type) : null}
            />
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.approvedLimit}
                value={formatRowApprovedLimit(row)}
            />
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.approvedLimitExpirationDate}
                value={formatRowDate(row.approved_limit_expiration_date)}
            />
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.zeroLimitDate}
                value={formatRowDate(row.zero_limit_date)}
            />
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.maxPaymentTermDays}
                value={
                    row.max_payment_term != null
                        ? String(row.max_payment_term)
                        : null
                }
            />
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.maxAllowedMepDays}
                value={
                    row.max_allowed_mep != null
                        ? String(row.max_allowed_mep)
                        : null
                }
            />
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.reportingDays}
                value={
                    row.reporting_days != null
                        ? String(row.reporting_days)
                        : null
                }
            />
            {row.mep_cutoff_day_of_month != null ? (
                <CreditInsuranceReadonlyField
                    label={creditInsuranceLabels.mepCutoffDayOfMonth}
                    value={String(row.mep_cutoff_day_of_month)}
                />
            ) : null}
            {row.mep_substitute_day_of_month != null ? (
                <CreditInsuranceReadonlyField
                    label={creditInsuranceLabels.mepSubstituteDayOfMonth}
                    value={String(row.mep_substitute_day_of_month)}
                />
            ) : null}
            {row.reporting_cutoff_day_of_month != null ? (
                <CreditInsuranceReadonlyField
                    label={creditInsuranceLabels.reportingCutoffDayOfMonth}
                    value={String(row.reporting_cutoff_day_of_month)}
                />
            ) : null}
            {row.reporting_substitute_day_of_month != null ? (
                <CreditInsuranceReadonlyField
                    label={creditInsuranceLabels.reportingSubstituteDayOfMonth}
                    value={String(row.reporting_substitute_day_of_month)}
                />
            ) : null}
            {row.payment_term_cutoff_day_of_month != null ? (
                <CreditInsuranceReadonlyField
                    label={creditInsuranceLabels.paymentTermCutoffDayOfMonth}
                    value={String(row.payment_term_cutoff_day_of_month)}
                />
            ) : null}
            {row.payment_term_substitute_day_of_month != null ? (
                <CreditInsuranceReadonlyField
                    label={creditInsuranceLabels.paymentTermSubstituteDayOfMonth}
                    value={String(row.payment_term_substitute_day_of_month)}
                />
            ) : null}
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.creditScore}
                value={
                    row.credit_score != null ? String(row.credit_score) : null
                }
            />
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.creditScoreInputDate}
                value={formatRowDate(row.credit_score_input_date)}
            />
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.activeCustomerSince}
                value={formatRowDate(row.active_customer_since)}
            />
            {row.limit_type !== "Named" ? (
                <CreditInsuranceReadonlyField
                    label={creditInsuranceLabels.outdatedDcl}
                    value={formatRowYesNo(row.outdated_dcl)}
                />
            ) : null}
            <CreditInsuranceReadonlyField
                label={creditInsuranceLabels.policyExclusionReason}
                value={
                    row.policy_exclusion_reason != null &&
                        String(row.policy_exclusion_reason).trim() !== ""
                        ? String(row.policy_exclusion_reason)
                        : null
                }
            />
        </Box>
    );

    const activePolicyGrid = (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(3, 1fr)",
                },
                columnGap: 1.5,
                rowGap: 1,
                direction: isRTL ? "rtl" : "ltr",
                textAlign: isRTL ? "right" : "left",
            }}
        >
            <Box sx={sectionHeaders.creditInsuranceSubsection}>
                <Typography variant="subtitle2" sx={sectionHeaders.title}>
                    {t("sections.credit_insurance", {
                        ns: "customers",
                        defaultValue: "Credit insurance",
                    })}
                </Typography>
            </Box>

            <Box sx={fieldCellSx}>
                <CustomerFormField
                    field="policy_id"
                    value={customer?.policy_id?.toString() || ""}
                    isEditing={isEditing}
                    error={errors.policy_id}
                    onChange={onChange}
                    countries={countries}
                    states={states}
                    activeUsers={activeUsers}
                    activePolicies={activePolicies}
                    t={t}
                    editedCustomer={customer}
                    label={creditInsuranceLabels.insurancePolicy}
                    icon={<ShieldIcon />}
                />
            </Box>

            <Box sx={fieldCellSx}>
                {isEditing ? (
                    <TextField
                        fullWidth
                        size="small"
                        label={creditInsuranceLabels.customerNumberPolicy}
                        value={customer?.customer_number_policy ?? ""}
                        onChange={(e) =>
                            onChange(
                                "customer_number_policy",
                                e.target.value === ""
                                    ? null
                                    : e.target.value
                            )
                        }
                        error={!!errors.customer_number_policy}
                        helperText={errors.customer_number_policy}
                        sx={creditInsuranceFieldSx}
                    />
                ) : (
                    <CreditInsuranceReadonlyField
                        label={creditInsuranceLabels.customerNumberPolicy}
                        value={
                            customer?.customer_number_policy != null &&
                                String(customer.customer_number_policy).trim() !== ""
                                ? String(customer.customer_number_policy)
                                : null
                        }
                    />
                )}
            </Box>

            <Box sx={fieldCellSx}>
                {isEditing ? (
                    <TextField
                        fullWidth
                        size="small"
                        select
                        label={creditInsuranceLabels.limitType}
                        value={customer?.limit_type || ""}
                        onChange={(e) => onChange("limit_type", e.target.value || null)}
                        required={policyRelatedRequired}
                        error={!!errors.limit_type}
                        helperText={errors.limit_type}
                        sx={creditInsuranceFieldSx}
                    >
                        <MenuItem value="DCL">DCL</MenuItem>
                        <MenuItem value="Named">Named</MenuItem>
                    </TextField>
                ) : (
                    <CreditInsuranceReadonlyField
                        label={creditInsuranceLabels.limitType}
                        value={customer?.limit_type ?? null}
                    />
                )}
            </Box>

            <Box sx={fieldCellSx}>
                {isEditing ? (
                    <TextField
                        fullWidth
                        size="small"
                        label={creditInsuranceLabels.approvedLimit}
                        type="number"
                        value={
                            customer?.approved_limit != null
                                ? String(customer.approved_limit)
                                : ""
                        }
                        onChange={(e) =>
                            onChange(
                                "approved_limit",
                                e.target.value === "" ? null : e.target.value
                            )
                        }
                        inputProps={{ step: "any" }}
                        required={policyRelatedRequired}
                        error={!!errors.approved_limit}
                        helperText={errors.approved_limit}
                        sx={creditInsuranceFieldSx}
                    />
                ) : (
                    <CreditInsuranceReadonlyField
                        label={creditInsuranceLabels.approvedLimit}
                        value={approvedLimitWithCurrency}
                    />
                )}
            </Box>

            {!isEditing && effectiveLimitBreakdown ? (
                <Box sx={fieldCellSx}>
                    <CreditInsuranceReadonlyField
                        label={t("credit_insurance.effective_limit", {
                            ns: "customers",
                        })}
                        value={effectiveLimitBreakdown.inlineDisplay}
                    />
                </Box>
            ) : null}

            <Box sx={fieldCellSx}>
                {isEditing ? (
                    <DatePicker
                        label={creditInsuranceLabels.zeroLimitDate}
                        value={
                            customer?.zero_limit_date
                                ? moment(customer.zero_limit_date)
                                : null
                        }
                        onChange={(newVal) =>
                            onChange(
                                "zero_limit_date",
                                newVal ? newVal.format("YYYY-MM-DD") : null
                            )
                        }
                        format={getDatePickerFormat(session ?? null, "DD/MM/YYYY")}
                        slotProps={{
                            textField: {
                                fullWidth: true,
                                size: "small",
                                required: zeroLimitDateRequired,
                                error: !!errors.zero_limit_date,
                                helperText: errors.zero_limit_date,
                                InputLabelProps: { shrink: true },
                                sx: creditInsuranceFieldSx,
                                ...(isRTL && {
                                    dir: "rtl",
                                    "data-hebrew": true as const,
                                }),
                            },
                        }}
                    />
                ) : (
                    <CreditInsuranceReadonlyField
                        label={creditInsuranceLabels.zeroLimitDate}
                        value={
                            customer?.zero_limit_date
                                ? formatDateForDisplay(
                                    customer.zero_limit_date,
                                    "date",
                                    userLocale,
                                    userTimezone
                                )
                                : null
                        }
                    />
                )}
            </Box>

            <Box sx={fieldCellSx}>
                {isEditing ? (
                    <DatePicker
                        label={creditInsuranceLabels.approvedLimitExpirationDate}
                        value={
                            customer?.approved_limit_expiration_date
                                ? moment(customer.approved_limit_expiration_date)
                                : null
                        }
                        onChange={(newVal) =>
                            onChange(
                                "approved_limit_expiration_date",
                                newVal ? newVal.format("YYYY-MM-DD") : null
                            )
                        }
                        format={getDatePickerFormat(session ?? null, "DD/MM/YYYY")}
                        slotProps={{
                            textField: {
                                fullWidth: true,
                                size: "small",
                                InputLabelProps: { shrink: true },
                                sx: creditInsuranceFieldSx,
                                ...(isRTL && {
                                    dir: "rtl",
                                    "data-hebrew": true as const,
                                }),
                            },
                        }}
                    />
                ) : (
                    <CreditInsuranceReadonlyField
                        label={creditInsuranceLabels.approvedLimitExpirationDate}
                        value={
                            customer?.approved_limit_expiration_date
                                ? formatDateForDisplay(
                                    customer.approved_limit_expiration_date,
                                    "date",
                                    userLocale,
                                    userTimezone
                                )
                                : null
                        }
                    />
                )}
            </Box>

            {!isEditing ? (
                <>
                    <Box sx={sectionHeaders.creditInsuranceSubsection}>
                        <Typography variant="subtitle2" sx={sectionHeaders.title}>
                            {creditInsuranceLabels.paymentTermSection}
                        </Typography>
                    </Box>

                    <Box sx={fieldCellSx}>
                        <CreditInsuranceReadonlyField
                            label={creditInsuranceLabels.maxPaymentTermDays}
                            value={
                                customer?.max_payment_term != null
                                    ? String(customer.max_payment_term)
                                    : null
                            }
                        />
                    </Box>

                    {customer?.payment_term_cutoff_day_of_month != null ? (
                        <Box sx={fieldCellSx}>
                            <CreditInsuranceReadonlyField
                                label={
                                    creditInsuranceLabels.paymentTermCutoffDayOfMonth
                                }
                                value={String(
                                    customer.payment_term_cutoff_day_of_month
                                )}
                            />
                        </Box>
                    ) : null}
                    {customer?.payment_term_substitute_day_of_month != null ? (
                        <Box sx={fieldCellSx}>
                            <CreditInsuranceReadonlyField
                                label={
                                    creditInsuranceLabels.paymentTermSubstituteDayOfMonth
                                }
                                value={String(
                                    customer.payment_term_substitute_day_of_month
                                )}
                            />
                        </Box>
                    ) : null}

                    <Box sx={sectionHeaders.creditInsuranceSubsection}>
                        <Typography variant="subtitle2" sx={sectionHeaders.title}>
                            {creditInsuranceLabels.mepSection}
                        </Typography>
                    </Box>

                    <Box sx={fieldCellSx}>
                        <CreditInsuranceReadonlyField
                            label={creditInsuranceLabels.maxAllowedMepDays}
                            value={
                                customer?.max_allowed_mep != null
                                    ? String(customer.max_allowed_mep)
                                    : null
                            }
                        />
                    </Box>

                    {customer?.mep_cutoff_day_of_month != null ? (
                        <Box sx={fieldCellSx}>
                            <CreditInsuranceReadonlyField
                                label={creditInsuranceLabels.mepCutoffDayOfMonth}
                                value={String(customer.mep_cutoff_day_of_month)}
                            />
                        </Box>
                    ) : null}
                    {customer?.mep_substitute_day_of_month != null ? (
                        <Box sx={fieldCellSx}>
                            <CreditInsuranceReadonlyField
                                label={
                                    creditInsuranceLabels.mepSubstituteDayOfMonth
                                }
                                value={String(
                                    customer.mep_substitute_day_of_month
                                )}
                            />
                        </Box>
                    ) : null}

                    <Box sx={sectionHeaders.creditInsuranceSubsection}>
                        <Typography variant="subtitle2" sx={sectionHeaders.title}>
                            {creditInsuranceLabels.reportingSection}
                        </Typography>
                    </Box>

                    <Box sx={fieldCellSx}>
                        <CreditInsuranceReadonlyField
                            label={creditInsuranceLabels.reportingDays}
                            value={
                                customer?.reporting_days != null
                                    ? String(customer.reporting_days)
                                    : null
                            }
                        />
                    </Box>

                    {customer?.reporting_cutoff_day_of_month != null ? (
                        <Box sx={fieldCellSx}>
                            <CreditInsuranceReadonlyField
                                label={
                                    creditInsuranceLabels.reportingCutoffDayOfMonth
                                }
                                value={String(
                                    customer.reporting_cutoff_day_of_month
                                )}
                            />
                        </Box>
                    ) : null}
                    {customer?.reporting_substitute_day_of_month != null ? (
                        <Box sx={fieldCellSx}>
                            <CreditInsuranceReadonlyField
                                label={
                                    creditInsuranceLabels.reportingSubstituteDayOfMonth
                                }
                                value={String(
                                    customer.reporting_substitute_day_of_month
                                )}
                            />
                        </Box>
                    ) : null}

                    <Box sx={fieldCellSx}>
                        <CreditInsuranceReadonlyField
                            label={t("fields.modified_at", { ns: "common" })}
                            value={
                                activeCustomerPolicyRow?.modified_at
                                    ? formatRowDateTime(
                                        String(
                                            activeCustomerPolicyRow.modified_at
                                        )
                                    )
                                    : null
                            }
                        />
                    </Box>

                    <Box sx={fieldCellSx}>
                        <CreditInsuranceReadonlyField
                            label={t("fields.modified_by", { ns: "common" })}
                            value={resolveUserAuditDisplayName(
                                activeCustomerPolicyRow?.User_CustomerPolicy_modified_byToUser
                            )}
                        />
                    </Box>
                </>
            ) : (
                <>
                    <Box sx={sectionHeaders.creditInsuranceSubsection}>
                        <Typography variant="subtitle2" sx={sectionHeaders.title}>
                            {creditInsuranceLabels.paymentTermSection}
                        </Typography>
                    </Box>

                    <Box sx={fieldCellSx}>
                        <TextField
                            fullWidth
                            size="small"
                            label={creditInsuranceLabels.maxPaymentTermDays}
                            type="number"
                            value={
                                customer?.max_payment_term != null
                                    ? String(customer.max_payment_term)
                                    : ""
                            }
                            onChange={(e) =>
                                onChange(
                                    "max_payment_term",
                                    e.target.value === ""
                                        ? null
                                        : parseInt(e.target.value, 10)
                                )
                            }
                            required={policyRelatedRequired}
                            error={!!errors.max_payment_term}
                            helperText={errors.max_payment_term}
                            sx={creditInsuranceFieldSx}
                        />
                    </Box>

                    <Box sx={fieldCellSx}>
                        <TextField
                            fullWidth
                            size="small"
                            label={creditInsuranceLabels.paymentTermCutoffDayOfMonth}
                            type="number"
                            value={
                                customer?.payment_term_cutoff_day_of_month != null
                                    ? String(
                                        customer.payment_term_cutoff_day_of_month
                                    )
                                    : ""
                            }
                            onChange={(e) =>
                                onChange(
                                    "payment_term_cutoff_day_of_month",
                                    e.target.value === ""
                                        ? null
                                        : parseInt(e.target.value, 10)
                                )
                            }
                            error={!!errors.payment_term_cutoff_day_of_month}
                            helperText={errors.payment_term_cutoff_day_of_month}
                            sx={creditInsuranceFieldSx}
                        />
                    </Box>
                    <Box sx={fieldCellSx}>
                        <TextField
                            fullWidth
                            size="small"
                            label={creditInsuranceLabels.paymentTermSubstituteDayOfMonth}
                            type="number"
                            value={
                                customer?.payment_term_substitute_day_of_month !=
                                    null
                                    ? String(
                                        customer.payment_term_substitute_day_of_month
                                    )
                                    : ""
                            }
                            onChange={(e) =>
                                onChange(
                                    "payment_term_substitute_day_of_month",
                                    e.target.value === ""
                                        ? null
                                        : parseInt(e.target.value, 10)
                                )
                            }
                            required={customer?.payment_term_cutoff_day_of_month != null}
                            error={!!errors.payment_term_substitute_day_of_month}
                            helperText={
                                errors.payment_term_substitute_day_of_month
                            }
                            sx={creditInsuranceFieldSx}
                        />
                    </Box>

                    <Box sx={sectionHeaders.creditInsuranceSubsection}>
                        <Typography variant="subtitle2" sx={sectionHeaders.title}>
                            {creditInsuranceLabels.mepSection}
                        </Typography>
                    </Box>

                    <Box sx={fieldCellSx}>
                        <TextField
                            fullWidth
                            size="small"
                            label={creditInsuranceLabels.maxAllowedMepDays}
                            type="number"
                            value={
                                customer?.max_allowed_mep != null
                                    ? String(customer.max_allowed_mep)
                                    : ""
                            }
                            onChange={(e) =>
                                onChange(
                                    "max_allowed_mep",
                                    e.target.value === ""
                                        ? null
                                        : parseInt(e.target.value, 10)
                                )
                            }
                            required={policyRelatedRequired}
                            error={!!errors.max_allowed_mep}
                            helperText={errors.max_allowed_mep}
                            sx={creditInsuranceFieldSx}
                        />
                    </Box>
                    <Box sx={fieldCellSx}>
                        <TextField
                            fullWidth
                            size="small"
                            label={creditInsuranceLabels.mepCutoffDayOfMonth}
                            type="number"
                            value={
                                customer?.mep_cutoff_day_of_month != null
                                    ? String(customer.mep_cutoff_day_of_month)
                                    : ""
                            }
                            onChange={(e) =>
                                onChange(
                                    "mep_cutoff_day_of_month",
                                    e.target.value === ""
                                        ? null
                                        : parseInt(e.target.value, 10)
                                )
                            }
                            error={!!errors.mep_cutoff_day_of_month}
                            helperText={errors.mep_cutoff_day_of_month}
                            sx={creditInsuranceFieldSx}
                        />
                    </Box>
                    <Box sx={fieldCellSx}>
                        <TextField
                            fullWidth
                            size="small"
                            label={creditInsuranceLabels.mepSubstituteDayOfMonth}
                            type="number"
                            value={
                                customer?.mep_substitute_day_of_month != null
                                    ? String(
                                        customer.mep_substitute_day_of_month
                                    )
                                    : ""
                            }
                            onChange={(e) =>
                                onChange(
                                    "mep_substitute_day_of_month",
                                    e.target.value === ""
                                        ? null
                                        : parseInt(e.target.value, 10)
                                )
                            }
                            required={customer?.mep_cutoff_day_of_month != null}
                            error={!!errors.mep_substitute_day_of_month}
                            helperText={
                                errors.mep_substitute_day_of_month
                            }
                            sx={creditInsuranceFieldSx}
                        />
                    </Box>

                    <Box sx={sectionHeaders.creditInsuranceSubsection}>
                        <Typography variant="subtitle2" sx={sectionHeaders.title}>
                            {creditInsuranceLabels.reportingSection}
                        </Typography>
                    </Box>

                    <Box sx={fieldCellSx}>
                        <TextField
                            fullWidth
                            size="small"
                            label={creditInsuranceLabels.reportingDays}
                            type="number"
                            value={
                                customer?.reporting_days != null
                                    ? String(customer.reporting_days)
                                    : ""
                            }
                            onChange={(e) =>
                                onChange(
                                    "reporting_days",
                                    e.target.value === ""
                                        ? null
                                        : parseInt(e.target.value, 10)
                                )
                            }
                            helperText={
                                errors.reporting_days ||
                                t("hints.reporting_days_new_invoices_only", {
                                    ns: "customers",
                                    defaultValue:
                                        "Changes apply to new invoices only.",
                                })
                            }
                            FormHelperTextProps={{
                                sx: {
                                    mt: 0.5,
                                    mb: 0,
                                    mx: 0,
                                    lineHeight: 1.2,
                                },
                            }}
                            required={policyRelatedRequired}
                            error={!!errors.reporting_days}
                            sx={reportingDaysFieldSx}
                        />
                    </Box>
                    <Box sx={fieldCellSx}>
                        <TextField
                            fullWidth
                            size="small"
                            label={
                                creditInsuranceLabels.reportingCutoffDayOfMonth
                            }
                            type="number"
                            value={
                                customer?.reporting_cutoff_day_of_month !=
                                    null
                                    ? String(
                                        customer.reporting_cutoff_day_of_month
                                    )
                                    : ""
                            }
                            onChange={(e) =>
                                onChange(
                                    "reporting_cutoff_day_of_month",
                                    e.target.value === ""
                                        ? null
                                        : parseInt(e.target.value, 10)
                                )
                            }
                            error={!!errors.reporting_cutoff_day_of_month}
                            helperText={
                                errors.reporting_cutoff_day_of_month
                            }
                            sx={creditInsuranceFieldSx}
                        />
                    </Box>
                    <Box sx={fieldCellSx}>
                        <TextField
                            fullWidth
                            size="small"
                            label={creditInsuranceLabels.reportingSubstituteDayOfMonth}
                            type="number"
                            value={
                                customer?.reporting_substitute_day_of_month !=
                                    null
                                    ? String(
                                        customer.reporting_substitute_day_of_month
                                    )
                                    : ""
                            }
                            onChange={(e) =>
                                onChange(
                                    "reporting_substitute_day_of_month",
                                    e.target.value === ""
                                        ? null
                                        : parseInt(e.target.value, 10)
                                )
                            }
                            required={customer?.reporting_cutoff_day_of_month != null}
                            helperText={
                                errors.reporting_substitute_day_of_month ||
                                t("hints.reporting_days_new_invoices_only", {
                                    ns: "customers",
                                    defaultValue:
                                        "Changes apply to new invoices only.",
                                })
                            }
                            FormHelperTextProps={{
                                sx: {
                                    mt: 0.5,
                                    mb: 0,
                                    mx: 0,
                                    lineHeight: 1.2,
                                },
                            }}
                            error={
                                !!errors.reporting_substitute_day_of_month
                            }
                            sx={creditInsuranceFieldSx}
                        />
                    </Box>
                </>
            )}

            {showDclFields ? (
                <>
                    <Box sx={fieldCellSx}>
                        {isEditing ? (
                            <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label={creditInsuranceLabels.creditScore}
                                value={
                                    customer?.credit_score != null
                                        ? String(customer.credit_score)
                                        : ""
                                }
                                onChange={(e) =>
                                    onChange(
                                        "credit_score",
                                        e.target.value === ""
                                            ? null
                                            : e.target.value
                                    )
                                }
                                inputProps={{ step: "any" }}
                                sx={creditInsuranceFieldSx}
                            />
                        ) : (
                            <CreditInsuranceReadonlyField
                                label={creditInsuranceLabels.creditScore}
                                value={
                                    customer?.credit_score != null
                                        ? String(customer.credit_score)
                                        : null
                                }
                            />
                        )}
                    </Box>

                    <Box sx={fieldCellSx}>
                        {isEditing ? (
                            <DatePicker
                                label={creditInsuranceLabels.creditScoreInputDate}
                                value={
                                    customer?.credit_score_input_date
                                        ? moment(customer.credit_score_input_date)
                                        : null
                                }
                                onChange={(newVal) =>
                                    onChange(
                                        "credit_score_input_date",
                                        newVal ? newVal.format("YYYY-MM-DD") : null
                                    )
                                }
                                format={getDatePickerFormat(session ?? null, "DD/MM/YYYY")}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: "small",
                                        InputLabelProps: { shrink: true },
                                        sx: creditInsuranceFieldSx,
                                        ...(isRTL && {
                                            dir: "rtl",
                                            "data-hebrew": true as const,
                                        }),
                                    },
                                }}
                            />
                        ) : (
                            <CreditInsuranceReadonlyField
                                label={creditInsuranceLabels.creditScoreInputDate}
                                value={
                                    customer?.credit_score_input_date
                                        ? formatDateForDisplay(
                                            customer.credit_score_input_date,
                                            "date",
                                            userLocale,
                                            userTimezone
                                        )
                                        : null
                                }
                            />
                        )}
                    </Box>
                </>
            ) : null}

            <Box sx={fieldCellSx}>
                {isEditing ? (
                    <DatePicker
                        label={creditInsuranceLabels.activeCustomerSince}
                        value={
                            customer?.active_customer_since
                                ? moment(customer.active_customer_since)
                                : null
                        }
                        onChange={(newVal) =>
                            onChange(
                                "active_customer_since",
                                newVal ? newVal.format("YYYY-MM-DD") : null
                            )
                        }
                        format={getDatePickerFormat(session ?? null, "DD/MM/YYYY")}
                        slotProps={{
                            textField: {
                                fullWidth: true,
                                size: "small",
                                InputLabelProps: { shrink: true },
                                sx: creditInsuranceFieldSx,
                                ...(isRTL && {
                                    dir: "rtl",
                                    "data-hebrew": true as const,
                                }),
                            },
                        }}
                    />
                ) : (
                    <CreditInsuranceReadonlyField
                        label={creditInsuranceLabels.activeCustomerSince}
                        value={
                            customer?.active_customer_since
                                ? formatDateForDisplay(
                                    customer.active_customer_since,
                                    "date",
                                    userLocale,
                                    userTimezone
                                )
                                : firstIssuedInvoiceDate
                                    ? formatDateForDisplay(
                                        firstIssuedInvoiceDate,
                                        "date",
                                        userLocale,
                                        userTimezone
                                    )
                                    : null
                        }
                    />
                )}
            </Box>

            {showDclFields && (
                <Box
                    sx={{
                        ...fieldCellSx,
                        minWidth: 0,
                        width: { md: "100%" },
                        alignSelf: "flex-start",
                    }}
                >
                    {isEditing ? (
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(customer?.outdated_dcl)}
                                    onChange={(_, checked) =>
                                        onChange("outdated_dcl", checked)
                                    }
                                    color="primary"
                                    {...(isRTL && { "data-rtl": true })}
                                />
                            }
                            label={
                                <Typography
                                    sx={{
                                        fontWeight: customer?.outdated_dcl
                                            ? 500
                                            : 400,
                                        color: customer?.outdated_dcl
                                            ? "text.primary"
                                            : "text.secondary",
                                    }}
                                >
                                    {creditInsuranceLabels.outdatedDcl}
                                </Typography>
                            }
                            labelPlacement="end"
                            sx={{
                                m: 0,
                                mb: 0.25,
                                direction: isRTL ? "rtl" : "ltr",
                                justifyContent: "flex-start",
                                alignItems: "center",
                                "& .MuiFormControlLabel-label": {
                                    marginLeft: isRTL ? 0 : theme.spacing(1),
                                    marginRight: isRTL ? theme.spacing(1) : 0,
                                },
                                borderRadius: 1,
                                cursor: "pointer",
                            }}
                        />
                    ) : (
                        <CreditInsuranceReadonlyField
                            label={creditInsuranceLabels.outdatedDcl}
                            value={
                                customer?.outdated_dcl
                                    ? t("fields.yes", { ns: "common" })
                                    : t("fields.no", { ns: "common" })
                            }
                        />
                    )}
                </Box>
            )}

            <Box sx={{ ...fieldCellSx, minWidth: 0 }}>
                {isEditing ? (
                    <Autocomplete
                        options={[...POLICY_EXCLUSION_REASONS]}
                        value={customer?.policy_exclusion_reason ?? null}
                        onChange={(_, value) =>
                            onChange("policy_exclusion_reason", value ?? null)
                        }
                        clearOnEscape
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                size="small"
                                fullWidth
                                label={creditInsuranceLabels.policyExclusionReason}
                                error={!!errors.policy_exclusion_reason}
                                helperText={errors.policy_exclusion_reason}
                                sx={creditInsuranceFieldSx}
                            />
                        )}
                    />
                ) : (
                    <CreditInsuranceReadonlyField
                        label={creditInsuranceLabels.policyExclusionReason}
                        value={customer?.policy_exclusion_reason ?? null}
                    />
                )}
            </Box>
        </Box>
    );

    return (
        <Card
            elevation={0}
            sx={{ border: "none", borderRadius: { xs: 1, sm: 2 }, boxShadow: "none" }}
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
                    <ShieldOutlinedIcon
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
                        {t("sections.policies")}
                    </Typography>
                </Box>
                {onEditClick && onCancelEdit && onSave &&
                    (!isEditing ? (
                        <Button variant="contained" size="small" onClick={onEditClick}>
                            {t("actions.edit", { ns: "common" })}
                        </Button>
                    ) : (
                        <Box
                            sx={{
                                display: "flex",
                                direction: isRTL ? "rtl" : "ltr",
                                flexShrink: 0,
                            }}
                        >
                            <Button
                                variant="outlined"
                                size="small"
                                className="cancel-button"
                                onClick={onCancelEdit}
                                disabled={isSaving}
                                sx={{
                                    mr: isRTL ? 0 : theme.spacing(1),
                                    ml: isRTL ? theme.spacing(1) : 0,
                                }}
                            >
                                {t("actions.cancel", { ns: "common" })}
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                onClick={isSaving ? undefined : onSave}
                                disabled={isSaving}
                                className="save-button"
                            >
                                {t("actions.save", { ns: "common" })}
                            </Button>
                        </Box>
                    ))}
            </Box>

            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                {activePolicyGrid}

                {customerId &&
                    (customer as { has_top_up_policies?: boolean })
                        ?.has_top_up_policies === true && (
                        <CustomerTopUpList
                            customerId={customerId}
                            accountHasTopUpPolicies
                            activePrimaryPolicyId={getEffectivePolicyId(customer) ?? null}
                        />
                    )}

                {inactivePolicyHistory.length > 0 ? (
                    <Box
                        sx={{
                            mt: 2,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.5,
                        }}
                    >
                        <Box sx={sectionHeaders.fullWidthSubsection}>
                            <Typography
                                variant="subtitle2"
                                sx={sectionHeaders.title}
                            >
                                {t("fields.policy_history", {
                                    ns: "customers",
                                })}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                width: "100%",
                                direction: "ltr",
                                justifyContent: isRTL ? "flex-start" : "flex-end",
                            }}
                        >
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={
                                    allPoliciesExpanded
                                        ? handleCollapseAllPolicies
                                        : handleExpandAllPolicies
                                }
                            >
                                {allPoliciesExpanded
                                    ? t("actions.collapse_all", {
                                        ns: "common",
                                        defaultValue: "Collapse All",
                                    })
                                    : t("actions.expand_all", {
                                        ns: "common",
                                        defaultValue: "Expand All",
                                    })}
                            </Button>
                        </Box>
                        {inactivePolicyHistory.map((row) => {
                            const label = policyLabelFromRow(row);
                            const accordionKey = policyAccordionKey(row);
                            const isExpanded =
                                expandedPolicies.has(accordionKey);
                            const headerSummaryParts =
                                buildPolicyHistoryHeaderSummary(row);
                            const showOutdatedDclChip =
                                Boolean(row.outdated_dcl) &&
                                row.limit_type !== "Named";
                            return (
                                <Accordion
                                    key={accordionKey}
                                    expanded={isExpanded}
                                    disableGutters
                                    onChange={() =>
                                        handlePolicyAccordionChange(accordionKey)
                                    }
                                    elevation={0}
                                    sx={policyHistoryAccordionStyles.accordion}
                                >
                                    <AccordionSummary
                                        expandIcon={<ExpandMoreIcon />}
                                        sx={policyHistoryAccordionStyles.summary(
                                            isExpanded
                                        )}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                width: "100%",
                                                minWidth: 0,
                                                pr: isRTL ? 0 : 2,
                                                pl: isRTL ? 2 : 0,
                                                gap: 1,
                                                flexWrap: {
                                                    xs: "wrap",
                                                    md: "nowrap",
                                                },
                                            }}
                                        >
                                            <ShieldIcon
                                                sx={{
                                                    color: "text.secondary",
                                                    fontSize: 18,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <Typography
                                                variant="subtitle1"
                                                noWrap
                                                sx={{
                                                    fontWeight: 600,
                                                    fontSize: "0.875rem",
                                                    lineHeight: 1.25,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {label}
                                            </Typography>
                                            <Chip
                                                size="small"
                                                label={resolvePolicyHistoryChipLabel(row)}
                                                variant="outlined"
                                                sx={{
                                                    fontSize: "0.7rem",
                                                    height: 20,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            {headerSummaryParts.length > 0 && (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    noWrap
                                                    sx={{
                                                        fontSize: "0.8125rem",
                                                        minWidth: 0,
                                                        flex: {
                                                            xs: "1 1 100%",
                                                            md: "0 1 auto",
                                                        },
                                                    }}
                                                >
                                                    {headerSummaryParts.join(" · ")}
                                                </Typography>
                                            )}
                                            {showOutdatedDclChip && (
                                                <Chip
                                                    size="small"
                                                    color="warning"
                                                    label={
                                                        creditInsuranceLabels.outdatedDcl
                                                    }
                                                    variant="outlined"
                                                    sx={{
                                                        fontSize: "0.7rem",
                                                        height: 20,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails
                                        sx={policyHistoryAccordionStyles.details}
                                    >
                                        <Box
                                            sx={
                                                policyHistoryAccordionStyles.detailsInner
                                            }
                                        >
                                            <Box sx={{ p: 2 }}>
                                                {renderHistoricalPolicyReadonlyGrid(
                                                    row
                                                )}
                                            </Box>
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>
                            );
                        })}
                    </Box>
                ) : null}
            </CardContent>
        </Card>
    );
};

export default CustomerCreditInsuranceInfo;
