// todo: allow users to delete contacts. before deletetion check if there are scheduled activites for this contact.

"use client";

import HelpIcon from "@mui/icons-material/Help";
import InfoIcon from "@mui/icons-material/Info";
import PersonIcon from "@mui/icons-material/Person";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import {
    Box,
    Button,
    FormControlLabel,
    IconButton,
    InputAdornment,
    Switch,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/app/api";
import {
    formatDateForDisplay,
    getDatePickerFormat,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import {
    getEnabledFields,
    mergeWithDefaults,
    GENERIC_FIELD_DB_COLUMNS,
    getFieldType,
    type GenericFieldKey,
} from "@/utils/genericFieldUtils";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { createLogRecord } from "@/shared/utility/LogCreator";
import { Contact } from "@/types/contact";

interface ContactFormData {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    mobile: string;
    date_of_birth: string;
    role: string;
    status: "Active" | "Inactive";
    company_wide_address: boolean;
    receives_standard_reminder: boolean;
    receives_escalated_reminder: boolean;
    state_id?: number;
    country_id?: number;
    mobile_status?: "Valid" | "Failure";
    id?: number;
    Country?: {
        id: number;
        name: string;
        iso2: string | null;
        emoji: string | null;
    } | null;
    State?: {
        id: number;
        name: string;
        country_id: number;
        country_code: string;
    } | null;
    generic_text1?: string | null;
    generic_text2?: string | null;
    generic_number1?: number | null;
    generic_number2?: number | null;
    generic_date1?: string | null;
    generic_date2?: string | null;
}

interface UpsertContactModalProps {
    isOpen: boolean;
    initialContact?: Contact | any; // Allow both Contact and InvalidContact types
    companyId: number;
    customerId: number;
    accountId?: number;
    closeModal: () => void;
    onCreateContact?: (contact: Contact) => void | Promise<void>;
    TransitionComponent?: React.ComponentType<any>;
}

interface ContactErrors {
    [key: string]: string;
}

const UpsertContactModal: React.FC<UpsertContactModalProps> = ({
    isOpen,
    initialContact,
    companyId,
    customerId: _customerId,
    accountId: accountIdProp,
    closeModal,
    onCreateContact,
    TransitionComponent,
}): JSX.Element => {
    const { t, i18n } = useTranslation([
        "contacts",
        "customers",
        "common",
        "control_center",
        "generic_fields",
    ]);
    const { success, error } = useToast();
    const queryClient = useQueryClient();
    const theme = useTheme();
    const { data: session } = useSession();
    const accountId = accountIdProp ?? (session?.user?.account_id as number | undefined);

    const { data: accountData } = useQuery({
        queryKey: ["account", accountId],
        queryFn: async () => {
            const res = await api.get(`/api/entities/accounts/${accountId}`);
            return res.data;
        },
        enabled: isOpen && !!accountId,
    });

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
        enabled: isOpen && !!session?.user,
        staleTime: 2 * 60 * 1000,
    });
    const hasManageContactsPermission =
        (userPermissionsData?.permissions || []).includes("manage_contacts");

    const genericConfig = useMemo(
        () => mergeWithDefaults(accountData?.generic_field_config),
        [accountData?.generic_field_config]
    );

    const enabledContactGenericFields = useMemo(
        () => getEnabledFields(genericConfig, "contact"),
        [genericConfig]
    );
    const isRTL = i18n.language === "he";

    // Memoized styles and configurations
    const textFieldSx = useMemo(
        () => ({
            "& .MuiInputBase-input": {
                textAlign: isRTL ? "right" : "left",
                direction: isRTL ? "rtl" : "ltr",
            },
            "& .MuiInputLabel-root": {
                textAlign: isRTL ? "right" : "left",
                direction: isRTL ? "rtl" : "ltr",
            },
            "& .MuiOutlinedInput-root": {
                alignItems: "center",
            },
        }),
        [isRTL]
    );

    const tooltipPopperProps = useMemo(
        () => ({
            sx: {
                direction: isRTL ? "rtl" : "ltr",
                "& .MuiTooltip-tooltip": {
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                },
            },
        }),
        [isRTL]
    );

    const gridContainerSx = useMemo(
        () => ({
            display: "grid",
            gap: 1,
            bgcolor: "background.default",
            borderRadius: 1,
            "@media (min-width: 600px)": {
                gridTemplateColumns: "repeat(2, 1fr)",
                padding: "8px",
            },
            "@media (max-width: 599px)": {
                gridTemplateColumns: "1fr",
                padding: "6px",
            },
        }),
        []
    );

    const sectionHeaderSx = useMemo(
        () => ({
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 0.5,
            color: "primary.main",
        }),
        []
    );

    const switchLabelSx = useMemo(
        () => ({
            alignItems: "center",
            "& .MuiFormControlLabel-label": {
                fontSize: "0.875rem",
                fontWeight: 500,
                lineHeight: 1.4,
                ml: 1,
            },
        }),
        []
    );

    const helpIconSx = useMemo(
        () => ({
            fontSize: { xs: "0.875rem", sm: "1rem" },
            color: "primary.main",
            cursor: "help",
            opacity: 0.7,
            "&:hover": {
                opacity: 1,
            },
        }),
        []
    );

    const clearNotificationError = useCallback(() => {
        setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.notification_settings;
            return newErrors;
        });
    }, []);

    // Fetch latest contact data when modal opens if editing
    const { data: fetchedContact } = useQuery<Contact>({
        queryKey: ["contact", initialContact?.id],
        queryFn: async () => {
            if (!initialContact?.id) return null;
            const response = await api.get(
                `/entities/contacts/${initialContact.id}`
            );
            return response.data;
        },
        enabled: isOpen && !!initialContact?.id, // Only fetch when modal is open and contact ID exists
        staleTime: 0, // Always fetch fresh data
        gcTime: 0, // Don't cache
    });

    // Use fetched contact if available, otherwise fall back to initialContact
    const currentContact = fetchedContact || initialContact;

    const PHONE_REGEX =
        /^\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/;
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    const validatePhoneNumber = useCallback((value: string): boolean => {
        return PHONE_REGEX.test(value);
    }, []);

    const validateEmail = useCallback((value: string): boolean => {
        return EMAIL_REGEX.test(value);
    }, []);

    const handlePhoneChange = useCallback(
        (field: "phone" | "mobile", value: string): void => {
            // Always update the contact state to allow typing
            setContact((prev) => ({
                ...prev,
                [field]: value,
                // Set mobile_status to Valid when mobile field contains a value
                ...(field === "mobile" && value.trim()
                    ? { mobile_status: "Valid" as const }
                    : {}),
            }));

            // Validate and handle errors
            if (value && !validatePhoneNumber(value)) {
                // Show error if the field is not empty and invalid
                setErrors((prev) => ({
                    ...prev,
                    [field]: t("validation.invalid_phone_format", {
                        ns: "contacts",
                    }),
                }));
            } else {
                // Clear error if the value is valid or empty
                setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors[field];

                    // Clear contact_method error if at least one contact method is now provided
                    // Since setContact updates state asynchronously, we need to check the new value
                    // for the current field and use a callback to check updated state for others
                    setTimeout(() => {
                        setContact((currentContact) => {
                            const hasEmail =
                                currentContact.email &&
                                currentContact.email.trim().length > 0;
                            const hasPhone =
                                currentContact.phone &&
                                currentContact.phone.trim().length > 0;
                            const hasMobile =
                                currentContact.mobile &&
                                currentContact.mobile.trim().length > 0;

                            if (hasEmail || hasPhone || hasMobile) {
                                setErrors((prevErrors) => {
                                    const updatedErrors = { ...prevErrors };
                                    delete updatedErrors.contact_method;
                                    return updatedErrors;
                                });
                            }

                            return currentContact; // Return unchanged since we already updated above
                        });
                    }, 0);

                    return newErrors;
                });
            }
        },
        [t, validatePhoneNumber]
    );

    const handleEmailChange = useCallback((value: string): void => {
        setContact((prev) => ({
            ...prev,
            email: value,
        }));

        if (value?.trim()) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.contact_method;
                return newErrors;
            });
        }
    }, []);

    const [contact, setContact] = useState<ContactFormData>({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        mobile: "",
        date_of_birth: "",
        role: "",
        status: "Active",
        company_wide_address: false,
        receives_standard_reminder: false,
        receives_escalated_reminder: false,
        mobile_status: undefined,
    });

    const [errors, setErrors] = useState<ContactErrors>({});
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showWarnings, setShowWarnings] = useState<boolean>(false);

    useEffect(() => {
        // Use currentContact which is either fetchedContact or initialContact
        const contactToUse = currentContact;

        if (contactToUse) {
            const formatDateField = (val: unknown): string => {
                if (!val) return "";
                if (val instanceof Date) return val.toISOString().split("T")[0];
                if (typeof val === "string") {
                    const d = new Date(val);
                    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
                }
                return "";
            };

            const newContact: ContactFormData = {
                first_name: contactToUse.first_name || "",
                last_name: contactToUse.last_name || "",
                email: contactToUse.email || "",
                phone: contactToUse.phone || "",
                mobile: contactToUse.mobile || "",
                date_of_birth: contactToUse.date_of_birth
                    ? new Date(contactToUse.date_of_birth)
                        .toISOString()
                        .split("T")[0]
                    : "",
                role: contactToUse.role || "",
                status: contactToUse.status || "Active",
                company_wide_address: Boolean(
                    contactToUse.company_wide_address
                ),
                receives_standard_reminder: Boolean(
                    contactToUse.receives_standard_reminder
                ),
                receives_escalated_reminder: Boolean(
                    contactToUse.receives_escalated_reminder
                ),
                mobile_status: contactToUse.mobile_status || undefined,
                state_id: contactToUse.State?.id,
                country_id: contactToUse.Country?.id,
                id: contactToUse.id,
            };

            if (contactToUse.generic_text1 !== undefined) newContact.generic_text1 = contactToUse.generic_text1 ?? null;
            if (contactToUse.generic_text2 !== undefined) newContact.generic_text2 = contactToUse.generic_text2 ?? null;
            if (contactToUse.generic_number1 !== undefined) newContact.generic_number1 = contactToUse.generic_number1 ?? null;
            if (contactToUse.generic_number2 !== undefined) newContact.generic_number2 = contactToUse.generic_number2 ?? null;
            if (contactToUse.generic_date1 !== undefined) newContact.generic_date1 = formatDateField(contactToUse.generic_date1) || null;
            if (contactToUse.generic_date2 !== undefined) newContact.generic_date2 = formatDateField(contactToUse.generic_date2) || null;

            setContact(newContact);

            if (
                newContact.email?.trim() ||
                newContact.phone?.trim() ||
                newContact.mobile?.trim()
            ) {
                setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.contact_method;
                    return newErrors;
                });
            }

            setShowWarnings(
                contactToUse.email_status === "Bounced" ||
                contactToUse.email_status === "Failure" ||
                contactToUse.mobile_status === "Failure"
            );
        } else {
            setContact({
                first_name: "",
                last_name: "",
                email: "",
                phone: "",
                mobile: "",
                date_of_birth: "",
                role: "",
                status: "Active",
                company_wide_address: false,
                receives_standard_reminder: false,
                receives_escalated_reminder: false,
                mobile_status: undefined,
            });
            setShowWarnings(false);
        }
    }, [currentContact, isOpen]);

    const validateFields = (): ContactErrors => {
        const errors: ContactErrors = {};

        if (!contact.first_name.trim()) {
            errors.first_name = t("validation.required", { ns: "common" });
        }

        if (!contact.company_wide_address && !contact.last_name.trim()) {
            errors.last_name = t("validation.required", { ns: "common" });
        }

        if (contact.email && !validateEmail(contact.email)) {
            errors.email = t("validation.invalid_email_format", {
                ns: "contacts",
            });
        }

        if (contact.phone && !validatePhoneNumber(contact.phone)) {
            errors.phone = t("validation.invalid_phone_format", {
                ns: "contacts",
            });
        }

        if (contact.mobile && !validatePhoneNumber(contact.mobile)) {
            errors.mobile = t("validation.invalid_phone_format", {
                ns: "contacts",
            });
        }

        // Validate company ID
        if (!companyId || companyId <= 0) {
            errors.company_id = "Invalid company ID";
        }

        // Validate date of birth if provided
        if (contact.date_of_birth) {
            const date = new Date(contact.date_of_birth);
            if (isNaN(date.getTime())) {
                errors.date_of_birth = "Invalid date format";
            }
        }

        if (
            !contact.email?.trim() &&
            !contact.phone?.trim() &&
            !contact.mobile?.trim()
        ) {
            errors.contact_method = t(
                "validation.at_least_one_contact_method",
                { ns: "contacts" }
            );
        }

        return errors;
    };

    const handleBlur = (field: keyof ContactFormData): void => {
        const newErrors = { ...errors };
        const value = contact[field];

        // Only validate if the field is empty
        if (typeof value === "string" && !value.trim()) {
            if (field === "first_name") {
                newErrors.first_name = t("validation.required", {
                    ns: "common",
                });
            } else if (field === "last_name" && !contact.company_wide_address) {
                newErrors.last_name = t("validation.required", {
                    ns: "common",
                });
            } else if (field === "email") {
                newErrors.email = t("validation.required", { ns: "common" });
            }
        } else if (
            field === "email" &&
            typeof value === "string" &&
            value &&
            !validateEmail(value)
        ) {
            newErrors.email = t("validation.invalid_email_format", {
                ns: "contacts",
            });
        } else if (
            (field === "phone" || field === "mobile") &&
            typeof value === "string" &&
            value &&
            !validatePhoneNumber(value)
        ) {
            newErrors[field] = t("validation.invalid_phone_format", {
                ns: "contacts",
            });
        } else {
            // Clear error if field is not empty and valid
            delete newErrors[field];

            // Clear contact_method error if at least one contact method is now provided
            if (field === "email" || field === "phone" || field === "mobile") {
                const hasEmail =
                    (field === "email" &&
                        value &&
                        typeof value === "string" &&
                        value.trim().length > 0) ||
                    (field !== "email" &&
                        contact.email &&
                        contact.email.trim().length > 0);
                const hasPhone =
                    (field === "phone" &&
                        value &&
                        typeof value === "string" &&
                        value.trim().length > 0) ||
                    (field !== "phone" &&
                        contact.phone &&
                        contact.phone.trim().length > 0);
                const hasMobile =
                    (field === "mobile" &&
                        value &&
                        typeof value === "string" &&
                        value.trim().length > 0) ||
                    (field !== "mobile" &&
                        contact.mobile &&
                        contact.mobile.trim().length > 0);

                if (hasEmail || hasPhone || hasMobile) {
                    delete newErrors.contact_method;
                }
            }
        }

        setErrors(newErrors);
    };

    const handleCompanyWideAddressChange = useCallback(
        (checked: boolean): void => {
            setContact((prev) => ({
                ...prev,
                company_wide_address: checked,
                mobile: checked ? "" : prev.mobile,
            }));
        },
        []
    );

    const submitHandler = async (): Promise<void> => {
        if (!hasManageContactsPermission) return;
        const newErrors = validateFields();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsLoading(true);
        try {
            const emailChanged =
                currentContact && contact.email !== currentContact.email;
            const mobileChanged =
                currentContact && contact.mobile !== currentContact.mobile;

            // Build formatted contact object with explicit field handling
            const formattedContact: Record<string, unknown> = {
                first_name: contact.first_name.trim(),
                last_name: contact.last_name?.trim() || null,
                email: contact.email?.trim() || null,
                phone: contact.phone?.trim() || null,
                mobile: contact.mobile?.trim() || null,
                role: contact.role?.trim() || null,
                status: contact.status,
                company_wide_address: contact.company_wide_address,
                receives_standard_reminder: contact.receives_standard_reminder,
                receives_escalated_reminder:
                    contact.receives_escalated_reminder,
                state_id: contact.state_id || null,
                date_of_birth: contact.date_of_birth
                    ? new Date(contact.date_of_birth).toISOString()
                    : null,
                company_id: companyId,
                customer_id: _customerId,
                // Set email_status to Valid if email has changed
                ...(emailChanged && contact.email
                    ? { email_status: "Valid" as const }
                    : {}),
                // Set mobile_status to Valid if mobile has changed
                ...(mobileChanged && contact.mobile
                    ? { mobile_status: "Valid" as const }
                    : {}),
                id: currentContact?.id,
            };

            // Add generic fields: editable from contact state, read-only from existing data
            enabledContactGenericFields.forEach((fieldKey) => {
                const dbColumn = GENERIC_FIELD_DB_COLUMNS[fieldKey];
                const config = genericConfig.contact[fieldKey];
                if (config.read_only && currentContact) {
                    formattedContact[dbColumn] = (currentContact as any)[dbColumn] ?? null;
                } else {
                    const val = contact[dbColumn as keyof ContactFormData];
                    if (val !== undefined) {
                        formattedContact[dbColumn] =
                            fieldKey.startsWith("date") && val
                                ? new Date(val as string).toISOString()
                                : val;
                    }
                }
            });

            // Ensure we have valid company ID
            if (!companyId) {
                throw new Error("Invalid company ID");
            }

            // Use the api helper for proper authentication and error handling
            // The API endpoint handles both create (POST without id) and update (POST with id)
            const response = await api.post(
                "/entities/contacts",
                formattedContact
            );
            const savedContact = response.data;

            // Compare sent vs saved to verify all fields were saved
            const verification: Record<
                string,
                { sent: any; saved: any; match: boolean }
            > = {};
            Object.keys(formattedContact).forEach((key) => {
                if (
                    key !== "id" &&
                    key !== "company_id" &&
                    key !== "customer_id"
                ) {
                    const sentValue = (formattedContact as any)[key];
                    const savedValue = (savedContact as any)?.[key];
                    verification[key] = {
                        sent: sentValue,
                        saved: savedValue,
                        match:
                            sentValue === savedValue ||
                            (sentValue === null &&
                                (savedValue === null || savedValue === "")),
                    };
                }
            });

            // Log any mismatches
            const mismatches = Object.entries(verification).filter(
                ([_, v]) => !v.match
            );
            if (mismatches.length > 0) {
                await createLogRecord(
                    "WARNING",
                    `Contact save: Field mismatches detected for contact ${savedContact?.id}`,
                    "UpsertContactModal",
                    { mismatches, savedContact, formattedContact }
                );
            }

            // Invalidate control center stats since contact changes affect the stats
            await import("@/utils/cacheUtils").then(
                ({ invalidateControlCenterStats }) => {
                    invalidateControlCenterStats();
                }
            );

            // Invalidate and refetch view execution queries to refresh the contact list.
            // refetchQueries ensures an immediate refetch (invalidate alone can be delayed).
            await queryClient.invalidateQueries({
                queryKey: ["view-execution"],
            });
            await queryClient.refetchQueries({
                queryKey: ["view-execution"],
            });
            // customer_contacts-virtual: useViewExecution uses this when no view is selected yet
            await queryClient.invalidateQueries({
                queryKey: ["customer_contacts-virtual"],
            });
            await queryClient.refetchQueries({
                queryKey: ["customer_contacts-virtual"],
            });

            // Also invalidate all contact-related queries to ensure data is refreshed
            await queryClient.invalidateQueries({
                queryKey: ["contacts"],
            });
            await queryClient.invalidateQueries({
                queryKey: ["contacts-virtual"],
            });

            // Invalidate LogActivity contacts query to update the dropdown
            await queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey;
                    return (
                        Array.isArray(key) &&
                        key.length === 2 &&
                        key[0] === "contacts" &&
                        typeof key[1] === "object" &&
                        key[1] !== null &&
                        "customerId" in key[1] &&
                        "companyId" in key[1] &&
                        (key[1] as any).customerId === _customerId &&
                        (key[1] as any).companyId === companyId
                    );
                },
            });

            // Invalidate the specific contact query to ensure fresh data on next open
            if (savedContact?.id) {
                await queryClient.invalidateQueries({
                    queryKey: ["contact", savedContact.id],
                });
            }

            if (onCreateContact) {
                await onCreateContact(savedContact);
            }

            // Small delay to ensure the contact is created before closing
            await new Promise((resolve) => setTimeout(resolve, 50));

            closeModal();

            // Invalidate stuck-activities after close so CustomerHeader banner updates; fire-and-forget to avoid affecting contact list refresh
            void queryClient.invalidateQueries({
                queryKey: ["stuck_activities", _customerId],
            });

            // Additional delay to let the modal fully close before showing success
            setTimeout(() => {
                success(t("messages.save_success", { ns: "contacts" }));
            }, 100);
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "An unknown error occurred";

            // Log error to server
            await createLogRecord(
                "ERROR",
                `Failed to save contact: ${errorMessage}`,
                "UpsertContactModal",
                {
                    error: errorMessage,
                    contactId: initialContact?.id,
                    customerId: _customerId,
                    companyId,
                    contact: contact,
                }
            );

            error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AppDialog
            key={initialContact?.id || "new-contact"}
            open={isOpen}
            onClose={closeModal}
            drag
            align
            slide
            resize
            isRTL={isRTL}
            resizeOptions={{
                initialWidth: 440,
                heightFraction: 0.8,
                minWidth: 360,
                maxWidth: 900,
                minHeight: 300,
                maxHeight: 0.95,
            }}
            title={
                initialContact
                    ? t("actions.edit_contact", { ns: "contacts" })
                    : t("actions.add_contact", { ns: "contacts" })
            }
            titleIcon={
                initialContact ? (
                    <PersonIcon aria-hidden="true" />
                ) : (
                    <PersonAddIcon aria-hidden="true" />
                )
            }
            ariaLabelledBy="contact-dialog-title"
            ariaDescribedBy="dialog-description"

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
                    },
                    "& > .MuiDialogActions-root": {
                        flexShrink: 0,
                        backgroundColor: theme.palette.background.paper,
                        borderTop: "none",
                        paddingTop: theme.spacing(2),
                    },
                },
            }}
            actions={
                hasManageContactsPermission ? (
                    <>
                        <Button
                            onClick={closeModal}
                            variant="outlined"
                            size="small"
                            className="cancel-button"
                            fullWidth={false}
                            sx={{
                                mr: isRTL ? 0 : theme.spacing(1),
                                ml: isRTL ? theme.spacing(1) : 0,
                            }}
                        >
                            {t("actions.cancel", { ns: "common" })}
                        </Button>
                        <Button
                            type="submit"
                            form="contact-form"
                            variant="contained"
                            size="small"
                            fullWidth={false}
                            className="save-button"
                            disabled={isLoading}
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                "& .MuiButton-endIcon": {
                                    marginLeft: isRTL ? 0 : theme.spacing(1),
                                    marginRight: isRTL ? theme.spacing(1) : 0,
                                },
                            }}
                        >
                            {t("actions.save", { ns: "common" })}
                        </Button>
                    </>
                ) : (
                    <Button
                        onClick={closeModal}
                        variant="contained"
                        size="small"
                        className="save-button"
                        fullWidth={false}
                    >
                        {t("actions.ok", { ns: "common" })}
                    </Button>
                )
            }
        >
            <form
                id="contact-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    submitHandler();
                }}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "hidden",
                }}
            >
                <ModalScrollBox id="contact-modal-scroll" isRTL={isRTL}>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: { xs: 0.75, sm: 1 },
                            width: "100%",
                            mx: "auto",
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {/* Warning Messages */}
                        {showWarnings && (
                            <>
                                {initialContact?.email_status === "Bounced" && (
                                    <Box sx={{ mb: 1 }}>
                                        <Typography
                                            variant="body2"
                                            color="warning.main"
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <InfoIcon
                                                color="warning"
                                                fontSize="small"
                                            />
                                            {t(
                                                "messages.warning_email_bounced",
                                                { ns: "contacts" }
                                            )}
                                        </Typography>
                                    </Box>
                                )}
                                {initialContact?.email_status === "Failure" && (
                                    <Box sx={{ mb: 1 }}>
                                        <Typography
                                            variant="body2"
                                            color="warning.main"
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <InfoIcon
                                                color="warning"
                                                fontSize="small"
                                            />
                                            {t(
                                                "messages.warning_email_failure",
                                                { ns: "contacts" }
                                            )}
                                        </Typography>
                                    </Box>
                                )}
                                {initialContact?.mobile_status ===
                                    "Failure" && (
                                        <Box sx={{ mb: 1 }}>
                                            <Typography
                                                variant="body2"
                                                color="warning.main"
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                }}
                                            >
                                                <InfoIcon
                                                    color="warning"
                                                    fontSize="small"
                                                />
                                                {t(
                                                    "messages.warning_mobile_failure",
                                                    { ns: "contacts" }
                                                )}
                                            </Typography>
                                        </Box>
                                    )}
                            </>
                        )}

                        {/* Status Section */}
                        <Box>
                            <Box sx={sectionHeaderSx}>
                                <Typography variant="subtitle2">
                                    {t("values.status", { ns: "contacts" })}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    bgcolor: "background.default",
                                    borderRadius: 1,
                                    p: 1,
                                    direction: isRTL ? "rtl" : "ltr",
                                }}
                            >
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={contact.status === "Active"}
                                            onChange={(e) =>
                                                setContact({
                                                    ...contact,
                                                    status: e.target.checked
                                                        ? "Active"
                                                        : "Inactive",
                                                })
                                            }
                                            color="primary"
                                            {...(isRTL && { "data-rtl": true })}
                                        />
                                    }
                                    label={
                                        <Typography
                                            variant="body2"
                                            sx={{ color: "text.secondary" }}
                                        >
                                            {contact.status === "Active"
                                                ? t("values.status_active", {
                                                    ns: "common",
                                                })
                                                : t("values.status_inactive", {
                                                    ns: "common",
                                                })}
                                        </Typography>
                                    }
                                    labelPlacement={isRTL ? "start" : "end"}
                                    sx={{
                                        margin: 0,
                                        ml: isRTL ? "auto" : 0,
                                        mr: isRTL ? 0 : "auto",
                                        direction: isRTL ? "rtl" : "ltr",
                                        "& .MuiFormControlLabel-label": {
                                            direction: isRTL ? "rtl" : "ltr",
                                        },
                                    }}
                                />
                            </Box>
                        </Box>

                        {/* Personal Information Section */}
                        <Box>
                            <Box sx={sectionHeaderSx}>
                                <Typography variant="subtitle2">
                                    {t("messages.personal_information", {
                                        ns: "contacts",
                                    })}
                                </Typography>
                            </Box>
                            <Box sx={gridContainerSx}>
                                <Box
                                    sx={{
                                        gridColumn: {
                                            xs: "1 / -1",
                                            sm: "1 / -1",
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                            mb: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: 500,
                                                color: "text.primary",
                                            }}
                                        >
                                            {t("fields.company_wide_address", {
                                                ns: "contacts",
                                            })}
                                        </Typography>
                                        <Tooltip
                                            title={t(
                                                "fields.company_wide_address",
                                                { ns: "contacts" }
                                            )}
                                            placement="bottom"
                                            arrow
                                            PopperProps={tooltipPopperProps}
                                        >
                                            <HelpIcon sx={helpIconSx} />
                                        </Tooltip>
                                    </Box>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={
                                                        contact.company_wide_address
                                                    }
                                                    onChange={(e) =>
                                                        handleCompanyWideAddressChange(
                                                            e.target.checked
                                                        )
                                                    }
                                                    color="primary"
                                                    {...(isRTL && {
                                                        "data-rtl": true,
                                                    })}
                                                />
                                            }
                                            label={
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        color: "text.secondary",
                                                    }}
                                                >
                                                    {contact.company_wide_address
                                                        ? t("fields.yes", {
                                                            ns: "common",
                                                        })
                                                        : t("fields.no", {
                                                            ns: "common",
                                                        })}
                                                </Typography>
                                            }
                                            sx={{
                                                alignItems: "center",
                                                "& .MuiFormControlLabel-label":
                                                {
                                                    fontSize: "0.875rem",
                                                    fontWeight: 500,
                                                    lineHeight: 1.4,
                                                    ml: 1,
                                                },
                                            }}
                                        />
                                    </Box>
                                </Box>

                                <TextField
                                    label={`${contact.company_wide_address ? t("fields.company_name", { ns: "contacts" }) : t("fields.first_name", { ns: "contacts" })} *`}
                                    value={contact.first_name}
                                    onChange={(e) =>
                                        setContact({
                                            ...contact,
                                            first_name: e.target.value,
                                        })
                                    }
                                    onBlur={() => handleBlur("first_name")}
                                    error={!!errors.first_name}
                                    helperText={errors.first_name || undefined}
                                    fullWidth
                                    size="small"
                                    {...(isRTL && { "data-hebrew": true })}
                                    sx={textFieldSx}
                                />

                                {!contact.company_wide_address && (
                                    <>
                                        <TextField
                                            label={`${t("fields.last_name", { ns: "contacts" })} *`}
                                            value={contact.last_name}
                                            onChange={(e) =>
                                                setContact({
                                                    ...contact,
                                                    last_name: e.target.value,
                                                })
                                            }
                                            onBlur={() =>
                                                handleBlur("last_name")
                                            }
                                            error={!!errors.last_name}
                                            helperText={
                                                errors.last_name || undefined
                                            }
                                            fullWidth
                                            size="small"
                                            {...(isRTL && {
                                                "data-hebrew": true,
                                            })}
                                            sx={textFieldSx}
                                        />

                                        <TextField
                                            label={t("fields.role", {
                                                ns: "contacts",
                                            })}
                                            value={contact.role}
                                            onChange={(e) =>
                                                setContact({
                                                    ...contact,
                                                    role: e.target.value,
                                                })
                                            }
                                            onBlur={() => handleBlur("role")}
                                            error={!!errors.role}
                                            helperText={
                                                errors.role || undefined
                                            }
                                            fullWidth
                                            size="small"
                                            {...(isRTL && {
                                                "data-hebrew": true,
                                            })}
                                            sx={textFieldSx}
                                        />
                                    </>
                                )}
                            </Box>
                        </Box>

                        {/* Contact Information Section */}
                        <Box>
                            <Box sx={sectionHeaderSx}>
                                <Typography variant="subtitle2">
                                    {t("messages.contact_information", {
                                        ns: "contacts",
                                    })}
                                </Typography>
                            </Box>
                            {errors.contact_method && (
                                <Box sx={{ mb: 1 }}>
                                    <Typography
                                        variant="body2"
                                        color="error.main"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <InfoIcon
                                            color="error"
                                            fontSize="small"
                                        />
                                        {errors.contact_method}
                                    </Typography>
                                </Box>
                            )}
                            <Box sx={gridContainerSx}>
                                <TextField
                                    fullWidth
                                    label={t("fields.email", {
                                        ns: "contacts",
                                    })}
                                    value={contact.email}
                                    onChange={(e) =>
                                        handleEmailChange(e.target.value)
                                    }
                                    onBlur={() => handleBlur("email")}
                                    error={!!errors.email}
                                    helperText={errors.email || undefined}
                                    type="email"
                                    size="small"
                                    {...(isRTL && { "data-hebrew": true })}
                                    sx={textFieldSx}
                                    inputProps={{
                                        title: t(
                                            "validation.invalid_email_format",
                                            { ns: "contacts" }
                                        ),
                                    }}
                                />

                                <TextField
                                    label={t("fields.phone", {
                                        ns: "contacts",
                                    })}
                                    value={contact.phone}
                                    onChange={(e) =>
                                        handlePhoneChange(
                                            "phone",
                                            e.target.value
                                        )
                                    }
                                    onBlur={() => handleBlur("phone")}
                                    error={!!errors.phone}
                                    helperText={
                                        errors.phone
                                            ? t("fields.phone_format_hint", {
                                                ns: "contacts",
                                            })
                                            : undefined
                                    }
                                    fullWidth
                                    size="small"
                                    {...(isRTL && { "data-hebrew": true })}
                                    sx={textFieldSx}
                                />

                                {!contact.company_wide_address && (
                                    <TextField
                                        label={t("fields.mobile", {
                                            ns: "contacts",
                                        })}
                                        value={contact.mobile}
                                        onChange={(e) =>
                                            handlePhoneChange(
                                                "mobile",
                                                e.target.value
                                            )
                                        }
                                        onBlur={() => handleBlur("mobile")}
                                        error={!!errors.mobile}
                                        helperText={
                                            errors.mobile
                                                ? t("fields.mobile_format_hint", {
                                                    ns: "contacts",
                                                })
                                                : undefined
                                        }
                                        fullWidth
                                        size="small"
                                        {...(isRTL && { "data-hebrew": true })}
                                        InputProps={{
                                            ...(contact.mobile &&
                                                !contact.mobile
                                                    .trim()
                                                    .startsWith("+") && {
                                                ...(isRTL
                                                    ? {
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <Tooltip
                                                                    title={t(
                                                                        "fields.country_code_notice",
                                                                        {
                                                                            ns: "contacts",
                                                                        }
                                                                    )}
                                                                    placement="bottom"
                                                                    arrow
                                                                    PopperProps={
                                                                        tooltipPopperProps
                                                                    }
                                                                >
                                                                    <IconButton
                                                                        edge="start"
                                                                        size="small"
                                                                        sx={{
                                                                            color: "primary.main",
                                                                            opacity: 0.7,
                                                                            "&:hover":
                                                                            {
                                                                                opacity: 1,
                                                                                backgroundColor:
                                                                                    "transparent",
                                                                            },
                                                                        }}
                                                                    >
                                                                        <HelpIcon
                                                                            sx={{
                                                                                fontSize:
                                                                                {
                                                                                    xs: "0.875rem",
                                                                                    sm: "1rem",
                                                                                },
                                                                            }}
                                                                        />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </InputAdornment>
                                                        ),
                                                    }
                                                    : {
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                <Tooltip
                                                                    title={t(
                                                                        "fields.country_code_notice",
                                                                        {
                                                                            ns: "contacts",
                                                                        }
                                                                    )}
                                                                    placement="bottom"
                                                                    arrow
                                                                    PopperProps={
                                                                        tooltipPopperProps
                                                                    }
                                                                >
                                                                    <IconButton
                                                                        edge="end"
                                                                        size="small"
                                                                        sx={{
                                                                            color: "primary.main",
                                                                            opacity: 0.7,
                                                                            "&:hover":
                                                                            {
                                                                                opacity: 1,
                                                                                backgroundColor:
                                                                                    "transparent",
                                                                            },
                                                                        }}
                                                                    >
                                                                        <HelpIcon
                                                                            sx={{
                                                                                fontSize:
                                                                                {
                                                                                    xs: "0.875rem",
                                                                                    sm: "1rem",
                                                                                },
                                                                            }}
                                                                        />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </InputAdornment>
                                                        ),
                                                    }),
                                            }),
                                        }}
                                        sx={textFieldSx}
                                    />
                                )}

                                {/* Country Display */}
                                {initialContact?.Country && (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 0.5,
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ fontWeight: 500 }}
                                        >
                                            {t("fields.country", {
                                                ns: "common",
                                            })}
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: "1.2rem",
                                                    lineHeight: 1,
                                                    fontFamily:
                                                        'system-ui, -apple-system, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
                                                }}
                                                role="img"
                                                aria-label={`Flag of ${initialContact.Country.name}`}
                                            >
                                                {initialContact.Country.emoji ||
                                                    "🏳️"}
                                            </span>
                                            <Typography
                                                variant="body2"
                                                color="text.primary"
                                                sx={{
                                                    fontWeight: 500,
                                                    fontSize: "0.875rem",
                                                }}
                                            >
                                                {initialContact.Country.name}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        {/* Notification Settings Section */}
                        <Box>
                            <Box sx={sectionHeaderSx}>
                                <Typography variant="subtitle2">
                                    {t("sections.notification_settings", {
                                        ns: "contacts",
                                    })}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    ...gridContainerSx,
                                    border: errors.notification_settings
                                        ? "1px solid"
                                        : "none",
                                    borderColor: errors.notification_settings
                                        ? "error.main"
                                        : "transparent",
                                }}
                            >
                                {errors.notification_settings && (
                                    <Box
                                        sx={{
                                            gridColumn: "1 / -1",
                                            color: "error.main",
                                            fontSize: "0.75rem",
                                            mt: -1,
                                            mb: 1,
                                        }}
                                    >
                                        {errors.notification_settings}
                                    </Box>
                                )}
                                <Box>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                            mb: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: 500,
                                                color: "text.primary",
                                            }}
                                        >
                                            {t(
                                                "fields.receiving_standard_reminders",
                                                { ns: "contacts" }
                                            )}
                                        </Typography>
                                        <Tooltip
                                            title={t(
                                                "fields.standard_reminder_description",
                                                { ns: "contacts" }
                                            )}
                                            placement="bottom"
                                            arrow
                                            PopperProps={tooltipPopperProps}
                                        >
                                            <HelpIcon sx={helpIconSx} />
                                        </Tooltip>
                                    </Box>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={
                                                        contact.receives_standard_reminder
                                                    }
                                                    onChange={(e) => {
                                                        setContact({
                                                            ...contact,
                                                            receives_standard_reminder:
                                                                e.target
                                                                    .checked,
                                                        });
                                                        if (
                                                            e.target.checked ||
                                                            contact.receives_escalated_reminder
                                                        ) {
                                                            clearNotificationError();
                                                        }
                                                    }}
                                                    color="primary"
                                                    {...(isRTL && {
                                                        "data-rtl": true,
                                                    })}
                                                />
                                            }
                                            label={
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        color: "text.secondary",
                                                    }}
                                                >
                                                    {contact.receives_standard_reminder
                                                        ? t("fields.yes", {
                                                            ns: "common",
                                                        })
                                                        : t("fields.no", {
                                                            ns: "common",
                                                        })}
                                                </Typography>
                                            }
                                            sx={switchLabelSx}
                                        />
                                    </Box>
                                </Box>

                                <Box>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                            mb: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: 500,
                                                color: "text.primary",
                                            }}
                                        >
                                            {t(
                                                "fields.receiving_escalated_reminders",
                                                { ns: "contacts" }
                                            )}
                                        </Typography>
                                        <Tooltip
                                            title={t(
                                                "fields.escalated_reminder_description",
                                                { ns: "contacts" }
                                            )}
                                            placement="bottom"
                                            arrow
                                            PopperProps={tooltipPopperProps}
                                        >
                                            <HelpIcon sx={helpIconSx} />
                                        </Tooltip>
                                    </Box>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={
                                                        contact.receives_escalated_reminder
                                                    }
                                                    onChange={(e) => {
                                                        setContact({
                                                            ...contact,
                                                            receives_escalated_reminder:
                                                                e.target
                                                                    .checked,
                                                        });
                                                        if (
                                                            e.target.checked ||
                                                            contact.receives_standard_reminder
                                                        ) {
                                                            clearNotificationError();
                                                        }
                                                    }}
                                                    color="primary"
                                                    {...(isRTL && {
                                                        "data-rtl": true,
                                                    })}
                                                />
                                            }
                                            label={
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        color: "text.secondary",
                                                    }}
                                                >
                                                    {contact.receives_escalated_reminder
                                                        ? t("fields.yes", {
                                                            ns: "common",
                                                        })
                                                        : t("fields.no", {
                                                            ns: "common",
                                                        })}
                                                </Typography>
                                            }
                                            sx={switchLabelSx}
                                        />
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </ModalScrollBox>
            </form>
        </AppDialog>
    );
};

export default UpsertContactModal;
