"use client";

import { Box, Typography } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import moment from "moment";
import { useSession } from "next-auth/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import {
    formatDateOnlyYmdForSession,
    getDatePickerFormat,
} from "@/utils/datetimeOperations";

/** Response of `POST /api/entities/insurance-policies/:id/save-preview`. */
export type InsurancePolicySavePreview = {
    policy_id: number;
    requires_confirmation: boolean;
    changed_fields: Array<{
        field: string;
        old_value: string | null;
        new_value: string | null;
        customer_count: number;
    }>;
    unique_customer_count: number;
    skipped_pending_customer_count: number;
    active_customer_count: number;
};

/** UTC calendar day, matching the server's effective-date rule. */
function todayUtcYmd(): string {
    return new Date().toISOString().slice(0, 10);
}

type InsurancePolicySaveConfirmDialogProps = {
    preview: InsurancePolicySavePreview | null;
    onClose: () => void;
    /** `effectiveDate` is YYYY-MM-DD: today applies live, a future day schedules a pending revision. */
    onConfirm: (effectiveDate: string) => void;
    isSaving: boolean;
    errorMessage?: string;
};

export default function InsurancePolicySaveConfirmDialog({
    preview,
    onClose,
    onConfirm,
    isSaving,
    errorMessage,
}: InsurancePolicySaveConfirmDialogProps) {
    const { t, i18n } = useTranslation(["settings", "common"]);
    const { data: session } = useSession();
    const tCi = (key: string, options?: Record<string, unknown>) =>
        t(`credit_insurance.${key}`, { ns: "settings", ...options });
    const emptyValue = tCi("save_confirm.empty_value");
    const isRTL = i18n.language === "he";
    // Remounted (via `key`) on each open, so the date defaults to that day.
    const [today] = useState(todayUtcYmd);
    const [effectiveDate, setEffectiveDate] = useState(today);
    const [effectiveDateError, setEffectiveDateError] = useState<string | null>(
        null
    );
    const isOpen = preview != null;

    const isFuture = effectiveDate > today;

    const handleConfirm = () => {
        if (!effectiveDate) {
            setEffectiveDateError(tCi("validation.effective_date_required"));
            return;
        }
        if (effectiveDate < todayUtcYmd()) {
            setEffectiveDateError(tCi("validation.effective_date_in_past"));
            return;
        }
        onConfirm(effectiveDate);
    };

    const description = preview ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="body1">{tCi("save_confirm.intro")}</Typography>
            <Box
                component="ul"
                sx={{ m: 0, ps: 2, display: "flex", flexDirection: "column", gap: 1 }}
            >
                {preview.changed_fields.map((change) => (
                    <li key={change.field}>
                        <Typography variant="body2" fontWeight={600}>
                            {tCi(`fields.${change.field}`)}
                        </Typography>
                        <Typography variant="body2">
                            {tCi("save_confirm.field_change", {
                                old: change.old_value ?? emptyValue,
                                new: change.new_value ?? emptyValue,
                                interpolation: { escapeValue: false },
                            })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {tCi("save_confirm.field_customer_count", {
                                count: change.customer_count,
                            })}
                        </Typography>
                    </li>
                ))}
            </Box>
            <Box>
                <Typography variant="body2" fontWeight={600}>
                    {tCi("save_confirm.unique_customer_count", {
                        count: preview.unique_customer_count,
                    })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {tCi("save_confirm.skipped_pending_count", {
                        count: preview.skipped_pending_customer_count,
                    })}
                </Typography>
                {preview.unique_customer_count === 0 && (
                    <Typography variant="body2" color="text.secondary">
                        {tCi("save_confirm.no_customers_to_update")}
                    </Typography>
                )}
            </Box>
            <DatePicker
                label={tCi("save_confirm.effective_date")}
                value={
                    effectiveDate
                        ? moment(effectiveDate, "YYYY-MM-DD", true)
                        : null
                }
                minDate={moment(today, "YYYY-MM-DD", true)}
                onChange={(newValue) => {
                    setEffectiveDate(
                        newValue && newValue.isValid()
                            ? newValue.format("YYYY-MM-DD")
                            : ""
                    );
                    setEffectiveDateError(null);
                }}
                format={getDatePickerFormat(session ?? null, "DD/MM/YYYY")}
                disabled={isSaving}
                slotProps={{
                    textField: {
                        ...(isRTL && { "data-hebrew": true as const }),
                        dir: isRTL ? "rtl" : "ltr",
                        fullWidth: true,
                        size: "small",
                        required: true,
                        error: !!effectiveDateError,
                        helperText: effectiveDateError,
                        InputLabelProps: { shrink: true },
                    },
                }}
            />
            {isFuture && (
                <Typography variant="body2" color="text.secondary">
                    {tCi("save_confirm.effective_date_future_hint", {
                        date: formatDateOnlyYmdForSession(
                            effectiveDate,
                            session ?? null
                        ),
                    })}
                </Typography>
            )}
        </Box>
    ) : null;

    return (
        <DeleteDialog
            isOpen={isOpen}
            onClose={() => {
                if (!isSaving) onClose();
            }}
            onConfirm={handleConfirm}
            title={tCi("save_confirm.title")}
            description={description}
            confirmLabel={tCi(
                isFuture ? "save_confirm.confirm_schedule" : "save_confirm.confirm"
            )}
            cancelLabel={t("actions.cancel", { ns: "common" })}
            isLoading={isSaving}
            errorMessage={errorMessage}
            type="warning"
            maxWidth="lg"
            locale={i18n.language}
        />
    );
}
