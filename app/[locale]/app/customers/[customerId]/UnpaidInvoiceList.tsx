"use client";
import {
    EditNote as EditNoteIcon,
    Payments as PaymentsIcon,
    Receipt as ReceiptIcon,
} from "@mui/icons-material";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid/ViewBasedDataGrid";
import { fetchCustomerById } from "@/shared/services/customerService";
import { Customer } from "@/types/Customer";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

import { CreditInsuranceViolationsCell } from "./CreditInsuranceViolationsCell";
import InvoiceCreditInsuranceReportingModal from "./InvoiceCreditInsuranceReportingModal";
import LastPaymentDateDialog from "./LastPaymentDateDialog";

interface CustomerProp {
    customer?: Customer | null;
    /** When true, invoice numbers open a modal to edit credit-insurance reporting fields */
    isCreditInsuranceAccount?: boolean;
    /** When true, each invoice row shows the "Set Last Payment Date" action */
    isCollectionAccount?: boolean;
}

const UnpaidInvoiceList: React.FC<CustomerProp> = ({
    customer: propCustomer,
    isCreditInsuranceAccount = false,
    isCollectionAccount = false,
}) => {
    const queryClient = useQueryClient();
    const { t, i18n } = useTranslation(["customers", "common", "invoices"]);
    const params = useParams();
    const searchParams = useSearchParams();
    const customerId = params?.customerId as string;
    const { data: session } = useSession();
    const theme = useTheme();

    // Get invoice ID to highlight from query parameter
    const highlightInvoiceId = searchParams?.get("highlightInvoice");
    const parsedHighlightInvoiceId = highlightInvoiceId
        ? parseInt(highlightInvoiceId, 10)
        : null;
    const invoiceIdToHighlight = Number.isFinite(parsedHighlightInvoiceId)
        ? parsedHighlightInvoiceId
        : null;

    // Search state
    const [search, setSearch] = useState("");
    // Track if view was manually selected (not from URL or auto-selected)
    const [isManualSelection, setIsManualSelection] = useState(false);
    const [selectedViewId, setSelectedViewId] = useState<number | null>(null);
    const [gridRefreshTrigger, setGridRefreshTrigger] = useState(0);
    const [reportingModalOpen, setReportingModalOpen] = useState(false);
    const [reportingRow, setReportingRow] = useState<Record<
        string,
        unknown
    > | null>(null);
    const [ptpDialogOpen, setPtpDialogOpen] = useState(false);
    const [ptpInvoiceId, setPtpInvoiceId] = useState<number | null>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const { data: fetchedCustomer } = useQuery<Customer>({
        queryKey: ["customer", parseInt(customerId)],
        queryFn: fetchCustomerById,
        enabled: !propCustomer,
    });

    const customer = propCustomer || fetchedCustomer;

    const hasCustomerPolicy = Boolean(
        (customer as Customer & { InsurancePolicy?: { id?: number } | null })
            ?.InsurancePolicy?.id ??
        (customer as Customer & { policy_id?: number | null })?.policy_id
    );

    // Helper function to translate invoice status names
    const translateStatusName = useCallback(
        (statusName: string | null | undefined): string => {
            if (!statusName) return "";

            // Convert status name to snake_case translation key
            const statusKey = statusName
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/[^a-z0-9_]/g, "");

            // Try to get translation, fallback to original name if not found
            const translatedStatus = t(`values.invoice_status_${statusKey}`, {
                ns: "invoices",
                defaultValue: statusName,
            });

            return translatedStatus;
        },
        [t]
    );

    // Additional filters for customer_id
    const additionalFilters = useMemo(() => {
        if (!customer?.id) return undefined;
        return [
            {
                table: "Invoice",
                field: "customer_id",
                operator: "equals",
                value: customer.id,
            },
        ];
    }, [customer?.id]);

    const openCreditInsuranceReportingModal = useCallback(
        (row: Record<string, unknown>) => {
            setReportingRow(row);
            setReportingModalOpen(true);
        },
        []
    );

    const renderCreditInsuranceInvoiceNumberCell = useCallback(
        (params: any) => {
            const displayValue =
                params?.value ??
                params?.row?.["Invoice.invoice_number"] ??
                params?.row?.invoice_number ??
                "";
            const rawId = params?.row?.id;
            const invoiceId =
                typeof rawId === "number" ? rawId : Number(rawId);
            return (
                <Typography
                    variant="body2"
                    component="button"
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
                            return;
                        }
                        openCreditInsuranceReportingModal(params.row);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    sx={{
                        color: "primary.main",
                        cursor: "pointer",
                        textDecoration: "none",
                        border: "none",
                        background: "none",
                        font: "inherit",
                        padding: 0,
                        textAlign: "inherit",
                        pointerEvents: "auto",
                        "&:hover": { textDecoration: "underline" },
                    }}
                >
                    {displayValue}
                </Typography>
            );
        },
        [openCreditInsuranceReportingModal]
    );

    const formatAmountCell = useCallback(
        (val: any, rowCurrency: string) => {
            if (val === undefined || val === null || val === "") return "";
            const currency = rowCurrency || "";
            if (typeof val === "number") {
                return formatCurrencyWithRTLSupport(
                    val,
                    currency,
                    getUserDateLocale(session),
                    i18n.language
                );
            }
            if (typeof val === "string") {
                const trimmed = val.trim();
                if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
                    const num = parseFloat(trimmed);
                    if (!isNaN(num)) {
                        return formatCurrencyWithRTLSupport(
                            num,
                            currency,
                            getUserDateLocale(session),
                            i18n.language
                        );
                    }
                }
                return trimmed;
            }
            return String(val);
        },
        [session, i18n.language]
    );

    // Custom cell renderers for invoice columns
    const customCellRenderers = useMemo(() => {
        const base: Record<string, (params: any) => React.ReactNode> = {
            InvoiceStatus: (params: any) => {
                const status = params?.value || params?.row?.status || params?.row?.["Invoice.status"];
                return status ? (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                color: status.color_code || "#808080",
                                fontWeight: 500,
                                lineHeight: 1.2,
                                margin: 0,
                                padding: 0,
                            }}
                        >
                            {translateStatusName(typeof status === 'string' ? status : status.name)}
                        </Typography>
                    </Box>
                ) : null;
            },
            customer_amount: (params: any) => {
                const amount = params?.value !== undefined && params?.value !== null ? params.value : params?.row?.customer_amount ?? 0;
                const currency = params?.row?.customer_currency || params?.row?.["Invoice.customer_currency"] || params?.row?.currency || "";
                const formattedAmount = formatAmountCell(amount, currency);
                const isRTL = i18n.language === "he";
                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                                unicodeBidi: isRTL ? "plaintext" : "normal",
                            }}
                        >
                            {formattedAmount}
                        </Typography>
                    </Box>
                );
            },
            customer_net_amount: (params: any) => {
                const netAmount = params?.value !== undefined && params?.value !== null ? params.value : params?.row?.customer_net_amount ?? 0;
                const currency = params?.row?.customer_currency || params?.row?.["Invoice.customer_currency"] || params?.row?.currency || "";
                const formattedAmount = formatAmountCell(netAmount, currency);
                const isRTL = i18n.language === "he";
                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                                unicodeBidi: isRTL ? "plaintext" : "normal",
                            }}
                        >
                            {formattedAmount}
                        </Typography>
                    </Box>
                );
            },
            due_date: (params: any) => {
                const dueDate = params?.value || params?.row?.due_date || params?.row?.["Invoice.due_date"];
                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography variant="body2">
                            {dueDate
                                ? formatDateForDisplay(
                                    dueDate.toString(),
                                    "date",
                                    getUserDateLocale(session),
                                    getUserTimezone(session)
                                )
                                : null}
                        </Typography>
                    </Box>
                );
            },
            customer_total_paid: (params: any) => {
                const totalPaid = params?.value !== undefined && params?.value !== null ? params.value : params?.row?.customer_total_paid || 0;
                const currency = params?.row?.customer_currency || "";
                const formattedAmount = typeof totalPaid === "string" ? totalPaid : formatCurrencyWithRTLSupport(
                    totalPaid,
                    currency,
                    getUserDateLocale(session),
                    i18n.language
                );
                const isRTL = i18n.language === "he";
                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                                unicodeBidi: isRTL ? "plaintext" : "normal",
                            }}
                        >
                            {formattedAmount}
                        </Typography>
                    </Box>
                );
            },
            customer_outstanding_debt: (params: any) => {
                const outstandingDebt = params?.value !== undefined && params?.value !== null ? params.value : params?.row?.customer_outstanding_debt ?? 0;
                const currency = params?.row?.customer_currency || params?.row?.["Invoice.customer_currency"] || params?.row?.currency || "";
                const formattedAmount = formatAmountCell(outstandingDebt, currency);
                const isRTL = i18n.language === "he";
                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                                unicodeBidi: isRTL ? "plaintext" : "normal",
                            }}
                        >
                            {formattedAmount}
                        </Typography>
                    </Box>
                );
            },
        };

        if (isCreditInsuranceAccount && hasCustomerPolicy) {
            base["Invoice.invoice_number"] = renderCreditInsuranceInvoiceNumberCell;
            base.invoice_number = renderCreditInsuranceInvoiceNumberCell;
        }

        return base;
    }, [
        session,
        i18n.language,
        formatAmountCell,
        translateStatusName,
        isCreditInsuranceAccount,
        hasCustomerPolicy,
        renderCreditInsuranceInvoiceNumberCell,
    ]);

    const creditInsuranceViolationsColumn = useMemo((): GridColDef => {
        return {
            field: "__credit_insurance_violations",
            headerName: t("credit_insurance_violations.column_title", {
                ns: "customers",
            }),
            width: 56,
            minWidth: 52,
            maxWidth: 100,
            flex: 0,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            align: "center",
            headerAlign: "center",
            renderCell: (params) => (
                <CreditInsuranceViolationsCell
                    row={params.row as Record<string, unknown>}
                />
            ),
        };
    }, [t]);

    const actionsColumnRenderer = useCallback(
        (params: GridRenderCellParams) => {
            const rawId = params?.row?.id;
            const invoiceId =
                typeof rawId === "number" ? rawId : Number(rawId);
            const row = params.row as Record<string, unknown>;
            return (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.25,
                    }}
                >
                    {isCreditInsuranceAccount && hasCustomerPolicy && (
                        <Tooltip
                            title={t("credit_insurance_reporting.edit_title", {
                                ns: "customers",
                            })}
                        >
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (
                                        Number.isFinite(invoiceId) &&
                                        invoiceId > 0
                                    ) {
                                        openCreditInsuranceReportingModal(row);
                                    }
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                sx={{
                                    color: "primary.main",
                                    "&:hover": {
                                        backgroundColor:
                                            "rgba(var(--primary-rgb), 0.08)",
                                    },
                                }}
                            >
                                <EditNoteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {isCollectionAccount && hasCustomerPolicy && (
                        <Tooltip
                            title={t("last_payment_date.set_action", {
                                ns: "customers",
                            })}
                        >
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (
                                        Number.isFinite(invoiceId) &&
                                        invoiceId > 0
                                    ) {
                                        setPtpInvoiceId(invoiceId);
                                        setPtpDialogOpen(true);
                                    }
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                sx={{
                                    color: "primary.main",
                                    "&:hover": {
                                        backgroundColor:
                                            "rgba(var(--primary-rgb), 0.08)",
                                    },
                                }}
                            >
                                <PaymentsIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            );
        },
        [
            t,
            isCreditInsuranceAccount,
            isCollectionAccount,
            hasCustomerPolicy,
            openCreditInsuranceReportingModal,
        ]
    );

    const showActionsColumn =
        hasCustomerPolicy && (isCreditInsuranceAccount || isCollectionAccount);

    const additionalDataColumns = useMemo(
        () =>
            isCreditInsuranceAccount && hasCustomerPolicy
                ? [creditInsuranceViolationsColumn]
                : undefined,
        [
            isCreditInsuranceAccount,
            hasCustomerPolicy,
            creditInsuranceViolationsColumn,
        ]
    );

    const actionsColumnConfig = useMemo(
        () =>
            showActionsColumn
                ? {
                    minWidth:
                        isCreditInsuranceAccount && isCollectionAccount
                            ? 88
                            : 52,
                    flex: 0.55,
                }
                : undefined,
        [showActionsColumn, isCreditInsuranceAccount, isCollectionAccount]
    );

    // Handle page-wide scrolling to scroll the table
    React.useEffect(() => {
        const findScrollableContainer = (): HTMLElement | null => {
            if (!tableContainerRef.current) return null;

            // The scrollable container is a direct child div with overflow-y: auto
            // Look for divs that have overflow styles
            const allDivs =
                tableContainerRef.current.querySelectorAll<HTMLElement>("div");

            for (const div of Array.from(allDivs)) {
                const style = window.getComputedStyle(div);
                // Check if it's scrollable vertically
                if (
                    (style.overflowY === "auto" ||
                        style.overflowY === "scroll") &&
                    div.scrollHeight > div.clientHeight
                ) {
                    return div;
                }
            }
            return null;
        };

        const handleWheel = (e: WheelEvent) => {
            // Only handle vertical scrolling
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                return; // Horizontal scroll, let it pass through
            }

            const container = findScrollableContainer();
            if (!container) return;

            // Check if the table container is visible and in viewport
            const containerRect = container.getBoundingClientRect();
            const isVisible =
                containerRect.top < window.innerHeight &&
                containerRect.bottom > 0 &&
                containerRect.width > 0 &&
                containerRect.height > 0;

            if (!isVisible) return;

            const { scrollTop, scrollHeight, clientHeight } = container;
            const canScrollUp = scrollTop > 0;
            const canScrollDown = scrollTop < scrollHeight - clientHeight;

            // Only intercept scroll if table can scroll in that direction
            const scrollingDown = e.deltaY > 0;
            const scrollingUp = e.deltaY < 0;

            if (
                (scrollingDown && canScrollDown) ||
                (scrollingUp && canScrollUp)
            ) {
                e.preventDefault();
                e.stopPropagation();
                container.scrollTop += e.deltaY;
            }
        };

        // Add wheel event listener with passive: false to allow preventDefault
        window.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            window.removeEventListener("wheel", handleWheel);
        };
    }, []);

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                borderRadius: theme.shape.borderRadius,
                position: "relative",
                isolation: "isolate",
            }}
        >
            {/* Header Section */}
            <Box
                sx={{
                    p: { xs: 1, sm: 1.25 },
                    mb: theme.spacing(1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ReceiptIcon
                        sx={{
                            color: "primary.main",
                            fontSize: { xs: 18, sm: 20 },
                        }}
                    />
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 500,
                            fontSize: { xs: "1rem", sm: "1.25rem" },
                        }}
                    >
                        {t("sections.outstanding_invoices", {
                            ns: "customers",
                        })}
                    </Typography>
                </Box>
            </Box>

            {/* Virtual Grid */}
            <Box
                ref={tableContainerRef}
                sx={{
                    position: "relative",
                    isolation: "isolate",
                }}
            >
                <ViewBasedDataGrid
                    context="customer_unpaid_invoices"
                    searchValue={search}
                    onSearchChange={setSearch}
                    defaultViewId={(() => {
                        // Only pass defaultViewId if it came from URL or auto-selection (not a manual selection)
                        // This allows the default view query to run and detect changes
                        // When isManualSelection is false, we pass selectedViewId if it exists,
                        // which allows the default view mechanism to work
                        return !isManualSelection && selectedViewId
                            ? selectedViewId
                            : undefined;
                    })()}
                    onViewChange={(viewId) => {
                        // Capture previous value before updating state
                        const previousViewId = selectedViewId;
                        setSelectedViewId(viewId);

                        // Only mark as manual selection if user explicitly changed from one view to another
                        // Auto-selection (null -> viewId) should NOT set isManualSelection = true
                        if (viewId !== null) {
                            // If we had a view selected before (not null), this is a user-initiated change
                            if (previousViewId !== null && previousViewId !== viewId) {
                                setIsManualSelection(true);
                            }
                            // If previousViewId was null, this is auto-selection - keep isManualSelection as false
                        } else {
                            setIsManualSelection(false);
                        }
                    }}
                    additionalFilters={additionalFilters}
                    customCellRenderers={customCellRenderers}
                    exportDisabled={false}
                    refreshTrigger={gridRefreshTrigger}
                    includeInvoiceCreditInsuranceViolationFields={
                        isCreditInsuranceAccount
                    }
                    additionalDataColumns={additionalDataColumns}
                    highlightedRowId={invoiceIdToHighlight}
                    actionsColumn={
                        showActionsColumn ? actionsColumnRenderer : undefined
                    }
                    actionsColumnConfig={actionsColumnConfig}
                />
            </Box>

            {isCreditInsuranceAccount && (
                <InvoiceCreditInsuranceReportingModal
                    open={reportingModalOpen}
                    onClose={() => {
                        setReportingModalOpen(false);
                        setReportingRow(null);
                    }}
                    row={reportingRow}
                    onSaved={() => {
                        setGridRefreshTrigger((n) => n + 1);
                    }}
                />
            )}

            {isCollectionAccount && (
                <LastPaymentDateDialog
                    open={ptpDialogOpen}
                    onClose={() => {
                        setPtpDialogOpen(false);
                        setPtpInvoiceId(null);
                    }}
                    invoiceId={ptpInvoiceId}
                    onSuccess={() => {
                        setGridRefreshTrigger((n) => n + 1);
                        queryClient.invalidateQueries({
                            queryKey: ["customerTimeLineData"],
                            exact: false,
                        });
                    }}
                />
            )}
        </Box>
    );
};

export default UnpaidInvoiceList;
