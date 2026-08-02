/**
 * LogActivity Component
 *
 * IMPORTANT: This component should ONLY pass parameters to the API without any business logic.
 * All business logic and data transformations should be handled by the backend services.
 *
 * Component Responsibilities:
 * 1. Collect raw data from the form
 * 2. Pass raw data to the API
 * 3. Handle UI state and user interactions
 * 4. Display success/error messages
 *
 * DO NOT:
 * - Transform or format data
 * - Add business logic
 * - Handle data validation beyond basic form validation
 * - Make decisions about data structure
 *
 * Data handling responsibilities:
 * - Backend services handle all data processing including:
 *   - Activity type determination
 *   - Date/time formatting
 *   - Content formatting
 *   - Title formatting
 *   - Timeline data formatting
 */

"use client";

import CallEndIcon from "@mui/icons-material/CallEnd";
import CallMadeIcon from "@mui/icons-material/CallMade";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import ClearIcon from "@mui/icons-material/Clear";
import ErrorIcon from "@mui/icons-material/Error";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SearchIcon from "@mui/icons-material/Search";
import {
    alpha,
    Autocomplete,
    Box,
    Button,
    Checkbox,
    Chip,
    FormControl,
    FormHelperText,
    IconButton,
    InputAdornment,
    InputLabel,
    ListItemText,
    MenuItem,
    OutlinedInput,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker, DateTimePicker } from "@mui/x-date-pickers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import { useSession } from "next-auth/react";
