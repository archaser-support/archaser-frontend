"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    ArrowBack as ArrowBackIcon,
    ArrowForward as ArrowForwardIcon,
    CheckCircle as CheckCircleIcon,
    Edit as EditIcon,
    Receipt as ReceiptIcon,
    Send as SendIcon,
    Warning as WarningIcon,
} from "@mui/icons-material";
import {
    Alert,
    AlertTitle,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    Fade,
    FormControl,
    MenuItem,
    Select,
    Stack,
    Step,
    StepLabel,
    Stepper,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { getPortalCardSx, PORTAL_CARD_CLASS } from "@/app/theme/portalCard";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInvoiceColumns } from "@/shared/components/portal/invoiceColumns";
import InvoiceDisplay from "@/shared/components/portal/InvoiceDisplay";
import { PortalInvoice } from "@/types/PortalInvoice";
import { broadcast } from "@/utils/broadcast";
import { BROADCAST_CONSTANTS } from "@/utils/constants";
import { PortalUrls } from "@/utils/portalUrlUtils";

// Types
type Reason = {
    id: number;
    name: string;
    editable: boolean | null;
};

type InvoiceSelectorProps = {
    invoices: PortalInvoice[];
    customer_id: number;
    reasons: Reason[];
    customerUUID: string;
    sub_domain: string | null;
    isStandalone?: boolean;
    hasDisputedInvoices?: boolean;
    onRefreshInvoices?: () => void;
};

type ValidationErrors = {
    invoices: boolean;
    reason: boolean;
    message: boolean;
};

type SubmittedData = {
    selectedInvoicesCount: number;
    totalAmount: string;
    reasonName: string;
    currency: string;
    disputeMessage: string;
    selectedInvoiceNumbers: string[];
};

// Constants
const STEPS = [
    "fields.dispute_creation_step_select_invoices",
    "fields.dispute_creation_step_provide_details",
    "fields.dispute_creation_step_submit",
] as const;

const STEPS_COUNT = STEPS.length;

