"use client";

import {
    Box,
    Typography,
    TextField,
    Autocomplete,
    FormHelperText,
    useTheme,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import EmailEditor from "@/app/[locale]/app/activityTemplates/EmailEditor";
import { useRTL } from "../hooks/useRTL";
import { ActivityTemplate } from "@/types/ActivitiesTemplate";
import { FormErrors } from "../MassSendEmailModal.types";
import { EMAIL_CONFIG } from "../MassSendEmailModal.constants";

interface EmailCompositionStepProps {
    selectedTemplate: ActivityTemplate | null;
    onTemplateChange: (template: ActivityTemplate | null) => void;
    emailTemplates: ActivityTemplate[];
    isLoadingTemplates: boolean;
    subject: string;
    onSubjectChange: (subject: string) => void;
    emailBody: string;
    onEmailBodyChange: (body: string) => void;
    errors: FormErrors;
    onErrorClear: (field: keyof FormErrors) => void;
    isSending: boolean;
}

const EmailCompositionStep: React.FC<EmailCompositionStepProps> = ({
    selectedTemplate,
    onTemplateChange,
    emailTemplates,
    isLoadingTemplates,
    subject,
    onSubjectChange,
    emailBody,
    onEmailBodyChange,
    errors,
    onErrorClear,
    isSending,
}) => {
    const { t, i18n } = useTranslation(["activities", "common"]);
    const theme = useTheme();
    const { isRTL, direction, textAlign } = useRTL();
    const isHebrew = i18n.language === "he";

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "hidden",
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
                {t("fields.email_composition", {
                    ns: "activities",
                })}
            </Typography>

            {/* Template Selector */}
            <Autocomplete
                value={selectedTemplate}
                onChange={(_, newValue) => {
                    onTemplateChange(newValue);
                }}
                options={emailTemplates}
                getOptionLabel={(option) => option.name || ""}
                isOptionEqualToValue={(option, value) =>
                    option.id === value?.id
                }
                disabled={isLoadingTemplates || isSending}
                loading={isLoadingTemplates}
                noOptionsText={t("fields.no_template", {
                    ns: "activities",
                })}
                dir={isHebrew ? "rtl" : "ltr"}
                {...(isHebrew && {
                    "data-hebrew": true,
                    "data-rtl": true,
                })}
                sx={{
                    mb: 2,
                    "& .MuiAutocomplete-endAdornment": {
                        position: "absolute",
                        right: isHebrew ? "auto" : "9px",
                        left: isHebrew ? "9px" : "auto",
                    },
                    "& .MuiAutocomplete-popper": {
                        zIndex: 10000,
                    },
                }}
                slotProps={{
                    popper: {
                        sx: {
                            zIndex: 10000,
                            direction: isHebrew ? "rtl" : "ltr",
                            "& .MuiAutocomplete-listbox": {
                                direction: isHebrew ? "rtl" : "ltr",
                            },
                        },
                        style: {
                            zIndex: 10000,
                        },
                    },
                }}
                renderOption={(props, option) => {
                    const { key, ...otherProps } = props;
                    return (
                        <li
                            key={key}
                            {...otherProps}
                            style={{
                                direction: isHebrew ? "rtl" : "ltr",
                                textAlign: isHebrew ? "right" : "left",
                                paddingRight: isHebrew ? "16px" : "14px",
                                paddingLeft: isHebrew ? "14px" : "16px",
                            }}
                        >
                            <Typography
                                sx={{
                                    direction: isHebrew ? "rtl" : "ltr",
                                    textAlign: isHebrew ? "right" : "left",
                                    width: "100%",
                                }}
                            >
                                {option.name}
                            </Typography>
                        </li>
                    );
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={t("fields.email_template", {
                            ns: "activities",
                        })}
                        size="small"
                        {...(isHebrew && { "data-hebrew": true })}
                        dir={isHebrew ? "rtl" : "ltr"}
                    />
                )}
            />

            {/* Subject Field */}
            <TextField
                fullWidth
                label={t("fields.email_subject", {
                    ns: "activities",
                })}
                value={subject}
                onChange={(e) => {
                    const newValue = e.target.value;
                    onSubjectChange(newValue);
                    if (errors.subject && newValue.trim() !== "") {
                        onErrorClear("subject");
                    }
                }}
                error={!!errors.subject}
                helperText={
                    errors.subject ||
                    `${subject.length}/${EMAIL_CONFIG.MAX_SUBJECT_LENGTH} ${t("fields.characters", { ns: "common" })}`
                }
                required
                disabled={isSending}
                inputProps={{ maxLength: EMAIL_CONFIG.MAX_SUBJECT_LENGTH }}
                dir={isHebrew ? "rtl" : "ltr"}
                {...(isHebrew && { "data-hebrew": true })}
            />

            {/* Email Body Editor */}
            <Box
                sx={{
                    direction,
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "hidden",
                }}
            >
                <Typography
                    variant="body2"
                    sx={{
                        mb: 0.5,
                        fontWeight: 500,
                        direction,
                        textAlign,
                        flexShrink: 0,
                    }}
                >
                    {t("fields.email_body", { ns: "activities" })}{" "}
                    <Box component="span" sx={{ color: "error.main" }}>
                        *
                    </Box>
                </Typography>
                <Box
                    sx={{
                        direction,
                        flex: "1 1 auto",
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 0,
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            flex: "1 1 auto",
                            display: "flex",
                            flexDirection: "column",
                            minHeight: 0,
                            overflow: "hidden",
                            position: "relative",
                            height: "100%",
                        }}
                    >
                        <EmailEditor
                            value={emailBody}
                            onChange={(content) => {
                                onEmailBodyChange(content);
                                if (errors.emailBody && content.trim() !== "") {
                                    onErrorClear("emailBody");
                                }
                            }}
                            error={errors.emailBody}
                            height="100%"
                        />
                    </Box>
                </Box>
                {errors.emailBody && (
                    <FormHelperText
                        error
                        sx={{
                            mt: 0.5,
                            textAlign,
                            direction,
                            flexShrink: 0,
                        }}
                    >
                        {errors.emailBody}
                    </FormHelperText>
                )}
            </Box>
        </Box>
    );
};

export default EmailCompositionStep;
