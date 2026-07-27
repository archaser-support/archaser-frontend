"use client";

import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
    Box,
    Button,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Typography,
    useTheme,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "@/app/api";
import { isAxiosError } from "axios";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import ModalScrollBox from "@/shared/layout-components/modal/ModalScrollBox";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

const SCROLL_ID = "replace-policy-modal-scroll";

type PolicyOption = {
    id: number;
    policy_number: string;
    status: string;
};

export function ReplacePolicyModal({
    open,
    onClose,
    accountId,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    accountId: number;
    onSuccess?: () => void;
}) {
    const { t, i18n } = useTranslation(["settings", "common"]);
    const theme = useTheme();
    const { success, error: showError } = useToast();
    const isRTL = i18n.language === "he";

    const [oldPolicyId, setOldPolicyId] = useState<number | "">("");
    const [newPolicyId, setNewPolicyId] = useState<number | "">("");

    const { data: policies = [], isLoading } = useQuery({
        queryKey: ["insurance-policies-replace", accountId],
        queryFn: async () => {
            const r = await api.get(
                `/api/entities/insurance-policies?account_id=${accountId}`
            );
            return (r.data?.policies ?? []) as PolicyOption[];
        },
        enabled: open && accountId > 0,
    });

    const { data: assignablePolicies = [], isLoading: isLoadingAssignable } =
        useQuery({
            queryKey: ["insurance-policies-replace-assignable", accountId],
            queryFn: async () => {
                const r = await api.get(
                    `/api/entities/insurance-policies?account_id=${accountId}&assignable_only=1`
                );
                return (r.data?.policies ?? []) as PolicyOption[];
            },
            enabled: open && accountId > 0,
        });

    const replaceMutation = useMutation({
        mutationFn: async () => {
            if (oldPolicyId === "" || newPolicyId === "") {
                throw new Error("missing");
            }
            const r = await api.post(
                "/api/entities/insurance-policies/bulk-replace",
                {
                    oldPolicyId,
                    newPolicyId,
                }
            );
            return r.data as { updatedCount: number };
        },
        onSuccess: (data) => {
            success(
                t("credit_insurance.replace_policy_success", {
                    ns: "settings",
                    count: data.updatedCount ?? 0,
                    defaultValue:
                        "Replaced policy for {{count}} customer(s).",
                })
            );
            setOldPolicyId("");
            setNewPolicyId("");
            onSuccess?.();
            onClose();
        },
        onError: (err: unknown) => {
            const msg =
                isAxiosError(err) && err.response?.data?.error
                    ? String(err.response.data.error)
                    : t("credit_insurance.replace_policy_error", {
                          ns: "settings",
                          defaultValue: "Failed to replace policy",
                      });
            showError(msg);
        },
    });

    const canSubmit =
        oldPolicyId !== "" &&
        newPolicyId !== "" &&
        oldPolicyId !== newPolicyId &&
        !replaceMutation.isPending;

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            title={t("credit_insurance.replace_policy_title", {
                ns: "settings",
                defaultValue: "Replace policy",
            })}
            titleIcon={<SwapHorizIcon aria-hidden="true" />}
            drag
            align
            slide
            isRTL={isRTL}
            ariaLabelledBy="replace-policy-title"
            ariaDescribedBy="replace-policy-desc"
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        disabled={replaceMutation.isPending}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        className="save-button"
                        disabled={!canSubmit}
                        onClick={() => replaceMutation.mutate()}
                        endIcon={
                            replaceMutation.isPending ? (
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
                        {t("credit_insurance.replace_policy_confirm", {
                            ns: "settings",
                            defaultValue: "Replace",
                        })}
                    </Button>
                </>
            }
        >
            <ModalScrollBox id={SCROLL_ID}>
                <Typography
                    id="replace-policy-desc"
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    {t("credit_insurance.replace_policy_description", {
                        ns: "settings",
                        defaultValue:
                            "All customers with the selected policy as their active policy will be moved to the replacement policy with updated terms.",
                    })}
                </Typography>
                {isLoading || isLoadingAssignable ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                        <CircularProgress size={28} />
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>
                                {t("credit_insurance.replace_policy_from", {
                                    ns: "settings",
                                    defaultValue: "Current policy",
                                })}
                            </InputLabel>
                            <Select
                                label={t("credit_insurance.replace_policy_from", {
                                    ns: "settings",
                                    defaultValue: "Current policy",
                                })}
                                value={oldPolicyId}
                                onChange={(e) =>
                                    setOldPolicyId(Number(e.target.value))
                                }
                            >
                                {policies.map((p) => (
                                    <MenuItem key={p.id} value={p.id}>
                                        {p.policy_number}
                                        {p.status !== "Active"
                                            ? ` (${p.status})`
                                            : ""}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small">
                            <InputLabel>
                                {t("credit_insurance.replace_policy_to", {
                                    ns: "settings",
                                    defaultValue: "Replacement policy",
                                })}
                            </InputLabel>
                            <Select
                                label={t("credit_insurance.replace_policy_to", {
                                    ns: "settings",
                                    defaultValue: "Replacement policy",
                                })}
                                value={newPolicyId}
                                onChange={(e) =>
                                    setNewPolicyId(Number(e.target.value))
                                }
                            >
                                {assignablePolicies.map((p) => (
                                    <MenuItem key={p.id} value={p.id}>
                                        {p.policy_number}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                )}
            </ModalScrollBox>
        </AppDialog>
    );
}
