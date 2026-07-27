"use client";

import { Settings as SettingsIcon } from "@mui/icons-material";
import {
    Box,
    Button,
    FormControlLabel,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    getDefaultLabel,
    validateFieldConfig,
    type GenericEntityKey,
    type GenericFieldKey,
} from "@/utils/genericFieldUtils";

export interface GenericFieldRow {
    id: string;
    entity: GenericEntityKey;
    fieldKey: GenericFieldKey;
    entityLabel: string;
    fieldTypeLabel: string;
    label: string;
    enabled: boolean;
    read_only: boolean;
}

interface UpsertGenericFieldModalProps {
    isOpen: boolean;
    onClose: () => void;
    field: GenericFieldRow | null;
    accountId: number;
    onSuccess?: () => void;
}

export function UpsertGenericFieldModal({
    isOpen,
    onClose,
    field,
    accountId,
    onSuccess,
}: UpsertGenericFieldModalProps) {
    const { t, i18n } = useTranslation(["generic_fields", "common"]);
    const theme = useTheme();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [label, setLabel] = useState("");
    const [enabled, setEnabled] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const [labelError, setLabelError] = useState<string | null>(null);

    useEffect(() => {
        if (field) {
            setLabel(field.label);
            setEnabled(field.enabled);
            setReadOnly(field.read_only);
            setLabelError(null);
        }
    }, [field]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!field) throw new Error("No field selected");
            const response = await api.put(
                `/api/accounts/${accountId}/generic-field-config`,
                {
                    entity: field.entity,
                    fieldKey: field.fieldKey,
                    label: label.trim() || getDefaultLabel(field.fieldKey),
                    enabled,
                    read_only: readOnly,
                }
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["account", accountId] });
            queryClient.invalidateQueries({
                queryKey: ["generic-fields"],
                exact: false,
            });
            onSuccess?.();
            showToast(
                t("messages.save_success", { ns: "generic_fields" }),
                "success"
            );
        },
        onError: (error: any) => {
            showToast(
                error?.response?.data?.error ||
                t("messages.save_error", { ns: "generic_fields" }),
                "error"
            );
        },
    });

    const handleSave = () => {
        if (!field) return;

        const defaultLabel = getDefaultLabel(field.fieldKey);
        const finalLabel = label.trim() || defaultLabel;
        const validation = validateFieldConfig(
            { label: finalLabel },
            defaultLabel
        );

        if (validation?.label) {
            setLabelError(validation.label);
            return;
        }

        setLabelError(null);
        mutation.mutate();
    };

    const handleClose = () => {
        setLabelError(null);
        onClose();
    };

    if (!field) return null;

    const isRTL = i18n.language === "he";

    return (
        <AppDialog
            open={isOpen}
            onClose={handleClose}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="380px"
            paperMaxHeight="90vh"
            title={t("sections.edit_field_title", { ns: "generic_fields" })}
            titleIcon={<SettingsIcon aria-hidden="true" />}
            ariaLabelledBy="generic-field-dialog-title"
            ariaDescribedBy="generic-field-dialog-description"
            actions={
                <>
                    <Button
                        onClick={handleClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        fullWidth={false}
                        disabled={mutation.isPending}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        size="small"
                        className="save-button"
                        fullWidth={false}
                        disabled={mutation.isPending}
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                            "& .MuiButton-endIcon": {
                                marginLeft: isRTL ? 0 : theme.spacing(1),
                                marginRight: isRTL ? theme.spacing(1) : 0,
                            },
                        }}
                    >
                        {t("actions.save", { ns: "generic_fields" })}
                    </Button>
                </>
            }
        >
            <Typography
                variant="subtitle2"
                sx={{
                    mb: 2,
                    color: "primary.main",
                    fontWeight: 600,
                    direction: isRTL ? "rtl" : "ltr",
                }}
            >
                {field.entityLabel}
            </Typography>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    pt: 1,
                    direction: isRTL ? "rtl" : "ltr",
                }}
            >
                <TextField
                    label={t("fields.modal_label", {
                        ns: "generic_fields",
                    })}
                    value={label}
                    onChange={(e) => {
                        setLabel(e.target.value);
                        setLabelError(null);
                    }}
                    error={!!labelError}
                    helperText={labelError}
                    fullWidth
                    placeholder={getDefaultLabel(field.fieldKey)}
                    inputProps={{ maxLength: 100 }}
                    sx={{
                        "& .MuiInputBase-input": {
                            textAlign: isRTL ? "right" : "left",
                            direction: isRTL ? "rtl" : "ltr",
                        },
                    }}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={enabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                        />
                    }
                    label={
                        enabled
                            ? t("values.status_active", {
                                ns: "generic_fields",
                            })
                            : t("values.status_inactive", {
                                ns: "generic_fields",
                            })
                    }
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={readOnly}
                            onChange={(e) =>
                                setReadOnly(e.target.checked)
                            }
                        />
                    }
                    label={
                        readOnly
                            ? t("values.read_only_read_only", {
                                ns: "generic_fields",
                                defaultValue: "Read-Only",
                            })
                            : t("values.read_only_editable", {
                                ns: "generic_fields",
                                defaultValue: "Editable",
                            })
                    }
                />
            </Box>
        </AppDialog>
    );
}