export default function InvoiceSelector({
    invoices,
    customer_id,
    reasons,
    customerUUID,
    sub_domain,
    isStandalone = false,
    hasDisputedInvoices = false,
    onRefreshInvoices,
}: InvoiceSelectorProps) {
    const theme = useTheme();
    // State
    const [selectedInvoices, setSelectedInvoices] = useState<Set<number>>(
        new Set()
    );
    const [disputeMessage, setDisputeMessage] = useState("");
    const [disputeReason, setDisputeReason] = useState("");
    const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
        invoices: false,
        reason: false,
        message: false,
    });
    const [submittedData, setSubmittedData] = useState<SubmittedData | null>(
        null
    );

    // Hooks
    const { t, i18n } = useTranslation([
        "portal",
        "disputes",
        "invoices",
        "common",
    ]);
    const router = useRouter();
    const columns = useInvoiceColumns();

    // Memoized values
    const steps = useMemo(() => STEPS.map((step) => t(step)), [t]);
    const isSubmitDisabled = selectedInvoices.size === 0;

    // Use the hasDisputedInvoices prop to determine if there are available invoices
    const hasAvailableInvoices = useMemo(() => {
        return invoices.length > 0;
    }, [invoices]);

    const selectedAmount = useMemo(() => {
        return invoices
            .filter((inv) => selectedInvoices.has(inv.id))
            .reduce((sum, inv) => sum + (inv.customerAmount || 0), 0)
            .toFixed(2);
    }, [invoices, selectedInvoices]);

    const selectedCurrency = useMemo(() => {
        const selectedInvoicesList = invoices.filter((inv) =>
            selectedInvoices.has(inv.id)
        );
        if (selectedInvoicesList.length === 0) return "";

        // Get the currency from the first selected invoice
        return selectedInvoicesList[0].customerCurrency || "";
    }, [invoices, selectedInvoices]);

    // Handlers
    const handleSubmit = useCallback(async () => {
        setValidationErrors({
            invoices: false,
            reason: false,
            message: false,
        });

        const errors = {
            invoices: selectedInvoices.size === 0,
            reason: !disputeReason,
            message: !disputeMessage.trim(),
        };

        setValidationErrors(errors);

        if (errors.invoices || errors.reason || errors.message) {
            return;
        }

        try {
            setIsLoading(true);
            const selectedInvoiceNumbers = invoices
                .filter((invoice) => selectedInvoices.has(invoice.id))
                .map((invoice) => invoice.invoiceNumber);

            // Log dispute submission details for debugging

            // Get Captcha token
            const { getCaptchaToken } = await import("@/utils/captchaFrontendUtils");
            const captchaToken = await getCaptchaToken("create_dispute");

            const response = await apiFetch("/api/portal/create-dispute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dispute_type: "invoice",
                    dispute_comment: disputeMessage,
                    dispute_reason_id: disputeReason,
                    customer_id,
                    invoices_in_dispute: selectedInvoiceNumbers.join(" ,"),
                    captchaToken,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const submittedDataObj = {
                selectedInvoicesCount: selectedInvoices.size,
                totalAmount: selectedAmount,
                reasonName:
                    reasons.find((r) => r.id.toString() === disputeReason)
                        ?.name || "",
                currency: selectedCurrency,
                disputeMessage: disputeMessage,
                selectedInvoiceNumbers: selectedInvoiceNumbers,
            };

            // Set submitted data for success display
            setSubmittedData(submittedDataObj);

            setSelectedInvoices(new Set());
            setDisputeMessage("");
            setDisputeReason("");
            setIsSubmitSuccess(true);
            setCurrentStep(2);

            broadcast.postMessage({
                type: BROADCAST_CONSTANTS.REFRESH_TIMELINE,
                data: {
                    customerId: customer_id,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (error) {
            // Handle dispute submission error
        } finally {
            setIsLoading(false);
        }
    }, [
        selectedInvoices,
        disputeMessage,
        disputeReason,
        customer_id,
        invoices,
        selectedAmount,
        reasons,
        onRefreshInvoices,
    ]);

    const handleClose = useCallback(() => {
        setIsSubmitSuccess(false);
        setCurrentStep(0);
        setSubmittedData(null);

        // Refresh the invoice list to exclude newly disputed invoices
        // This happens when user closes the success page and wants to create another dispute
        if (onRefreshInvoices) {
            onRefreshInvoices();
        }
    }, [onRefreshInvoices]);

    const handleViewDisputes = useCallback(() => {
        const customerLanguage = i18n.language === "he" ? "Hebrew" : "English";
        router.push(PortalUrls.disputes(customerUUID, customerLanguage));
    }, [router, customerUUID, i18n.language]);

    const handleGoToHomepage = useCallback(() => {
        const customerLanguage = i18n.language === "he" ? "Hebrew" : "English";
        router.push(PortalUrls.home(customerUUID, customerLanguage));
    }, [router, customerUUID, i18n.language]);

    const toggleInvoiceSelection = useCallback((invoiceId: number) => {
        setSelectedInvoices((prev) => {
            const updated = new Set(prev);
            if (updated.has(invoiceId)) {
                updated.delete(invoiceId);
            } else {
                updated.add(invoiceId);
            }
            return updated;
        });
    }, []);

    const toggleAllInvoices = useCallback(
        (checked: boolean) => {
            setSelectedInvoices(
                checked
                    ? new Set(invoices.map((invoice) => invoice.id))
                    : new Set()
            );
        },
        [invoices]
    );

    const handleReasonChange = useCallback(
        (value: string) => {
            setDisputeReason(value);
            if (validationErrors.reason) {
                setValidationErrors((prev) => ({ ...prev, reason: false }));
            }
        },
        [validationErrors.reason]
    );

    const handleMessageChange = useCallback(
        (value: string) => {
            setDisputeMessage(value);
            if (validationErrors.message) {
                setValidationErrors((prev) => ({ ...prev, message: false }));
            }
        },
        [validationErrors.message]
    );

    // Error states
    if (customer_id === 0) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "calc(100vh - 200px)",
                    p: 3,
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                <Card sx={{ textAlign: "center" }}>
                    <CardContent sx={{ p: 4 }}>
                        <WarningIcon
                            sx={{ fontSize: 64, color: "error.main", mb: 2 }}
                        />
                        <Typography
                            variant="h5"
                            sx={{ mb: 2, fontWeight: 600 }}
                        >
                            {t("messages.dispute_creation_account_not_found")}
                        </Typography>
                        <Typography
                            variant="body1"
                            color="text.secondary"
                            sx={{ mb: 3 }}
                        >
                            {t("fields.dispute_account_not_found_description")}
                        </Typography>
                        <Alert severity="info">
                            <AlertTitle>
                                {t("fields.dispute_creation_contact_support")}
                            </AlertTitle>
                            {t("messages.general_assist_message")}
                        </Alert>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    // Only show the blocking message if there are NO invoices available AND there's an active dispute
    if (invoices.length === 0 && hasDisputedInvoices) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "400px",
                    p: 0,
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                <Card sx={{ textAlign: "center" }}>
                    <CardContent sx={{ p: 4 }}>
                        <Box
                            sx={{
                                width: 80,
                                height: 80,
                                borderRadius: "50%",
                                backgroundColor: "rgba(107, 70, 193, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                mb: 2,
                                mx: "auto",
                            }}
                        >
                            <WarningIcon
                                sx={{
                                    fontSize: 48,
                                    color: "primary.main",
                                    display: "block",
                                }}
                            />
                        </Box>
                        <Typography
                            variant="h5"
                            sx={{
                                mb: 3,
                                fontWeight: 600,
                                color: "#1F2937",
                            }}
                        >
                            {t("fields.dispute_creation_active_dispute")}
                        </Typography>
                        <Button
                            onClick={handleViewDisputes}
                            variant="contained"
                            size="medium"
                        >
                            {t("actions.invoices_under_review")}
                        </Button>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    // Show success message if no invoices and no active dispute (all paid)
    if (invoices.length === 0 && !hasDisputedInvoices) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "400px",
                    p: 0,
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                <Card sx={{ textAlign: "center" }}>
                    <CardContent sx={{ p: 4 }}>
                        <Box
                            sx={{
                                width: 80,
                                height: 80,
                                borderRadius: "50%",
                                backgroundColor: "rgba(16, 185, 129, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                mb: 2,
                                mx: "auto",
                            }}
                        >
                            <CheckCircleIcon
                                sx={{
                                    fontSize: 48,
                                    color: "success.main",
                                    display: "block",
                                }}
                            />
                        </Box>
                        <Typography
                            variant="h5"
                            sx={{ mb: 2, fontWeight: 600 }}
                        >
                            {t("messages.dispute_creation_all_invoices_paid")}
                        </Typography>
                        <Typography
                            variant="body1"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            {t(
                                "messages.dispute_creation_no_outstanding_invoices_description"
                            )}
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    // Render functions
    const renderProgress = () => (
        <Box sx={{ mb: 4, direction: i18n.language === "he" ? "rtl" : "ltr" }}>
            <Stepper
                activeStep={currentStep}
                alternativeLabel={true}
                sx={{
                    "& .MuiStepLabel-root .Mui-completed": {
                        color: "success.main",
                    },
                    "& .MuiStepLabel-root .Mui-active": {
                        color: "primary.main",
                    },
                    // Fix RTL stepper layout
                    ...(i18n.language === "he" && {
                        flexDirection: "row-reverse",
                    }),
                }}
            >
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>
        </Box>
    );

    const renderInvoiceSelection = () => (
        <Fade in={currentStep === 0} timeout={300}>
            <Box>
                <Box
                    sx={{
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                        py: 2,
                        mb: 3,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 2,
                        px: 4,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            flexWrap: "wrap",
                        }}
                    >
                        <Chip
                            label={t("actions.selected_invoices_count", {
                                count: selectedInvoices.size,
                                ns: "portal",
                            })}
                            color={
                                selectedInvoices.size > 0
                                    ? "primary"
                                    : "default"
                            }
                            icon={
                                selectedInvoices.size > 0 ? (
                                    <CheckCircleIcon />
                                ) : undefined
                            }
                            sx={{
                                fontWeight: 600,
                                fontSize: "1rem",
                                py: 1.5,
                                px: 2,
                                "& .MuiChip-label": {
                                    px: 1,
                                },
                            }}
                        />
                    </Box>

                    {selectedInvoices.size > 0 && (
                        <Button
                            onClick={() => setCurrentStep(1)}
                            endIcon={
                                i18n.language === "he" ? (
                                    <ArrowBackIcon />
                                ) : (
                                    <ArrowForwardIcon />
                                )
                            }
                            size="medium"
                            variant="contained"
                            sx={{
                                "& .MuiButton-endIcon": {
                                    ml: i18n.language === "he" ? 0 : 1,
                                    mr: i18n.language === "he" ? 1 : 0,
                                },
                            }}
                        >
                            {t("actions.dispute_creation_continue_to_details")}
                        </Button>
                    )}

                    {validationErrors.invoices && (
                        <Alert severity="error" sx={{ mt: 2, width: "100%" }}>
                            {t("actions.please_select_at_least_one_invoice")}
                        </Alert>
                    )}
                </Box>

                <InvoiceDisplay
                    invoices={invoices}
                    columns={columns}
                    isSelectable={true}
                    selectedInvoices={selectedInvoices}
                    onInvoiceSelect={toggleInvoiceSelection}
                    onSelectAll={toggleAllInvoices}
                    showSelectAll={true}
                    mobileBreakpoint={1200}
                    emptyMessage={t("fields.no_invoices_found")}
                />
            </Box>
        </Fade>
    );

    const renderDisputeForm = () => (
        <Fade in={currentStep === 1} timeout={300}>
            <Box>
                <Card
                    className={PORTAL_CARD_CLASS}
                    elevation={0}
                    sx={{
                        ...getPortalCardSx(theme),
                        p: 4,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <Stack spacing={4}>
                        <Box>
                            <Typography
                                variant="h6"
                                sx={{
                                    mb: 2,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <ReceiptIcon color="primary" />
                                {t("actions.select_reason", { ns: "portal" })} *
                            </Typography>
                            <FormControl
                                fullWidth
                                error={validationErrors.reason}
                            >
                                <Select
                                    value={disputeReason}
                                    onChange={(e) =>
                                        handleReasonChange(e.target.value)
                                    }
                                    displayEmpty
                                    sx={{
                                        borderRadius: 2,
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        "& .MuiSelect-select": {
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            paddingRight:
                                                i18n.language === "he"
                                                    ? "32px"
                                                    : "14px",
                                            paddingLeft:
                                                i18n.language === "he"
                                                    ? "14px"
                                                    : "32px",
                                        },
                                        "& .MuiSelect-icon": {
                                            right:
                                                i18n.language === "he"
                                                    ? "auto"
                                                    : "14px",
                                            left:
                                                i18n.language === "he"
                                                    ? "14px"
                                                    : "auto",
                                        },
                                    }}
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                "& .MuiMenuItem-root": {
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    paddingRight:
                                                        i18n.language === "he"
                                                            ? "16px"
                                                            : "16px",
                                                    paddingLeft:
                                                        i18n.language === "he"
                                                            ? "16px"
                                                            : "16px",
                                                },
                                            },
                                        },
                                    }}
                                >
                                    <MenuItem value="" disabled>
                                        {t("actions.select_reason", {
                                            ns: "portal",
                                        })}
                                    </MenuItem>
                                    {reasons.map((reason) => (
                                        <MenuItem
                                            key={reason.id}
                                            value={reason.id.toString()}
                                        >
                                            {reason.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {validationErrors.reason && (
                                    <Typography
                                        variant="caption"
                                        color="error"
                                        sx={{ mt: 1, display: "block" }}
                                    >
                                        {t(
                                            "actions.please_select_a_reason_for_the_dispute"
                                        )}
                                    </Typography>
                                )}
                            </FormControl>
                        </Box>

                        <Divider />

                        <Box>
                            <Typography
                                variant="h6"
                                sx={{
                                    mb: 2,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <EditIcon color="primary" />
                                {t(
                                    "messages.dispute_creation_dispute_message"
                                )}{" "}
                                *
                            </Typography>
                            <Box>
                                <textarea
                                    value={disputeMessage}
                                    onChange={(e) =>
                                        handleMessageChange(e.target.value)
                                    }
                                    placeholder={t(
                                        "actions.enter_dispute_message"
                                    )}
                                    rows={3}
                                    style={{
                                        width: "100%",
                                        minHeight: "120px",
                                        padding: "16px 14px",
                                        border: validationErrors.message
                                            ? "1px solid #d32f2f"
                                            : "1px solid rgba(0, 0, 0, 0.23)",
                                        borderRadius: "8px",
                                        fontSize: "1rem",
                                        fontFamily: "inherit",
                                        lineHeight: "1.5",
                                        resize: "vertical",
                                        outline: "none",
                                        backgroundColor: "transparent",
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor =
                                            validationErrors.message
                                                ? "#d32f2f"
                                                : "#1976d2";
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor =
                                            validationErrors.message
                                                ? "#d32f2f"
                                                : "rgba(0, 0, 0, 0.23)";
                                    }}
                                />
                                <Typography
                                    variant="caption"
                                    color={
                                        validationErrors.message
                                            ? "error"
                                            : "text.secondary"
                                    }
                                    sx={{ mt: 1, display: "block" }}
                                >
                                    {validationErrors.message
                                        ? t("messages.dispute_message_required")
                                        : ""}
                                </Typography>
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                display: "flex",
                                gap: 2,
                                justifyContent: "space-between",
                                pt: 2,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <Button
                                variant="outlined"
                                onClick={() => setCurrentStep(0)}
                                startIcon={
                                    i18n.language === "he" ? (
                                        <ArrowForwardIcon />
                                    ) : (
                                        <ArrowBackIcon />
                                    )
                                }
                                size="medium"
                                sx={{
                                    "& .MuiButton-startIcon": {
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    },
                                }}
                            >
                                {t("actions.back", { ns: "common" })}
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSubmit}
                                disabled={isSubmitDisabled || isLoading}
                                endIcon={
                                    i18n.language === "he" ? (
                                        <SendIcon
                                            sx={{ transform: "scaleX(-1)" }}
                                        />
                                    ) : (
                                        <SendIcon />
                                    )
                                }
                                size="medium"
                                sx={{
                                    "& .MuiButton-endIcon": {
                                        ml: i18n.language === "he" ? 0 : 1,
                                        mr: i18n.language === "he" ? 1 : 0,
                                    },
                                }}
                            >
                                {t("actions.dispute_creation_submit_dispute")}
                            </Button>
                        </Box>
                    </Stack>
                </Card>
            </Box>
        </Fade>
    );

    const renderSuccess = () => (
        <Fade in={isSubmitSuccess} timeout={500}>
            <Card
                className={PORTAL_CARD_CLASS}
                elevation={0}
                sx={{
                    ...getPortalCardSx(theme),
                    p: 5,
                    textAlign: "center",
                    background:
                        "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                    color: "#1a202c",
                    position: "relative",
                    overflow: "hidden",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                <Box
                    sx={{
                        position: "absolute",
                        top: -20,
                        right: -20,
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        backgroundColor: "rgba(0,0,0,0.02)",
                        zIndex: 0,
                    }}
                />

                <Box sx={{ position: "relative", zIndex: 1 }}>
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            mb: 3,
                        }}
                    >
                        <Box
                            sx={{
                                width: 100,
                                height: 100,
                                borderRadius: "50%",
                                backgroundColor: "rgba(16, 185, 129, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <CheckCircleIcon
                                sx={{ fontSize: 60, color: "#10b981" }}
                            />
                        </Box>
                    </Box>

                    <Typography
                        variant="h3"
                        sx={{
                            mb: 2,
                            fontWeight: 700,
                            color: "#1a202c",
                            fontSize: {
                                xs: "1.5rem",
                                sm: "2rem",
                                md: "2.25rem",
                            },
                        }}
                    >
                        {t("actions.dispute_submitted_successfully")}
                    </Typography>

                    <Typography
                        variant="body2"
                        sx={{
                            mb: 3,
                            color: "#4a5568",
                            fontSize: "0.875rem",
                            lineHeight: 1.6,
                        }}
                    >
                        {t("messages.dispute_creation_thank_you_message")}
                    </Typography>

                    <Card
                        className={PORTAL_CARD_CLASS}
                        elevation={0}
                        sx={{
                            ...getPortalCardSx(theme),
                            mb: 4,
                            backgroundColor: alpha(theme.palette.success.main, 0.05),
                            border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                            color: "#1a202c",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            p: 3,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Typography
                            variant="h6"
                            sx={{
                                mb: 2,
                                fontWeight: 600,
                                color: "#1a202c",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                            }}
                        >
                            {t(
                                "sections.dispute_creation_dispute_summary_title"
                            )}
                        </Typography>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ color: "#4a5568" }}
                            >
                                <strong>{t("fields.invoice_numbers")}:</strong>{" "}
                                {submittedData?.selectedInvoiceNumbers?.join(
                                    ", "
                                ) || t("fields.dispute_creation_not_available")}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: "#4a5568" }}
                            >
                                <strong>{t("fields.total_amount")}:</strong>{" "}
                                {submittedData?.currency}{" "}
                                {submittedData?.totalAmount || "0.00"}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: "#4a5568" }}
                            >
                                <strong>{t("actions.select_reason")}:</strong>{" "}
                                {submittedData?.reasonName ||
                                    t("fields.dispute_creation_not_available")}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: "#4a5568" }}
                            >
                                <strong>{t("fields.comments")}:</strong>{" "}
                                {submittedData?.disputeMessage ||
                                    t("fields.dispute_creation_not_available")}
                            </Typography>
                        </Box>
                    </Card>

                    {hasAvailableInvoices === false && (
                        <Alert
                            severity="info"
                            sx={{ mb: 3, textAlign: "left" }}
                        >
                            <AlertTitle>
                                {t("fields.dispute_no_more_invoices_available")}
                            </AlertTitle>
                            {t("messages.general_assist_message")}
                        </Alert>
                    )}

                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            alignItems: "center",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        {
                            <>
                                {hasAvailableInvoices && (
                                    <Button
                                        variant="contained"
                                        onClick={handleClose}
                                        size="medium"
                                    >
                                        {t("actions.create_another_dispute")}
                                    </Button>
                                )}
                                <Button
                                    variant={
                                        hasAvailableInvoices
                                            ? "outlined"
                                            : "contained"
                                    }
                                    onClick={handleGoToHomepage}
                                    size="medium"
                                >
                                    {t("actions.go_to_homepage")}
                                </Button>
                            </>
                        }
                    </Box>
                </Box>
            </Card>
        </Fade>
    );

    // Main render
    if (isSubmitSuccess) {
        return renderSuccess();
    }

    return (
        <Box sx={{ pb: 3, direction: i18n.language === "he" ? "rtl" : "ltr" }}>
            {renderProgress()}

            <Box sx={{ minHeight: "400px" }}>
                {currentStep === 0 && renderInvoiceSelection()}
                {currentStep === 1 && renderDisputeForm()}
            </Box>
        </Box>
    );
}
