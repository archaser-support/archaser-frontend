"use client";

import ClearIcon from "@mui/icons-material/Clear";
import GavelIcon from "@mui/icons-material/Gavel";
import SearchIcon from "@mui/icons-material/Search";
import {
    Box,
    Button,
    Checkbox,
    Chip,
    FormControl,
    FormHelperText,
    IconButton,
    InputAdornment,
    InputLabel,
    ListItemText,
    MenuItem,
    OutlinedInput,
    Select,
    TextField,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import api from "@/app/api";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import CustomerNumberAutocomplete from "@/shared/components/CustomerNumberAutocomplete";
import { MonthEndFieldLabelWithTooltip } from "@/shared/creditInsurance/MonthEndFieldLabelWithTooltip";
import {
    CLAIM_STATUSES,
    canOverrideRecognizedLoss,
    claimCustomerDisplayName,
    createClaim,
    normalizeClaimStatus,
    requiresLossDate,
    requiresSubmissionFields,
    type ClaimRecord,
    type ClaimStatus,
    type CreateClaimPayload,
    type UpdateClaimPayload,
    updateClaim,
} from "@/shared/services/claimsService";
import { formatMoney } from "@/utils/stringFormatters";

function toDateInputValue(value: string | Date | null | undefined): string {
    if (value == null || value === "") {
        return "";
    }
    if (typeof value === "string") {
        return value.slice(0, 10);
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    return "";
}

function moneyToInput(value: number | string | null | undefined): string {
    if (value == null || value === "") {
        return "";
    }
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : "";
}

type InvoiceOption = {
    value: string;
    label: string;
    id: number;
    invoice_number: string;
};

type ClaimFormState = {
    status: ClaimStatus;
    recognized_loss: string;
    loss_date: string;
    submission_date: string;
    insurer_submission_reference: string;
    notes: string;
    customer_id: string;
    customer_number: string;
};

const emptyForm = (): ClaimFormState => ({
    status: "Draft",
    recognized_loss: "",
    loss_date: "",
    submission_date: "",
    insurer_submission_reference: "",
    notes: "",
    customer_id: "",
    customer_number: "",
});

function formFromClaim(claim: ClaimRecord): ClaimFormState {
    return {
        status: normalizeClaimStatus(claim.status) ?? "Draft",
        recognized_loss: moneyToInput(claim.recognized_loss),
        loss_date: toDateInputValue(claim.loss_date),
        submission_date: toDateInputValue(claim.submission_date),
        insurer_submission_reference:
            claim.insurer_submission_reference?.trim() || "",
        notes: claim.notes || "",
        customer_id:
            claim.customer_id != null ? String(claim.customer_id) : "",
        customer_number: "",
    };
}

export type ClaimFormDialogProps = {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    claim: ClaimRecord | null;
};

export default function ClaimFormDialog({
    open,
    onClose,
    onSuccess,
    claim,
}: ClaimFormDialogProps) {
    const { t, i18n } = useTranslation(["claims", "common"]);
    const theme = useTheme();
    const { showToast } = useToast();
    const isRTL = i18n.language === "he";
    const isEdit = claim != null;

    const [form, setForm] = useState<ClaimFormState>(emptyForm);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [selectedInvoices, setSelectedInvoices] = useState<InvoiceOption[]>(
        []
    );
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState("");
    const [isInvoiceSelectOpen, setIsInvoiceSelectOpen] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }
        setForm(claim ? formFromClaim(claim) : emptyForm());
        setFieldErrors({});
        setSelectedInvoices([]);
        setInvoiceSearchTerm("");
        setIsInvoiceSelectOpen(false);
    }, [open, claim]);

    const customerIdNumber = Number(form.customer_id.trim());
    const hasSelectedCustomer =
        Number.isFinite(customerIdNumber) && customerIdNumber > 0;

    const {
        data: invoiceResponse,
        isError: invoicesFailed,
        isFetching: invoicesLoading,
    } = useQuery({
        queryKey: ["claims", "customer-invoices", "due-overdue", customerIdNumber],
        queryFn: async () => {
            const sharedParams = {
                customer_id: customerIdNumber,
                page: 1,
                limit: 500,
                sortField: "invoice_date",
                sortDirection: "desc",
            };
            const [dueResponse, overdueResponse] = await Promise.all([
                api.get("/entities/invoices", {
                    params: { ...sharedParams, status: "Due" },
                }),
                api.get("/entities/invoices", {
                    params: { ...sharedParams, status: "Overdue" },
                }),
            ]);
            const dueInvoices =
                (dueResponse.data as { invoices?: Array<Record<string, unknown>> })
                    ?.invoices ?? [];
            const overdueInvoices =
                (
                    overdueResponse.data as {
                        invoices?: Array<Record<string, unknown>>;
                    }
                )?.invoices ?? [];
            const byId = new Map<number, Record<string, unknown>>();
            for (const invoice of [...dueInvoices, ...overdueInvoices]) {
                const id = Number(invoice.id);
                if (Number.isFinite(id)) {
                    byId.set(id, invoice);
                }
            }
            return {
                invoices: Array.from(byId.values()),
            };
        },
        enabled: open && !isEdit && hasSelectedCustomer,
    });

    const mappedInvoiceOptions = useMemo((): InvoiceOption[] => {
        const invoices = invoiceResponse?.invoices;
        if (!Array.isArray(invoices) || invoices.length === 0) {
            return [];
        }
        return invoices.map((invoice) => {
            const id = Number(invoice.id);
            const invoiceNumber = String(
                invoice.invoice_number ?? invoice.invoiceNumber ?? id
            );
            const amount =
                invoice.outstanding_debt ??
                invoice.customer_outstanding_debt ??
                invoice.amount ??
                null;
            const currency =
                (invoice.customer_currency as string | undefined) ||
                undefined;
            const amountLabel =
                amount != null && Number.isFinite(Number(amount))
                    ? ` - ${formatMoney(Number(amount), currency, {
                          language: i18n.language,
                      })}`
                    : "";
            return {
                id,
                value: String(id),
                invoice_number: invoiceNumber,
                label: `${t("fields.invoice", { ns: "claims" })} #${invoiceNumber}${amountLabel}`,
            };
        });
    }, [invoiceResponse, i18n.language, t]);

    const filteredInvoiceOptions = useMemo(() => {
        if (!invoiceSearchTerm.trim()) {
            return mappedInvoiceOptions;
        }
        const term = invoiceSearchTerm.toLowerCase();
        return mappedInvoiceOptions.filter(
            (invoice) =>
                invoice.invoice_number.toLowerCase().includes(term) ||
                invoice.label.toLowerCase().includes(term)
        );
    }, [mappedInvoiceOptions, invoiceSearchTerm]);

    const hasLinkedInvoice = isEdit
        ? claim?.invoice_id != null
        : selectedInvoices.length > 0;

    const recognizedLossEditable =
        !isEdit || canOverrideRecognizedLoss(String(claim?.status ?? "Draft"));

    const statusOptions = useMemo(
        () =>
            CLAIM_STATUSES.map((status) => ({
                value: status,
                label: t(`statuses.${status}`, { ns: "claims" }),
            })),
        [t]
    );

    const setField = useCallback(
        <K extends keyof ClaimFormState>(key: K, value: ClaimFormState[K]) => {
            setForm((prev) => ({ ...prev, [key]: value }));
            setFieldErrors((prev) => {
                if (!prev[key]) {
                    return prev;
                }
                const next = { ...prev };
                delete next[key];
                return next;
            });
        },
        []
    );

    const handleCustomerNumberChange = useCallback((customerNumber: string) => {
        setForm((prev) => ({
            ...prev,
            customer_number: customerNumber,
            ...(customerNumber.trim() === ""
                ? { customer_id: "" }
                : {}),
        }));
        if (customerNumber.trim() === "") {
            setSelectedInvoices([]);
            setInvoiceSearchTerm("");
            setFieldErrors((prev) => {
                if (!prev.customer_id) {
                    return prev;
                }
                const next = { ...prev };
                delete next.customer_id;
                return next;
            });
        }
    }, []);

    const handleCustomerSelect = useCallback(
        (
            customer: {
                id: number;
                customer_number: string | null;
                name: string;
            } | null
        ) => {
            setForm((prev) => ({
                ...prev,
                customer_id: customer ? String(customer.id) : "",
                customer_number: customer?.customer_number?.trim() || "",
            }));
            setSelectedInvoices([]);
            setInvoiceSearchTerm("");
            setFieldErrors((prev) => {
                if (!prev.customer_id && !prev.invoice_id) {
                    return prev;
                }
                const next = { ...prev };
                delete next.customer_id;
                delete next.invoice_id;
                return next;
            });
        },
        []
    );

    const handleInvoiceSelection = useCallback(
        (selectedValues: string[]) => {
            const next = mappedInvoiceOptions.filter((invoice) =>
                selectedValues.includes(invoice.value)
            );
            setSelectedInvoices(next);
            setFieldErrors((prev) => {
                if (!prev.invoice_id) {
                    return prev;
                }
                const nextErrors = { ...prev };
                delete nextErrors.invoice_id;
                return nextErrors;
            });
            setIsInvoiceSelectOpen(true);
        },
        [mappedInvoiceOptions]
    );

    const handleRemoveInvoice = useCallback((invoiceValue: string) => {
        setSelectedInvoices((prev) =>
            prev.filter((invoice) => invoice.value !== invoiceValue)
        );
    }, []);

    const handleClearAllInvoices = useCallback(() => {
        setSelectedInvoices([]);
        setInvoiceSearchTerm("");
    }, []);

    const validate = useCallback((): boolean => {
        const errors: Record<string, string> = {};
        const hasInvoice = isEdit
            ? claim?.invoice_id != null
            : selectedInvoices.length > 0;

        if (!isEdit) {
            const customerId = Number(form.customer_id.trim());
            if (!Number.isFinite(customerId) || customerId <= 0) {
                errors.customer_id = t("messages.customer_id_required", {
                    ns: "claims",
                });
            }
        }

        if (requiresLossDate(form.status) && !form.loss_date.trim()) {
            errors.loss_date = t("messages.loss_date_required", {
                ns: "claims",
            });
        }

        if (!hasInvoice && !form.recognized_loss.trim()) {
            errors.recognized_loss = t("messages.recognized_loss_required", {
                ns: "claims",
            });
        }

        if (form.recognized_loss.trim() !== "") {
            const loss = Number(form.recognized_loss);
            if (!Number.isFinite(loss) || loss < 0) {
                errors.recognized_loss = t("messages.recognized_loss_required", {
                    ns: "claims",
                });
            }
        }

        if (requiresSubmissionFields(form.status)) {
            if (!form.submission_date.trim()) {
                errors.submission_date = t(
                    "messages.submission_date_required",
                    { ns: "claims" }
                );
            }
            if (!form.insurer_submission_reference.trim()) {
                errors.insurer_submission_reference = t(
                    "messages.insurer_reference_required",
                    { ns: "claims" }
                );
            }
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    }, [claim?.invoice_id, form, isEdit, selectedInvoices.length, t]);

    const mutation = useMutation({
        mutationFn: async (vars: {
            isEdit: boolean;
            claimId: number | null;
            updatePayload?: UpdateClaimPayload;
            createPayloads?: CreateClaimPayload[];
        }) => {
            if (vars.isEdit && vars.claimId != null && vars.updatePayload) {
                return updateClaim(vars.claimId, vars.updatePayload);
            }
            const payloads = vars.createPayloads ?? [];
            if (payloads.length === 0) {
                throw new Error("Nothing to save");
            }
            if (payloads.length === 1) {
                return createClaim(payloads[0]);
            }
            const created = [];
            for (const payload of payloads) {
                created.push(await createClaim(payload));
            }
            return created;
        },
        onSuccess: (result) => {
            const count = Array.isArray(result) ? result.length : 1;
            showToast(
                count > 1
                    ? t("messages.create_success_multiple", {
                          ns: "claims",
                          count,
                      })
                    : t(
                          isEdit
                              ? "messages.update_success"
                              : "messages.create_success",
                          { ns: "claims" }
                      ),
                "success"
            );
            onSuccess();
            onClose();
        },
        onError: (err: unknown) => {
            const fallback = t(
                isEdit ? "messages.update_failed" : "messages.create_failed",
                { ns: "claims" }
            );
            if (axios.isAxiosError(err)) {
                const data = err.response?.data as
                    | { error?: string }
                    | undefined;
                showToast(
                    String(data?.error ?? err.message ?? fallback),
                    "error"
                );
                return;
            }
            showToast(
                err instanceof Error ? err.message : fallback,
                "error"
            );
        },
    });

    const handleSubmit = useCallback(() => {
        if (!validate()) {
            return;
        }

        if (isEdit && claim) {
            const payload: UpdateClaimPayload = {
                status: form.status,
                notes: form.notes.trim() || null,
                submission_date: form.submission_date.trim() || null,
                insurer_submission_reference:
                    form.insurer_submission_reference.trim() || null,
            };
            if (recognizedLossEditable && form.recognized_loss.trim()) {
                payload.recognized_loss = Number(form.recognized_loss);
            }
            if (
                requiresLossDate(form.status) ||
                (claim.invoice_id == null && form.loss_date.trim())
            ) {
                payload.loss_date = form.loss_date.trim() || null;
            }
            mutation.mutate({
                isEdit: true,
                claimId: claim.id,
                updatePayload: payload,
            });
            return;
        }

        const customerId = Number(form.customer_id.trim());
        const shared: Omit<CreateClaimPayload, "invoice_id"> = {
            status: form.status,
            customer_id: customerId,
            notes: form.notes.trim() || null,
            submission_date: form.submission_date.trim() || null,
            insurer_submission_reference:
                form.insurer_submission_reference.trim() || null,
            require_eligibility: false,
        };
        if (form.recognized_loss.trim()) {
            shared.recognized_loss = Number(form.recognized_loss);
        }

        const createPayloads: CreateClaimPayload[] =
            selectedInvoices.length === 0
                ? [
                      {
                          ...shared,
                          ...(form.loss_date.trim()
                              ? { loss_date: form.loss_date.trim() }
                              : {}),
                          recognized_loss: Number(form.recognized_loss),
                      },
                  ]
                : selectedInvoices.map((invoice) => ({
                      ...shared,
                      invoice_id: invoice.id,
                      ...(form.loss_date.trim()
                          ? { loss_date: form.loss_date.trim() }
                          : {}),
                  }));

        mutation.mutate({
            isEdit: false,
            claimId: null,
            createPayloads,
        });
    }, [
        claim,
        form,
        isEdit,
        mutation,
        recognizedLossEditable,
        selectedInvoices,
        validate,
    ]);

    const editContextLabel = useMemo(() => {
        if (!claim) {
            return "";
        }
        const parts = [`${t("fields.id", { ns: "claims" })}: ${claim.id}`];
        if (claim.Invoice?.invoice_number) {
            parts.push(
                `${t("fields.invoice", { ns: "claims" })}: ${claim.Invoice.invoice_number}`
            );
        }
        const customerName = claimCustomerDisplayName(claim.Customer);
        if (customerName) {
            parts.push(customerName);
        }
        return parts.join(" · ");
    }, [claim, t]);

    const fieldLabel = useCallback(
        (fieldKey: string, labelText: string) => (
            <MonthEndFieldLabelWithTooltip
                label={labelText}
                tooltip={t(`tooltips.${fieldKey}`, { ns: "claims" })}
                isRtl={isRTL}
            />
        ),
        [isRTL, t]
    );

    const invoiceFieldLabelText = `${t("fields.invoice", { ns: "claims" })} (${t("fields.optional", { ns: "claims" })})`;

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            isRTL={isRTL}
            title={t(isEdit ? "actions.edit" : "actions.create", {
                ns: "claims",
            })}
            titleIcon={<GavelIcon />}
            paperWidth="480px"
            actions={
                <>
                    <Button
                        onClick={onClose}
                        disabled={mutation.isPending}
                        className="cancel-button"
                    >
                        {t("actions.cancel", { ns: "claims" })}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={mutation.isPending}
                        variant="contained"
                        className="save-button"
                    >
                        {t("actions.save", { ns: "claims" })}
                    </Button>
                </>
            }
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: theme.spacing(2),
                    pt: theme.spacing(1),
                    direction: isRTL ? "rtl" : "ltr",
                }}
            >
                {isEdit && claim ? (
                    <Typography variant="body2" color="text.secondary">
                        {editContextLabel}
                    </Typography>
                ) : (
                    <>
                        <CustomerNumberAutocomplete
                            value={form.customer_number}
                            onChange={handleCustomerNumberChange}
                            onCustomerSelect={handleCustomerSelect}
                            error={fieldErrors.customer_id}
                            label={fieldLabel(
                                "customer",
                                t("fields.customer", { ns: "claims" })
                            )}
                            size="small"
                        />

                        <FormControl
                            fullWidth
                            size="small"
                            error={Boolean(fieldErrors.invoice_id)}
                            disabled={!hasSelectedCustomer || invoicesLoading}
                            dir={isRTL ? "rtl" : "ltr"}
                            {...(isRTL && {
                                "data-hebrew": true,
                                "data-rtl": true,
                            })}
                        >
                            <InputLabel id="claim-invoices-label" shrink>
                                {fieldLabel("invoice", invoiceFieldLabelText)}
                            </InputLabel>
                            <Select<string[]>
                                labelId="claim-invoices-label"
                                id="claim-invoices"
                                multiple
                                open={isInvoiceSelectOpen}
                                onOpen={() => setIsInvoiceSelectOpen(true)}
                                onClose={() => setIsInvoiceSelectOpen(false)}
                                value={selectedInvoices.map(
                                    (invoice) => invoice.value
                                )}
                                onChange={(event) => {
                                    handleInvoiceSelection(
                                        event.target.value as string[]
                                    );
                                }}
                                displayEmpty
                                input={
                                    <OutlinedInput
                                        size="small"
                                        notched
                                        label={invoiceFieldLabelText}
                                        className="input-toolbar-labeled"
                                    />
                                }
                                renderValue={() => (
                                    <>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                flexWrap: "wrap",
                                                gap: 0.5,
                                                height: "100%",
                                                maxHeight: 60,
                                                overflow: "auto",
                                                pr:
                                                    selectedInvoices.length > 0
                                                        ? isRTL
                                                            ? "0"
                                                            : "56px"
                                                        : 0,
                                                pl:
                                                    selectedInvoices.length > 0
                                                        ? isRTL
                                                            ? "56px"
                                                            : "0"
                                                        : 0,
                                            }}
                                        >
                                            {selectedInvoices.length === 0 ? (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {t(
                                                        "fields.select_invoices",
                                                        { ns: "claims" }
                                                    )}
                                                </Typography>
                                            ) : (
                                                selectedInvoices.map(
                                                    (invoice) => (
                                                        <Chip
                                                            key={invoice.value}
                                                            label={invoice.label}
                                                            size="small"
                                                            onDelete={() =>
                                                                handleRemoveInvoice(
                                                                    invoice.value
                                                                )
                                                            }
                                                        />
                                                    )
                                                )
                                            )}
                                        </Box>
                                        {selectedInvoices.length > 0 && (
                                            <IconButton
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleClearAllInvoices();
                                                    setIsInvoiceSelectOpen(
                                                        false
                                                    );
                                                }}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                size="small"
                                                sx={{
                                                    position: "absolute",
                                                    right: isRTL
                                                        ? "auto"
                                                        : "32px",
                                                    left: isRTL
                                                        ? "36px"
                                                        : "auto",
                                                    top: "50%",
                                                    transform:
                                                        "translateY(-50%)",
                                                    height: "28px",
                                                    width: "28px",
                                                    zIndex: 1,
                                                }}
                                            >
                                                <ClearIcon />
                                            </IconButton>
                                        )}
                                    </>
                                )}
                                MenuProps={{
                                    PaperProps: {
                                        sx: {
                                            maxHeight: 300,
                                            direction: isRTL ? "rtl" : "ltr",
                                        },
                                    },
                                    keepMounted: true,
                                    onClose: (_event, reason) => {
                                        if (
                                            reason === "escapeKeyDown" ||
                                            reason === "backdropClick" ||
                                            reason === "tabKeyDown"
                                        ) {
                                            setIsInvoiceSelectOpen(false);
                                            setTimeout(() => {
                                                setInvoiceSearchTerm("");
                                            }, 100);
                                        }
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        p: 1,
                                        borderBottom: 1,
                                        borderColor: "divider",
                                    }}
                                >
                                    <TextField
                                        size="small"
                                        placeholder={t(
                                            "fields.search_placeholder",
                                            { ns: "common" }
                                        )}
                                        value={invoiceSearchTerm}
                                        onChange={(e) =>
                                            setInvoiceSearchTerm(e.target.value)
                                        }
                                        dir={isRTL ? "rtl" : "ltr"}
                                        {...(isRTL && {
                                            "data-hebrew": true,
                                        })}
                                        fullWidth
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon
                                                        fontSize="small"
                                                        color="action"
                                                    />
                                                </InputAdornment>
                                            ),
                                            endAdornment: invoiceSearchTerm ? (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() =>
                                                            setInvoiceSearchTerm(
                                                                ""
                                                            )
                                                        }
                                                    >
                                                        <ClearIcon fontSize="small" />
                                                    </IconButton>
                                                </InputAdornment>
                                            ) : null,
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.stopPropagation()}
                                    />
                                </Box>

                                {filteredInvoiceOptions.length > 0 ? (
                                    filteredInvoiceOptions.map((invoice) => {
                                        const isSelected =
                                            selectedInvoices.some(
                                                (selected) =>
                                                    selected.value ===
                                                    invoice.value
                                            );
                                        return (
                                            <MenuItem
                                                key={invoice.value}
                                                value={invoice.value}
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                    py: 1,
                                                }}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    sx={{ p: 0 }}
                                                />
                                                <ListItemText
                                                    primary={invoice.label}
                                                    primaryTypographyProps={{
                                                        fontSize: "0.875rem",
                                                    }}
                                                />
                                            </MenuItem>
                                        );
                                    })
                                ) : (
                                    <MenuItem
                                        disabled
                                        sx={{ py: 2, textAlign: "center" }}
                                    >
                                        {invoicesFailed
                                            ? t("messages.error", {
                                                  ns: "common",
                                              })
                                            : invoiceSearchTerm
                                              ? t(
                                                    "fields.no_invoices_found",
                                                    { ns: "claims" }
                                                )
                                              : t(
                                                    "fields.no_invoices_available",
                                                    { ns: "claims" }
                                                )}
                                    </MenuItem>
                                )}
                            </Select>
                            {fieldErrors.invoice_id && (
                                <FormHelperText>
                                    {fieldErrors.invoice_id}
                                </FormHelperText>
                            )}
                        </FormControl>
                    </>
                )}

                <TextField
                    select
                    label={fieldLabel(
                        "status",
                        t("fields.status", { ns: "claims" })
                    )}
                    value={form.status}
                    onChange={(e) =>
                        setField("status", e.target.value as ClaimStatus)
                    }
                    fullWidth
                    size="small"
                >
                    {statusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.label}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    label={fieldLabel(
                        "recognized_loss",
                        t("fields.recognized_loss", { ns: "claims" })
                    )}
                    value={form.recognized_loss}
                    onChange={(e) =>
                        setField("recognized_loss", e.target.value)
                    }
                    error={Boolean(fieldErrors.recognized_loss)}
                    helperText={fieldErrors.recognized_loss}
                    fullWidth
                    size="small"
                    disabled={!recognizedLossEditable}
                    required={!hasLinkedInvoice}
                    inputProps={{ inputMode: "decimal" }}
                />

                <Box
                    sx={{
                        display: "flex",
                        gap: theme.spacing(2),
                        alignItems: "flex-start",
                    }}
                >
                    <TextField
                        label={fieldLabel(
                            "submission_date",
                            t("fields.submission_date", { ns: "claims" })
                        )}
                        type="date"
                        value={form.submission_date}
                        onChange={(e) =>
                            setField("submission_date", e.target.value)
                        }
                        error={Boolean(fieldErrors.submission_date)}
                        helperText={fieldErrors.submission_date}
                        fullWidth
                        size="small"
                        required={requiresSubmissionFields(form.status)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1 }}
                    />
                    {(requiresLossDate(form.status) ||
                        ((!isEdit || claim?.invoice_id == null) &&
                            !hasLinkedInvoice)) && (
                        <TextField
                            label={fieldLabel(
                                "loss_date",
                                t("fields.loss_date", { ns: "claims" })
                            )}
                            type="date"
                            value={form.loss_date}
                            onChange={(e) =>
                                setField("loss_date", e.target.value)
                            }
                            error={Boolean(fieldErrors.loss_date)}
                            helperText={fieldErrors.loss_date}
                            fullWidth
                            size="small"
                            required={requiresLossDate(form.status)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                        />
                    )}
                </Box>

                <TextField
                    label={fieldLabel(
                        "insurer_submission_reference",
                        t("fields.insurer_submission_reference", {
                            ns: "claims",
                        })
                    )}
                    value={form.insurer_submission_reference}
                    onChange={(e) =>
                        setField(
                            "insurer_submission_reference",
                            e.target.value
                        )
                    }
                    error={Boolean(fieldErrors.insurer_submission_reference)}
                    helperText={fieldErrors.insurer_submission_reference}
                    fullWidth
                    size="small"
                    required={requiresSubmissionFields(form.status)}
                />

                <TextField
                    label={fieldLabel(
                        "notes",
                        t("fields.notes", { ns: "claims" })
                    )}
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                />
            </Box>
        </AppDialog>
    );
}
