"use client";

import BusinessIcon from "@mui/icons-material/Business";
import InfoIcon from "@mui/icons-material/Info";
import LanguageIcon from "@mui/icons-material/Language";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import ShieldIcon from "@mui/icons-material/Shield";
import {
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import moment from "moment";
import { useSession } from "next-auth/react";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getEffectivePolicyId } from "@/shared/customerPolicyAdapter";
import {
    formatDateForDisplay,
    getDatePickerFormat,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import {
    GENERIC_FIELD_DB_COLUMNS,
    GENERIC_FIELD_KEYS,
    getFieldType,
    type GenericFieldKey,
} from "@/utils/genericFieldUtils";
import { POLICY_EXCLUSION_REASONS } from "@/shared/creditInsurance/policyExclusion";

import CustomerFormField from "./CustomerFormField";

/** Matches `CustomerFormField` view mode (same label/value typography as Collection configuration). */
export function CreditInsuranceReadonlyField({
    label,
    value,
    multiline,
}: {
    label: string;
    value: React.ReactNode;
    multiline?: boolean;
}) {
    const theme = useTheme();
    const { i18n } = useTranslation();
    const isHebrew = i18n.language === "he";
    /** Match `CustomerFormField` view empty state (hyphen-minus, not em dash). */
    const empty = "-";
    const display =
        value === null || value === undefined || value === "" ? empty : value;

    return (
        <Box>
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
            <Typography
                component="div"
                sx={{
                    fontWeight: 400,
                    minHeight: multiline ? undefined : "40px",
                    display: "flex",
                    alignItems: multiline ? "flex-start" : "center",
                    color:
                        display === empty ? "text.secondary" : "text.primary",
                    whiteSpace: multiline ? "pre-wrap" : undefined,
                    direction: isHebrew ? "rtl" : "ltr",
                    textAlign: isHebrew ? "right" : "left",
                }}
            >
                {display}
            </Typography>
        </Box>
    );
}

export function toTitleCaseLabel(input: string): string {
    return input.replace(/\b([A-Za-z])([A-Za-z']*)\b/g, (_, first, rest) => {
        const word = `${first}${rest}`;
        if (word.toUpperCase() === word) {
            return word;
        }
        return first.toUpperCase() + rest.toLowerCase();
    });
}

interface CustomerGeneralInfoProps {
    customer: any;
    isEditing: boolean;
    errors?: { [key: string]: string };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onChange: (_field: string, _value: any) => void;
    countries: any[];
    states: any[];
    activeUsers: any[];
    sequenceContainers?: any[];
    businessUnits?: any[];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    t: (_key: string, _options?: any) => string;
    i18n: any;
    onEditClick?: () => void;
    onCancelEdit?: () => void;
    onSave?: () => void;
    isSaving?: boolean;
    genericFieldsConfig?: { [key: string]: { enabled: boolean; label: string; read_only: boolean } };
    isCreditOnlyAccount?: boolean;
    isCreditInsuranceAccount?: boolean;
    activePolicies?: { id: number; policy_number: string }[];
    showCreditInsuranceSection?: boolean;
}

const CustomerGeneralInfo: React.FC<CustomerGeneralInfoProps> = ({
    customer,
    isEditing,
    errors = {},
    onChange,
    countries,
    states,
    activeUsers,
    sequenceContainers = [],
    businessUnits = [],
    t,
    i18n,
    onEditClick,
    onCancelEdit,
    onSave,
    isSaving = false,
    genericFieldsConfig = {},
    isCreditOnlyAccount = false,
    isCreditInsuranceAccount = false,
    activePolicies = [],
    showCreditInsuranceSection = true,
}) => {
    const theme = useTheme();
    const { data: session } = useSession();

    const sectionHeaders = useMemo(() => {
        const isHebrew = i18n.language === "he";
        const base = {
            gridColumn: "1 / -1" as const,
            mb: 0.5,
            mt: 1.5,
            py: 0.5,
            px: 0,
            direction: isHebrew ? "rtl" : "ltr",
            textAlign: isHebrew ? "right" : "left",
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

    const fieldCellSx = useMemo(
        () => ({
            position: "relative" as const,
            direction: i18n.language === "he" ? ("rtl" as const) : ("ltr" as const),
            textAlign: (i18n.language === "he" ? "right" : "left") as
                | "right"
                | "left",
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
            policyExclusionReason: toTitleCaseLabel(
                t("fields.policy_exclusion_reason", {
                    ns: "customers",
                    defaultValue: "Policy exclusion reason",
                })
            ),
            approvedLimitExpirationDate: toTitleCaseLabel(
                t("fields.approved_limit_expiration_date", {
                    ns: "customers",
                    defaultValue: "Approved limit expiration date",
                })
            ),
        }),
        [t]
    );

    /** When a policy is attached, policy-driven inputs show the required asterisk. */
    const policyRelatedRequired = Boolean(
        getEffectivePolicyId(customer ?? {})
    );
    return (
        <Card
            elevation={0}
            sx={{
                border: "none",
                borderRadius: `${theme.appButton.borderRadius}px`,
                boxShadow: "none",
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
                        {t("sections.general_information")}
                    </Typography>
                </Box>
                {onEditClick && onCancelEdit && onSave && (
                    !isEditing ? (
                        <Button
                            variant="contained"
                            size="small"
                            onClick={onEditClick}
                        >
                            {t("actions.edit", { ns: "common" })}
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
                                disabled={isSaving}
                            >
                                {t("actions.cancel", { ns: "common" })}
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                onClick={isSaving ? undefined : onSave}
                                className="save-button"
                                disabled={isSaving}
                            >
                                {t("actions.save", { ns: "common" })}
                            </Button>
                        </Box>
                    )
                )}
            </Box>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, 1fr)",
                            md: "repeat(3, 1fr)",
                        },
                        gap: 1.5,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        textAlign: i18n.language === "he" ? "right" : "left",
                    }}
                >
                    {/* GROUP 1: Identity & Contact */}
                    <Box sx={sectionHeaders.first}>
                        <Typography variant="subtitle2" sx={sectionHeaders.title}>
                            {t("sections.identity_contact", { ns: "customers" })}
                        </Typography>
                    </Box>

                    {/* Company Name */}
                    <Box
                        sx={{
                            position: "relative",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                        }}
                    >
                        <CustomerFormField
                            field="customer_name"
                            value={customer?.customer_name || ""}
                            isEditing={isEditing}
                            error={errors.customer_name}
                            onChange={onChange}
                            countries={countries}
                            states={states}
                            activeUsers={activeUsers}
                            t={t}
                            editedCustomer={customer}
                            label={t("fields.name")}
                            icon={<BusinessIcon />}
                        />
                    </Box>

                    {/* Customer Code */}
                    <Box
                        sx={{
                            position: "relative",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                        }}
                    >
                        <CustomerFormField
                            field="customer_number"
                            value={customer?.customer_number || ""}
                            isEditing={isEditing}
                            error={errors.customer_number}
                            onChange={onChange}
                            countries={countries}
                            states={states}
                            activeUsers={activeUsers}
                            t={t}
                            editedCustomer={customer}
                            label={t("fields.customer_code")}
                            icon={<BusinessIcon />}
                        />
                    </Box>

                    {/* CRN (company registration) */}
                    <Box
                        sx={{
                            position: "relative",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                        }}
                    >
                        <CustomerFormField
                            field="crn"
                            value={customer?.crn ?? ""}
                            isEditing={isEditing}
                            error={errors.crn}
                            onChange={onChange}
                            countries={countries}
                            states={states}
                            activeUsers={activeUsers}
                            t={t}
                            editedCustomer={customer}
                            label={t("fields.crn")}
                            icon={<BusinessIcon />}
                        />
                    </Box>

                    {/* Phone */}
                    <Box
                        sx={{
                            position: "relative",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                        }}
                    >
                        <CustomerFormField
                            field="phone"
                            value={customer?.phone || ""}
                            isEditing={isEditing}
                            error={errors.phone}
                            onChange={onChange}
                            countries={countries}
                            states={states}
                            activeUsers={activeUsers}
                            t={t}
                            editedCustomer={customer}
                            label={t("fields.phone")}
                            icon={<PhoneIcon />}
                        />
                    </Box>

                    {/* GROUP 2: Assignment & Organization */}
                    <Box sx={sectionHeaders.standard}>
                        <Typography variant="subtitle2" sx={sectionHeaders.title}>
                            {t("sections.assignment_organization", {
                                ns: "customers",
                            })}
                        </Typography>
                    </Box>

                    {/* Business Unit */}
                    <Box
                        sx={{
                            position: "relative",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                        }}
                    >
                        <CustomerFormField
                            field="business_unit_id"
                            value={customer?.business_unit_id?.toString() || ""}
                            isEditing={isEditing}
                            error={errors.business_unit_id}
                            onChange={onChange}
                            countries={countries}
                            states={states}
                            activeUsers={activeUsers}
                            sequenceContainers={sequenceContainers}
                            businessUnits={businessUnits}
                            t={t}
                            editedCustomer={customer}
                            label={t("fields.business_unit")}
                            icon={<BusinessIcon />}
                        />
                    </Box>

                    {/* Parent Customer */}
                    <Box
                        sx={{
                            position: "relative",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                        }}
                    >
                        <CustomerFormField
                            field="parent_customer_id"
                            value={
                                customer?.parent_customer_id?.toString() || ""
                            }
                            isEditing={isEditing}
                            error={errors.parent_customer_id}
                            onChange={onChange}
                            countries={countries}
                            states={states}
                            activeUsers={activeUsers}
                            sequenceContainers={sequenceContainers}
                            businessUnits={businessUnits}
                            t={t}
                            editedCustomer={customer}
                            label={t("fields.parent_customer")}
                            icon={<BusinessIcon />}
                        />
                    </Box>

                    {/* Owner */}
                    <Box
                        sx={{
                            position: "relative",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                        }}
                    >
                        <CustomerFormField
                            field="owner_id"
                            value={customer?.owner_id || null}
                            isEditing={isEditing}
                            error={errors.owner_id}
                            onChange={onChange}
                            countries={countries}
                            states={states}
                            activeUsers={activeUsers}
                            t={t}
                            editedCustomer={customer}
                            label={t("fields.owner")}
                            icon={<PersonIcon />}
                        />
                    </Box>

                    {!isCreditOnlyAccount && (
                        <Box sx={sectionHeaders.standard}>
                            <Typography
                                variant="subtitle2"
                                sx={sectionHeaders.title}
                            >
                                {t("sections.collection_configuration", {
                                    ns: "customers",
                                })}
                            </Typography>
                        </Box>
                    )}

                    {/* Language */}
                    <Box
                        sx={{
                            position: "relative",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                        }}
                    >
                        <CustomerFormField
                            field="language"
                            value={customer?.language || ""}
                            isEditing={isEditing}
                            error={errors.language}
                            onChange={onChange}
                            countries={countries}
                            states={states}
                            activeUsers={activeUsers}
                            t={t}
                            editedCustomer={customer}
                            label={t("fields.language")}
                            icon={<LanguageIcon />}
                        />
                    </Box>

                    {!isCreditOnlyAccount && (
                        <Box
                            sx={{
                                position: "relative",
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                            }}
                        >
                            <CustomerFormField
                                field="category_for_new_collection"
                                value={
                                    customer?.category_for_new_collection ||
                                    "Automated"
                                }
                                isEditing={isEditing}
                                error={errors.category_for_new_collection}
                                onChange={onChange}
                                countries={countries}
                                states={states}
                                activeUsers={activeUsers}
                                sequenceContainers={sequenceContainers}
                                businessUnits={businessUnits}
                                t={t}
                                editedCustomer={customer}
                                label={t("fields.category_for_new_collection")}
                                icon={<InfoIcon />}
                            />
                        </Box>
                    )}

                    {!isCreditOnlyAccount && (
                        <Box
                            sx={{
                                position: "relative",
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                            }}
                        >
                            <CustomerFormField
                                field="sequence_container_id"
                                value={
                                    customer?.sequence_container_id?.toString() ||
                                    ""
                                }
                                isEditing={isEditing}
                                error={errors.sequence_container_id}
                                onChange={onChange}
                                countries={countries}
                                states={states}
                                activeUsers={activeUsers}
                                sequenceContainers={sequenceContainers}
                                businessUnits={businessUnits}
                                t={t}
                                editedCustomer={customer}
                                label={t("fields.sequence_container")}
                                icon={<BusinessIcon />}
                            />
                        </Box>
                    )}

                    {!isCreditOnlyAccount && (
                        <Box
                            sx={{
                                position: "relative",
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                            }}
                        >
                            <CustomerFormField
                                field="first_activity_delay_days"
                                value={
                                    customer?.first_activity_delay_days?.toString() ||
                                    ""
                                }
                                isEditing={isEditing}
                                error={errors.first_activity_delay_days}
                                onChange={onChange}
                                countries={countries}
                                states={states}
                                activeUsers={activeUsers}
                                t={t}
                                editedCustomer={customer}
                                label={t("fields.first_activity_delay_days")}
                                icon={<BusinessIcon />}
                            />
                        </Box>
                    )}

                    {isCreditInsuranceAccount && showCreditInsuranceSection && (
                        <>
                            <Box sx={sectionHeaders.standard}>
                                <Typography
                                    variant="subtitle2"
                                    sx={sectionHeaders.title}
                                >
                                    {t("sections.credit_insurance", {
                                        ns: "customers",
                                        defaultValue: "Credit insurance",
                                    })}
                                </Typography>
                            </Box>
                            <Box sx={fieldCellSx}>
                                <CustomerFormField
                                    field="policy_id"
                                    value={
                                        customer?.policy_id?.toString() || ""
                                    }
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
                                                e.target.value === ""
                                                    ? null
                                                    : e.target.value
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
                                        value={
                                            customer?.approved_limit != null
                                                ? String(customer.approved_limit)
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
                                        format={getDatePickerFormat(session, "DD/MM/YYYY")}
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                size: "small",
                                                sx: creditInsuranceFieldSx,
                                                ...(i18n.language === "he" && {
                                                    "data-hebrew": true,
                                                    dir: "rtl" as const,
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
                                                    getUserDateLocale(session),
                                                    getUserTimezone(session)
                                                )
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
                                        onChange={(e) =>
                                            onChange(
                                                "limit_type",
                                                e.target.value || null
                                            )
                                        }
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
                                        label={
                                            creditInsuranceLabels.maxPaymentTermDays
                                        }
                                        type="number"
                                        value={
                                            customer?.max_payment_term != null
                                                ? String(
                                                    customer.max_payment_term
                                                )
                                                : ""
                                        }
                                        onChange={(e) =>
                                            onChange(
                                                "max_payment_term",
                                                e.target.value === ""
                                                    ? null
                                                    : parseInt(
                                                        e.target.value,
                                                        10
                                                    )
                                            )
                                        }
                                        required={policyRelatedRequired}
                                        error={!!errors.max_payment_term}
                                        helperText={errors.max_payment_term}
                                        sx={creditInsuranceFieldSx}
                                    />
                                ) : (
                                    <CreditInsuranceReadonlyField
                                        label={
                                            creditInsuranceLabels.maxPaymentTermDays
                                        }
                                        value={
                                            customer?.max_payment_term != null
                                                ? String(
                                                    customer.max_payment_term
                                                )
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
                                        label={
                                            creditInsuranceLabels.maxAllowedMepDays
                                        }
                                        type="number"
                                        value={
                                            customer?.max_allowed_mep != null
                                                ? String(
                                                    customer.max_allowed_mep
                                                )
                                                : ""
                                        }
                                        onChange={(e) =>
                                            onChange(
                                                "max_allowed_mep",
                                                e.target.value === ""
                                                    ? null
                                                    : parseInt(
                                                        e.target.value,
                                                        10
                                                    )
                                            )
                                        }
                                        required={policyRelatedRequired}
                                        error={!!errors.max_allowed_mep}
                                        helperText={errors.max_allowed_mep}
                                        sx={creditInsuranceFieldSx}
                                    />
                                ) : (
                                    <CreditInsuranceReadonlyField
                                        label={
                                            creditInsuranceLabels.maxAllowedMepDays
                                        }
                                        value={
                                            customer?.max_allowed_mep != null
                                                ? String(
                                                    customer.max_allowed_mep
                                                )
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
                                                    : parseInt(
                                                        e.target.value,
                                                        10
                                                    )
                                            )
                                        }
                                        helperText={
                                            errors.reporting_days ||
                                            t(
                                                "hints.reporting_days_new_invoices_only",
                                                {
                                                    ns: "customers",
                                                    defaultValue:
                                                        "Changes apply to new invoices only.",
                                                }
                                            )
                                        }
                                        FormHelperTextProps={{
                                            sx: { mt: 0.5, mx: 0 },
                                        }}
                                        required={policyRelatedRequired}
                                        error={!!errors.reporting_days}
                                        sx={creditInsuranceFieldSx}
                                    />
                                ) : (
                                    <CreditInsuranceReadonlyField
                                        label={creditInsuranceLabels.reportingDays}
                                        value={
                                            customer?.reporting_days != null
                                                ? String(customer.reporting_days)
                                                : null
                                        }
                                    />
                                )}
                            </Box>
                            <Box sx={fieldCellSx}>
                                {isEditing ? (
                                    <Autocomplete
                                        options={[...POLICY_EXCLUSION_REASONS]}
                                        value={
                                            customer?.policy_exclusion_reason ?? null
                                        }
                                        onChange={(_, value) =>
                                            onChange(
                                                "policy_exclusion_reason",
                                                value ?? null
                                            )
                                        }
                                        clearOnEscape
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                size="small"
                                                fullWidth
                                                label={
                                                    creditInsuranceLabels.policyExclusionReason
                                                }
                                                error={
                                                    !!errors.policy_exclusion_reason
                                                }
                                                helperText={
                                                    errors.policy_exclusion_reason
                                                }
                                                sx={creditInsuranceFieldSx}
                                            />
                                        )}
                                    />
                                ) : (
                                    <CreditInsuranceReadonlyField
                                        label={
                                            creditInsuranceLabels.policyExclusionReason
                                        }
                                        value={
                                            customer?.policy_exclusion_reason ?? null
                                        }
                                    />
                                )}
                            </Box>
                        </>
                    )}

                    {/* Custom Fields Section */}
                    {genericFieldsConfig &&
                        Object.values(genericFieldsConfig).some(
                            (fieldConfig) => fieldConfig?.enabled
                        ) && (
                            <>
                                <Box
                                    sx={{
                                        ...sectionHeaders.standard,
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        textAlign:
                                            i18n.language === "he"
                                                ? "right"
                                                : "left",
                                    }}
                                >
                                    <Typography
                                        variant="subtitle2"
                                        sx={{
                                            ...sectionHeaders.title,
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                        }}
                                    >
                                        {t("sections.custom_fields", {
                                            ns: "generic_fields",
                                            defaultValue: "Custom Fields",
                                        })}
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        gridColumn: "1 / -1",
                                        display: "grid",
                                        gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "repeat(2, 1fr)",
                                            md: "repeat(3, 1fr)",
                                        },
                                        gap: 1.5,
                                        direction:
                                            i18n.language === "he" ? "rtl" : "ltr",
                                    }}
                                >
                                    {GENERIC_FIELD_KEYS.map((fieldKey) => {
                                        const config = genericFieldsConfig[fieldKey];
                                        if (!config?.enabled) return null;

                                        const dbColumn =
                                            GENERIC_FIELD_DB_COLUMNS[fieldKey as GenericFieldKey];
                                        const value = customer?.[dbColumn];
                                        const fieldType = getFieldType(fieldKey);
                                        const isReadOnly =
                                            config.read_only || !isEditing;
                                        const isHebrew = i18n.language === "he";

                                        return (
                                            <Box
                                                key={fieldKey}
                                                sx={{
                                                    position: "relative",
                                                    direction: isHebrew
                                                        ? "rtl"
                                                        : "ltr",
                                                    textAlign: isHebrew
                                                        ? "right"
                                                        : "left",
                                                }}
                                            >
                                                {isReadOnly ? (
                                                    <Box
                                                        sx={{
                                                            direction: isHebrew
                                                                ? "rtl"
                                                                : "ltr",
                                                            textAlign: isHebrew
                                                                ? "right"
                                                                : "left",
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                            sx={{
                                                                fontSize: "0.75rem",
                                                                direction: isHebrew
                                                                    ? "rtl"
                                                                    : "ltr",
                                                                textAlign: isHebrew
                                                                    ? "right"
                                                                    : "left",
                                                            }}
                                                        >
                                                            {config.label}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                direction: isHebrew
                                                                    ? "rtl"
                                                                    : "ltr",
                                                                textAlign: isHebrew
                                                                    ? "right"
                                                                    : "left",
                                                            }}
                                                        >
                                                            {fieldType === "date" &&
                                                                value
                                                                ? formatDateForDisplay(
                                                                    value,
                                                                    "date",
                                                                    getUserDateLocale(
                                                                        session
                                                                    ),
                                                                    getUserTimezone(
                                                                        session
                                                                    )
                                                                )
                                                                : value ?? "-"}
                                                        </Typography>
                                                    </Box>
                                                ) : fieldType === "date" ? (
                                                    <DatePicker
                                                        label={config.label}
                                                        value={
                                                            value
                                                                ? moment(value)
                                                                : null
                                                        }
                                                        onChange={(newVal) =>
                                                            onChange(
                                                                dbColumn,
                                                                newVal
                                                                    ? newVal.format(
                                                                        "YYYY-MM-DD"
                                                                    )
                                                                    : null
                                                            )
                                                        }
                                                        format={getDatePickerFormat(
                                                            session,
                                                            "DD/MM/YYYY"
                                                        )}
                                                        slotProps={{
                                                            textField: {
                                                                fullWidth: true,
                                                                size: "small",
                                                                error:
                                                                    !!errors?.[
                                                                    dbColumn
                                                                    ],
                                                                helperText:
                                                                    errors?.[
                                                                    dbColumn
                                                                    ],
                                                                dir: isHebrew
                                                                    ? "rtl"
                                                                    : "ltr",
                                                                ...(isHebrew && {
                                                                    "data-hebrew": true,
                                                                    "data-rtl": true,
                                                                }),
                                                                sx: {
                                                                    "& .MuiInputBase-root":
                                                                    {
                                                                        height: "40px",
                                                                        minHeight:
                                                                            "40px",
                                                                    },
                                                                    ...(isHebrew && {
                                                                        "& .MuiInputAdornment-root":
                                                                        {
                                                                            marginLeft: "9px",
                                                                            marginRight: 0,
                                                                        },
                                                                    }),
                                                                },
                                                            },
                                                            popper: isHebrew
                                                                ? {
                                                                    sx: {
                                                                        direction:
                                                                            "rtl",
                                                                    },
                                                                }
                                                                : undefined,
                                                        }}
                                                    />
                                                ) : (
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label={config.label}
                                                        value={value ?? ""}
                                                        onChange={(e) => {
                                                            if (fieldType === "number") {
                                                                const v =
                                                                    e.target.value;
                                                                if (v === "")
                                                                    onChange(
                                                                        dbColumn,
                                                                        null
                                                                    );
                                                                else {
                                                                    const n =
                                                                        parseFloat(v);
                                                                    onChange(
                                                                        dbColumn,
                                                                        isNaN(n)
                                                                            ? null
                                                                            : n
                                                                    );
                                                                }
                                                            } else {
                                                                onChange(
                                                                    dbColumn,
                                                                    e.target.value
                                                                );
                                                            }
                                                        }}
                                                        type={
                                                            fieldType === "number"
                                                                ? "number"
                                                                : "text"
                                                        }
                                                        inputProps={
                                                            fieldType === "number"
                                                                ? { step: "any" }
                                                                : undefined
                                                        }
                                                        error={!!errors?.[dbColumn]}
                                                        helperText={errors?.[dbColumn]}
                                                        dir={isHebrew ? "rtl" : "ltr"}
                                                        {...(isHebrew && {
                                                            "data-hebrew": true,
                                                        })}
                                                    />
                                                )}
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </>
                        )}
                </Box>
            </CardContent>
        </Card>
    );
};

export default CustomerGeneralInfo;