import React, {
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";
import { useTranslation } from "react-i18next";

import api, { apiFetch } from "@/app/api";
import { Outcome, useAgentPortal } from "@/app/context/AgentPortalContext";

import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import ActivityFileUploader from "@/shared/layout-components/activity/ActivityFileUploader";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { fetchDisputeReasonsByAccountId } from "@/shared/services/accountService";
import { fetchContacts } from "@/shared/services/customerService";
import { calculateLogActivityPromiseToPayDateRange } from "@/shared/services/promiseToPayService";
import { ContactResponse } from "@/types/contact";
import { Customer } from "@/types/Customer";
import { DisputeReasonResponse } from "@/types/DisputeReason";
import { combineFirstLastNames } from "@/utils/authUtils";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

import { BusinessHoursService } from "../../../../../utils/businessHoursService";
import {
    getCountryTimezone,
    getDatePickerFormat,
    getUserDateLocale,
    getUserTimezone,
} from "../../../../../utils/datetimeOperations";

import MakePaymentModal from "./MakePaymentModal";
import UpdateResolutionModal from "./UpdateResolutionModal";
import UpsertContactModal from "./UpsertContactModal";

// Invoice option for selects
interface InvoiceOption {
    value: string;
    label: string;
    id: number;
    invoice_number: string;
    amount?: number;
    customer_currency?: string;
}

// Dispute reason option for selects
interface DisputeReasonOption {
    value: string;
    label: string;
    id: number;
}

// Contact option for selects
interface ContactOption {
    value: string;
    label: string;
    name: string;
    mobile?: string | null;
}

// Outcome option for selects
interface OutcomeOption {
    value: Outcome;
    label: string;
}

interface LogActivityProps {
    customer: Customer;
    isActive?: boolean;
    toggleOpen: () => void;
    refreshTimeline?: () => void;
}

const LogActivity: React.FC<LogActivityProps> = ({
    customer,
    isActive = false,
    toggleOpen,
    refreshTimeline,
}) => {
    const { t, i18n } = useTranslation(["activities", "customers", "common"]);
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const theme = useTheme();
    const isRTL = i18n.language === "he";

    const logActivityDatePickerFormat = useMemo(
        () => getDatePickerFormat(session, "DD/MM/YYYY"),
        [session]
    );

    const logActivityDateTimePickerFormat = useMemo(
        () =>
            getUserDateLocale(session) === "he-IL"
                ? "DD/MM/YYYY HH:mm"
                : "MM/DD/YYYY hh:mm A",
        [session]
    );

    const getLogActivityPickerTextFieldSlotProps = useCallback(
        (options?: { error?: boolean; helperText?: string }) => ({
            fullWidth: true,
            size: "small" as const,
            ...(options?.error !== undefined && { error: options.error }),
            ...(options?.helperText !== undefined && {
                helperText: options.helperText,
            }),
            ...(isRTL && { "data-hebrew": true }),
            dir: (isRTL ? "rtl" : "ltr") as "rtl" | "ltr",
        }),
        [isRTL]
    );

    // Fetch user permissions to check for create_dispute permission
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            session?.user?.account_id,
        ],
        queryFn: async () => {
            const response = await api.get("/permissions/me");
            return response.data;
        },
        enabled: !!session?.user?.id,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasCreateDisputePermission =
        userPermissions.includes("create_dispute");

    // Helper function to determine if customer is inactive with no active collection period
    const isInactiveWithNoActivePeriod = useCallback(
        (customer: Customer): boolean => {
            if (customer.collection_status !== "Inactive") return false;
            const hasActivePeriod =
                customer.CustomerCollectionPeriod?.some(
                    (period: { period_end_date: Date | null }) =>
                        period.period_end_date === null
                ) ?? false;
            return !hasActivePeriod;
        },
        []
    );

    const outcomes: OutcomeOption[] = [
        {
            value: "no_answer",
            label: t("values.outcomes_no_answer", { ns: "activities" }),
        },
        {
            value: "bad_number",
            label: t("values.outcomes_bad_number", { ns: "activities" }),
        },
        {
            value: "schedule_follow_up",
            label: t("values.outcomes_schedule_follow_up", {
                ns: "activities",
            }),
        },
        {
            value: "general",
            label: t("values.outcomes_general", { ns: "activities" }),
        },
        {
            value: "add_new_contact",
            label: t("values.outcomes_add_new_contact", { ns: "activities" }),
        },
        {
            value: "promise_to_pay",
            label: t("values.outcomes_promise_to_pay", { ns: "activities" }),
        },
        {
            value: "open_dispute",
            label: t("values.outcomes_open_dispute", { ns: "activities" }),
        },
        {
            value: "generic_comment",
            label: t("actions.log_activity_add_comment", { ns: "activities" }),
        },
    ];

    const currentUserTimezone = getUserTimezone(session);
    const customerTimezone = getCountryTimezone(
        customer?.Country?.iso2,
        customer?.State?.iso2
    );
    const getFollowUpUtcIsoFromCustomerTime = useCallback(
        (value: Date | string | null): string | null => {
            if (!value) return null;

            const dateObj = value instanceof Date ? value : new Date(value);
            if (isNaN(dateObj.getTime())) return null;

            // Treat picker date/time as customer wall-clock time.
            const customerLocalMoment = moment.tz(
                {
                    year: dateObj.getFullYear(),
                    month: dateObj.getMonth(),
                    day: dateObj.getDate(),
                    hour: dateObj.getHours(),
                    minute: dateObj.getMinutes(),
                    second: 0,
                    millisecond: 0,
                },
                customerTimezone
            );

            return customerLocalMoment.utc().toISOString();
        },
        [customerTimezone]
    );

    const {
        selectedContact,
        setSelectedContact,
        selectedOutcome,
        setSelectedOutcome,
        selectedDate,
        setSelectedDate,
        showCalendar,
        setShowCalendar,
        comment,
        setComment,
        disputedInvoices,
        setDisputedInvoices,
        disputeReason,
        setDisputeReason,
        followUpDate,
        setFollowUpDate,
        isCalling,
        setIsCalling,
        callType,
        setCallType,
        elapsedTime,
        setElapsedTime,
        startTime,
        setStartTime,
        businessHoursWarning,
        setBusinessHoursWarning,
        resetPortal,
    } = useAgentPortal();

    // Add validation state
    const [validationErrors, setValidationErrors] = useState<
        Record<string, string>
    >({});

    // Add invoice search state
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState<string>("");
    const [isInvoiceSelectOpen, setIsInvoiceSelectOpen] =
        useState<boolean>(false);



    const clearValidationError = useCallback((field: string) => {
        setValidationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
        });
    }, []);

    const setValidationError = useCallback((field: string, message: string) => {
        setValidationErrors((prev) => ({
            ...prev,
            [field]: message,
        }));
    }, []);

    const [modalState, setModalState] = useState({
        showPaymentModal: false,
        showContactModal: false,
        isUpdateResolutionModalOpen: false,
        initialResolution: null as string | null,
        paymentMade: false,
    });

    const [loading, setLoading] = useState<boolean>(false);

    // Add file upload state
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [shouldLoadContacts, setShouldLoadContacts] = useState(false);

    // Prevent hydration mismatch by only calculating current date after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    // Load contacts async after page load to not block initial render
    useEffect(() => {
        if (customer?.company_id) {
            // Delay loading contacts to allow page to render first
            const timer = setTimeout(() => {
                setShouldLoadContacts(true);
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [customer?.company_id]);

    // Use a stable date during SSR, only calculate actual "now" after mount
    const now = useMemo(() => {
        if (!mounted) {
            // Return a stable date during SSR to prevent hydration mismatch
            // This will be recalculated after mount
            return new Date("2000-01-01");
        }
        return new Date();
    }, [mounted]);

    const isToday = useMemo(
        () =>
            followUpDate && mounted
                ? moment(followUpDate).isSame(now, "day")
                : false,
        [followUpDate, now, mounted]
    );

    // Query keys for data fetching
    // Note: The invoices query uses the unified DisputeInvoiceService
    // with status_id: [3, 13] for due and overdue invoices with non-zero outstanding debt
    const queryKeys = useMemo(() => {
        return {
            disputeReasons: [
                "disputeReasons",
                {
                    page: 1,
                    limit: 10,
                    status: "",
                    editable: "true",
                },
            ],
            contacts: [
                "contacts",
                {
                    customerId: customer?.id,
                    companyId: customer?.company_id,
                    page: 1,
                    limit: 50,
                    search: "",
                    status: "",
                },
            ],
            invoices: [
                "disputeInvoices",
                {
                    customerId: customer?.id,
                },
            ],
        };
    }, [customer?.account_id, customer?.company_id, customer?.id]);

    const queryEnabled = useMemo(() => {
        const enabled = {
            disputeReasons:
                isActive &&
                selectedOutcome?.value === "open_dispute",
            contacts: !!customer?.company_id && shouldLoadContacts,
            invoices: isActive && !!customer?.id,
        };


        return enabled;
    }, [
        isActive,
        selectedOutcome?.value,
        customer?.company_id,
        customer?.id,
        shouldLoadContacts,
    ]);

    const {
        data: disputeReasons,
    } = useQuery<DisputeReasonResponse, Error>({
        queryKey: queryKeys.disputeReasons,
        queryFn: fetchDisputeReasonsByAccountId,
        enabled: queryEnabled.disputeReasons,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    const {
        data: contactResponse,
        refetch,
    } = useQuery<ContactResponse, Error>({
        queryKey: queryKeys.contacts,
        queryFn: fetchContacts,
        enabled: queryEnabled.contacts,
        placeholderData: (prev) => prev || { contacts: [], totalRecords: 0 },
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    });

    const contacts = useMemo(() => {
        return contactResponse?.contacts || [];
    }, [contactResponse]);

    const contactOptions = useMemo(() => {
        const options = contacts.map((contact) => ({
            value: contact.id.toString(),
            label: combineFirstLastNames(contact.first_name, contact.last_name),
            name: combineFirstLastNames(contact.first_name, contact.last_name),
            mobile: contact.mobile || contact.phone,
        }));

        // Add the "Add Contact" option
        options.push({
            value: "other",
            label: t("actions.log_activity_add_contact", { ns: "activities" }),
            name: t("actions.log_activity_add_contact", { ns: "activities" }),
            mobile: null,
        });

        return options;
    }, [contacts, t]);

    const {
        data: invoiceResponse,
    } = useQuery({
        queryKey: queryKeys.invoices,
        queryFn: async () => {
            try {
                // Use the app API endpoint for invoices available for dispute
                const response = await apiFetch(`/api/entities/customers/${customer?.id}/invoices-available-for-dispute`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        credentials: "include",
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}: ${response.statusText}`
                    );
                }

                const data = await response.json();

                // The API endpoint returns serializeBigInt(availableInvoices) which should be an array
                // But handle both array and object responses
                let invoices: any[] = [];
                if (Array.isArray(data)) {
                    invoices = data;
                } else if (data && typeof data === "object" && data !== null) {
                    // Check for common response structures
                    if (Array.isArray(data.invoices)) {
                        invoices = data.invoices;
                    } else if (Array.isArray(data.data)) {
                        invoices = data.data;
                    } else if (Array.isArray(data.results)) {
                        invoices = data.results;
                    }
                }

                return {
                    invoices,
                    totalRecords: invoices.length,
                };
            } catch (error) {
                return {
                    invoices: [],
                    totalRecords: 0,
                };
            }
        },
        enabled: queryEnabled.invoices,
        placeholderData: { invoices: [], totalRecords: 0 },
        staleTime: 0, // Disable caching to ensure fresh data
        gcTime: 0, // Disable garbage collection to ensure fresh data
    });


    useEffect(() => {
        if (isCalling) {
            setStartTime(new Date());
            setElapsedTime(0);
        } else if (startTime) {
            const duration = Math.floor(
                (new Date().getTime() - startTime.getTime()) / 1000
            );
            setElapsedTime(duration);
        }
    }, [isCalling]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isCalling) {
            interval = setInterval(() => {
                setElapsedTime((prev) => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [isCalling]);

    const handleOutcomeChange = useCallback(
        (newValue: OutcomeOption | null) => {
            setSelectedOutcome(newValue);

            // For generic comments, we don't need contact selection or call state
            if (newValue?.value === "generic_comment") {
                setSelectedContact(null); // Clear contact selection
                setCallType(null); // Clear call type
                setIsCalling(false); // Stop any active call
                setElapsedTime(0); // Reset call timer
            }

            // Clear dispute-related fields when changing away from open_dispute
            if (newValue?.value !== "open_dispute") {
                setDisputedInvoices([]); // Clear disputed invoices
                setDisputeReason(null); // Clear dispute reason
                setDisputeReasonId(""); // Clear dispute reason ID (this was missing!)
                setValidationErrors({}); // Clear validation errors
            }

            if (newValue?.value === "promise_to_pay") {
                setShowCalendar(true);
            } else {
                setShowCalendar(false);
            }

            if (newValue?.value !== "promise_to_pay") {
                setSelectedDate(null);
            }

            if (newValue?.value !== "schedule_follow_up") {
                setFollowUpDate(null);
            }

            // Delay modal opening to prevent dropdown from closing
            if (newValue?.value === "add_new_contact") {
                setTimeout(() => {
                    setModalState((prev) => ({
                        ...prev,
                        showContactModal: true,
                    }));
                }, 100);
            }
        },
        [setSelectedOutcome, setShowCalendar, setSelectedDate, setFollowUpDate]
    );

    const handleContactChange = useCallback(
        (newValue: ContactOption | null) => {
            if (newValue?.value === "other") {
                setModalState((prev) => ({ ...prev, showContactModal: true }));
            } else {
                setSelectedContact(newValue);
            }
        },
        [setSelectedContact, setModalState]
    );

    // Load contacts when dropdown is opened (if not already loading)
    const handleContactDropdownOpen = useCallback(() => {
        if (!shouldLoadContacts && customer?.company_id) {
            setShouldLoadContacts(true);
        }
    }, [shouldLoadContacts, customer?.company_id]);

    const handleLogActivityContactChange = useCallback(
        (newValue: ContactOption | null) => {
            handleContactChange(newValue);
            if (validationErrors.contact) {
                clearValidationError("contact");
            }
        },
        [
            handleContactChange,
            validationErrors.contact,
            clearValidationError,
        ]
    );

    const filteredOutcomeOptions = useMemo(
        () =>
            outcomes.filter((option) => {
                if (
                    option.value === "open_dispute" &&
                    !hasCreateDisputePermission
                ) {
                    return false;
                }
                if (isInactiveWithNoActivePeriod(customer)) {
                    const hiddenOutcomes = ["promise_to_pay"];
                    if (hiddenOutcomes.includes(option.value)) {
                        return false;
                    }
                }
                return true;
            }),
        [outcomes, hasCreateDisputePermission, customer]
    );

    const handleLogActivityOutcomeChange = useCallback(
        (newValue: OutcomeOption | null) => {
            handleOutcomeChange(newValue);
            if (validationErrors.outcome) {
                clearValidationError("outcome");
            }
        },
        [handleOutcomeChange, validationErrors.outcome, clearValidationError]
    );

    const renderLogActivityOutcomeOption = useCallback(
        (
            _props: React.HTMLAttributes<HTMLLIElement> & {
                key: string | number;
            },
            option: OutcomeOption
        ) => (
            <Typography
                variant="body2"
                sx={{
                    width: "100%",
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                }}
            >
                {option.label}
            </Typography>
        ),
        [isRTL]
    );

    const renderLogActivityContactOption = useCallback(
        (
            _props: React.HTMLAttributes<HTMLLIElement> & {
                key: string | number;
            },
            option: ContactOption
        ) => {
            if (option.value === "other") {
                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            width: "100%",
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        <Tooltip
                            title={t("actions.log_activity_add_contact", {
                                ns: "activities",
                            })}
                            arrow
                            enterDelay={300}
                            leaveDelay={100}
                            placement="bottom"
                            PopperProps={{
                                sx: {
                                    "& .MuiTooltip-tooltip": {
                                        direction: isRTL ? "rtl" : "ltr",
                                    },
                                    "& .MuiTooltip-arrow": {
                                        ...(isRTL && {
                                            transform: "scaleX(-1)",
                                        }),
                                    },
                                },
                            }}
                        >
                            <IconButton
                                color="primary"
                                size="small"
                                className="toolbar-button"
                                sx={{ padding: 0 }}
                            >
                                <PersonAddIcon />
                            </IconButton>
                        </Tooltip>
                        <Typography
                            variant="body2"
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                            }}
                        >
                            {t("actions.log_activity_add_contact", {
                                ns: "activities",
                            })}
                        </Typography>
                    </Box>
                );
            }

            return (
                <Typography
                    variant="body2"
                    sx={{
                        width: "100%",
                        direction: isRTL ? "rtl" : "ltr",
                        textAlign: isRTL ? "right" : "left",
                    }}
                >
                    {option.label}
                </Typography>
            );
        },
        [isRTL, t]
    );

    const handleFollowUpDateChange = useCallback(
        (date: any) => {
            if (date) {
                const dateObj = date instanceof Date ? date : new Date(date);
                setFollowUpDate(dateObj);
            } else {
                setFollowUpDate(null);
            }
        },
        [setFollowUpDate]
    );

    const handlePaymentDateChange = useCallback(
        (date: any) => {
            const dateObj = date
                ? date instanceof Date
                    ? date
                    : new Date(date)
                : null;
            setSelectedDate(dateObj);
        },
        [setSelectedDate]
    );

    const logActivity = useCallback(
        async (
            outcome: Outcome,
            contact: ContactOption | null,
            comment: string,
            followUpDate: string | null,
            duration: number | null
        ) => {
            try {
                // For generic comments, we don't require a collection period
                if (
                    outcome !== "generic_comment" &&
                    !customer?.CustomerCollectionPeriod?.[0]
                ) {
                    return;
                }

                if (duration !== null && duration !== undefined) {
                    const durationNum = Number(duration);
                    if (isNaN(durationNum) || durationNum < 0) {
                        return;
                    }
                    duration = durationNum;
                }

                const requestBody = {
                    notes: comment,
                    follow_up_time:
                        selectedOutcome?.value === "schedule_follow_up"
                            ? getFollowUpUtcIsoFromCustomerTime(followUpDate)
                            : selectedOutcome?.value === "promise_to_pay"
                                ? selectedDate
                                : null,
                    contact: selectedContact
                        ? {
                            id: parseInt(selectedContact.value),
                            name: selectedContact.name,
                            phone: selectedContact.mobile,
                            company_id: customer?.company_id,
                            account_id: customer?.account_id,
                        }
                        : undefined,
                    duration,
                    call_direction: callType,
                    agent_name: session?.user?.name || "Agent",
                    timezone: currentUserTimezone,
                    call_outcome: outcome,
                };

                let activityData;
                try {
                    const response = await api.post(
                        `/entities/customers/${customer.id}/activity/log-call-activity`,
                        requestBody
                    );
                    activityData = response.data;
                } catch (error) {
                    const errorMessage =
                        error instanceof Error
                            ? error.message
                            : "Unknown network error";
                    throw new Error(`Network error: ${errorMessage}`);
                }

                if (
                    selectedOutcome?.value === "promise_to_pay" &&
                    !activityData
                ) {
                    try {
                        const activityResponse = await api.get(
                            `/entities/customers/${customer.id}/activity?limit=1&sort=created_at:desc`
                        );
                        const activityResult = activityResponse.data;

                        if (
                            activityResult.activities &&
                            activityResult.activities.length > 0
                        ) {
                            activityData = activityResult.activities[0];
                        }
                    } catch (_error) {
                        // Ignore error, as we'll handle it later
                    }
                }

                resetPortal();

                // Use the comprehensive refresh mechanism from parent component
                if (refreshTimeline) {
                    try {
                        await refreshTimeline();
                    } catch (_error) {
                        // Ignore refresh errors
                    }
                }
                toggleOpen();
            } catch (_error) {
                // Ignore error, as we'll handle it later
            }
        },
        [
            customer,
            callType,
            session?.user?.name,
            currentUserTimezone,
            customerTimezone,
            getFollowUpUtcIsoFromCustomerTime,
            resetPortal,
            toggleOpen,
            refreshTimeline,
        ]
    );

    const validateForm = () => {
        const errors: typeof validationErrors = {};

        if (!selectedOutcome) {
            errors.outcome = t("messages.log_activity_select_outcome_error", {
                ns: "activities",
            });
        }

        // Only require contact for non-generic comment outcomes
        if (!selectedContact && selectedOutcome?.value !== "generic_comment") {
            errors.contact = t("messages.log_activity_select_contact_error", {
                ns: "activities",
            });
        }

        if (selectedOutcome?.value === "schedule_follow_up" && !followUpDate) {
            errors.followUpDate = t(
                "messages.log_activity_select_follow_up_time_error",
                { ns: "activities" }
            );
        }

        if (selectedOutcome?.value === "promise_to_pay" && !selectedDate) {
            errors.paymentDate = t(
                "messages.log_activity_select_payment_date_error",
                { ns: "activities" }
            );
        }

        if (
            selectedOutcome?.value === "open_dispute" &&
            (!disputedInvoices || disputedInvoices.length === 0)
        ) {
            errors.disputedInvoices = t(
                "messages.log_activity_select_invoice_error",
                { ns: "activities" }
            );
        }

        if (selectedOutcome?.value === "open_dispute" && !disputeReason) {
            errors.disputeReason = t(
                "messages.log_activity_select_dispute_reason_error",
                { ns: "activities" }
            );
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };


    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {

            const requestBody = {
                notes: comment,
                follow_up_time:
                    selectedOutcome?.value === "schedule_follow_up"
                        ? getFollowUpUtcIsoFromCustomerTime(followUpDate)
                        : selectedOutcome?.value === "promise_to_pay"
                            ? selectedDate
                                ? moment(selectedDate).format("YYYY-MM-DD")
                                : null
                            : null,
                contact: selectedContact
                    ? {
                        id: parseInt(selectedContact.value),
                        name: selectedContact.name,
                        phone: selectedContact.mobile,
                        company_id: customer?.company_id,
                        account_id: customer?.account_id,
                    }
                    : undefined,
                duration: elapsedTime,
                call_direction: callType,
                agent_name: session?.user?.name || "Agent",
                timezone: currentUserTimezone,
                call_outcome: selectedOutcome?.value,
                disputed_invoices:
                    disputedInvoices.length > 0
                        ? disputedInvoices.map((invoice) => invoice.id)
                        : undefined,
                dispute_reason: disputeReason?.id || null,
            };

            let response;
            try {
                response = await apiFetch(`/api/entities/customers/${customer.id}/activity/log-call-activity`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        credentials: "include", // Include cookies for authentication
                        body: JSON.stringify(requestBody),
                    }
                );
            } catch (fetchError) {
                const errorMessage =
                    fetchError instanceof Error
                        ? fetchError.message
                        : "Unknown network error";
                throw new Error(`Network error: ${errorMessage}`);
            }

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (_parseError) {
                    errorData = {
                        message: `HTTP ${response.status}: ${response.statusText}`,
                    };
                }
                throw new Error(
                    errorData.message ||
                    `HTTP ${response.status}: ${response.statusText}`
                );
            }

            let activityData;
            try {
                activityData = await response.json();
            } catch (_parseError) {
                throw new Error("Invalid JSON response from server");
            }

            // Upload files if any are selected
            if (selectedFiles.length > 0 && activityData?.activity?.id) {
                try {
                    await uploadFiles(activityData.activity.id.toString());
                } catch (_uploadError) {
                    // Continue with the activity creation even if file upload fails
                }
            }

            if (selectedOutcome?.value === "promise_to_pay" && !activityData) {
                try {
                    const activityResponse = await api.get(
                        `/entities/customers/${customer.id}/activity?limit=1&sort=created_at:desc`
                    );
                    const activityResult = activityResponse.data;

                    if (
                        activityResult.activities &&
                        activityResult.activities.length > 0
                    ) {
                        activityData = activityResult.activities[0];
                    }
                } catch (_error) {
                    // Ignore error, as we'll handle it later
                }
            }

            // Use the comprehensive refresh mechanism from parent component
            if (refreshTimeline) {
                try {
                    await refreshTimeline();
                } catch (_error) {
                    // Silently handle refresh errors
                }
            }

            // Clear all form fields so next time the modal opens it is empty
            resetFormFields();
            toggleOpen();
        } catch (_error) {
            // Ignore error, as we'll handle it later
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (secs: number) => {
        const minutes = Math.floor(secs / 60);
        const seconds = secs % 60;
        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };

    const updateModalState = useCallback(
        (updates: Partial<typeof modalState>) => {
            setModalState((prev: typeof modalState) => ({
                ...prev,
                ...updates,
            }));
        },
        []
    );

    const refreshList = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: queryKeys.contacts,
        });
        await refetch();
    }, [queryClient, queryKeys.contacts, refetch]);

    let followUpDatePickerSection = null;
    if (selectedOutcome?.value === "schedule_follow_up") {
        followUpDatePickerSection = (
            <FormControl
                fullWidth
                required
                error={!!validationErrors.followUpDate}
                sx={{ mb: validationErrors.followUpDate ? 0 : 1 }}
            >
                <DateTimePicker
                    label={t("fields.log_activity_follow_up_time", {
                        ns: "activities",
                    })}
                    value={followUpDate ? moment(followUpDate) : null}
                    onChange={handleFollowUpDateChange}
                    minDate={moment()}
                    format={logActivityDateTimePickerFormat}
                    slotProps={{
                        textField: getLogActivityPickerTextFieldSlotProps({
                            error: !!validationErrors.followUpDate,
                            helperText: validationErrors.followUpDate,
                        }),
                    }}
                />
            </FormControl>
        );
    }

    let paymentDatePickerSection = null;
    if (showCalendar) {
        const dateRange = calculateLogActivityPromiseToPayDateRange(customer);

        if (dateRange.isMaxedOut) {
            paymentDatePickerSection = (
                <Typography
                    color="error"
                    variant="body2"
                    sx={{ fontSize: "0.875rem" }}
                >
                    {t("messages.log_activity_max_promises_reached", {
                        ns: "activities",
                        count:
                            customer?.CustomerCollectionPeriod?.[0]
                                ?.promise_to_pay_count ?? 0,
                        limit: (customer as any)?.Account?.promise_to_pay ?? 2,
                    })}
                </Typography>
            );
        } else {
            paymentDatePickerSection = (
                <FormControl
                    fullWidth
                    required
                    error={!!validationErrors.paymentDate}
                    sx={{ mb: validationErrors.paymentDate ? 0 : 1 }}
                >
                    <DatePicker
                        label={t("fields.log_activity_payment_date", {
                            ns: "activities",
                        })}
                        value={selectedDate ? moment(selectedDate) : null}
                        onChange={handlePaymentDateChange}
                        minDate={moment(dateRange.minDate)}
                        maxDate={moment(dateRange.maxDate)}
                        format={logActivityDatePickerFormat}
                        slotProps={{
                            textField: getLogActivityPickerTextFieldSlotProps({
                                error: !!validationErrors.paymentDate,
                                helperText: validationErrors.paymentDate,
                            }),
                        }}
                    />
                </FormControl>
            );
        }
    }

    // After fetching disputeReasons and invoiceResponse, map them to OptionType arrays
    // Map dispute reasons to show the name in the account/user's language preference
    const mappedDisputeReasonOptions: DisputeReasonOption[] = useMemo(() => {
        if (!disputeReasons?.disputeReasons) {
            return [];
        }

        // Get account language from session (e.g., "Hebrew" or "English")
        const accountLanguage = session?.user?.language;

        return disputeReasons.disputeReasons.map((reason) => {
            // Get the language-specific name based on account's language preference
            let displayName = reason.name || ""; // Fallback to default name

            // Try to find language-specific name using account language
            if (accountLanguage && reason.DisputeReasonLanguage) {
                const languages = (reason.DisputeReasonLanguage as any[]) || [];

                if (languages.length > 0) {
                    // Try exact match first
                    let languageTemplate = languages.find(
                        (lt: { language?: string; name?: string }) =>
                            lt.language === accountLanguage
                    );

                    // If no exact match, try case-insensitive match
                    if (!languageTemplate) {
                        languageTemplate = languages.find(
                            (lt: { language?: string; name?: string }) =>
                                lt.language?.toLowerCase() ===
                                accountLanguage?.toLowerCase()
                        );
                    }

                    if (languageTemplate?.name) {
                        displayName = languageTemplate.name;
                    }
                }
            }

            return {
                value: String(reason.id),
                label: displayName,
                id: reason.id,
            };
        });
    }, [disputeReasons, session?.user?.language]);

    const mappedInvoiceOptions: InvoiceOption[] = useMemo(() => {
        // Check if we have a valid response structure
        if (!invoiceResponse) {
            return [];
        }

        // The API returns an array directly, not an object with invoices property
        const invoices = invoiceResponse.invoices || [];

        // Check if invoices is an array
        if (!Array.isArray(invoices)) {
            return [];
        }

        // Additional safety check for empty array
        if (invoices.length === 0) {
            return [];
        }

        try {
            const options = invoices.map((invoice: any) => {
                // Handle invoice fields from the API response
                const invoiceNumber =
                    invoice.invoice_number || invoice.invoiceNumber || "";
                // Use customer_outstanding_debt for the amount (this is what the API returns)
                const amount =
                    invoice.customer_outstanding_debt ||
                    invoice.customer_amount ||
                    invoice.customerAmount ||
                    0;
                // Get currency from Customer or invoice
                const currency =
                    invoice.Customer?.customer_currency1 ||
                    invoice.customer_currency ||
                    invoice.customerCurrency ||
                    invoice.Customer?.customer_currency2 ||
                    "USD";
                const formattedAmount = amount
                    ? formatAmountWithoutSymbol(amount)
                    : "";

                return {
                    value: String(invoice.id),
                    label: `Invoice #${invoiceNumber}${formattedAmount ? ` - ${formattedAmount} ${currency}` : ""}`,
                    id: invoice.id,
                    invoice_number: invoiceNumber,
                    amount: amount || undefined,
                    customer_currency: currency,
                };
            });

            return options;
        } catch (_error) {
            return [];
        }
    }, [invoiceResponse]);

    // Filtered invoice options based on search term
    const filteredInvoiceOptions = useMemo(() => {
        // Safety check to ensure mappedInvoiceOptions is an array
        if (!Array.isArray(mappedInvoiceOptions)) {
            return [];
        }

        // Additional safety check for empty array
        if (mappedInvoiceOptions.length === 0) {
            return [];
        }

        if (!invoiceSearchTerm.trim()) {
            return mappedInvoiceOptions;
        }

        try {
            return mappedInvoiceOptions.filter(
                (invoice) =>
                    invoice.invoice_number
                        .toLowerCase()
                        .includes(invoiceSearchTerm.toLowerCase()) ||
                    invoice.label
                        .toLowerCase()
                        .includes(invoiceSearchTerm.toLowerCase()) ||
                    (invoice.amount &&
                        formatAmountWithoutSymbol(invoice.amount)
                            .toLowerCase()
                            .includes(invoiceSearchTerm.toLowerCase())) ||
                    (invoice.customer_currency &&
                        invoice.customer_currency
                            .toLowerCase()
                            .includes(invoiceSearchTerm.toLowerCase()))
            );
        } catch (_error) {
            return [];
        }
    }, [mappedInvoiceOptions, invoiceSearchTerm]);

    // Enhanced invoice selection handlers
    const handleInvoiceSelection = useCallback(
        (selectedValues: string[]) => {
            // Safety check to ensure mappedInvoiceOptions is an array
            if (!Array.isArray(mappedInvoiceOptions)) {
                setDisputedInvoices([]);
                return;
            }

            // Additional safety check for empty array
            if (mappedInvoiceOptions.length === 0) {
                setDisputedInvoices([]);
                return;
            }

            try {
                const selectedInvoices = mappedInvoiceOptions.filter(
                    (invoice) => selectedValues.includes(invoice.value)
                );

                // Ensure we're setting the state correctly
                setDisputedInvoices(selectedInvoices);

                // Don't clear search term immediately - let user continue selecting
                // Only clear if they explicitly close the dropdown or select all they need

                // Keep dropdown open for multiple selections
                // Don't close the dropdown automatically

                if (validationErrors.disputedInvoices) {
                    clearValidationError("disputedInvoices");
                }
            } catch (_error) {
                setDisputedInvoices([]);
            }
        },
        [
            mappedInvoiceOptions,
            validationErrors.disputedInvoices,
            clearValidationError,
        ]
    );

    const handleRemoveInvoice = useCallback(
        (invoiceValue: string) => {
            const updatedInvoices = disputedInvoices.filter(
                (invoice: InvoiceOption) => invoice.value !== invoiceValue
            );
            setDisputedInvoices(updatedInvoices);
        },
        [disputedInvoices, setDisputedInvoices]
    );

    const handleClearAllInvoices = useCallback(() => {
        setDisputedInvoices([]);
        setInvoiceSearchTerm("");
    }, []);

    // ============================================================================
    // BUSINESS HOURS VALIDATION
    // ============================================================================
    // Validates follow-up scheduling against contact's business hours
    // Only runs when both contact and follow-up time are selected
    useEffect(() => {
        // Clear warning if conditions are not met
        if (
            selectedOutcome?.value !== "schedule_follow_up" ||
            !followUpDate ||
            !selectedContact?.value ||
            !selectedContact?.name ||
            !selectedContact?.mobile
        ) {
            setBusinessHoursWarning(null);
            return;
        }

        // Add debouncing to prevent excessive calls
        const timeoutId = setTimeout(() => {
            const checkBusinessHours = async () => {
                try {
                    // Get contact availability from the business hours service
                    const businessHoursService =
                        BusinessHoursService.getInstance();

                    // Use the public scheduleWithBusinessHours method to check business hours
                    const schedulingResult =
                        await businessHoursService.scheduleWithBusinessHours(
                            followUpDate,
                            {
                                contactId: parseInt(selectedContact.value),
                                urgency: "normal",
                                channel: "phone",
                                businessHoursOnly: true,
                            }
                        );

                    // Determine contact timezone from the result
                    const contactTimezone =
                        schedulingResult.contactTimezone || "UTC";
                    const contactLocalTime =
                        moment(followUpDate).tz(contactTimezone);

                    // Check if within business hours using the result
                    const isOutsideBusinessHours =
                        !schedulingResult.isBusinessHours;

                    // Only show warning if time is outside business hours
                    if (isOutsideBusinessHours) {
                        const userLocale = getUserDateLocale(session);
                        const dateFormat =
                            userLocale === "he-IL"
                                ? "DD/MM/YYYY hh:mm A"
                                : "MM/DD/YYYY hh:mm A";

                        setBusinessHoursWarning({
                            isOutsideBusinessHours: true,
                            contactLocalTime:
                                contactLocalTime.format(dateFormat),
                            contactTimezone: contactTimezone,
                        });
                    } else {
                        // Time is within business hours - no warning needed
                        setBusinessHoursWarning(null);
                    }
                } catch (_error) {
                    setBusinessHoursWarning(null);
                }
            };

            checkBusinessHours();
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [
        selectedOutcome?.value,
        followUpDate,
        selectedContact?.value,
        session,
        t,
    ]);

    const [disputeReasonId, setDisputeReasonId] = useState<string>("");

    // Add click outside handler for invoice dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            // Check if the click is on a Material-UI dropdown menu
            const isMaterialUIMenu =
                target instanceof Element &&
                (target.closest(".MuiMenu-root") ||
                    target.closest(".MuiPopover-root") ||
                    target.closest(".MuiMenuItem-root") ||
                    target.closest(".MuiPaper-root"));

            // Close invoice dropdown if open and click is outside
            if (!isMaterialUIMenu && isInvoiceSelectOpen) {
                setIsInvoiceSelectOpen(false);
            }
        };

        // Only add listener if component is active/open
        if (isActive) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isActive, isInvoiceSelectOpen]);

    // Global effect to fix aria-hidden accessibility issues
    useEffect(() => {
        const fixAriaHiddenIssues = () => {
            // Find all elements with aria-hidden="true"
            const hiddenElements = document.querySelectorAll(
                '[aria-hidden="true"]'
            );

            const activeElement = document.activeElement as HTMLElement;
            if (!activeElement) return;

            hiddenElements.forEach((element) => {
                // Check if this element contains the focused element
                const isAncestorOfFocused = element.contains(activeElement);

                // Check if the focused element is interactive
                const isInteractiveElement =
                    activeElement.tagName === "BUTTON" ||
                    activeElement.tagName === "INPUT" ||
                    activeElement.tagName === "TEXTAREA" ||
                    activeElement.tagName === "SELECT" ||
                    activeElement.tagName === "A" ||
                    activeElement.getAttribute("role") === "button" ||
                    activeElement.getAttribute("role") === "menu" ||
                    activeElement.getAttribute("role") === "listbox" ||
                    activeElement.getAttribute("tabindex") !== null ||
                    activeElement.classList.contains("MuiButtonBase-root") ||
                    activeElement.classList.contains("MuiIconButton-root") ||
                    activeElement.classList.contains("MuiMenuItem-root") ||
                    activeElement.classList.contains("MuiAutocomplete-root") ||
                    activeElement.closest(".MuiDialog-root") !== null;

                // Check for Material-UI specific elements that might have focus issues
                const isMaterialUIElement =
                    element.classList.contains("MuiPopover-root") ||
                    element.classList.contains("MuiMenu-root") ||
                    element.classList.contains("MuiModal-root") ||
                    element.classList.contains("MuiDialog-root") ||
                    element.classList.contains("MuiBox-root") ||
                    element.classList.contains("MuiPaper-root");

                // Exception: Don't remove aria-hidden from backdrop elements
                const isBackdrop =
                    element.classList.contains("MuiBackdrop-root") ||
                    element.getAttribute("data-backdrop") === "true";

                // If this element contains a focused interactive element and it's a MUI element (not backdrop)
                if (
                    isAncestorOfFocused &&
                    isInteractiveElement &&
                    isMaterialUIElement &&
                    !isBackdrop
                ) {
                    // Remove aria-hidden to prevent accessibility violation
                    element.removeAttribute("aria-hidden");
                }
            });

            // Also ensure the LogActivity dialog itself doesn't have aria-hidden when it's open
            if (isActive) {
                const logActivityDialog = document.querySelector(
                    '[aria-labelledby="log-activity-dialog-title"]'
                ) as HTMLElement;
                if (logActivityDialog) {
                    const dialogParent = logActivityDialog.closest(
                        '[aria-hidden="true"]'
                    ) as HTMLElement;
                    if (dialogParent && !dialogParent.classList.contains("MuiBackdrop-root")) {
                        dialogParent.removeAttribute("aria-hidden");
                    }
                }
            }
        };

        // Run immediately
        fixAriaHiddenIssues();

        // Set up mutation observer to watch for changes
        const observer = new MutationObserver((mutations) => {
            let shouldFix = false;

            mutations.forEach((mutation) => {
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "aria-hidden"
                ) {
                    shouldFix = true;
                }
            });

            if (shouldFix) {
                // Use requestAnimationFrame to ensure DOM is updated
                requestAnimationFrame(fixAriaHiddenIssues);
            }
        });

        // Observe the entire document for attribute changes
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["aria-hidden"],
            subtree: true,
        });

        // Also listen for focus events to catch dynamic focus changes
        const handleFocus = () => {
            // Use a small delay to ensure DOM is updated
            setTimeout(() => {
                requestAnimationFrame(fixAriaHiddenIssues);
            }, 0);
        };

        document.addEventListener("focusin", handleFocus, true);
        document.addEventListener("focusout", handleFocus, true);

        // Also run fix when focus changes to catch aria-hidden issues
        const handleFocusChange = () => {
            // Small delay to ensure DOM is updated
            setTimeout(() => {
                fixAriaHiddenIssues();
            }, 0);
        };

        document.addEventListener("focusin", handleFocusChange, true);

        return () => {
            observer.disconnect();
            document.removeEventListener("focusin", handleFocus, true);
            document.removeEventListener("focusout", handleFocus, true);
            document.removeEventListener("focusin", handleFocusChange, true);
        };
    }, [isActive]);

    // Restore focus to LogActivity dialog when nested contact modal closes
    useEffect(() => {
        if (isActive && !modalState.showContactModal) {
            // Small delay to let the nested modal fully close and DOM update
            const timeoutId = setTimeout(() => {
                const logActivityDialog = document.querySelector(
                    '[aria-labelledby="log-activity-dialog-title"]'
                ) as HTMLElement;

                if (logActivityDialog) {
                    // Remove aria-hidden from dialog and its parents if present
                    let current: HTMLElement | null = logActivityDialog;
                    while (current && current !== document.body) {
                        if (current.getAttribute("aria-hidden") === "true") {
                            current.removeAttribute("aria-hidden");
                        }
                        current = current.parentElement;
                    }

                    // Find the first focusable element in the dialog
                    const focusableElements = logActivityDialog.querySelectorAll(
                        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
                    );

                    if (focusableElements.length > 0) {
                        const firstFocusable = focusableElements[0] as HTMLElement;
                        // Use requestAnimationFrame to ensure DOM is ready
                        requestAnimationFrame(() => {
                            firstFocusable.focus();
                        });
                    }
                }
            }, 150);

            return () => clearTimeout(timeoutId);
        }
    }, [isActive, modalState.showContactModal]);

    const onCreateContact = async (contact: {
        id: number;
        first_name: string | null;
        last_name: string | null;
        phone?: string | null;
    }) => {

        const fullName = combineFirstLastNames(
            contact.first_name || "",
            contact.last_name || ""
        );

        const newContact: ContactOption = {
            value: String(contact.id),
            label: contact.phone ? `${fullName} - ${contact.phone}` : fullName,
            name: fullName,
            mobile: contact.phone || null,
        };
        setSelectedContact(newContact);

        await new Promise((resolve) => setTimeout(resolve, 100));

        if (customer?.id) {
            try {
                await logActivity(
                    "add_new_contact",
                    newContact,
                    `New contact created: ${fullName}`,
                    null,
                    null
                );
            } catch (_error) {
            }
        }
    };

    const handleDisputeReasonChange = useCallback(
        (newValue: DisputeReasonOption | null) => {
            if (newValue) {
                setDisputeReasonId(newValue.value);
                const reason = disputeReasons?.disputeReasons.find(
                    (r) => String(r.id) === newValue.value
                );
                setDisputeReason(reason || null);

                if (validationErrors.disputeReason) {
                    clearValidationError("disputeReason");
                }
            } else {
                setDisputeReasonId("");
                setDisputeReason(null);
            }
        },
        [
            disputeReasons?.disputeReasons,
            validationErrors.disputeReason,
            clearValidationError,
        ]
    );

    const renderLogActivityDisputeReasonOption = useCallback(
        (
            _props: React.HTMLAttributes<HTMLLIElement> & {
                key: string | number;
            },
            option: DisputeReasonOption
        ) => (
            <Typography
                variant="body2"
                sx={{
                    width: "100%",
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                }}
            >
                {option.label}
            </Typography>
        ),
        [isRTL]
    );

    const selectedDisputeReasonOption = useMemo(
        () =>
            mappedDisputeReasonOptions.find(
                (option) => option.value === disputeReasonId
            ) ?? null,
        [mappedDisputeReasonOptions, disputeReasonId]
    );

    // File upload handlers
    const handleFileSelected = (file: File) => {
        setSelectedFiles((prev) => [...prev, file]);
    };

    const handleFileRemoved = (file: File) => {
        setSelectedFiles((prev) => prev.filter((f) => f !== file));
    };

    const uploadFiles = async (activityId: string) => {
        if (selectedFiles.length === 0) return;

        setIsUploadingFiles(true);
        try {
            const formData = new FormData();
            formData.append("activityId", activityId);

            selectedFiles.forEach((file) => {
                formData.append("files", file);
            });

            const response = await apiFetch("/api/activity-attachments", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to upload files");
            }

            const result = await response.json();

            // Clear selected files after successful upload
            setSelectedFiles([]);

            // Refresh the timeline to show the new attachments
            if (refreshTimeline) {
                await refreshTimeline();
            }
        } catch (_error) {
            // You might want to show an error message to the user here
        } finally {
            setIsUploadingFiles(false);
        }
    };



    const resetFormFields = useCallback(() => {
        setSelectedContact(null);
        setSelectedOutcome(null);
        setComment("");
        setFollowUpDate(null);
        setSelectedDate(null);
        setShowCalendar(false);
        setElapsedTime(0);
        setCallType(null);
        setIsCalling(false);
        setDisputeReasonId("");
        setDisputedInvoices([]);
        setDisputeReason(null);
        setValidationErrors({});
        setBusinessHoursWarning(null);
        setSelectedFiles([]);
        setInvoiceSearchTerm("");
        setIsInvoiceSelectOpen(false);
        resetPortal();
    }, [resetPortal]);

    const handleCloseLogActivity = useCallback(() => {
        resetFormFields();
        toggleOpen();
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement?.blur) {
            activeElement.blur();
        }
    }, [toggleOpen, resetFormFields]);

    return (
        <>
            <AppDialog
                open={isActive}
                onClose={handleCloseLogActivity}
                drag
                align
                slide
                isRTL={isRTL}
                paperWidth="400px"
                paperMaxHeight="90vh"
                title={
                    <>
                        <Box
                            component="span"
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: theme.spacing(1),
                            }}
                        >
                            <ScheduleIcon aria-hidden="true" />
                            {t("fields.log_activity_log_activity", {
                                ns: "activities",
                            })}
                        </Box>
                        {selectedOutcome?.value !== "generic_comment" && (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: { xs: 0.5, sm: 1 },
                                    px: { xs: 0.75, sm: 1 },
                                    py: { xs: 0.5, sm: 0.75 },
                                    borderRadius: 1,
                                    minWidth: { xs: "70px", sm: "80px" },
                                    maxWidth: { xs: "90px", sm: "100px" },
                                    justifyContent: "flex-end",
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 600,
                                        fontFamily: "monospace",
                                        textAlign: "right",
                                    }}
                                >
                                    {formatTime(elapsedTime)}
                                </Typography>
                            </Box>
                        )}
                    </>
                }
                titleIcon={null}
                ariaLabelledBy="log-activity-dialog-title"
                ariaDescribedBy="log-activity-dialog-description"
                actions={
                    <>
                        <Button
                            onClick={handleCloseLogActivity}
                            variant="outlined"
                            size="small"
                            className="cancel-button"
                            fullWidth={false}
                            disabled={loading}
                            sx={{
                                mr: isRTL ? 0 : theme.spacing(1),
                                ml: isRTL ? theme.spacing(1) : 0,
                            }}
                        >
                            {t("actions.cancel", { ns: "common" })}
                        </Button>
                        <Button
                            type="submit"
                            form="log-activity-form"
                            variant="contained"
                            size="small"
                            className="save-button"
                            fullWidth={false}
                            disabled={loading}
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
                }
            >
                <form
                    id="log-activity-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSave();
                    }}
                    noValidate
                    dir={isRTL ? "rtl" : "ltr"}
                >
                    <Box
                        id="log-activity-dialog-description"
                        component="div"
                        role="region"
                        aria-label={t("fields.log_activity_log_activity", {
                            ns: "activities",
                        })}
                        sx={{
                            paddingTop: theme.spacing(2),
                            direction: isRTL ? "rtl" : "ltr",
                            flex: "1 1 auto",
                            minHeight: 0,
                            overflow: "auto",
                        }}
                    >
                        <Stack spacing={{ xs: 1.5, sm: 2 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: {
                                        xs: "column",
                                        sm: "row",
                                    },
                                    alignItems: {
                                        xs: "stretch",
                                        sm: "flex-start",
                                    },
                                    gap: { xs: 0.5, sm: 0.75 },
                                    mb: { xs: 1, sm: 1.25 },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: "100%",
                                        display: "flex",
                                        gap: 1,
                                        alignItems: "flex-start",
                                    }}
                                >
                                    {selectedOutcome?.value !==
                                        "generic_comment" && (
                                            <Box
                                                sx={{
                                                    width: "calc(100% - 100px)",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <ToolbarDropdownFilter<ContactOption>
                                                    value={selectedContact}
                                                    onOpen={
                                                        handleContactDropdownOpen
                                                    }
                                                    onChange={
                                                        handleLogActivityContactChange
                                                    }
                                                    options={contactOptions}
                                                    getOptionLabel={(option) =>
                                                        option.label
                                                    }
                                                    isOptionEqualToValue={(
                                                        option,
                                                        v
                                                    ) =>
                                                        option.value === v.value
                                                    }
                                                    disabled={
                                                        contactOptions.length ===
                                                        0
                                                    }
                                                    label={t(
                                                        "fields.log_activity_contact",
                                                        { ns: "activities" }
                                                    )}
                                                    placeholder={t(
                                                        "fields.log_activity_select_contact",
                                                        { ns: "activities" }
                                                    )}
                                                    error={
                                                        !!validationErrors.contact
                                                    }
                                                    required
                                                    fullWidth
                                                    noOptionsText={t(
                                                        "fields.log_activity_no_contacts_available",
                                                        { ns: "activities" }
                                                    )}
                                                    renderOption={
                                                        renderLogActivityContactOption
                                                    }
                                                />
                                                {validationErrors.contact && (
                                                    <FormHelperText
                                                        error
                                                        sx={{ mb: 0, mt: 0.5 }}
                                                    >
                                                        <Box
                                                            component="span"
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 0.5,
                                                            }}
                                                        >
                                                            <ErrorIcon fontSize="small" />
                                                            {
                                                                validationErrors.contact
                                                            }
                                                        </Box>
                                                    </FormHelperText>
                                                )}
                                            </Box>
                                        )}
                                    {selectedOutcome?.value !==
                                        "generic_comment" && (
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: { xs: 0.5, sm: 1 },
                                                    flexShrink: 0,
                                                    width: "100px",
                                                    justifyContent: "flex-end",
                                                }}
                                            >
                                                <IconButton
                                                    color={
                                                        isCalling
                                                            ? "error"
                                                            : callType ===
                                                                "outgoing"
                                                                ? "primary"
                                                                : "default"
                                                    }
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isCalling) {
                                                            setIsCalling(false);
                                                            setCallType(null);
                                                        } else {
                                                            setCallType(
                                                                "outgoing"
                                                            );
                                                            setIsCalling(true);
                                                        }
                                                    }}
                                                    title={
                                                        isCalling
                                                            ? t(
                                                                "fields.log_activity_end_call",
                                                                {
                                                                    ns: "activities",
                                                                }
                                                            )
                                                            : t(
                                                                "fields.log_activity_outgoing_call",
                                                                {
                                                                    ns: "activities",
                                                                }
                                                            )
                                                    }
                                                    disabled={
                                                        !isCalling &&
                                                        !selectedContact
                                                    }
                                                >
                                                    {isCalling ? (
                                                        <CallEndIcon />
                                                    ) : (
                                                        <CallMadeIcon />
                                                    )}
                                                </IconButton>
                                                {!isCalling && (
                                                    <IconButton
                                                        color={
                                                            callType ===
                                                                "incoming"
                                                                ? "primary"
                                                                : "default"
                                                        }
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCallType(
                                                                "incoming"
                                                            );
                                                            setIsCalling(true);
                                                        }}
                                                        title={t(
                                                            "fields.log_activity_incoming_call",
                                                            { ns: "activities" }
                                                        )}
                                                    >
                                                        <CallReceivedIcon />
                                                    </IconButton>
                                                )}
                                            </Box>
                                        )}
                                </Box>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: {
                                        xs: "column",
                                        sm: "row",
                                    },
                                    alignItems: {
                                        xs: "stretch",
                                        sm: "flex-start",
                                    },
                                    gap: { xs: 0.5, sm: 0.75 },
                                    mb: { xs: 1, sm: 1.25 },
                                }}
                            >
                                <Box sx={{ width: "100%" }}>
                                    <ToolbarDropdownFilter<OutcomeOption>
                                        value={selectedOutcome}
                                        onChange={handleLogActivityOutcomeChange}
                                        options={filteredOutcomeOptions}
                                        getOptionLabel={(option) => option.label}
                                        isOptionEqualToValue={(option, v) =>
                                            option.value === v.value
                                        }
                                        label={t("fields.log_activity_outcome", {
                                            ns: "activities",
                                        })}
                                        placeholder={t(
                                            "fields.log_activity_select_outcome",
                                            { ns: "activities" }
                                        )}
                                        error={!!validationErrors.outcome}
                                        required
                                        fullWidth
                                        renderOption={
                                            renderLogActivityOutcomeOption
                                        }
                                    />
                                </Box>
                            </Box>
                            {followUpDatePickerSection}
                            {businessHoursWarning && (
                                <Box
                                    sx={{
                                        border: 1,
                                        borderColor: "error.main",
                                        borderRadius: 1,
                                        p: 1.5,
                                        backgroundColor: "error.50",
                                        mt: 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            mb: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {t(
                                                "messages.log_activity_business_hours_warning",
                                                {
                                                    ns: "activities",
                                                    time: businessHoursWarning.contactLocalTime,
                                                }
                                            )}
                                        </Typography>
                                        <Typography
                                            component="span"
                                            sx={{
                                                fontWeight: 600,
                                                color: "error.main",
                                                ml: 0.5,
                                                display: "flex",
                                                alignItems: "center",
                                            }}
                                        >
                                            ❌{" "}
                                            {t(
                                                "messages.log_activity_outside_business_hours",
                                                { ns: "activities" }
                                            )}
                                        </Typography>
                                    </Box>

                                    <Typography
                                        variant="caption"
                                        color="warning.main"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            fontSize: "0.75rem",
                                        }}
                                    >
                                        ⚠️{" "}
                                        {t(
                                            "messages.log_activity_business_hours_suggestion",
                                            { ns: "activities" }
                                        )}
                                    </Typography>

                                    <Box
                                        sx={{
                                            mt: 1,
                                            pt: 1,
                                            borderTop: 1,
                                            borderColor: "divider",
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ fontSize: "0.7rem" }}
                                        >
                                            📞{" "}
                                            {t(
                                                "messages.log_activity_default_business_hours",
                                                { ns: "activities" }
                                            )}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                            {paymentDatePickerSection}
                            {selectedOutcome?.value === "open_dispute" && (
                                <Stack spacing={2} sx={{ width: "100%", mb: 1 }}>
                                    <Box sx={{ width: "100%" }}>
                                        <FormControl
                                            fullWidth
                                            required
                                            size="small"
                                            sx={{ mb: 0 }}
                                            error={
                                                !!validationErrors.disputedInvoices
                                            }
                                            dir={isRTL ? "rtl" : "ltr"}
                                            {...(isRTL && {
                                                "data-hebrew": true,
                                                "data-rtl": true,
                                            })}
                                        >
                                            <InputLabel
                                                id="disputed-invoices-label"
                                                shrink
                                            >
                                                {t(
                                                    "fields.log_activity_relevant_invoices",
                                                    { ns: "activities" }
                                                )}
                                            </InputLabel>
                                            <Select<string[]>
                                                    labelId="disputed-invoices-label"
                                                    id="disputed-invoices"
                                                    multiple
                                                    open={
                                                        isInvoiceSelectOpen
                                                    }
                                                    onOpen={() =>
                                                        setIsInvoiceSelectOpen(
                                                            true
                                                        )
                                                    }
                                                    onClose={() =>
                                                        setIsInvoiceSelectOpen(
                                                            false
                                                        )
                                                    }
                                                    value={
                                                        disputedInvoices?.map(
                                                            (invoice) =>
                                                                invoice.value
                                                        ) || []
                                                    }
                                                    onChange={(event) => {
                                                        const selectedValues =
                                                            event.target
                                                                .value as string[];
                                                        handleInvoiceSelection(
                                                            selectedValues
                                                        );
                                                        // Prevent the dropdown from closing by keeping it open
                                                        setIsInvoiceSelectOpen(
                                                            true
                                                        );
                                                    }}
                                                    displayEmpty
                                                    input={
                                                        <OutlinedInput
                                                            size="small"
                                                            notched
                                                            label={t(
                                                                "fields.log_activity_relevant_invoices",
                                                                {
                                                                    ns: "activities",
                                                                }
                                                            )}
                                                            className="input-toolbar-labeled"
                                                        />
                                                    }
                                                    renderValue={(
                                                        _selected: string[]
                                                    ) => (
                                                        <>
                                                            <Box
                                                                sx={{
                                                                    display:
                                                                        "flex",
                                                                    alignItems: "center",
                                                                    flexWrap:
                                                                        "wrap",
                                                                    gap: 0.5,
                                                                    height: "100%",
                                                                    maxHeight: 60,
                                                                    overflow:
                                                                        "auto",
                                                                    // Padding to avoid overlap with clear button
                                                                    pr:
                                                                        disputedInvoices.length >
                                                                            0
                                                                            ? isRTL
                                                                                ? "0"
                                                                                : "56px"
                                                                            : 0,
                                                                    pl:
                                                                        disputedInvoices.length >
                                                                            0
                                                                            ? isRTL
                                                                                ? "56px"
                                                                                : "0"
                                                                            : 0,
                                                                }}
                                                            >
                                                                {disputedInvoices.length ===
                                                                    0 ? (
                                                                    <Typography
                                                                        variant="body2"
                                                                        color="text.secondary"
                                                                    >
                                                                        {t(
                                                                            "fields.log_activity_select_invoices",
                                                                            {
                                                                                ns: "activities",
                                                                            }
                                                                        )}
                                                                    </Typography>
                                                                ) : (
                                                                    disputedInvoices.map(
                                                                        (
                                                                            invoice
                                                                        ) => (
                                                                            <Chip
                                                                                key={
                                                                                    invoice.value
                                                                                }
                                                                                label={
                                                                                    invoice.label
                                                                                }
                                                                                size="small"
                                                                                onDelete={() =>
                                                                                    handleRemoveInvoice(
                                                                                        invoice.value
                                                                                    )
                                                                                }
                                                                            />
                                                                        )
                                                                    )
                                                                )}
                                                            </Box>
                                                            {disputedInvoices.length >
                                                                0 && (
                                                                    <IconButton
                                                                        onClick={(
                                                                            e
                                                                        ) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            handleClearAllInvoices();
                                                                            setIsInvoiceSelectOpen(
                                                                                false
                                                                            );
                                                                        }}
                                                                        onMouseDown={(
                                                                            e
                                                                        ) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                        }}
                                                                        onFocus={(
                                                                            e
                                                                        ) => {
                                                                            if (
                                                                                isInvoiceSelectOpen
                                                                            ) {
                                                                                e.currentTarget.blur();
                                                                            }
                                                                        }}
                                                                        size="small"
                                                                        tabIndex={
                                                                            isInvoiceSelectOpen
                                                                                ? -1
                                                                                : 0
                                                                        }
                                                                        aria-hidden={
                                                                            isInvoiceSelectOpen
                                                                        }
                                                                        sx={{
                                                                            position:
                                                                                "absolute",
                                                                            // Position relative to Select input container, to the left of dropdown icon
                                                                            right:
                                                                                i18n.language ===
                                                                                    "he"
                                                                                    ? "auto"
                                                                                    : "32px",
                                                                            left:
                                                                                i18n.language ===
                                                                                    "he"
                                                                                    ? "36px"
                                                                                    : "auto",
                                                                            top: "50%",
                                                                            transform:
                                                                                "translateY(-50%)",
                                                                            height: "28px",
                                                                            width: "28px",
                                                                            zIndex: 1,
                                                                            "& .MuiSvgIcon-root":
                                                                            {
                                                                                fontSize:
                                                                                    "1.5rem !important",
                                                                            },
                                                                        }}
                                                                    >
                                                                        <ClearIcon />
                                                                    </IconButton>
                                                                )}
                                                        </>
                                                    )}
                                                    MenuProps={{
                                                        PaperProps: {
                                                            sx: {
                                                                maxHeight: 300,
                                                                direction: isRTL
                                                                    ? "rtl"
                                                                    : "ltr",
                                                            },
                                                        },
                                                        keepMounted: true, // Keep the menu mounted to prevent closing
                                                        disablePortal: false,
                                                        onClose: (
                                                            event,
                                                            reason
                                                        ) => {
                                                            // Only close if the user explicitly closes it (not on selection)
                                                            if (
                                                                reason ===
                                                                "escapeKeyDown" ||
                                                                reason ===
                                                                "backdropClick" ||
                                                                reason ===
                                                                "tabKeyDown"
                                                            ) {
                                                                setIsInvoiceSelectOpen(
                                                                    false
                                                                );
                                                                // Clear search term when dropdown is actually closed
                                                                setTimeout(
                                                                    () => {
                                                                        setInvoiceSearchTerm(
                                                                            ""
                                                                        );
                                                                    },
                                                                    100
                                                                );
                                                            }
                                                            // Ensure focus is properly managed when menu closes
                                                            setTimeout(
                                                                () => {
                                                                    const selectElement =
                                                                        document.getElementById(
                                                                            "disputed-invoices"
                                                                        );
                                                                    if (
                                                                        selectElement
                                                                    ) {
                                                                        selectElement.blur();
                                                                    }
                                                                    // Enhanced aria-hidden cleanup
                                                                    const menuElements =
                                                                        document.querySelectorAll(
                                                                            '[aria-hidden="true"]'
                                                                        );
                                                                    menuElements.forEach(
                                                                        (
                                                                            el
                                                                        ) => {
                                                                            if (
                                                                                el.classList.contains(
                                                                                    "MuiPopover-root"
                                                                                ) ||
                                                                                el.classList.contains(
                                                                                    "MuiMenu-root"
                                                                                ) ||
                                                                                el.classList.contains(
                                                                                    "MuiModal-root"
                                                                                ) ||
                                                                                el.classList.contains(
                                                                                    "MuiDialog-root"
                                                                                )
                                                                            ) {
                                                                                // Check if element contains focused content
                                                                                const hasFocusedContent =
                                                                                    el.querySelector(
                                                                                        ":focus"
                                                                                    ) ||
                                                                                    (document.activeElement &&
                                                                                        el.contains(
                                                                                            document.activeElement
                                                                                        ));
                                                                                if (
                                                                                    hasFocusedContent
                                                                                ) {
                                                                                    el.removeAttribute(
                                                                                        "aria-hidden"
                                                                                    );
                                                                                }
                                                                            }
                                                                        }
                                                                    );
                                                                },
                                                                0
                                                            );
                                                        },
                                                    }}
                                                >
                                                    {/* Search Input */}
                                                    <Box
                                                        sx={{
                                                            p: 1,
                                                            borderBottom: 1,
                                                            borderColor:
                                                                "divider",
                                                        }}
                                                    >
                                                        <TextField
                                                            size="small"
                                                            placeholder={t(
                                                                "fields.search_placeholder",
                                                                {
                                                                    ns: "common",
                                                                }
                                                            )}
                                                            value={
                                                                invoiceSearchTerm
                                                            }
                                                            onChange={(e) =>
                                                                setInvoiceSearchTerm(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            dir={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr"
                                                            }
                                                            {...(i18n.language ===
                                                                "he" && {
                                                                "data-hebrew": true,
                                                            })}
                                                            fullWidth
                                                            InputProps={{
                                                                startAdornment:
                                                                    (
                                                                        <InputAdornment position="start">
                                                                            <SearchIcon
                                                                                fontSize="small"
                                                                                color="action"
                                                                            />
                                                                        </InputAdornment>
                                                                    ),
                                                                endAdornment:
                                                                    invoiceSearchTerm && (
                                                                        <InputAdornment position="end">
                                                                            <IconButton
                                                                                onClick={() =>
                                                                                    setInvoiceSearchTerm(
                                                                                        ""
                                                                                    )
                                                                                }
                                                                            >
                                                                                <ClearIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </InputAdornment>
                                                                    ),
                                                            }}
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                            onKeyDown={(
                                                                e
                                                            ) =>
                                                                e.stopPropagation()
                                                            }
                                                        />
                                                    </Box>

                                                    {/* Invoice Options */}
                                                    {filteredInvoiceOptions.length >
                                                        0 ? (
                                                        filteredInvoiceOptions.map(
                                                            (invoice) => {
                                                                const isSelected =
                                                                    disputedInvoices.some(
                                                                        (
                                                                            selected
                                                                        ) =>
                                                                            selected.value ===
                                                                            invoice.value
                                                                    );
                                                                return (
                                                                    <MenuItem
                                                                        key={
                                                                            invoice.value
                                                                        }
                                                                        value={
                                                                            invoice.value
                                                                        }
                                                                        sx={{
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            gap: 1,
                                                                            py: 1,
                                                                        }}
                                                                    >
                                                                        <Checkbox
                                                                            checked={
                                                                                isSelected
                                                                            }
                                                                            sx={{
                                                                                p: 0,
                                                                            }}
                                                                        />
                                                                        <ListItemText
                                                                            primary={
                                                                                invoice.label
                                                                            }
                                                                            primaryTypographyProps={{
                                                                                fontSize:
                                                                                    "0.875rem",
                                                                            }}
                                                                        />
                                                                    </MenuItem>
                                                                );
                                                            }
                                                        )
                                                    ) : (
                                                        <MenuItem
                                                            disabled
                                                            sx={{
                                                                py: 2,
                                                                textAlign:
                                                                    "center",
                                                            }}
                                                        >
                                                            {invoiceSearchTerm
                                                                ? t(
                                                                    "fields.log_activity_no_invoices_found",
                                                                    {
                                                                        ns: "activities",
                                                                    }
                                                                )
                                                                : t(
                                                                    "fields.log_activity_no_invoices_available",
                                                                    {
                                                                        ns: "activities",
                                                                    }
                                                                )}
                                                        </MenuItem>
                                                    )}
                                                </Select>
                                            {validationErrors.disputedInvoices && (
                                                <FormHelperText
                                                    error
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    <Box
                                                        component="span"
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 0.5,
                                                        }}
                                                    >
                                                        <ErrorIcon fontSize="small" />
                                                        {
                                                            validationErrors.disputedInvoices
                                                        }
                                                    </Box>
                                                </FormHelperText>
                                            )}
                                        </FormControl>
                                    </Box>

                                    <Box sx={{ width: "100%" }}>
                                        <ToolbarDropdownFilter<DisputeReasonOption>
                                            value={selectedDisputeReasonOption}
                                            onChange={handleDisputeReasonChange}
                                            options={mappedDisputeReasonOptions}
                                            getOptionLabel={(option) =>
                                                option.label
                                            }
                                            isOptionEqualToValue={(option, v) =>
                                                option.value === v.value
                                            }
                                            disabled={
                                                mappedDisputeReasonOptions.length ===
                                                0
                                            }
                                            label={t(
                                                "fields.log_activity_dispute_reason",
                                                { ns: "activities" }
                                            )}
                                            placeholder={t(
                                                "fields.log_activity_select_dispute_reason",
                                                { ns: "activities" }
                                            )}
                                            error={
                                                !!validationErrors.disputeReason
                                            }
                                            required
                                            fullWidth
                                            noOptionsText={t(
                                                "messages.no_dispute_reasons_available",
                                                { ns: "activities" }
                                            )}
                                            renderOption={
                                                renderLogActivityDisputeReasonOption
                                            }
                                        />
                                        {validationErrors.disputeReason && (
                                            <FormHelperText
                                                error
                                                sx={{ mt: 0.5 }}
                                            >
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 0.5,
                                                    }}
                                                >
                                                    <ErrorIcon fontSize="small" />
                                                    {
                                                        validationErrors.disputeReason
                                                    }
                                                </Box>
                                            </FormHelperText>
                                        )}
                                    </Box>
                                </Stack>
                            )}
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: {
                                        xs: "column",
                                        sm: "row",
                                    },
                                    alignItems: {
                                        xs: "stretch",
                                        sm: "flex-start",
                                    },
                                    gap: { xs: 0.5, sm: 0.75 },
                                    mb: 2, // Add margin bottom to prevent overlap
                                }}
                            >
                                <Box sx={{ width: "100%" }}>
                                    <TextField
                                        id="comment"
                                        label={t(
                                            "fields.log_activity_comment",
                                            { ns: "activities" }
                                        )}
                                        multiline
                                        rows={4}
                                        value={comment}
                                        onChange={(e) =>
                                            setComment(e.target.value)
                                        }
                                        placeholder={t(
                                            "fields.log_activity_add_note",
                                            { ns: "activities" }
                                        )}
                                        dir={
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr"
                                        }
                                        {...(i18n.language === "he" && {
                                            "data-hebrew": true,
                                            multiline: true,
                                        })}
                                        fullWidth
                                        sx={{
                                            mb: 0.5,
                                            "& .MuiInputBase-root": {
                                                overflowY: "auto",
                                            },
                                            "& .MuiInputBase-input": {
                                                overflowY: "auto",
                                            },
                                            "& textarea": {
                                                overflowY: "auto",
                                                scrollbarWidth: "thin",
                                                scrollbarColor: `${alpha(theme.palette.primary.main, 0.6)} ${alpha(theme.palette.primary.main, 0.1)}`,
                                                "&::-webkit-scrollbar": {
                                                    width: "8px",
                                                },
                                                "&::-webkit-scrollbar-track": {
                                                    backgroundColor: alpha(
                                                        theme.palette.primary.main,
                                                        0.1
                                                    ),
                                                    borderRadius: "4px",
                                                    overflow: "hidden",
                                                },
                                                "&::-webkit-scrollbar-thumb": {
                                                    backgroundColor: alpha(
                                                        theme.palette.primary.main,
                                                        0.6
                                                    ),
                                                    borderRadius: "4px",
                                                    transition:
                                                        "background-color 0.2s ease-in-out",
                                                    "&:hover": {
                                                        backgroundColor:
                                                            theme.palette.primary.main,
                                                    },
                                                },
                                            },
                                        }}
                                    />
                                </Box>
                            </Box>

                            {/* File Upload Section */}
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: {
                                        xs: "column",
                                        sm: "row",
                                    },
                                    alignItems: {
                                        xs: "stretch",
                                        sm: "flex-start",
                                    },
                                    gap: { xs: 1, sm: 2 },
                                }}
                            >
                                <Box sx={{ width: "100%" }}>
                                    <ActivityFileUploader
                                        onFileSelected={handleFileSelected}
                                        onFileRemoved={handleFileRemoved}
                                        selectedFiles={selectedFiles}
                                        isUploading={isUploadingFiles}
                                        maxFileSize={5 * 1024 * 1024} // 5MB
                                        maxFiles={5}
                                    />
                                </Box>
                            </Box>
                        </Stack>
                    </Box>
                </form >
            </AppDialog >
            <MakePaymentModal
                isOpen={modalState.showPaymentModal}
                setIsOpen={(value: SetStateAction<boolean>) => {
                    if (typeof value === "function") {
                        setModalState((prev) => ({
                            ...prev,
                            showPaymentModal: value(prev.showPaymentModal),
                        }));
                    } else {
                        setModalState((prev) => ({
                            ...prev,
                            showPaymentModal: value,
                        }));
                    }
                }}
                accountId={customer?.account_id ?? null}
                customerId={customer?.id ?? null}
                customer={customer}
                onPaymentInitiated={() =>
                    updateModalState({ paymentMade: true })
                }
            />
            <UpsertContactModal
                isOpen={modalState.showContactModal}
                closeModal={() => updateModalState({ showContactModal: false })}
                initialContact={undefined}
                companyId={Number(customer?.company_id)}
                customerId={customer?.id ?? 0}
                accountId={customer?.account_id}
                onCreateContact={onCreateContact}
            />
            <UpdateResolutionModal
                customerId={customer?.id ?? 0}
                isModalOpen={modalState.isUpdateResolutionModalOpen}
                setIsModalOpen={(value: SetStateAction<boolean>) => {
                    if (typeof value === "function") {
                        setModalState((prev) => ({
                            ...prev,
                            isUpdateResolutionModalOpen: value(
                                prev.isUpdateResolutionModalOpen
                            ),
                        }));
                    } else {
                        setModalState((prev) => ({
                            ...prev,
                            isUpdateResolutionModalOpen: value,
                        }));
                    }
                }}
                disputeResolution={modalState.initialResolution}
                setDisputeResolution={(val: string) => {
                    updateModalState({ initialResolution: val });
                }}
                resolutionOptions={[
                    { value: "Denied", label: "Denied" },
                    {
                        value: "Accepted - Settled partly",
                        label: "Accepted - Settled partly",
                    },
                    {
                        value: "Accepted -  Settled in full",
                        label: "Accepted - Settled in full",
                    },
                    { value: "Cancelled", label: "Cancelled" },
                    {
                        value: "Admin Fixed – Balance Unchanged",
                        label: "Admin Fixed – Balance Unchanged",
                    },
                ]}
                title={t("sections.log_activity_update_resolution", {
                    ns: "activities",
                })}
            />
        </>
    );
};

export default LogActivity;
