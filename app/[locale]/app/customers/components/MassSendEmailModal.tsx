"use client";

import {
    CheckCircle,
    Clear as ClearIcon,
    Email as EmailIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    Search as SearchIcon,
} from "@mui/icons-material";
import {
    alpha,
    Box,
    Button,
    FormControlLabel,
    FormHelperText,
    IconButton,
    InputAdornment,
    LinearProgress,
    Skeleton,
    Switch,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import api from "@/app/api";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { fetchActivityTemplates } from "@/shared/services/activityTemplateService";
import { ActivityTemplate } from "@/types/ActivitiesTemplate";
import { Contact } from "@/types/contact";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import { useContactSelection } from "./hooks/useContactSelection";
import { useRTL } from "./hooks/useRTL";
import {
    EMAIL_CONFIG,
    TEMPLATE_QUERY_CONFIG,
} from "./MassSendEmailModal.constants";
import {
    ContactWithCustomer,
    FormErrors,
    MassSendEmailModalProps,
    SendResult
} from "./MassSendEmailModal.types";
import {
    filterValidContacts,
    getActiveRows,
    getCustomerName,
} from "./MassSendEmailModal.utils";
import EmailCompositionStep from "./steps/EmailCompositionStep";

const MassSendEmailModal: React.FC<MassSendEmailModalProps> = ({
    isOpen,
    closeModal,
    customer, // Single customer
    selectedRows, // Multiple customers
    onUpdateComplete,
    refreshTimeline,
}) => {
    const { t, i18n } = useTranslation([
        "customers",
        "activities",
        "common",
        "contacts",
    ]);
    const { showToast } = useToast();
    const theme = useTheme();
    const { isRTL, direction, textAlign, flexDirection, transitionDirection } =
        useRTL();

    // Determine mode: single customer or multiple customers
    const isSingleMode = !!customer;
    const isMultiMode = !!selectedRows && selectedRows.length > 0;

    // Convert single customer to CustomerRow format for unified handling
    const activeRows = useMemo(() => {
        if (isSingleMode && customer) {
            // Extract customer name from Person or Company
            let customerName = '';
            if (customer.type === "Person" && customer.Person) {
                const firstName = customer.Person.first_name || '';
                const lastName = customer.Person.last_name || '';
                customerName = `${firstName} ${lastName}`.trim() || `Customer ${customer.id}`;
            } else if (customer.type === "Company" && customer.Company) {
                customerName = customer.Company.name || `Customer ${customer.id}`;
            } else {
                customerName = `Customer ${customer.id}`;
            }

            return [{
                id: parseInt(customer.id.toString(), 10),
                name: customerName,
                type: customer.type as "Person" | "Company",
                collection_status: customer.collection_status as "Active" | "Inactive",
                company_id: customer.company_id ?? undefined,
                language: customer.language || 'en',
                raw: customer,
            }];
        }
        if (isMultiMode && selectedRows) {
            return getActiveRows(selectedRows);
        }
        return [];
    }, [customer, selectedRows, isSingleMode, isMultiMode]);

    const inactiveCount = isMultiMode
        ? (selectedRows?.length || 0) - activeRows.length
        : 0;

    // For single mode, use customer language; for multi mode, use default
    const customerLanguage = useMemo(() => {
        if (isSingleMode && customer) {
            return customer.language || 'en';
        }
        return i18n.language; // Default to current UI language for multi mode
    }, [customer, isSingleMode, i18n.language]);

    // State management
    const [selectedTemplate, setSelectedTemplate] =
        useState<ActivityTemplate | null>(null);
    const [subject, setSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendProgress, setSendProgress] = useState<{
        current: number;
        total: number;
        currentCustomerName?: string;
    } | null>(null);
    const [sendResults, setSendResults] = useState<SendResult[]>([]);
    const [errors, setErrors] = useState<FormErrors>({});
    const [currentStep, setCurrentStep] = useState<1 | 2>(1);
    const [contactSearchTerm, setContactSearchTerm] = useState("");


    // Contact selection hook
    const {
        selectedContactsByCustomer,
        selectRegularContacts,
        selectEscalatedContacts,
        selectionSummary,
        handleContactToggle,
        handleContactTypeToggle,
        resetSelection,
    } = useContactSelection();

    // Fetch email templates
    const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
        queryKey: ["activity-templates", TEMPLATE_QUERY_CONFIG],
        queryFn: fetchActivityTemplates,
        enabled: isOpen,
    });

    const emailTemplates = useMemo(() => {
        if (!templatesData?.templates) return [];
        return templatesData.templates.filter(
            (template: ActivityTemplate) =>
                template.category === "Automated" &&
                template.active === true &&
                // email_content was removed from ActivitiesTemplate — content now lives in ActivityTemplateLanguage
                template.ActivityTemplateLanguage?.some(
                    (lang: any) => lang.email_content
                )
        );
    }, [templatesData]);

    // Fetch contacts - different logic for single vs multi mode
    const [debouncedContactSearchTerm] = useDebounce(
        contactSearchTerm,
        EMAIL_CONFIG.DEBOUNCE_DELAY
    );

    const { data: contactsData, isLoading: isLoadingContacts } = useQuery({
        queryKey: [
            isSingleMode ? "contacts-for-email" : "all-contacts-for-mass-email",
            isSingleMode
                ? activeRows[0]?.id
                : activeRows.map((r) => r.id),
            currentStep,
        ],
        queryFn: async () => {
            if (isSingleMode && customer) {
                // Single customer mode: fetch contacts for one customer
                const customerIdNumber = parseInt(customer.id.toString(), 10);
                const companyId = customer.company_id || 0;

                const params: any = {
                    page: 1,
                    limit: 1000,
                    sortField: "first_name",
                    sortDirection: "asc",
                    status: "1",
                };

                if (customer.type === "Person") {
                    params.customerId = customerIdNumber;
                } else if (companyId) {
                    params.companyId = companyId;
                }

                const response = await api.get("/entities/contacts", { params });

                if (response.data?.contacts) {
                    const filtered = filterValidContacts(response.data.contacts);
                    // Convert to ContactWithCustomer format for grid UI
                    const customerId = customerIdNumber;
                    // Get customer name from Person or Company
                    let customerName = '';
                    if (customer.type === "Person" && customer.Person) {
                        const firstName = customer.Person.first_name || '';
                        const lastName = customer.Person.last_name || '';
                        customerName = `${firstName} ${lastName}`.trim() || `Customer ${customer.id}`;
                    } else if (customer.type === "Company" && customer.Company) {
                        customerName = customer.Company.name || `Customer ${customer.id}`;
                    } else {
                        customerName = `Customer ${customer.id}`;
                    }
                    return filtered.map((contact: Contact) => ({
                        ...contact,
                        customerId,
                        customerName,
                    }));
                }

                return [];
            } else {
                // Multi customer mode: existing logic
                const allContacts: ContactWithCustomer[] = [];

                for (const customerRow of activeRows) {
                    const customerIdNumber = parseInt(
                        customerRow.id.toString(),
                        10
                    );
                    const params: any = {
                        page: 1,
                        limit: 1000,
                        sortField: "first_name",
                        sortDirection: "asc",
                        status: "1",
                        customerId: customerIdNumber,
                    };

                    try {
                        const response = await api.get("/entities/contacts", {
                            params,
                        });
                        if (response.data?.contacts) {
                            const filtered = filterValidContacts(
                                response.data.contacts.filter(
                                    (contact: Contact) =>
                                        contact.customer_id === customerIdNumber
                                )
                            ).map((contact: Contact) => ({
                                ...contact,
                                customerId: customerRow.id,
                                customerName: getCustomerName(customerRow),
                            }));
                            allContacts.push(...filtered);
                        }
                    } catch (error) {
                        // Silently handle errors - contacts will be empty for this customer
                    }
                }

                return allContacts;
            }
        },
        enabled: isOpen && currentStep === 2 && activeRows.length > 0,
        staleTime: EMAIL_CONFIG.CONTACTS_CACHE_TIME,
    });

    // Filter contacts based on search term (works for both single and multi mode)
    const filteredAllContacts = useMemo(() => {
        if (!contactsData || !Array.isArray(contactsData)) return [];
        if (!debouncedContactSearchTerm.trim()) return contactsData;

        const searchLower = debouncedContactSearchTerm.toLowerCase();
        return contactsData.filter(
            (contact: ContactWithCustomer) =>
                `${contact.first_name} ${contact.last_name || ""}`
                    .trim()
                    .toLowerCase()
                    .includes(searchLower) ||
                (contact.email &&
                    contact.email.toLowerCase().includes(searchLower)) ||
                (contact.customerName &&
                    contact.customerName.toLowerCase().includes(searchLower))
        );
    }, [contactsData, debouncedContactSearchTerm]);


    // Memoize search field styles (matching EndlessScrollToolbar pattern)
    const searchFieldStyles = useMemo(
        () => ({
            minHeight: 0,
            height: "auto",
            margin: 0,
            "& .MuiTextField-root": {
                minHeight: 0,
                height: "auto",
                margin: 0,
            },
            "& .MuiFormControl-root": {
                minHeight: 0,
                height: "auto",
                margin: 0,
            },
            "& .MuiOutlinedInput-root": {
                direction,
                backgroundColor: theme.palette.background.paper,
                borderRadius: theme.shape.borderRadius,
                padding: "0 !important",
                position: "relative",
                "& fieldset": {
                    borderColor: theme.palette.divider,
                    borderWidth: "1px",
                },
                "&:hover fieldset": {
                    borderColor: theme.palette.divider,
                },
                "&.Mui-focused fieldset": {
                    borderColor: theme.palette.primary.main,
                    borderWidth: "1px",
                },
                "&.MuiInputBase-adornedStart": {
                    paddingLeft: direction === "ltr" ? "0 !important" : "0 !important",
                },
                "&.MuiInputBase-adornedEnd": {
                    paddingRight: direction === "rtl" ? `${theme.spacing(4)} !important` : `${theme.spacing(4)} !important`,
                    paddingLeft: direction === "rtl" ? "0 !important" : "0 !important",
                },
            },
            "& input": {
                direction,
                textAlign: direction === "rtl" ? "right" : "left",
                "&::placeholder": {
                    textAlign: direction === "rtl" ? "right" : "left",
                    direction,
                    opacity: 1,
                },
            },
            "& .MuiInputBase-input": {
                direction,
                textAlign: direction === "rtl" ? "right" : "left",
                "&::placeholder": {
                    textAlign: direction === "rtl" ? "right" : "left",
                    direction,
                    opacity: 1,
                },
            },
            "& .MuiOutlinedInput-input": {
                direction,
                textAlign: direction === "rtl" ? "right" : "left",
                padding: "0 !important",
                fontSize: { xs: "0.7rem", sm: "0.75rem", md: "0.8rem" },
                height: "auto",
                minHeight: 0,
                "&::placeholder": {
                    textAlign: direction === "rtl" ? "right" : "left",
                    direction,
                    opacity: 1,
                },
            },
            "& .MuiOutlinedInput-inputAdornedStart": {
                paddingLeft: direction === "ltr" ? theme.spacing(0.5) : "0 !important",
            },
            "& .MuiOutlinedInput-inputAdornedEnd": {
                paddingRight: direction === "rtl" ? theme.spacing(0.5) : theme.spacing(0.5),
            },
            "& .MuiInputBase-inputAdornedStart": {
                paddingLeft: direction === "ltr" ? "0 !important" : "0 !important",
                paddingRight: direction === "rtl" ? "0 !important" : "0 !important",
            },
            "& .MuiInputBase-inputAdornedEnd": {
                paddingRight: direction === "ltr" ? "0 !important" : "0 !important",
                paddingLeft: direction === "rtl" ? "0 !important" : "0 !important",
            },
            "& .MuiInputAdornment-root": {
                marginTop: "0 !important",
                marginBottom: "0 !important",
                minWidth: "auto",
                width: "auto",
                "& > span.notranslate": {
                    display: "none",
                    width: 0,
                    minWidth: 0,
                },
            },
            "& .MuiInputAdornment-positionStart": {
                marginLeft: direction === "ltr" ? theme.spacing(0.5) : 0,
                marginRight: direction === "rtl" ? theme.spacing(0.5) : 0,
                minWidth: "auto",
                width: "auto",
            },
            "& .MuiInputAdornment-positionEnd": {
                marginRight: direction === "ltr" ? theme.spacing(0.5) : 0,
                marginLeft: direction === "rtl" ? theme.spacing(0.5) : 0,
                minWidth: "auto",
                width: "auto",
            },
            "& .MuiSvgIcon-root": {
                fontSize: { xs: "0.9rem", sm: "1rem", md: "1.1rem" },
            },
        }),
        [direction, theme]
    );

    // Get contacts data for both modes (array format)
    const allContactsData = useMemo(() => {
        // For both modes, contactsData is an array of ContactWithCustomer
        if (Array.isArray(contactsData)) {
            return contactsData as ContactWithCustomer[];
        }
        return undefined;
    }, [contactsData]);

    // Handle contact type toggle (works for both modes)
    const handleRegularContactsToggle = useCallback(
        (checked: boolean) => {
            if (allContactsData) {
                handleContactTypeToggle("regular", checked, allContactsData);
            }
        },
        [handleContactTypeToggle, allContactsData]
    );

    const handleEscalatedContactsToggle = useCallback(
        (checked: boolean) => {
            if (allContactsData) {
                handleContactTypeToggle("escalated", checked, allContactsData);
            }
        },
        [handleContactTypeToggle, allContactsData]
    );


    // Handle contact toggle with error clearing (for multi mode)
    const handleContactToggleWithError = useCallback(
        (customerId: number, contactId: number) => {
            handleContactToggle(customerId, contactId);
            if (errors.contacts) {
                setErrors((prev) => ({ ...prev, contacts: undefined }));
            }
        },
        [handleContactToggle, errors.contacts]
    );

    // When template is selected, populate subject and body with language support
    useEffect(() => {
        if (selectedTemplate) {
            // For single mode, use customer language; for multi mode, use default
            const targetLanguage = isSingleMode ? customerLanguage : i18n.language;

            // Try to get language-specific content first
            const languageTemplate =
                selectedTemplate.ActivityTemplateLanguage?.find(
                    (lang: any) => lang.language === targetLanguage
                );

            if (languageTemplate) {
                setSubject(languageTemplate.email_subject || "");
                setEmailBody(languageTemplate.email_content || "");
            } else {
                // No matching language template found — email_subject/email_content were removed
                // from ActivitiesTemplate; content now lives exclusively in ActivityTemplateLanguage.
                // Try the first available language template as fallback.
                const firstLang = selectedTemplate.ActivityTemplateLanguage?.[0];
                setSubject(firstLang?.email_subject || "");
                setEmailBody(firstLang?.email_content || "");
            }
        }
    }, [selectedTemplate, customerLanguage, isSingleMode, i18n.language]);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedTemplate(null);
            setSubject("");
            setEmailBody("");
            setIsSending(false);
            setSendProgress(null);
            setSendResults([]);
            setErrors({});
            setCurrentStep(1);
            setContactSearchTerm("");

            // Reset selection
            resetSelection();
        }
    }, [isOpen, resetSelection]);

    // Validation
    const validateForm = useCallback((): boolean => {
        const newErrors: FormErrors = {};

        if (!subject || subject.trim() === "") {
            newErrors.subject = t("validation.subject_required", {
                ns: "common",
            });
        }

        if (!emailBody || emailBody.trim() === "") {
            newErrors.emailBody = t("validation.email_body_required", {
                ns: "common",
            });
        }

        // Validation for contacts (works for both modes using grid UI)
        if (selectionSummary.totalContacts === 0) {
            newErrors.contacts = t("validation.select_at_least_one_contact", {
                ns: "common",
            });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [subject, emailBody, selectionSummary.totalContacts, t]);

    // Validate step 1 (email composition)
    const validateStep1 = useCallback((): boolean => {
        const newErrors: FormErrors = {};

        if (!subject || subject.trim() === "") {
            newErrors.subject = t("validation.subject_required", {
                ns: "common",
            });
        }

        if (!emailBody || emailBody.trim() === "") {
            newErrors.emailBody = t("validation.email_body_required", {
                ns: "common",
            });
        }

        setErrors((prevErrors) => ({
            ...prevErrors,
            ...newErrors,
        }));
        return Object.keys(newErrors).length === 0;
    }, [subject, emailBody, t]);

    // Handle next step
    const handleNext = useCallback(() => {
        if (validateStep1()) {
            setCurrentStep(2);
        }
    }, [validateStep1]);

    // Handle back step
    const handleBack = useCallback(() => {
        setCurrentStep(1);
    }, []);

    // Handle send
    const handleSend = useCallback(async () => {
        if (!validateForm()) {
            return;
        }

        setIsSending(true);

        if (isSingleMode && customer) {
            // Single customer mode: use grid UI selection
            const customerIdNumber = parseInt(customer.id.toString(), 10);
            const contactIds = selectedContactsByCustomer[customerIdNumber] || [];

            try {
                await api.post(
                    `/entities/customers/${customerIdNumber}/activity/send-email`,
                    {
                        contactIds,
                        templateId: selectedTemplate?.id || null,
                        subject: subject.trim(),
                        emailBody: emailBody.trim(),
                    }
                );

                showToast(
                    t("messages.email_sent_successfully", { ns: "activities" }),
                    "success"
                );

                if (refreshTimeline) {
                    refreshTimeline();
                }

                setIsSending(false);
                closeModal();
            } catch (error: any) {
                const errorMessage =
                    error?.response?.data?.error ||
                    error?.message ||
                    t("messages.failed_to_send_email", { ns: "activities" });
                showToast(errorMessage, "error");
                setIsSending(false);
            }
        } else {
            // Multi customer mode: existing logic
            setSendProgress({
                current: 0,
                total: Object.keys(selectedContactsByCustomer).length,
            });
            setSendResults([]);

            const results: SendResult[] = [];
            const customersToProcess = activeRows.filter(
                (row) =>
                    selectedContactsByCustomer[row.id] &&
                    selectedContactsByCustomer[row.id].length > 0
            );

            for (let i = 0; i < customersToProcess.length; i++) {
                const customerRow = customersToProcess[i];
                const customerName = getCustomerName(customerRow);
                const contactIds = selectedContactsByCustomer[customerRow.id] || [];

                setSendProgress({
                    current: i + 1,
                    total: customersToProcess.length,
                    currentCustomerName: customerName,
                });

                try {
                    await api.post(
                        `/entities/customers/${customerRow.id}/activity/send-email`,
                        {
                            contactIds,
                            templateId: selectedTemplate?.id || null,
                            subject: subject.trim(),
                            emailBody: emailBody.trim(),
                        }
                    );

                    results.push({
                        customerId: customerRow.id,
                        customerName,
                        success: true,
                        contactCount: contactIds.length,
                    });
                } catch (error: any) {
                    const errorMessage =
                        error?.response?.data?.error ||
                        error?.message ||
                        t("messages.failed_to_send_email", { ns: "activities" });
                    results.push({
                        customerId: customerRow.id,
                        customerName,
                        success: false,
                        error: errorMessage,
                    });
                }

                setSendResults([...results]);
            }

            setIsSending(false);
            setSendProgress(null);

            // Show summary toast
            const successCount = results.filter((r) => r.success).length;
            const failedCount = results.filter((r) => !r.success).length;
            const totalContactsSent = results
                .filter((r) => r.success)
                .reduce((sum, r) => sum + (r.contactCount || 0), 0);

            if (successCount === customersToProcess.length) {
                showToast(
                    t("messages.mass_email_sent_successfully", {
                        contacts: totalContactsSent,
                        customers: successCount,
                        ns: "activities",
                    }),
                    "success"
                );
            } else if (successCount > 0) {
                showToast(
                    t("messages.mass_email_partial_success", {
                        success: successCount,
                        total: customersToProcess.length,
                        failed: failedCount,
                        ns: "activities",
                    }),
                    "warning"
                );
            } else {
                showToast(
                    t("messages.mass_email_failed", { ns: "activities" }),
                    "error"
                );
            }

            if (successCount > 0) {
                closeModal();
                if (onUpdateComplete) {
                    onUpdateComplete();
                }
            }
        }
    }, [
        validateForm,
        isSingleMode,
        customer,
        selectedTemplate,
        subject,
        emailBody,
        refreshTimeline,
        closeModal,
        showToast,
        t,
        selectedContactsByCustomer,
        activeRows,
        onUpdateComplete,
    ]);

    // Error clear handler
    const handleErrorClear = useCallback((field: keyof FormErrors) => {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    }, []);

    return (
        <AppDialog
            open={isOpen}
            onClose={closeModal}
            drag
            align
            slide
            resize
            isRTL={isRTL}
            resizeOptions={{
                initialWidth: 600,
                heightFraction: 0.8,
                minWidth: 520,
                maxWidth: 1100,
                minHeight: 400,
                maxHeight: 0.95,
            }}
            title={
                isSingleMode
                    ? t("actions.send_email", { ns: "activities" })
                    : t("actions.mass_send_email", { ns: "activities" })
            }
            titleIcon={<EmailIcon aria-hidden="true" />}
            ariaLabelledBy="mass-send-email-modal-title"
            ariaDescribedBy="mass-send-email-modal-description"

            paperSx={{
                sx: {
                    "& .MuiDialogContent-root": {
                        p: 2,
                    },
                },
            }}
            actions={
                <Box
                    sx={{
                        display: "flex",
                        gap: 1,
                        flexDirection,
                        width: "100%",
                        flexWrap: { xs: "wrap", sm: "nowrap" },
                        justifyContent: "flex-end",
                    }}
                >
                    {isRTL ? (
                        <>
                            {currentStep === 1 ? (
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleNext}
                                    disabled={!subject || !emailBody}
                                    sx={{
                                        minWidth: "auto",
                                        direction,
                                    }}
                                    className="save-button"
                                >
                                    {t("actions.next", { ns: "common" })}
                                </Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleSend}
                                    disabled={
                                        isSending ||
                                        !subject ||
                                        !emailBody ||
                                        selectionSummary.totalContacts === 0
                                    }
                                    sx={{
                                        minWidth: "auto",
                                        direction,
                                    }}
                                    className="save-button"
                                >
                                    {isSending
                                        ? t("actions.sending", {
                                            ns: "activities",
                                        })
                                        : t("actions.send", { ns: "common" })}
                                </Button>
                            )}
                            <Button
                                onClick={closeModal}
                                variant="outlined"
                                size="small"
                                className="cancel-button"
                                disabled={isSending}
                                sx={{
                                    mr: isRTL ? 0 : theme.spacing(1),
                                    ml: isRTL ? theme.spacing(1) : 0,
                                }}
                            >
                                {t("actions.cancel", { ns: "common" })}
                            </Button>
                            {currentStep === 2 && (
                                <Button
                                    onClick={handleBack}
                                    variant="outlined"
                                    size="small"
                                    className="cancel-button"
                                    disabled={isSending}
                                    sx={{
                                        mr: isRTL ? 0 : theme.spacing(1),
                                        ml: isRTL ? theme.spacing(1) : 0,
                                    }}
                                >
                                    {t("actions.back", { ns: "common" })}
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            {currentStep === 2 && (
                                <Button
                                    onClick={handleBack}
                                    variant="outlined"
                                    size="small"
                                    className="cancel-button"
                                    disabled={isSending}
                                    sx={{
                                        mr: isRTL ? 0 : theme.spacing(1),
                                        ml: isRTL ? theme.spacing(1) : 0,
                                    }}
                                >
                                    {t("actions.back", { ns: "common" })}
                                </Button>
                            )}
                            <Button
                                onClick={closeModal}
                                variant="outlined"
                                size="small"
                                className="cancel-button"
                                disabled={isSending}
                                sx={{
                                    mr: isRTL ? 0 : theme.spacing(1),
                                    ml: isRTL ? theme.spacing(1) : 0,
                                }}
                            >
                                {t("actions.cancel", { ns: "common" })}
                            </Button>
                            {currentStep === 1 ? (
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleNext}
                                    disabled={!subject || !emailBody}
                                    sx={{
                                        minWidth: "auto",
                                        direction,
                                    }}
                                    className="save-button"
                                >
                                    {t("actions.next", { ns: "common" })}
                                </Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleSend}
                                    disabled={
                                        isSending ||
                                        !subject ||
                                        !emailBody ||
                                        selectionSummary.totalContacts === 0
                                    }
                                    sx={{
                                        minWidth: "auto",
                                        direction,
                                    }}
                                    className="save-button"
                                >
                                    {isSending
                                        ? t("actions.sending", {
                                            ns: "activities",
                                        })
                                        : t("actions.send", { ns: "common" })}
                                </Button>
                            )}
                        </>
                    )}
                </Box>
            }
        >
            <Box
                id="mass-send-email-modal-description"
                sx={{
                    p: 0,
                    direction,
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    overflow: "hidden",
                    minHeight: 0,
                    height: "100%",
                }}
            >
                <Box
                    sx={{
                        p: 1.5,
                        direction,
                        flex: "1 1 auto",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        minHeight: 0,
                    }}
                >
                    {/* Inactive customers warning */}
                    {inactiveCount > 0 && (
                        <Box
                            sx={{
                                p: 2,
                                mb: 2,
                                backgroundColor: "rgba(255, 152, 0, 0.1)",
                                borderRadius: 1,
                                border: "1px solid rgba(255, 152, 0, 0.3)",
                                direction,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: 500,
                                    color: "warning.main",
                                    direction,
                                    textAlign,
                                }}
                            >
                                {t(
                                    "messages.inactive_customers_will_be_ignored",
                                    { count: inactiveCount, ns: "activities" }
                                )}
                            </Typography>
                        </Box>
                    )}

                    {/* Step Container with Slide Animation */}
                    <Box
                        sx={{
                            position: "relative",
                            overflow: "hidden",
                            flex: "1 1 auto",
                            display: "flex",
                            flexDirection: "column",
                            minHeight: 0,
                            height: "100%",
                        }}
                    >
                        {/* Step 1: Email Composition */}
                        <Box
                            sx={{
                                position: "absolute",
                                width: "100%",
                                height: "100%",
                                top: 0,
                                left: 0,
                                transform:
                                    currentStep === 1
                                        ? "translateX(0)"
                                        : isRTL
                                            ? "translateX(100%)"
                                            : "translateX(-100%)",
                                transition: "transform 0.3s ease-in-out",
                                opacity: currentStep === 1 ? 1 : 0,
                                pointerEvents:
                                    currentStep === 1 ? "auto" : "none",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <EmailCompositionStep
                                selectedTemplate={selectedTemplate}
                                onTemplateChange={setSelectedTemplate}
                                emailTemplates={emailTemplates}
                                isLoadingTemplates={isLoadingTemplates}
                                subject={subject}
                                onSubjectChange={setSubject}
                                emailBody={emailBody}
                                onEmailBodyChange={setEmailBody}
                                errors={errors}
                                onErrorClear={handleErrorClear}
                                isSending={isSending}
                            />
                        </Box>

                        {/* Step 2: Contact Selection */}
                        <Box
                            sx={{
                                position: "absolute",
                                width: "100%",
                                height: "100%",
                                top: 0,
                                left: 0,
                                transform:
                                    currentStep === 2
                                        ? "translateX(0)"
                                        : isRTL
                                            ? "translateX(-100%)"
                                            : "translateX(100%)",
                                transition: "transform 0.3s ease-in-out",
                                opacity: currentStep === 2 ? 1 : 0,
                                pointerEvents:
                                    currentStep === 2 ? "auto" : "none",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            {/* Customer Contact Selection Section */}
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    height: "100%",
                                    flex: "1 1 auto",
                                    minHeight: 0,
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        mb: 2,
                                    }}
                                >
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            color: theme.palette.primary.main,
                                            fontWeight: 600,
                                            fontSize: "1.25rem",
                                            mb: 2,
                                            textAlign,
                                            direction,
                                        }}
                                    >
                                        {t("fields.select_contacts", {
                                            ns: "activities",
                                        })}
                                    </Typography>
                                </Box>

                                {/* Grid-based UI for both single and multi customer modes */}
                                <>
                                    {/* Switches Row */}
                                    <Box
                                        sx={{
                                            mb: 2,
                                            display: "flex",
                                            gap: 2,
                                            alignItems: "center",
                                            flexDirection: "row",
                                            direction,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: 500,
                                                color: theme.palette.text.secondary,
                                                textAlign,
                                                direction,
                                                mr: isRTL ? 0 : 2,
                                                ml: isRTL ? 2 : 0,
                                            }}
                                        >
                                            {isRTL ? "בחר:" : "Select:"}
                                        </Typography>
                                        {isRTL ? (
                                            // For Hebrew RTL: Escalated first (appears on right), Standard second (appears on left)
                                            <>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={
                                                                selectEscalatedContacts
                                                            }
                                                            onChange={(e) =>
                                                                handleEscalatedContactsToggle(
                                                                    e.target.checked
                                                                )
                                                            }
                                                            disabled={isSending}
                                                            {...(isRTL ? { "data-rtl": true } : {})}
                                                        />
                                                    }
                                                    label={t("fields.escalated_reminders", {
                                                        ns: "contacts",
                                                    })}
                                                    sx={{
                                                        direction,
                                                    }}
                                                />
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={selectRegularContacts}
                                                            onChange={(e) =>
                                                                handleRegularContactsToggle(
                                                                    e.target.checked
                                                                )
                                                            }
                                                            disabled={isSending}
                                                            {...(isRTL ? { "data-rtl": true } : {})}
                                                        />
                                                    }
                                                    label={t("fields.standard_reminders", {
                                                        ns: "contacts",
                                                    })}
                                                    sx={{
                                                        direction,
                                                    }}
                                                />
                                            </>
                                        ) : (
                                            // For LTR: Standard first (appears on left), Escalated second (appears on right)
                                            <>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={selectRegularContacts}
                                                            onChange={(e) =>
                                                                handleRegularContactsToggle(
                                                                    e.target.checked
                                                                )
                                                            }
                                                            disabled={isSending}
                                                            {...(isRTL ? { "data-rtl": true } : {})}
                                                        />
                                                    }
                                                    label={t("fields.standard_reminders", {
                                                        ns: "contacts",
                                                    })}
                                                    sx={{
                                                        direction,
                                                    }}
                                                />
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={
                                                                selectEscalatedContacts
                                                            }
                                                            onChange={(e) =>
                                                                handleEscalatedContactsToggle(
                                                                    e.target.checked
                                                                )
                                                            }
                                                            disabled={isSending}
                                                            {...(isRTL ? { "data-rtl": true } : {})}
                                                        />
                                                    }
                                                    label={t("fields.escalated_reminders", {
                                                        ns: "contacts",
                                                    })}
                                                    sx={{
                                                        direction,
                                                    }}
                                                />
                                            </>
                                        )}
                                    </Box>

                                    {/* Selection Summary */}
                                    {selectionSummary.totalContacts > 0 && (
                                        <Box
                                            sx={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                px: 1.5,
                                                py: 0.5,
                                                mb: 2,
                                                bgcolor: alpha(
                                                    theme.palette.primary.main,
                                                    0.1
                                                ),
                                                borderRadius: 1,
                                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                                textAlign,
                                                direction,
                                            }}
                                        >
                                            <CheckCircle
                                                sx={{
                                                    fontSize: 16,
                                                    color: theme.palette.primary
                                                        .main,
                                                    mr: isRTL ? 0 : 0.5,
                                                    ml: isRTL ? 0.5 : 0,
                                                }}
                                            />
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontSize: "0.75rem",
                                                    fontWeight: 500,
                                                    color: theme.palette.primary
                                                        .main,
                                                }}
                                            >
                                                {t("messages.selection_summary", {
                                                    contacts:
                                                        selectionSummary.totalContacts,
                                                    customers:
                                                        selectionSummary.customerCount,
                                                    ns: "activities",
                                                })}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Progress Bar */}
                                    {isSending && sendProgress && (
                                        <Box
                                            sx={{
                                                mb: 2,
                                                direction: direction,
                                            }}
                                        >
                                            <LinearProgress
                                                variant="determinate"
                                                value={
                                                    (sendProgress.current /
                                                        sendProgress.total) *
                                                    100
                                                }
                                                sx={{ mb: 1 }}
                                            />
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{
                                                    textAlign,
                                                    direction,
                                                }}
                                            >
                                                {t("messages.sending_to_customer", {
                                                    current: sendProgress.current,
                                                    total: sendProgress.total,
                                                    customer:
                                                        sendProgress.currentCustomerName,
                                                    ns: "activities",
                                                })}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Results Summary */}
                                    {sendResults.length > 0 && !isSending && (
                                        <Box
                                            sx={{
                                                mb: 2,
                                                direction: direction,
                                            }}
                                        >
                                            <Typography
                                                variant="subtitle2"
                                                sx={{
                                                    mb: 1,
                                                    textAlign,
                                                    direction,
                                                }}
                                            >
                                                {t("messages.send_results", {
                                                    ns: "activities",
                                                })}
                                            </Typography>
                                            {sendResults.map((result) => (
                                                <Box
                                                    key={result.customerId}
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                        p: 1,
                                                        mb: 0.5,
                                                        bgcolor: result.success
                                                            ? "success.light"
                                                            : "error.light",
                                                        borderRadius: 1,
                                                        flexDirection,
                                                    }}
                                                >
                                                    {result.success ? (
                                                        <CheckCircle
                                                            sx={{
                                                                color: "success.main",
                                                            }}
                                                        />
                                                    ) : (
                                                        <ErrorIcon
                                                            sx={{
                                                                color: "error.main",
                                                            }}
                                                        />
                                                    )}
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            textAlign,
                                                            direction,
                                                        }}
                                                    >
                                                        {result.customerName}:{" "}
                                                        {result.success
                                                            ? t(
                                                                "messages.sent_to_contacts",
                                                                {
                                                                    count: result.contactCount,
                                                                    ns: "activities",
                                                                }
                                                            )
                                                            : result.error}
                                                    </Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    )}

                                    {/* Search Bar */}
                                    <TextField
                                        fullWidth
                                        size="small"
                                        placeholder={t(
                                            "fields.search_placeholder",
                                            {
                                                ns: "common",
                                            }
                                        )}
                                        value={contactSearchTerm}
                                        onChange={(e) =>
                                            setContactSearchTerm(e.target.value)
                                        }
                                        dir={direction}
                                        {...(isRTL && {
                                            "data-rtl": true,
                                            "data-hebrew": true,
                                        })}
                                        sx={{
                                            ...searchFieldStyles,
                                            mb: 3,
                                        }}
                                        inputProps={{
                                            dir: direction,
                                            style: {
                                                textAlign: direction === "rtl" ? "right" : "left",
                                                direction: direction as "ltr" | "rtl",
                                            },
                                        }}
                                        InputProps={{
                                            startAdornment:
                                                direction === "ltr" ? (
                                                    <InputAdornment
                                                        position="start"
                                                        sx={{
                                                            marginLeft: 0,
                                                            marginRight: 0,
                                                            minWidth: "auto",
                                                            width: "auto",
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                cursor: "pointer",
                                                                padding: "0",
                                                                borderRadius: "4px",
                                                                width: "20px",
                                                                height: "20px",
                                                                minWidth: "20px",
                                                                minHeight: "20px",
                                                                "&:hover": {
                                                                    backgroundColor:
                                                                        theme.palette.action.hover,
                                                                },
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                            }}
                                                        >
                                                            <SearchIcon fontSize="small" />
                                                        </Box>
                                                    </InputAdornment>
                                                ) : direction === "rtl" && contactSearchTerm ? (
                                                    <InputAdornment
                                                        position="start"
                                                        sx={{
                                                            position: "absolute",
                                                            left: 0,
                                                            right: "auto",
                                                        }}
                                                    >
                                                        <IconButton
                                                            onClick={() =>
                                                                setContactSearchTerm("")
                                                            }
                                                            edge="start"
                                                            size="small"
                                                            sx={{
                                                                padding: theme.spacing(0.5),
                                                                marginLeft: 0,
                                                                "&:hover": {
                                                                    backgroundColor:
                                                                        theme.palette.action.hover,
                                                                },
                                                            }}
                                                        >
                                                            <ClearIcon fontSize="small" />
                                                        </IconButton>
                                                    </InputAdornment>
                                                ) : undefined,
                                            endAdornment:
                                                direction === "rtl" ? (
                                                    contactSearchTerm ? (
                                                        <InputAdornment
                                                            position="end"
                                                            sx={{
                                                                position: "absolute",
                                                                right: theme.spacing(0.5),
                                                                left: "auto",
                                                                minWidth: "auto",
                                                                width: "auto",
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    cursor: "pointer",
                                                                    padding: "0",
                                                                    borderRadius: "4px",
                                                                    width: "20px",
                                                                    height: "20px",
                                                                    minWidth: "20px",
                                                                    minHeight: "20px",
                                                                    "&:hover": {
                                                                        backgroundColor:
                                                                            theme.palette.action.hover,
                                                                    },
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                }}
                                                            >
                                                                <SearchIcon fontSize="small" />
                                                            </Box>
                                                        </InputAdornment>
                                                    ) : (
                                                        <InputAdornment
                                                            position="end"
                                                            sx={{
                                                                position: "absolute",
                                                                right: theme.spacing(0.5),
                                                                left: "auto",
                                                                minWidth: "auto",
                                                                width: "auto",
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    cursor: "pointer",
                                                                    padding: "0",
                                                                    borderRadius: "4px",
                                                                    "&:hover": {
                                                                        backgroundColor:
                                                                            theme.palette.action.hover,
                                                                    },
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                }}
                                                            >
                                                                <SearchIcon fontSize="small" />
                                                            </Box>
                                                        </InputAdornment>
                                                    )
                                                ) : direction === "ltr" &&
                                                    contactSearchTerm ? (
                                                    <InputAdornment
                                                        position="end"
                                                        sx={{
                                                            position: "absolute",
                                                            right: 0,
                                                            left: "auto",
                                                            display: "flex",
                                                            alignItems: "center",
                                                        }}
                                                    >
                                                        <IconButton
                                                            onClick={() =>
                                                                setContactSearchTerm("")
                                                            }
                                                            edge="end"
                                                            size="small"
                                                            sx={{
                                                                padding: theme.spacing(0.5),
                                                                marginRight: 0,
                                                                marginLeft: 0,
                                                                "&:hover": {
                                                                    backgroundColor:
                                                                        theme.palette.action
                                                                            .hover,
                                                                },
                                                            }}
                                                        >
                                                            <ClearIcon fontSize="small" />
                                                        </IconButton>
                                                    </InputAdornment>
                                                ) : undefined,
                                        }}
                                    />

                                    {/* Contacts Grid */}
                                    <Box
                                        sx={{
                                            flex: "1 1 auto",
                                            display: "flex",
                                            flexDirection: "column",
                                            minHeight: 0,
                                            overflow: "hidden",
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                        }}
                                    >
                                        {/* Header Row - outside scroll so scrollbar starts below */}
                                        {!isLoadingContacts &&
                                            filteredAllContacts.length > 0 && (
                                                <Box
                                                    sx={{
                                                        flex: "0 0 auto",
                                                        display: "flex",
                                                        mt: 2,
                                                        mb: 1,
                                                        pb: 1,
                                                        borderBottom: `1px solid ${theme.palette.divider}`,
                                                        direction,
                                                    }}
                                                >
                                                    {!isSingleMode && (
                                                        <Box
                                                            sx={{
                                                                flex: "0 0 38%",
                                                                px: 1,
                                                            }}
                                                        >
                                                            <Typography
                                                                variant="subtitle2"
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    textAlign,
                                                                    direction,
                                                                }}
                                                            >
                                                                {isRTL
                                                                    ? "לקוח"
                                                                    : "Customer"}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                    <Box
                                                        sx={{
                                                            flex: isSingleMode ? "0 0 64%" : "0 0 26%",
                                                            px: 1,
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="subtitle2"
                                                            sx={{
                                                                fontWeight: 600,
                                                                textAlign,
                                                                direction,
                                                            }}
                                                        >
                                                            {t("fields.name", {
                                                                ns: "contacts",
                                                            })}
                                                        </Typography>
                                                    </Box>
                                                    <Box
                                                        sx={{
                                                            flex: "0 0 18%",
                                                            px: 1,
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="subtitle2"
                                                            sx={{
                                                                fontWeight: 600,
                                                                textAlign,
                                                                direction,
                                                            }}
                                                        >
                                                            {t(
                                                                "fields.standard_reminders",
                                                                {
                                                                    ns: "contacts",
                                                                }
                                                            )}
                                                        </Typography>
                                                    </Box>
                                                    <Box
                                                        sx={{
                                                            flex: "0 0 18%",
                                                            px: 1,
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="subtitle2"
                                                            sx={{
                                                                fontWeight: 600,
                                                                textAlign,
                                                                direction,
                                                            }}
                                                        >
                                                            {t(
                                                                "fields.escalated_reminders",
                                                                {
                                                                    ns: "contacts",
                                                                }
                                                            )}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            )}
                                        <ModalScrollBox
                                            id="mass-send-email-modal-scroll"
                                            isRTL={isRTL}
                                        >
                                            {isLoadingContacts ? (
                                                <Box>
                                                    <Skeleton height={60} />
                                                    <Skeleton height={60} />
                                                    <Skeleton height={60} />
                                                </Box>
                                            ) : filteredAllContacts.length === 0 ? (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{
                                                        textAlign: textAlign,
                                                        p: 2,
                                                    }}
                                                >
                                                    {t("messages.no_valid_contacts", {
                                                        ns: "activities",
                                                    })}
                                                </Typography>
                                            ) : (
                                                <>
                                                    {filteredAllContacts.map(
                                                        (contact) => {
                                                            const customerId =
                                                                contact.customerId;
                                                            const isSelected = (
                                                                selectedContactsByCustomer[
                                                                customerId
                                                                ] || []
                                                            ).includes(contact.id);

                                                            return (
                                                                <Box
                                                                    key={`${customerId}-${contact.id}`}
                                                                    sx={{
                                                                        display:
                                                                            "flex",
                                                                        py: 1,
                                                                        px: 1,
                                                                        borderRadius: 1,
                                                                        bgcolor:
                                                                            isSelected
                                                                                ? alpha(
                                                                                    theme
                                                                                        .palette
                                                                                        .primary
                                                                                        .main,
                                                                                    0.08
                                                                                )
                                                                                : "transparent",
                                                                        "&:hover": {
                                                                            bgcolor:
                                                                                isSelected
                                                                                    ? alpha(
                                                                                        theme
                                                                                            .palette
                                                                                            .primary
                                                                                            .main,
                                                                                        0.15
                                                                                    )
                                                                                    : alpha(
                                                                                        theme
                                                                                            .palette
                                                                                            .primary
                                                                                            .main,
                                                                                        0.05
                                                                                    ),
                                                                        },
                                                                        ...(isRTL
                                                                            ? {
                                                                                borderRight:
                                                                                    isSelected
                                                                                        ? `3px solid ${theme.palette.primary.main}`
                                                                                        : "3px solid transparent",
                                                                            }
                                                                            : {
                                                                                borderLeft:
                                                                                    isSelected
                                                                                        ? `3px solid ${theme.palette.primary.main}`
                                                                                        : "3px solid transparent",
                                                                            }),
                                                                        direction,
                                                                    }}
                                                                >
                                                                    {/* Customer column - only show for multi mode */}
                                                                    {!isSingleMode && (
                                                                        <Box
                                                                            sx={{
                                                                                flex: "0 0 38%",
                                                                                px: 1,
                                                                            }}
                                                                        >
                                                                            <Typography
                                                                                variant="body2"
                                                                                sx={{
                                                                                    textAlign,
                                                                                    direction,
                                                                                }}
                                                                            >
                                                                                {
                                                                                    contact.customerName
                                                                                }
                                                                            </Typography>
                                                                        </Box>
                                                                    )}
                                                                    <Box
                                                                        sx={{
                                                                            flex: isSingleMode ? "0 0 64%" : "0 0 26%",
                                                                            px: 1,
                                                                        }}
                                                                    >
                                                                        <Box
                                                                            sx={{
                                                                                display:
                                                                                    "flex",
                                                                                alignItems:
                                                                                    "center",
                                                                                gap: 0.5,
                                                                                flexDirection,
                                                                                justifyContent: isRTL ? "flex-end" : "flex-start",
                                                                            }}
                                                                        >
                                                                            {contact.email && (
                                                                                <Tooltip
                                                                                    title={
                                                                                        contact.email
                                                                                    }
                                                                                    arrow
                                                                                    placement="bottom"
                                                                                >
                                                                                    <InfoIcon
                                                                                        sx={{
                                                                                            fontSize: 16,
                                                                                            color: theme
                                                                                                .palette
                                                                                                .text
                                                                                                .secondary,
                                                                                            cursor: "help",
                                                                                        }}
                                                                                    />
                                                                                </Tooltip>
                                                                            )}
                                                                            <Typography
                                                                                variant="body2"
                                                                                sx={{
                                                                                    textAlign: isRTL ? "right" : "left",
                                                                                    direction,
                                                                                }}
                                                                            >
                                                                                {`${contact.first_name} ${contact.last_name || ""}`.trim() ||
                                                                                    "-"}
                                                                            </Typography>
                                                                        </Box>
                                                                    </Box>
                                                                    <Box
                                                                        sx={{
                                                                            flex: "0 0 18%",
                                                                            px: 1,
                                                                            display:
                                                                                "flex",
                                                                            justifyContent:
                                                                                "center",
                                                                        }}
                                                                    >
                                                                        <Switch
                                                                            checked={
                                                                                isSelected &&
                                                                                !contact.receives_escalated_reminder
                                                                            }
                                                                            onChange={() => {
                                                                                handleContactToggleWithError(
                                                                                    customerId,
                                                                                    contact.id
                                                                                );
                                                                            }}
                                                                            disabled={
                                                                                isSending ||
                                                                                contact.receives_escalated_reminder ===
                                                                                true
                                                                            }
                                                                            {...(isRTL ? { "data-rtl": true } : {})}
                                                                        />
                                                                    </Box>
                                                                    <Box
                                                                        sx={{
                                                                            flex: "0 0 18%",
                                                                            px: 1,
                                                                            display:
                                                                                "flex",
                                                                            justifyContent:
                                                                                "center",
                                                                        }}
                                                                    >
                                                                        <Switch
                                                                            checked={
                                                                                isSelected &&
                                                                                contact.receives_escalated_reminder ===
                                                                                true
                                                                            }
                                                                            onChange={() => {
                                                                                handleContactToggleWithError(
                                                                                    customerId,
                                                                                    contact.id
                                                                                );
                                                                            }}
                                                                            disabled={
                                                                                isSending ||
                                                                                contact.receives_escalated_reminder !==
                                                                                true
                                                                            }
                                                                            {...(isRTL ? { "data-rtl": true } : {})}
                                                                        />
                                                                    </Box>
                                                                </Box>
                                                            );
                                                        }
                                                    )}
                                                </>
                                            )}
                                        </ModalScrollBox>
                                    </Box>
                                </>

                                {errors.contacts && (
                                    <FormHelperText
                                        error
                                        sx={{
                                            mt: 1,
                                            textAlign,
                                            direction,
                                        }}
                                    >
                                        {errors.contacts}
                                    </FormHelperText>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </AppDialog>
    );
};

export default MassSendEmailModal;
