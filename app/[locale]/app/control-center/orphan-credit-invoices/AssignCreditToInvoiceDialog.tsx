"use client";

import { Link as LinkIcon } from "@mui/icons-material";
import {
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

const SCROLL_CONTAINER_ID = "assign-credit-modal-scroll";

export type AssignCreditInvoiceOption = {
    id: number;
    invoice_number: string;
    amount: number;
    customer_net_amount?: number;
    customer_currency?: string;
    Account?: { Country?: { currency?: string } };
};

export type AssignCreditToInvoiceDialogProps = {
    open: boolean;
    onClose: () => void;
    availableInvoices: AssignCreditInvoiceOption[];
    selectedInvoiceId: number | "";
    onSelectedInvoiceIdChange: (invoiceId: number | "") => void;
    selectedCreditInvoice: { id: number } | null;
    isAssigning: boolean;
    onAssign: () => void;
};

export function AssignCreditToInvoiceDialog({
    open,
    onClose,
    availableInvoices,
    selectedInvoiceId,
    onSelectedInvoiceIdChange,
    selectedCreditInvoice,
    isAssigning,
    onAssign,
}: AssignCreditToInvoiceDialogProps) {
    const { t, i18n } = useTranslation([
        "control_center",
        "invoices",
        "common",
    ]);
    const theme = useTheme();
    const isRTL = i18n.language === "he";

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

    const selectedInvoice =
        availableInvoices.find((invoice) => invoice.id === selectedInvoiceId) ||
        null;

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="380px"
            paperMaxHeight="90vh"
            scrollContainerId={SCROLL_CONTAINER_ID}
            title={t("actions.assign_credit_title", { ns: "control_center" })}
            titleIcon={<LinkIcon aria-hidden="true" />}
            ariaLabelledBy="assign-credit-modal-title"
            ariaDescribedBy="assign-credit-modal-description"
            keepMounted
            disableEnforceFocus={false}
            disableAutoFocus={false}
            paperSx={{
                sx: {
                    minHeight: "min(520px, 70vh)",
                    height: "min(520px, 70vh) !important",
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
                    },
                },
            }}
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        fullWidth={false}
                        disabled={isAssigning}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        type="button"
                        onClick={onAssign}
                        variant="contained"
                        size="small"
                        className="save-button"
                        disabled={!selectedInvoiceId || isAssigning}
                        fullWidth={false}
                        endIcon={
                            isAssigning ? (
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
                        {t("actions.assign", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "hidden",
                }}
            >
                <ModalScrollBox
                    id={SCROLL_CONTAINER_ID}
                    isRTL={isRTL}
                    sx={{ minHeight: theme.spacing(40) }}
                >
                    <Box
                        id="assign-credit-modal-description"
                        component="div"
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: theme.spacing(1.5),
                            mx: "auto",
                            width: "100%",
                            direction: isRTL ? "rtl" : "ltr",
                            pt: theme.spacing(2),
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                            }}
                        >
                            {t("messages.assign_credit_description", {
                                ns: "control_center",
                            })}
                        </Typography>

                        <Autocomplete
                            key={selectedCreditInvoice?.id || "no-invoice"}
                            value={selectedInvoice}
                            onChange={(_, newValue) =>
                                onSelectedInvoiceIdChange(newValue?.id || "")
                            }
                            options={availableInvoices}
                            getOptionLabel={(option) => {
                                const currency =
                                    option.customer_currency ||
                                    option.Account?.Country?.currency ||
                                    "";
                                const formattedAmount =
                                    formatAmountWithoutSymbol(
                                        option.customer_net_amount ||
                                            option.amount
                                    );
                                return `${option.invoice_number} - ${formattedAmount} ${currency}`;
                            }}
                            isOptionEqualToValue={(option, value) =>
                                option.id === value?.id
                            }
                            size="small"
                            dir={isRTL ? "rtl" : "ltr"}
                            {...(isRTL && {
                                "data-hebrew": true,
                                "data-rtl": true,
                            })}
                            selectOnFocus
                            clearOnBlur={false}
                            handleHomeEndKeys
                            renderOption={(props, option) => {
                                const { key, ...otherProps } = props;
                                const currency =
                                    option.customer_currency ||
                                    option.Account?.Country?.currency ||
                                    "";
                                const formattedAmount =
                                    formatAmountWithoutSymbol(
                                        option.customer_net_amount ||
                                            option.amount
                                    );
                                return (
                                    <li
                                        key={key}
                                        {...otherProps}
                                        style={{
                                            direction: isRTL ? "rtl" : "ltr",
                                            textAlign: isRTL ? "right" : "left",
                                            display: "flex",
                                            alignItems: "center",
                                            minHeight: "48px",
                                            padding: "8px 16px",
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                width: "100%",
                                                direction: isRTL ? "rtl" : "ltr",
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    direction: isRTL
                                                        ? "rtl"
                                                        : "ltr",
                                                    textAlign: isRTL
                                                        ? "right"
                                                        : "left",
                                                }}
                                            >
                                                {option.invoice_number}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{
                                                    direction: isRTL
                                                        ? "rtl"
                                                        : "ltr",
                                                    textAlign: isRTL
                                                        ? "right"
                                                        : "left",
                                                }}
                                            >
                                                {`${formattedAmount} ${currency}`}
                                            </Typography>
                                        </Box>
                                    </li>
                                );
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t("fields.select_invoice", {
                                        ns: "invoices",
                                    })}
                                    variant="outlined"
                                    fullWidth
                                    size="small"
                                    placeholder={t("fields.search_placeholder", {
                                        ns: "common",
                                    })}
                                    {...(isRTL && { "data-hebrew": true })}
                                    sx={textFieldSx}
                                />
                            )}
                            ListboxProps={{
                                style: {
                                    maxHeight: 400,
                                },
                            }}
                        />
                    </Box>
                </ModalScrollBox>
            </Box>
        </AppDialog>
    );
}
