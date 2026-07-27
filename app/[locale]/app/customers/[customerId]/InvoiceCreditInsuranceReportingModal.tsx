"use client";

import api from "@/app/api";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { Receipt as ReceiptIcon } from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import axios from "axios";
import {
    Box,
    Button,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import moment, { Moment } from "moment";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getInvoiceFieldFromGridRow } from "@/shared/utils/invoiceGridRowFields";
import { getDatePickerFormat } from "@/utils/datetimeOperations";

const DIALOG_TITLE_ID = "invoice-credit-insurance-reporting-title";
const DIALOG_DESC_ID = "invoice-credit-insurance-reporting-description";
const FORM_ID = "invoice-credit-insurance-reporting-form";

/** Select value → maps to API `reported_status` Reported / null */
const REPORTED = "Reported";
const NOT_REPORTED = "NotReported";

function toDateInputValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "string") {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
            return d.toISOString().slice(0, 10);
        }
        return "";
    }
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    return "";
}

export interface InvoiceCreditInsuranceReportingModalProps {
    open: boolean;
    onClose: () => void;
    /** Transformed grid row from ViewBasedDataGrid */
    row: Record<string, unknown> | null;
    onSaved: () => void;
}

const InvoiceCreditInsuranceReportingModal: React.FC<
    InvoiceCreditInsuranceReportingModalProps
