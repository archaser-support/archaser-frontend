"use client";

import { Grid, TextField } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { AccountDisplayData } from "../types";

interface BankDetailsProps {
    customer: AccountDisplayData;
    onFieldChange: (key: string, value: any) => void;
    isEditing?: boolean;
}

const BankDetails: React.FC<BankDetailsProps> = ({
    customer,
    onFieldChange,
    isEditing = false,
}) => {
    const { t, i18n } = useTranslation(["accounts", "common"]);

    return (
        <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        label={t("fields.beneficiary_name", { ns: "accounts" })}
                        value={
                            customer.beneficiary_name ||
                            t("messages.not_specified", { ns: "accounts" })
                        }
                        onChange={(e) =>
                            onFieldChange("beneficiary_name", e.target.value)
                        }
                        size="small"
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        label={t("fields.bank_name", { ns: "accounts" })}
                        value={
                            customer.bank_name ||
                            t("messages.not_specified", { ns: "accounts" })
                        }
                        onChange={(e) =>
                            onFieldChange("bank_name", e.target.value)
                        }
                        size="small"
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        label={t("fields.branch_name", { ns: "accounts" })}
                        value={
                            customer.branch_name ||
                            t("messages.not_specified", { ns: "accounts" })
                        }
                        onChange={(e) =>
                            onFieldChange("branch_name", e.target.value)
                        }
                        size="small"
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        label={t("fields.branch_number", { ns: "accounts" })}
                        value={
                            customer.branch_number ||
                            t("messages.not_specified", { ns: "accounts" })
                        }
                        onChange={(e) =>
                            onFieldChange("branch_number", e.target.value)
                        }
                        size="small"
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        label={t("fields.account_number", { ns: "accounts" })}
                        value={
                            customer.account_number ||
                            t("messages.not_specified", { ns: "accounts" })
                        }
                        onChange={(e) =>
                            onFieldChange("account_number", e.target.value)
                        }
                        size="small"
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        label={t("fields.swift", { ns: "accounts" })}
                        value={
                            customer.swift ||
                            t("messages.not_specified", { ns: "accounts" })
                        }
                        onChange={(e) => onFieldChange("swift", e.target.value)}
                        size="small"
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                        fullWidth
                        label={t("fields.iban", { ns: "accounts" })}
                        value={
                            customer.iban ||
                            t("messages.not_specified", { ns: "accounts" })
                        }
                        onChange={(e) => onFieldChange("iban", e.target.value)}
                        size="small"
                        sx={{
                            padding: 0,
                            margin: 0,
                            "& .MuiFormControl-root": {
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiInputLabel-root": {
                                whiteSpace: "nowrap",
                                overflow: "visible",
                                textOverflow: "clip",
                            },
                            "& .MuiOutlinedInput-root": {
                                display: "flex !important",
                                alignItems: "center !important",
                            },
                            "& .MuiOutlinedInput-input": {
                                paddingTop: "6px !important",
                                paddingBottom: "6px !important",
                            },
                        }}
                    />
                
            </Grid>
            <Grid size={{ xs: 12 }}>
                <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        maxRows={8}
                        label={t("fields.bank_comments", { ns: "accounts" })}
                        value={customer.bank_comments || ""}
                        onChange={(e) =>
                            onFieldChange("bank_comments", e.target.value)
                        }
                        size="small"
                        placeholder={
                            isEditing
                                ? t("messages.bank_comments_placeholder", { ns: "accounts" })
                                : ""
                        }
                        {...(i18n.language === "he" && { "data-hebrew": true, multiline: true })}
                        sx={{
                            "& .MuiInputBase-root": {
                                alignItems: "flex-start",
                                minHeight: "auto",
                                height: "auto",
                                overflow: "visible",
                            },
                            "& .MuiInputBase-input": {
                                paddingTop: "12px",
                                paddingBottom: "12px",
                                lineHeight: "1.5",
                                height: "auto !important",
                                minHeight: "auto !important",
                                overflow: "visible",
                            },
                            "& .MuiOutlinedInput-root": {
                                height: "auto",
                                minHeight: "auto",
                            },
                            "& .MuiInputLabel-root": {
                                backgroundColor: "background.paper",
                                px: 0.5,
                                ml: -0.5,
                            },
                        }}
                    />
                
            </Grid>
        </Grid>
    );
};

export default BankDetails;
