"use client";

import api from "@/app/api";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { EventNote as EventNoteIcon } from "@mui/icons-material";
import axios from "axios";
import { Box, Button, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import moment, { Moment } from "moment";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getDatePickerFormat } from "@/utils/datetimeOperations";

const DIALOG_TITLE_ID = "last-payment-date-dialog-title";
const DIALOG_DESC_ID = "last-payment-date-dialog-desc";

export interface LastPaymentDateDialogProps {
    open: boolean;
    onClose: () => void;
    invoiceId: number | null;
    onSuccess: () => void;
}

const LastPaymentDateDialog: React.FC<LastPaymentDateDialogProps> = ({
    open,
    onClose,
    invoiceId,
    onSuccess,
}) => {
    const { t, i18n } = useTranslation(["customers", "common"]);
    const { data: session } = useSession();
    const theme = useTheme();
    const { showToast } = useToast();
    const isRTL = i18n.language === "he";

    const [lastPaymentDate, setLastPaymentDate] = useState<string>("");
    const [saving, setSaving] = useState(false);
    const [saveAttempted, setSaveAttempted] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLastPaymentDate("");
        setSaveAttempted(false);
    }, [open, invoiceId]);

    const isDateMissing = !lastPaymentDate.trim();
    const showDateError = saveAttempted && isDateMissing;

    const handleClose = () => {
        if (!saving) {
            onClose();
        }
    };

    const handleSave = async () => {
        if (invoiceId == null || !Number.isFinite(invoiceId) || invoiceId <= 0) {
            showToast(
                t("last_payment_date.invalid_invoice", { ns: "customers" }),
                "error"
            );
            return;
        }

        if (isDateMissing) {
            setSaveAttempted(true);
            return;
        }

        setSaving(true);
        try {
            await api.post("/invoices/update-last-payment-date", {
                invoiceId,
                lastPaymentDate: lastPaymentDate.trim(),
            });

            showToast(
                t("last_payment_date.save_success", { ns: "customers" }),
                "success"
            );
            onSuccess();
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

    const datePickerFormat = useMemo(
        () => getDatePickerFormat(session, "DD/MM/YYYY"),
        [session]
    );

    const dateValue: Moment | null = useMemo(() => {
        const s = lastPaymentDate.trim();
        if (!s) return null;
        const m = moment(s, "YYYY-MM-DD", true);
        return m.isValid() ? m : null;
    }, [lastPaymentDate]);

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

    const textFieldRtlProps = useMemo(
        () => ({
            ...(isRTL && { "data-hebrew": true as const }),
            dir: (isRTL ? "rtl" : "ltr") as "rtl" | "ltr",
        }),
        [isRTL]
    );

    const labelText = t("last_payment_date.label", { ns: "customers" });

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
            title={t("last_payment_date.dialog_title", { ns: "customers" })}
            titleIcon={<EventNoteIcon aria-hidden="true" />}
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
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void handleSave()}
                        variant="contained"
                        size="small"
                        className="save-button"
                        disabled={saving || isDateMissing}
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
            <Box
                id={DIALOG_DESC_ID}
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
                <DatePicker
                    format={datePickerFormat}
                    label={`${labelText} *`}
                    value={dateValue}
                    disabled={saving}
                    onChange={(newVal: Moment | null) => {
                        setSaveAttempted(false);
                        if (!newVal || !newVal.isValid()) {
                            setLastPaymentDate("");
                            return;
                        }
                        setLastPaymentDate(newVal.format("YYYY-MM-DD"));
                    }}
                    slotProps={{
                        textField: {
                            id: "last-payment-date-picker",
                            fullWidth: true,
                            size: "small",
                            variant: "outlined",
                            error: showDateError,
                            helperText: showDateError
                                ? t("last_payment_date.date_required", {
                                      ns: "customers",
                                  })
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
                                "aria-label": labelText,
                                "aria-invalid": showDateError,
                            },
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
            </Box>
        </AppDialog>
    );
};

export default LastPaymentDateDialog;