> = ({ open, onClose, row, onSaved }) => {
    const { t, i18n } = useTranslation(["customers", "common"]);
    const { data: session } = useSession();
    const theme = useTheme();
    const isRTL = i18n.language === "he";
    const { showToast } = useToast();
    const [reportedStatus, setReportedStatus] = useState<string>(NOT_REPORTED);
    const [actualReportingDate, setActualReportingDate] = useState<string>("");
    const [reportingRefComment, setReportingRefComment] = useState("");
    const [saving, setSaving] = useState(false);
    /** Only set true after a failed save so we do not show date errors on select alone */
    const [saveAttempted, setSaveAttempted] = useState(false);

    const invoiceIdRaw = row?.id;
    const invoiceId =
        typeof invoiceIdRaw === "number"
            ? invoiceIdRaw
            : Number(invoiceIdRaw);
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

    const selectControlSx = useMemo(
        () => ({
            ...textFieldDirSx,
            direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            "& .MuiOutlinedInput-notchedOutline": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
            },
            "& .MuiSelect-select": {
                textAlign: isRTL ? ("right" as const) : ("left" as const),
            },
            "& .MuiSelect-icon": {
                right: isRTL ? "auto" : "7px",
                left: isRTL ? "7px" : "auto",
            },
        }),
        [isRTL, textFieldDirSx]
    );

    const menuItemSx = useMemo(
        () => ({
            direction: isRTL ? ("rtl" as const) : ("ltr" as const),
            textAlign: isRTL ? ("right" as const) : ("left" as const),
            justifyContent: isRTL
                ? ("flex-end" as const)
                : ("flex-start" as const),
        }),
        [isRTL]
    );

    useEffect(() => {
        if (!open || !row) return;
        setSaveAttempted(false);
        const status = getInvoiceFieldFromGridRow(row, "reported_status");
        if (status === "Reported") {
            setReportedStatus(REPORTED);
            setActualReportingDate(
                toDateInputValue(
                    getInvoiceFieldFromGridRow(row, "actual_reporting_date")
                )
            );
            const note = getInvoiceFieldFromGridRow(row, "reporting_comment");
            setReportingRefComment(
                note != null && note !== "" ? String(note) : ""
            );
        } else {
            setReportedStatus(NOT_REPORTED);
            setActualReportingDate("");
            setReportingRefComment("");
        }
    }, [open, row]);

    const isReported = reportedStatus === REPORTED;
    const isActualDateMissing = isReported && !actualReportingDate.trim();
    const showActualDateError = saveAttempted && isActualDateMissing;

    const handleClose = () => {
        if (!saving) {
            onClose();
        }
    };

    const handleSave = async () => {
        if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
            showToast(
                t("credit_insurance_reporting.invalid_invoice", {
                    ns: "customers",
                }),
                "error"
            );
            return;
        }

        if (isActualDateMissing) {
            setSaveAttempted(true);
            return;
        }

        setSaving(true);
        try {
            const body =
                reportedStatus === REPORTED
                    ? {
                          reported_status: "Reported" as const,
                          actual_reporting_date: actualReportingDate.trim(),
                          reporting_comment:
                              reportingRefComment.trim() || null,
                      }
                    : {
                          reported_status: null as null,
                          actual_reporting_date: null as null,
                      };

            await api.put(`/entities/invoices/${invoiceId}`, body);

            showToast(
                t("credit_insurance_reporting.save_success", {
                    ns: "customers",
                }),
                "success"
            );
            onSaved();
            onClose();
        } catch (e: unknown) {
            const message = axios.isAxiosError(e)
                ? String(
                      (e.response?.data as { error?: string } | undefined)
                          ?.error ?? e.message
                  )
                : e instanceof Error
                  ? e.message
                  : t("messages.error", { ns: "common" });
            showToast(message, "error");
        } finally {
            setSaving(false);
        }
    };

    const titleText = t("credit_insurance_reporting.edit_title", {
        ns: "customers",
    });

    const actualReportingDateLabel = t(
        "credit_insurance_reporting.actual_reporting_date",
        {
            ns: "customers",
        }
    );

    const reportedStatusLabel = t("credit_insurance_reporting.reported_status", {
        ns: "customers",
    });

    const actualReportingDatePickerLabel = useMemo(
        () =>
            isReported
                ? `${actualReportingDateLabel} ${t("credit_insurance_reporting.required_indicator", {
                      ns: "customers",
                  })}`.trim()
                : actualReportingDateLabel,
        [actualReportingDateLabel, isReported, t]
    );

    const reportingDateValue: Moment | null = useMemo(() => {
        const s = actualReportingDate.trim();
        if (!s) return null;
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
            paperWidth="360px"
            paperMaxHeight="90vh"
            title={titleText}
            titleIcon={<ReceiptIcon aria-hidden="true" />}
            ariaLabelledBy={DIALOG_TITLE_ID}
            ariaDescribedBy={DIALOG_DESC_ID}
            keepMounted
            disableEnforceFocus={false}
            disableAutoFocus={false}
            actions={
                <>
                    <Button
                        type="button"
                        onClick={handleClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        disabled={saving}
                        fullWidth={false}
                        sx={{
                            mr: i18n.language === "he" ? 0 : theme.spacing(1),
                            ml: i18n.language === "he" ? theme.spacing(1) : 0,
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
                        disabled={saving}
                        fullWidth={false}
                        endIcon={
                            saving ? (
                                <CircularProgress
                                    size={16}
                                    sx={{ color: "inherit" }}
                                />
                            ) : undefined
                        }
                        sx={{
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiButton-endIcon": {
                                marginLeft:
                                    i18n.language === "he" ? 0 : theme.spacing(1),
                                marginRight:
                                    i18n.language === "he" ? theme.spacing(1) : 0,
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
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: theme.spacing(2),
                        width: "100%",
                        maxWidth: "360px",
                        mx: "auto",
                        direction: isRTL ? "rtl" : "ltr",
                    }}
                >
                    <FormControl
                        fullWidth
                        size="small"
                        sx={selectControlSx}
                        {...(isRTL && { "data-hebrew": true })}
                        dir={isRTL ? "rtl" : "ltr"}
                    >
                        <InputLabel
                            id="reported-status-label"
                            {...(isRTL && { "data-hebrew": true as const })}
                        >
                            {reportedStatusLabel}
                        </InputLabel>
                        <Select
                            labelId="reported-status-label"
                            label={reportedStatusLabel}
                            value={reportedStatus}
                            dir={isRTL ? "rtl" : "ltr"}
                            disabled={saving}
                            onChange={(e) => {
                                const v = String(e.target.value);
                                setReportedStatus(v);
                                setSaveAttempted(false);
                                if (v === NOT_REPORTED) {
                                    setActualReportingDate("");
                                    setReportingRefComment("");
                                }
                            }}
                        >
                            <MenuItem value={NOT_REPORTED} sx={menuItemSx}>
                                {t("credit_insurance_reporting.not_reported", {
                                    ns: "customers",
                                })}
                            </MenuItem>
                            <MenuItem value={REPORTED} sx={menuItemSx}>
                                {t("credit_insurance_reporting.reported", {
                                    ns: "customers",
                                })}
                            </MenuItem>
                        </Select>
                    </FormControl>
                    <DatePicker
                        format={datePickerFormat}
                        label={actualReportingDatePickerLabel}
                        value={reportingDateValue}
                        disabled={saving || !isReported}
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
                                id: "actual-reporting-date",
                                fullWidth: true,
                                size: "small",
                                variant: "outlined",
                                error: showActualDateError,
                                helperText: showActualDateError
                                    ? t(
                                          "credit_insurance_reporting.actual_date_required_helper",
                                          {
                                              ns: "customers",
                                          }
                                      )
                                    : undefined,
                                InputLabelProps: {
                                    shrink: true,
                                    sx: {
                                        color: "text.secondary",
                                        "&.Mui-focused": {
                                            color: "text.secondary",
                                        },
                                        "&.Mui-error": {
                                            color: "text.secondary",
                                        },
                                    },
                                },
                                inputProps: {
                                    "aria-label": actualReportingDateLabel,
                                    "aria-invalid": showActualDateError,
                                    "aria-describedby": showActualDateError
                                        ? "actual-reporting-date-helper"
                                        : undefined,
                                },
                                FormHelperTextProps: showActualDateError
                                    ? { id: "actual-reporting-date-helper" }
                                    : undefined,
                                ...textFieldRtlProps,
                                sx: {
                                    ...textFieldDirSx,
                                    "& .MuiInputBase-root": {
                                        minHeight: 40,
                                    },
                                    ...(isRTL && {
                                        "& .MuiInputAdornment-root": {
                                            marginLeft: "9px",
                                            marginRight: 0,
                                        },
                                    }),
                                },
                            },
                        }}
                    />
                    <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        multiline
                        minRows={2}
                        label={t("credit_insurance_reporting.reference_or_comment", {
                            ns: "customers",
                        })}
                        value={reportingRefComment}
                        onChange={(e) => setReportingRefComment(e.target.value)}
                        disabled={saving || !isReported}
                        inputProps={textFieldRtlProps}
                        sx={textFieldDirSx}
                    />
                </Box>
            </form>
        </AppDialog>
    );
};

export default InvoiceCreditInsuranceReportingModal;
