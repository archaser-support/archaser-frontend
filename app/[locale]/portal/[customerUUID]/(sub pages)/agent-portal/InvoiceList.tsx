"use client";
import { apiFetch } from "@/utils/apiFetch";
import {
    Box,
    Typography,
    Button,
    Container,
    Stepper,
    Step,
    StepLabel,
    FormControl,
    Select,
    MenuItem,
    TextField,
} from "@mui/material";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { useInvoiceColumns } from "@/shared/components/portal/invoiceColumns";
import InvoiceDisplay from "@/shared/components/portal/InvoiceDisplay";
import { useMobileDetection } from "@/shared/hooks/useMobileDetection";
import { PortalInvoice } from "@/types/PortalInvoice";

type Reason = {
    id: number;
    name: string;
    editable: boolean | null;
};

type InvoiceListProps = {
    invoices: PortalInvoice[];
    customer_id: number;
    reasons: Reason[];
    onRefreshInvoices?: () => void;
};

export default function InvoiceList({
    invoices,
    customer_id,
    reasons,
    onRefreshInvoices,
}: InvoiceListProps) {
    const { t, i18n } = useTranslation(["portal", "invoices", "common"]);
    const [selectedInvoices, setSelectedInvoices] = useState<Set<number>>(
        new Set()
    );
    const [disputeMessage, setDisputeMessage] = useState("");
    const [disputeReason, setDisputeReason] = useState("");
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const isMobile = useMobileDetection(768);
    const columns = useInvoiceColumns();
    const totalSteps = 3;

    const handleNext = () => {
        if (currentStep === 1 && selectedInvoices.size === 0) {
            alert(t("fields.please_select_at_least_one_invoice"));
            return;
        }
        if (currentStep === 2 && !disputeReason) {
            alert(t("fields.please_select_a_reason_for_the_dispute"));
            return;
        }
        setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    };

    const handlePrevious = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    const toggleInvoiceSelection = (id: number) => {
        setSelectedInvoices((prev) => {
            const updated = new Set(prev);
            if (updated.has(id)) {
                updated.delete(id);
            } else {
                updated.add(id);
            }
            return updated;
        });
    };

    const toggleAllInvoices = (checked: boolean) => {
        setSelectedInvoices(
            checked ? new Set(invoices.map((invoice) => invoice.id)) : new Set()
        );
    };

    const handleSubmit = async () => {
        try {
            setIsLoading(true);
            const invoices_numbers = invoices.filter((invoice) =>
                selectedInvoices.has(invoice.id)
            );

            const response = await apiFetch("/api/portal/create-dispute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dispute_type: "invoice",
                    dispute_comment: disputeMessage,
                    dispute_reason_id: disputeReason,
                    customer_id,
                    invoices_in_dispute: invoices_numbers
                        .map((invoice) => invoice.invoiceNumber)
                        .join(" ,"),
                }),
            });

            if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);
            setSelectedInvoices(new Set());
            setDisputeMessage("");
            setDisputeReason("");
            setCurrentStep(1);
            setIsSubmitSuccess(true);
        } catch (error) {
            alert(t("fields.error_logging_dispute_please_try_again_later"));
        } finally {
            setIsLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <Box>
                        <Typography
                            variant="h6"
                            sx={{ mb: 3, textAlign: "center" }}
                        >
                            {t("fields.which_invoices_should_we_review")}
                        </Typography>
                        <InvoiceDisplay
                            invoices={invoices}
                            columns={columns}
                            isSelectable={true}
                            selectedInvoices={selectedInvoices}
                            onInvoiceSelect={toggleInvoiceSelection}
                            onSelectAll={toggleAllInvoices}
                            showSelectAll={true}
                            emptyMessage={t("fields.no_invoices_found")}
                        />
                    </Box>
                );
            case 2:
                return (
                    <Box sx={{ maxWidth: 600, mx: "auto" }}>
                        <Typography
                            variant="h6"
                            sx={{ mb: 3, textAlign: "center" }}
                        >
                            {t(
                                "portal.please_choose_your_reason_for_your_dispute_to_proceed"
                            )}
                        </Typography>
                        <FormControl fullWidth>
                            <Select
                                value={disputeReason}
                                onChange={(e) =>
                                    setDisputeReason(e.target.value)
                                }
                                displayEmpty
                                sx={{
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
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
                                    {t("fields.select_reason")}
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
                        </FormControl>
                    </Box>
                );
            case 3:
                return (
                    <Box sx={{ maxWidth: 600, mx: "auto" }}>
                        <Typography
                            variant="h6"
                            sx={{ mb: 3, textAlign: "center" }}
                        >
                            {t(
                                "portal.please_provide_a_brief_explanation_of_your_dispute_to_help_us_understand_your_claim_more_effectively"
                            )}
                        </Typography>
                        <TextField
                            multiline
                            rows={4}
                            value={disputeMessage}
                            onChange={(e) => setDisputeMessage(e.target.value)}
                            placeholder={t("fields.enter_dispute_message")}
                            variant="outlined"
                            fullWidth
                            {...(i18n.language === "he" && {
                                "data-hebrew": true,
                                multiline: true,
                            })}
                        />
                    </Box>
                );
            default:
                return null;
        }
    };

    if (isSubmitSuccess) {
        return (
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Box sx={{ textAlign: "center" }}>
                    <Typography
                        variant="h5"
                        sx={{ mb: 2, color: "success.main" }}
                    >
                        {t("fields.dispute_submitted_successfully")}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 3 }}>
                        {t("fields.dispute_submitted_message")}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={() => {
                            setIsSubmitSuccess(false);
                            // Refresh the invoice list to exclude newly disputed invoices
                            if (onRefreshInvoices) {
                                onRefreshInvoices();
                            }
                        }}
                    >
                        {t("fields.close")}
                    </Button>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ mb: 4 }}>
                <Typography
                    variant="h4"
                    sx={{ mb: 2, textAlign: "center", fontWeight: 600 }}
                >
                    {t("fields.create_dispute")}
                </Typography>

                {/* Stepper */}
                <Stepper activeStep={currentStep - 1} sx={{ mb: 4 }}>
                    <Step>
                        <StepLabel>{t("fields.select_invoices")}</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>{t("fields.choose_reason")}</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>{t("fields.provide_details")}</StepLabel>
                    </Step>
                </Stepper>
            </Box>

            {/* Step Content */}
            <Box sx={{ mb: 4 }}>{renderStepContent()}</Box>

            {/* Navigation Buttons */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    maxWidth: 600,
                    mx: "auto",
                }}
            >
                <Button
                    variant="outlined"
                    onClick={handlePrevious}
                    disabled={currentStep === 1}
                >
                    {t("fields.previous")}
                </Button>

                {currentStep === totalSteps ? (
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={isLoading}
                    >
                        {isLoading
                            ? t("fields.submitting")
                            : t("fields.submit")}
                    </Button>
                ) : (
                    <Button variant="contained" onClick={handleNext}>
                        {t("fields.next")}
                    </Button>
                )}
            </Box>
        </Container>
    );
}
