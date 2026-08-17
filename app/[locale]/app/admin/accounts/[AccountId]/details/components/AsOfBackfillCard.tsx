"use client";

import { History as HistoryIcon } from "@mui/icons-material";
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Stack,
    Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    fetchAsOfBackfillStatus,
    pauseAsOfBackfill,
    resumeAsOfBackfill,
    startAsOfBackfill,
    type AsOfBackfillStatus,
    type AsOfBackfillStatusValue,
} from "@/shared/services/asOfBackfillService";
import { accountCardContentSx, accountCardSx } from "../accountCardStyles";
import AccountSectionCardHeader from "./AccountSectionCardHeader";

const ARCHASER_ADMIN_ACCOUNT_ID = 10013;
const STATUS_CHIP_COLOR: Record<
    AsOfBackfillStatusValue,
    "default" | "info" | "warning" | "error" | "success"
> = {
    idle: "default",
    running: "info",
    paused: "warning",
    failed: "error",
    complete: "success",
};

export default function AsOfBackfillCard({ accountId }: { accountId: number }) {
    const { t } = useTranslation(["accounts"]);
    const { data: session } = useSession();
    const { success, error: showError } = useToast();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [confirmingStart, setConfirmingStart] = useState(false);
    const isArchaserAdmin =
        session?.user?.account_id === ARCHASER_ADMIN_ACCOUNT_ID;
    const queryKey = ["as-of-backfill", accountId];
    const invalidate = () => queryClient.invalidateQueries({ queryKey });

    const { data: status, isError } = useQuery({
        queryKey,
        queryFn: () => fetchAsOfBackfillStatus(accountId),
        enabled: isArchaserAdmin && accountId > 0,
        refetchInterval: (query) => {
            const data = query.state.data as AsOfBackfillStatus | undefined;
            return open && data?.status === "running" ? 4000 : false;
        },
    });
    const notifyError = () =>
        showError(t("as_of_backfill.action_failed", { ns: "accounts" }));
    const startMutation = useMutation({
        mutationFn: () => startAsOfBackfill(accountId),
        onSuccess: () => {
            setConfirmingStart(false);
            success(t("as_of_backfill.start_success", { ns: "accounts" }));
            invalidate();
        },
        onError: notifyError,
    });
    const pauseMutation = useMutation({
        mutationFn: () => pauseAsOfBackfill(accountId),
        onSuccess: () => {
            success(t("as_of_backfill.pause_success", { ns: "accounts" }));
            invalidate();
        },
        onError: notifyError,
    });
    const resumeMutation = useMutation({
        mutationFn: () => resumeAsOfBackfill(accountId),
        onSuccess: () => {
            success(t("as_of_backfill.resume_success", { ns: "accounts" }));
            invalidate();
        },
        onError: notifyError,
    });

    if (!isArchaserAdmin || isError) return null;

    const currentStatus: AsOfBackfillStatusValue = status?.status ?? "idle";
    const busy =
        startMutation.isPending ||
        pauseMutation.isPending ||
        resumeMutation.isPending;
    const canStart = ["idle", "complete", "failed"].includes(currentStatus);
    const close = () => {
        setOpen(false);
        setConfirmingStart(false);
    };
    const detail = (label: string, value: React.ReactNode) => (
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.5 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ textAlign: "end" }}>{value}</Typography>
        </Box>
    );
    const actions = confirmingStart ? (
        <>
            <Button onClick={() => setConfirmingStart(false)} disabled={busy}>
                {t("as_of_backfill.cancel_button", { ns: "accounts" })}
            </Button>
            <Button variant="contained" color="warning" onClick={() => startMutation.mutate()} disabled={busy}>
                {t("as_of_backfill.confirm_button", { ns: "accounts" })}
            </Button>
        </>
    ) : (
        <>
            <Button onClick={close} disabled={busy}>{t("as_of_backfill.close_button", { ns: "accounts" })}</Button>
            {canStart && <Button variant="contained" onClick={() => setConfirmingStart(true)} disabled={busy}>{t("as_of_backfill.start_button", { ns: "accounts" })}</Button>}
            {currentStatus === "running" && <Button variant="contained" color="warning" onClick={() => pauseMutation.mutate()} disabled={busy}>{t("as_of_backfill.pause_button", { ns: "accounts" })}</Button>}
            {currentStatus === "paused" && <Button variant="contained" onClick={() => resumeMutation.mutate()} disabled={busy}>{t("as_of_backfill.resume_button", { ns: "accounts" })}</Button>}
        </>
    );

    return (
        <>
            <Card elevation={0} sx={accountCardSx}>
                <AccountSectionCardHeader icon={HistoryIcon} title={t("as_of_backfill.title", { ns: "accounts" })} />
                <CardContent sx={accountCardContentSx}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {t("as_of_backfill.description", { ns: "accounts" })}
                    </Typography>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setOpen(true)}>
                            {t("as_of_backfill.open_button", { ns: "accounts" })}
                        </Button>
                        <Chip size="small" color={STATUS_CHIP_COLOR[currentStatus]} label={t(`as_of_backfill.status_${currentStatus}`, { ns: "accounts" })} />
                    </Stack>
                </CardContent>
            </Card>
            <AppDialog open={open} onClose={close} title={t("as_of_backfill.title", { ns: "accounts" })} titleIcon={<HistoryIcon fontSize="small" />} paperWidth="440px" actions={actions}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t("as_of_backfill.description", { ns: "accounts" })}
                </Typography>
                {detail(t("as_of_backfill.status_label", { ns: "accounts" }), <Chip size="small" color={STATUS_CHIP_COLOR[currentStatus]} label={t(`as_of_backfill.status_${currentStatus}`, { ns: "accounts" })} />)}
                {detail(t("as_of_backfill.date_range_label", { ns: "accounts" }), status?.fromDate && status?.toDate ? `${status.fromDate} → ${status.toDate}` : t("as_of_backfill.not_run", { ns: "accounts" }))}
                {detail(t("as_of_backfill.progress_label", { ns: "accounts" }), t("as_of_backfill.progress_value", { ns: "accounts", done: status?.daysDone ?? 0, total: status?.daysTotal ?? 0 }))}
                {detail(t("as_of_backfill.last_checkpoint_label", { ns: "accounts" }), status?.lastCheckpoint ?? t("as_of_backfill.not_run", { ns: "accounts" }))}
                {status?.lastError && detail(t("as_of_backfill.last_error_label", { ns: "accounts" }), <Typography variant="body2" color="error">{status.lastError}</Typography>)}
                {confirmingStart && <Box sx={{ mt: 2 }}><Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>{t("as_of_backfill.confirm_start_title", { ns: "accounts" })}</Typography><Typography variant="body2" color="text.secondary">{t("as_of_backfill.confirm_start_message", { ns: "accounts" })}</Typography></Box>}
            </AppDialog>
        </>
    );
}
