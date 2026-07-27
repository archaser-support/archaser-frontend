"use client";

import { Box, Grid, TextField } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { AccountDisplayData } from "../types";

interface CommunicationSettingsProps {
    customer: AccountDisplayData;
    onFieldChange: (key: string, value: any) => void;
    validationErrors?: Record<string, string>;
}

const CommunicationSettings: React.FC<CommunicationSettingsProps> = ({
    customer,
    onFieldChange,
    validationErrors = {},
}) => {
    const { t } = useTranslation(["accounts", "common"]);

    return (
        <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                    fullWidth
                    label={t("fields.email_from_name", { ns: "accounts" })}
                    value={customer.email_from_name || ""}
                    onChange={(e) =>
                        onFieldChange("email_from_name", e.target.value)
                    }
                    size="small"
                    required
                    error={!!validationErrors.email_from_name}
                    helperText={validationErrors.email_from_name}
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
                    label={t("fields.email_from", { ns: "accounts" })}
                    value={customer.email_from || ""}
                    onChange={(e) =>
                        onFieldChange("email_from", e.target.value)
                    }
                    size="small"
                    required
                    error={!!validationErrors.email_from}
                    helperText={validationErrors.email_from}
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
                    label={t("fields.sms_from_name", { ns: "accounts" })}
                    value={customer.sms_from_name || ""}
                    onChange={(e) =>
                        onFieldChange("sms_from_name", e.target.value)
                    }
                    size="small"
                    error={!!validationErrors.sms_from_name}
                    helperText={validationErrors.sms_from_name}
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
        </Grid>
    );
};

export default CommunicationSettings;
