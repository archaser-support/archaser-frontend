"use client";

import {
    Box,
    Button,
    FormControl,
    FormControlLabel,
    FormGroup,
    Grid,
    InputLabel,
    LinearProgress,
    MenuItem,
    Select as MuiSelect,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { CurrencySelect, LocaleSelect } from "@/components/LocationSelects";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import {
    fetchVatBasisRefreshStatus,
    retryVatBasisRefresh,
    type VatBasisRefreshStatus,
} from "@/shared/services/vatBasisRefreshService";
import { isStagingDeployClient } from "@/utils/domainUtils";

import { AccountDisplayData } from "../types";

interface GeneralInformationProps {
    customer: AccountDisplayData;
    onFieldChange: (key: string, value: any) => void;
    validationErrors?: Record<string, string>;
    REQUIRED_FIELDS?: string[];
    isArchaserAdmin?: boolean;
    accountId?: number | string | null;
    /** When set, VAT toggle confirm persists immediately via this callback. */
    onPersistAmountsIncludeVat?: (value: boolean) => Promise<void>;
}

const GeneralInformation: React.FC<GeneralInformationProps> = ({
    customer,
    onFieldChange,
    validationErrors: _validationErrors = {},
    REQUIRED_FIELDS: _REQUIRED_FIELDS = [],
    isArchaserAdmin = false,
    accountId,
    onPersistAmountsIncludeVat,
}) => {
    const { t } = useTranslation(["accounts", "common"]);
    const queryClient = useQueryClient();
    const showDemoToggle = isArchaserAdmin && isStagingDeployClient();
    const amountsIncludeVat = customer.amounts_include_vat !== false;
    const [pendingIncludeVat, setPendingIncludeVat] = useState<boolean | null>(
        null
    );
    const [isPersistingVat, setIsPersistingVat] = useState(false);
    const numericAccountId =
        accountId != null && accountId !== "new" ? Number(accountId) : NaN;
    const canPollVatJob = Number.isFinite(numericAccountId) && numericAccountId > 0;
    const vatJobQueryKey = ["vat-basis-refresh", numericAccountId];

    const { data: vatJobStatus } = useQuery({
        queryKey: vatJobQueryKey,
        queryFn: () => fetchVatBasisRefreshStatus(numericAccountId),
        enabled: canPollVatJob,
        refetchInterval: (query) => {
            const data = query.state.data as VatBasisRefreshStatus | undefined;
            return data?.status === "running" ? 2000 : false;
        },
    });

    const retryMutation = useMutation({
        mutationFn: () => retryVatBasisRefresh(numericAccountId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: vatJobQueryKey });
        },
    });

    const StatusOptions = [
        { value: "Active", label: t("values.status_active", { ns: "common" }) },
        {
            value: "Inactive",
            label: t("values.status_inactive", { ns: "common" }),
        },
    ];

    const BalanceEvaluationOptions = [
        {
            value: "Payment-Based",
            label: t("values.payment_based", { ns: "accounts" }),
        },
        {
            value: "Invoice-Based",
            label: t("values.invoice_based", { ns: "accounts" }),
        },
    ];

    const handleVatToggleRequest = (next: boolean) => {
        if (next === amountsIncludeVat) {
            return;
        }
        setPendingIncludeVat(next);
    };

    const handleVatConfirmCancel = () => {
        if (isPersistingVat) {
            return;
        }
        setPendingIncludeVat(null);
    };

    const handleVatConfirm = async () => {
        if (pendingIncludeVat == null) {
            return;
        }
        const next = pendingIncludeVat;
        if (!onPersistAmountsIncludeVat) {
            onFieldChange("amounts_include_vat", next);
            setPendingIncludeVat(null);
            return;
        }
        setIsPersistingVat(true);
        try {
            await onPersistAmountsIncludeVat(next);
            onFieldChange("amounts_include_vat", next);
            setPendingIncludeVat(null);
            if (canPollVatJob) {
                await queryClient.invalidateQueries({
                    queryKey: vatJobQueryKey,
                });
            }
        } catch {
            // Parent shows toast; keep previous switch value.
        } finally {
            setIsPersistingVat(false);
        }
    };

    return (
        <>
            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        label={t("fields.name", { ns: "accounts" })}
                        value={customer.name || ""}
                        onChange={(e) => onFieldChange("name", e.target.value)}
                        required
                        error={!!_validationErrors.name}
                        helperText={_validationErrors.name}
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
                        size="small"
                        variant="outlined"
                        label={t("fields.company_number", { ns: "accounts" })}
                        value={customer.company_number || ""}
                        onChange={(e) =>
                            onFieldChange("company_number", e.target.value)
                        }
                        required
                        error={!!_validationErrors.company_number}
                        helperText={_validationErrors.company_number}
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
                    <Box
                        sx={{
                            position: "relative",
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
                    >
                        <div style={{ flex: 1 }}>
                            <CurrencySelect
                                value={customer.currency || ""}
                                onChange={(value) =>
                                    onFieldChange("currency", value)
                                }
                                label={`${t("fields.currency", { ns: "accounts" })} *`}
                            />
                            {_validationErrors.currency && (
                                <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{ mt: 0.5, ml: 1.5 }}
                                >
                                    {_validationErrors.currency}
                                </Typography>
                            )}
                        </div>
                    </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <Box
                        sx={{
                            position: "relative",
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
                    >
                        <div style={{ flex: 1 }}>
                            <LocaleSelect
                                value={customer.locale || ""}
                                onChange={(value) =>
                                    onFieldChange("locale", value)
                                }
                                label={`${t("fields.locale", { ns: "accounts" })} *`}
                            />
                            {_validationErrors.locale && (
                                <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{ mt: 0.5, ml: 1.5 }}
                                >
                                    {_validationErrors.locale}
                                </Typography>
                            )}
                        </div>
                    </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <FormControl
                        fullWidth
                        size="small"
                        variant="outlined"
                        error={!!_validationErrors.balance_evaluation_method}
                        sx={{
                            padding: 0,
                            margin: 0,
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
                    >
                        <InputLabel>
                            {t("fields.balance_evaluation_method", {
                                ns: "accounts",
                            })}
                        </InputLabel>
                        <MuiSelect
                            value={
                                customer.balance_evaluation_method ||
                                "Invoice-Based"
                            }
                            onChange={(e) =>
                                onFieldChange(
                                    "balance_evaluation_method",
                                    e.target.value
                                )
                            }
                            label={t("fields.balance_evaluation_method", {
                                ns: "accounts",
                            })}
                            variant="outlined"
                        >
                            {BalanceEvaluationOptions.map((option) => (
                                <MenuItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </MenuItem>
                            ))}
                        </MuiSelect>
                        {_validationErrors.balance_evaluation_method && (
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ mt: 0.5, ml: 1.5 }}
                            >
                                {_validationErrors.balance_evaluation_method}
                            </Typography>
                        )}
                    </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        type="number"
                        label={t("fields.promise_to_pay", { ns: "accounts" })}
                        value={customer.promise_to_pay || ""}
                        onChange={(e) =>
                            onFieldChange(
                                "promise_to_pay",
                                parseFloat(e.target.value) || 0
                            )
                        }
                        required
                        error={!!_validationErrors.promise_to_pay}
                        helperText={_validationErrors.promise_to_pay}
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
                    <FormControl
                        fullWidth
                        size="small"
                        variant="outlined"
                        sx={{
                            padding: 0,
                            margin: 0,
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
                    >
                        <InputLabel>
                            {t("fields.status", { ns: "common" })}
                        </InputLabel>
                        <MuiSelect
                            value={customer.status || ""}
                            onChange={(e) =>
                                onFieldChange("status", e.target.value)
                            }
                            label={t("fields.status", { ns: "common" })}
                            variant="outlined"
                        >
                            {StatusOptions.map((option) => (
                                <MenuItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </MenuItem>
                            ))}
                        </MuiSelect>
                    </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        type="number"
                        label={t("fields.max_promise_to_pay_allowed_per_cycle", {
                            ns: "accounts",
                        })}
                        value={
                            customer.max_promise_to_pay_allowed_per_cycle || ""
                        }
                        onChange={(e) =>
                            onFieldChange(
                                "max_promise_to_pay_allowed_per_cycle",
                                parseFloat(e.target.value) || 0
                            )
                        }
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
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            borderRadius: 1,
                            px: 1.5,
                            py: 1,
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                            {t("fields.products", {
                                ns: "accounts",
                                defaultValue: "Products",
                            })}
                        </Typography>
                        <FormGroup row>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={!!customer.has_collection}
                                        onChange={(e) =>
                                            onFieldChange(
                                                "has_collection",
                                                e.target.checked
                                            )
                                        }
                                    />
                                }
                                label={t("fields.has_collection", {
                                    ns: "accounts",
                                    defaultValue: "Collection",
                                })}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={!!customer.has_credit_insurance}
                                        onChange={(e) =>
                                            onFieldChange(
                                                "has_credit_insurance",
                                                e.target.checked
                                            )
                                        }
                                    />
                                }
                                label={t("fields.has_credit_insurance", {
                                    ns: "accounts",
                                    defaultValue: "Credit Insurance",
                                })}
                            />
                            {showDemoToggle ? (
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={!!customer.is_demo}
                                            onChange={(e) =>
                                                onFieldChange(
                                                    "is_demo",
                                                    e.target.checked
                                                )
                                            }
                                        />
                                    }
                                    label={t("fields.is_demo", {
                                        ns: "accounts",
                                        defaultValue: "Demo account",
                                    })}
                                />
                            ) : null}
                            {isArchaserAdmin ? (
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={
                                                !!customer.enable_customer_checkpoints
                                            }
                                            onChange={(e) =>
                                                onFieldChange(
                                                    "enable_customer_checkpoints",
                                                    e.target.checked
                                                )
                                            }
                                        />
                                    }
                                    label={t(
                                        "fields.enable_customer_checkpoints",
                                        {
                                            ns: "accounts",
                                            defaultValue:
                                                "Customer checkpoints",
                                        }
                                    )}
                                />
                            ) : null}
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={amountsIncludeVat}
                                        disabled={isPersistingVat}
                                        onChange={(e) =>
                                            handleVatToggleRequest(
                                                e.target.checked
                                            )
                                        }
                                    />
                                }
                                label={t("fields.amounts_include_vat", {
                                    ns: "accounts",
                                })}
                            />
                            {vatJobStatus?.status === "running" ||
                            vatJobStatus?.status === "failed" ? (
                                <Box sx={{ mt: 1.5, width: "100%" }}>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mb: 0.5 }}
                                    >
                                        {t("vat_basis.progress_value", {
                                            ns: "accounts",
                                            done:
                                                vatJobStatus.customersDone ?? 0,
                                            total:
                                                vatJobStatus.customersTotal ??
                                                0,
                                        })}
                                        {vatJobStatus.estimatedSecondsRemaining !=
                                        null
                                            ? ` · ${t("vat_basis.eta_seconds", {
                                                  ns: "accounts",
                                                  seconds:
                                                      vatJobStatus.estimatedSecondsRemaining,
                                              })}`
                                            : null}
                                    </Typography>
                                    {vatJobStatus.status === "running" ? (
                                        <LinearProgress
                                            variant={
                                                vatJobStatus.customersTotal > 0
                                                    ? "determinate"
                                                    : "indeterminate"
                                            }
                                            value={
                                                vatJobStatus.customersTotal > 0
                                                    ? Math.min(
                                                          100,
                                                          (vatJobStatus.customersDone /
                                                              vatJobStatus.customersTotal) *
                                                              100
                                                      )
                                                    : 0
                                            }
                                        />
                                    ) : null}
                                    {vatJobStatus.status === "failed" ? (
                                        <Box sx={{ mt: 1 }}>
                                            <Typography
                                                variant="body2"
                                                color="error"
                                            >
                                                {vatJobStatus.lastError ||
                                                    t("vat_basis.refresh_failed", {
                                                        ns: "accounts",
                                                    })}
                                            </Typography>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                sx={{ mt: 1 }}
                                                disabled={retryMutation.isPending}
                                                onClick={() =>
                                                    retryMutation.mutate()
                                                }
                                            >
                                                {t("vat_basis.retry_button", {
                                                    ns: "accounts",
                                                })}
                                            </Button>
                                        </Box>
                                    ) : null}
                                </Box>
                            ) : null}
                        </FormGroup>
                    </Box>
                </Grid>
            </Grid>
            <AppDialog
                open={pendingIncludeVat != null}
                onClose={handleVatConfirmCancel}
                title={t("vat_basis.confirm_title", { ns: "accounts" })}
                paperWidth="440px"
                actions={
                    <>
                        <Button
                            onClick={handleVatConfirmCancel}
                            disabled={isPersistingVat}
                        >
                            {t("vat_basis.cancel_button", { ns: "accounts" })}
                        </Button>
                        <Button
                            variant="contained"
                            color="warning"
                            onClick={() => void handleVatConfirm()}
                            disabled={isPersistingVat}
                        >
                            {t("vat_basis.confirm_button", { ns: "accounts" })}
                        </Button>
                    </>
                }
            >
                <Typography variant="body2" color="text.secondary">
                    {t("vat_basis.confirm_message", { ns: "accounts" })}
                </Typography>
            </AppDialog>
        </>
    );
};

export default GeneralInformation;
