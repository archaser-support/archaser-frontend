"use client";
import { apiFetch } from "@/utils/apiFetch";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { Receipt as ReceiptIcon } from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
    Box,
    Button,
    CircularProgress,
    TextField,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import moment, { Moment } from "moment";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getDatePickerFormat } from "@/utils/datetimeOperations";

const DIALOG_TITLE_ID = "bulk-mark-credit-invoices-reported-title";
const DIALOG_DESC_ID = "bulk-mark-credit-invoices-reported-desc";
const FORM_ID = "bulk-mark-credit-invoices-reported-form";

export type BulkMarkInvoicesReportedDialogProps = {
    open: boolean;
    onClose: () => void;
    invoiceIds: number[];
    onSuccess: () => void;
};

export function BulkMarkInvoicesReportedDialog({
    open,
    onClose,
    invoiceIds,
    onSuccess,
}: BulkMarkInvoicesReportedDialogProps) {
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const { data: session } = useSession();
    const theme = useTheme();
    const { showToast } = useToast();
    const isRTL = i18n.language === "he";

    const [actualReportingDate, setActualReportingDate] = useState("");
    const [reportingRefComment, setReportingRefComment] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveAttempted, setSaveAttempted] = useState(false);

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

    useEffect(() => {
        if (!open) {
            return;
        }
        setSaveAttempted(false);
        setActualReportingDate(moment().format("YYYY-MM-DD"));
        setReportingRefComment("");
    }, [open, invoiceIds.length]);

    const isActualDateMissing = !actualReportingDate.trim();
    const showActualDateError = saveAttempted && isActualDateMissing;

    const handleClose = () => {
        if (!saving) {
            onClose();
        }
    };

    const handleSave = async () => {
        if (invoiceIds.length === 0) {
            return;
        }
        if (isActualDateMissing) {
            setSaveAttempted(true);
            return;
        }

        setSaving(true);
        try {
            const res = await apiFetch("/api/credit-insurance/mark-reported-bulk", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invoice_ids: invoiceIds,
                    actual_reporting_date: actualReportingDate.trim(),
                    reporting_comment: reportingRefComment.trim() || null,
                }),
            });
            const json = (await res.json()) as {
                error?: string;
                updatedCount?: number;
            };
            if (!res.ok) {
                throw new Error(json.error ?? "Request failed");
            }
            showToast(
                t("credit_insurance_report.bulk_mark_success", {
                    count: json.updatedCount ?? invoiceIds.length,
                }),
                "success"
            );
            onSuccess();
            onClose();
        } catch (e: unknown) {
            const message =
                e instanceof Error
                    ? e.message
                    : t("messages.error", { ns: "common" });
            showToast(message, "error");
        } finally {
            setSaving(false);
        }
    };

    const actualReportingDateLabel = t(
        "credit_insurance_reporting.actual_reporting_date",
        { ns: "dashboard" }
    );

    const reportingDateValue: Moment | null = useMemo(() => {
        const s = actualReportingDate.trim();
        if (!s) {
            return null;
        }
        const m = moment(s, "YYYY-MM-DD", true);
        return m.isValid() ? m : null;
    }, [actualReportingDate]);

    const datePickerFormat = useMemo(
        () => getDatePickerFormat(session, "DD/MM/YYYY"),
        [session]
    );

    return (
        <AppDialog
            open={open}
            onClose={handleClose}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="400px"
            paperMaxHeight="90vh"
            title={t("credit_insurance_report.bulk_mark_title")}
            titleIcon={<ReceiptIcon aria-hidden="true" />}
            ariaLabelledBy={DIALOG_TITLE_ID}
            ariaDescribedBy={DIALOG_DESC_ID}
            keepMounted
            actions={
                <>
                    <Button
                        type="button"
                        onClick={handleClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        disabled={saving}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        type="submit"
                        form={FORM_ID}
                        variant="contained"
                        size="small"
                        className="save-button"
                        disabled={saving || invoiceIds.length === 0}
                        endIcon={
                            saving ? (
                                <CircularProgress size={16} sx={{ color: "inherit" }} />
                            ) : undefined
                        }
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
                id={FORM_ID}
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleSave();
                }}
                dir={isRTL ? "rtl" : "ltr"}
            >
                <Box
                    id={DIALOG_DESC_ID}
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: theme.spacing(2),
                    }}
                >
                    <Typography variant="body2" color="text.secondary">
                        {t("credit_insurance_report.bulk_mark_description", {
                            count: invoiceIds.length,
                        })}
                    </Typography>
                    <DatePicker
                        format={datePickerFormat}
                        label={`${actualReportingDateLabel} *`}
                        value={reportingDateValue}
                        disabled={saving}
                        onChange={(newVal: Moment | null) => {
                            setSaveAttempted(false);
                            if (!newVal || !newVal.isValid()) {
                                setActualReportingDate("");
                                return;
                            }
                            setActualReportingDate(newVal.format("YYYY-MM-DD"));
                        }}
                        slotProps={{
                            textField: {
                                fullWidth: true,
                                size: "small",
                                variant: "outlined",
                                error: showActualDateError,
                                helperText: showActualDateError
                                    ? t(
                                          "credit_insurance_reporting.actual_date_required",
                                          { ns: "dashboard" }
                                      )
                                    : undefined,
                                ...textFieldRtlProps,
                                sx: textFieldDirSx,
                            },
                        }}
                    />
                    <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        multiline
                        minRows={2}
                        label={t(
                            "credit_insurance_reporting.ref_number",
                            { ns: "dashboard" }
                        )}
                        value={reportingRefComment}
                        onChange={(e) => setReportingRefComment(e.target.value)}
                        disabled={saving}
                        inputProps={textFieldRtlProps}
                        sx={textFieldDirSx}
                    />
                </Box>
            </form>
        </AppDialog>
    );
}
