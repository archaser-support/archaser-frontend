import { alpha } from "@mui/material/styles";
import { Box, Chip, Typography } from "@mui/material";
import Link from "next/link";
import React from "react";

import AppUrls from "@/utils/appUrls";
import {
    formatAmountWithoutSymbol,
    formatCurrencyWithRTLSupport,
    resolveCustomerFirstCurrency,
} from "@/utils/stringFormatters";

// Types for column definitions
export interface ColumnDefinition {
    field: string;
    headerName: string;
    width?: number; // Make width optional when flex is provided
    renderCell: (params: any) => React.ReactNode;
    flex?: number;
    minWidth?: number;
}

export interface ColumnDefinitionsProps {
    t: any; // Use any for translation function to avoid type conflicts
    chartDetails: any;
    formatDateForDisplay: (date: string | Date) => string;
    getStatusColor: (
        status: string
    ) =>
        | "primary"
        | "secondary"
        | "success"
        | "error"
        | "warning"
        | "info"
        | "default";
    theme: any;
    i18nLanguage?: string; // Add i18n language for RTL support
}

// Helper function to create currency cell renderer
const createCurrencyCell = (
    t: any,
    chartDetails: any,
    i18nLanguage: string = "en"
) => {
    const CurrencyCell = (params: any) => {
        // Use currency code instead of symbol for consistency with export
        const currencyCode = resolveCustomerFirstCurrency({
            fallbackCurrency: chartDetails?.currency,
        });
        const formattedAmount = formatCurrencyWithRTLSupport(
            params.value || 0,
            currencyCode,
            "en-US",
            i18nLanguage
        );
        const isRTL = i18nLanguage === "he";
        return (
            <Typography
                variant="body2"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                    // Ensure numbers display correctly in RTL context
                    unicodeBidi: isRTL ? "plaintext" : "normal",
                }}
            >
                {formattedAmount}
            </Typography>
        );
    };
    CurrencyCell.displayName = "CurrencyCell";
    return CurrencyCell;
};

// Helper function to create text cell renderer
const createTextCell = () => {
    const TextCell = (params: any) => (
        <Typography
            variant="body2"
            sx={{ display: "flex", alignItems: "center", height: "100%" }}
        >
            {params.value || ""}
        </Typography>
    );
    TextCell.displayName = "TextCell";
    return TextCell;
};

// Helper function to create date cell renderer
const createDateCell = (
    formatDateForDisplay: (date: string | Date) => string
) => {
    const DateCell = (params: any) => (
        <Typography
            variant="body2"
            sx={{ display: "flex", alignItems: "center", height: "100%" }}
        >
            {params.value ? formatDateForDisplay(params.value) : ""}
        </Typography>
    );
    DateCell.displayName = "DateCell";
    return DateCell;
};

// Helper function to create days overdue chip renderer
const createDaysOverdueCell = (t: any, theme: any) => {
    const DaysOverdueCell = (params: any) => {
        const days = params.value;

        // Don't show anything if days is empty, null, or undefined
        if (!days && days !== 0) {
            return (
                <Typography
                    variant="body2"
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                    }}
                />
            );
        }

        const getDaysOverdueBgColor = (days: number) => {
            if (days >= 90) return theme.palette.chartPalette.dark;
            if (days >= 60) return theme.palette.chartPalette.main;
            if (days >= 30) return theme.palette.chartPalette.light;
            return alpha(theme.palette.chartPalette.main, 0.5);
        };

        const daysLabel = t("fields.days", "Days", { ns: "common" });
        return (
            <Chip
                label={`${days} ${daysLabel}`}
                size="small"
                variant="filled"
                sx={{
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    backgroundColor: getDaysOverdueBgColor(days),
                    color: "white",
                }}
            />
        );
    };
    DaysOverdueCell.displayName = "DaysOverdueCell";
    return DaysOverdueCell;
};

// Helper function to create days to payment chip renderer
const createDaysToPaymentCell = (t: any, theme: any) => {
    const DaysToPaymentCell = (params: any) => {
        const days = params.value;
        if (!days)
            return (
                <Typography
                    variant="body2"
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                    }}
                >
                    N/A
                </Typography>
            );

        const getDaysBgColor = (days: number) => {
            if (days <= 7) return theme.palette.chartPalette.light;
            if (days <= 30) return theme.palette.chartPalette.main;
            if (days <= 90) return theme.palette.chartPalette.main;
            return theme.palette.chartPalette.dark;
        };

        const daysLabel = t("fields.days", "Days", { ns: "common" });
        return (
            <Chip
                label={`${days} ${daysLabel}`}
                size="small"
                variant="filled"
                sx={{
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    backgroundColor: getDaysBgColor(days),
                    color: "white",
                }}
            />
        );
    };
    DaysToPaymentCell.displayName = "DaysToPaymentCell";
    return DaysToPaymentCell;
};

// Helper function to create days until due chip renderer (for Due tab)
const createDaysUntilDueCell = (t: any, theme: any) => {
    const DaysUntilDueCell = (params: any) => {
        const days = params.value;

        // Don't show anything if days is empty, null, or undefined
        if (!days && days !== 0) {
            return (
                <Typography
                    variant="body2"
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                    }}
                />
            );
        }

        const getDaysUntilDueBgColor = (days: number) => {
            if (days <= 0) return theme.palette.chartPalette.dark; // Overdue
            if (days <= 7) return theme.palette.chartPalette.main; // Due soon
            if (days <= 30) return theme.palette.chartPalette.light; // Due this month
            return alpha(theme.palette.chartPalette.main, 0.5); // Due later
        };

        const daysLabel = t("fields.days", "Days", { ns: "common" });
        return (
            <Chip
                label={`${days} ${daysLabel}`}
                size="small"
                variant="filled"
                sx={{
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    backgroundColor: getDaysUntilDueBgColor(days),
                    color: "white",
                }}
            />
        );
    };
    DaysUntilDueCell.displayName = "DaysUntilDueCell";
    return DaysUntilDueCell;
};

// Helper function to create phase chip renderer
const createPhaseCell = (t: any, _getStatusColor: any, theme: any) => {
    const PhaseCell = (params: any) => {
        const phase = params.value?.toLowerCase();

        const getPhaseStyle = (phaseKey: string) => {
            const palette = theme.palette.chartPalette;
            const styles: Record<
                string,
                { bg: string; text: string; border: string }
            > = {
                automated: {
                    bg: alpha(palette.main, 0.1),
                    text: palette.main,
                    border: palette.main,
                },
                agent: {
                    bg: alpha(palette.main, 0.1),
                    text: palette.main,
                    border: palette.main,
                },
                "promise to pay": {
                    bg: alpha(palette.main, 0.15),
                    text: palette.dark,
                    border: palette.dark,
                },
                dispute: {
                    bg: alpha(palette.dark, 0.15),
                    text: palette.dark,
                    border: palette.dark,
                },
                legal: {
                    bg: alpha(palette.main, 0.2),
                    text: palette.main,
                    border: palette.main,
                },
            };
            return (
                styles[phaseKey] || {
                    bg: alpha(palette.main, 0.08),
                    text: palette.light,
                    border: palette.light,
                }
            );
        };

        const style = getPhaseStyle(phase);

        // Map phase values to proper capitalized translation values
        const getPhaseLabel = (phaseValue: string) => {
            const phaseMap: Record<string, string> = {
                automated: t("values.categories_automated"),
                agent: t("fields.categories__agent"),
                promise_to_pay: t("fields.categories_promise_to_pay"),
                dispute: t("fields.categories_dispute"),
                legal: t("fields.categories__legal"),
            };
            return phaseMap[phaseValue] || params.value;
        };

        const phaseLabel = getPhaseLabel(phase);

        return (
            <Chip
                label={phaseLabel}
                size="small"
                variant="outlined"
                sx={{
                    backgroundColor: style.bg,
                    color: style.text,
                    borderColor: style.border,
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    "&:hover": {
                        backgroundColor: style.bg,
                        opacity: 0.8,
                    },
                }}
            />
        );
    };
    PhaseCell.displayName = "PhaseCell";
    return PhaseCell;
};

// Helper function to create status chip renderer
const createStatusCell = (t: any, _getStatusColor: any, theme: any) => {
    const StatusCell = (params: any) => {
        const status = params.value?.toLowerCase();
        const palette = theme.palette.chartPalette;

        const getStatusStyle = (statusKey: string) => {
            const styles: Record<
                string,
                { bg: string; text: string; border: string }
            > = {
                automated: {
                    bg: alpha(palette.main, 0.1),
                    text: palette.main,
                    border: palette.main,
                },
                agent: {
                    bg: alpha(palette.main, 0.1),
                    text: palette.main,
                    border: palette.main,
                },
                promise: {
                    bg: alpha(palette.main, 0.15),
                    text: palette.dark,
                    border: palette.dark,
                },
                dispute: {
                    bg: alpha(palette.dark, 0.15),
                    text: palette.dark,
                    border: palette.dark,
                },
                legal: {
                    bg: alpha(palette.main, 0.2),
                    text: palette.main,
                    border: palette.main,
                },
                active: {
                    bg: alpha(palette.main, 0.15),
                    text: palette.dark,
                    border: palette.dark,
                },
                overdue: {
                    bg: alpha(palette.dark, 0.15),
                    text: palette.dark,
                    border: palette.dark,
                },
                collected: {
                    bg: alpha(palette.main, 0.15),
                    text: palette.dark,
                    border: palette.dark,
                },
            };
            return (
                styles[statusKey] || {
                    bg: alpha(palette.main, 0.08),
                    text: palette.light,
                    border: palette.light,
                }
            );
        };

        const style = getStatusStyle(status);

        return (
            <Chip
                label={String(
                    t(
                        `fields.categories_${params.value?.toLowerCase()}`,
                        params.value
                    )
                )}
                size="small"
                variant="outlined"
                sx={{
                    backgroundColor: style.bg,
                    color: style.text,
                    borderColor: style.border,
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    "&:hover": {
                        backgroundColor: style.bg,
                        opacity: 0.8,
                    },
                }}
            />
        );
    };
    StatusCell.displayName = "StatusCell";
    return StatusCell;
};

// Helper function to create collection phase chip renderer
const createCollectionPhaseCell = (t: any, _getStatusColor: any, theme: any) => {
    const CollectionPhaseCell = (params: any) => {
        const palette = theme.palette.chartPalette;

        return (
            <Chip
                label={params.value}
                size="small"
                variant="outlined"
                sx={{
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    backgroundColor: alpha(palette.main, 0.1),
                    color: palette.main,
                    borderColor: palette.main,
                }}
            />
        );
    };
    CollectionPhaseCell.displayName = "CollectionPhaseCell";
    return CollectionPhaseCell;
};

// Helper function to create promise amount cell renderer
const createPromiseAmountCell = (
    t: any,
    chartDetails: any,
    i18nLanguage: string = "en"
) => {
    const PromiseAmountCell = (params: any) => {
        if (params.value <= 0) {
            return (
                <Typography
                    variant="body2"
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                    }}
                >
                    {""}
                </Typography>
            );
        }

        const currencyCode = resolveCustomerFirstCurrency({
            fallbackCurrency: chartDetails?.currency,
        });
        const formattedAmount = formatCurrencyWithRTLSupport(
            params.value,
            currencyCode,
            "en-US",
            i18nLanguage
        );
        const isRTL = i18nLanguage === "he";

        return (
            <Typography
                variant="body2"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                    unicodeBidi: isRTL ? "plaintext" : "normal",
                }}
            >
                {formattedAmount}
            </Typography>
        );
    };
    PromiseAmountCell.displayName = "PromiseAmountCell";
    return PromiseAmountCell;
};

// Helper function to create invoice count cell renderer
const createInvoiceCountCell = () => {
    const InvoiceCountCell = (params: any) => (
        <Typography
            variant="body2"
            sx={{ display: "flex", alignItems: "center", height: "100%" }}
        >
            {params.value || 0}
        </Typography>
    );
    InvoiceCountCell.displayName = "InvoiceCountCell";
    return InvoiceCountCell;
};

// Helper function to create customer name cell renderer
const createAccountNameCell = (theme: any) => {
    const AccountNameCell = (params: any) => (
        <Box
            component={Link}
            href={AppUrls.Customer_DETAILS(params.row.accountId)}
            sx={{
                color: theme.palette.secondary.main,
                textDecoration: "underline",
                textUnderlineOffset: "0.125em",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                height: "100%",
                "&:hover": {
                    textDecoration: "underline",
                    color: theme.palette.secondary.dark,
                },
            }}
        >
            {params.value}
        </Box>
    );
    AccountNameCell.displayName = "AccountNameCell";
    return AccountNameCell;
};

// Helper function to create payment amount in customer currency cell renderer
const createPaymentAmountInCustomerCurrencyCell = (
    _t: any,
    _chartDetails: any,
    i18nLanguage: string = "en"
) => {
    const PaymentAmountInCustomerCurrencyCell = (params: any) => {
        // Handle NaN values properly
        const safeAmount = (value: any) => {
            if (
                value === null ||
                value === undefined ||
                isNaN(value) ||
                value === "NaN"
            ) {
                return 0;
            }
            return Number(value) || 0;
        };

        const amount = safeAmount(params.value);
        const customerCurrency = resolveCustomerFirstCurrency({
            customerCurrencyPrimary: params.row.customerCurrency,
        });
        const formattedAmount = formatCurrencyWithRTLSupport(
            amount,
            customerCurrency,
            "en-US",
            i18nLanguage
        );
        const isRTL = i18nLanguage === "he";

        return (
            <Typography
                variant="body2"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                    unicodeBidi: isRTL ? "plaintext" : "normal",
                }}
            >
                {formattedAmount}
            </Typography>
        );
    };
    PaymentAmountInCustomerCurrencyCell.displayName =
        "PaymentAmountInCustomerCurrencyCell";
    return PaymentAmountInCustomerCurrencyCell;
};

// Column definitions factory
export const createColumnDefinitions = ({
    t,
    chartDetails,
    formatDateForDisplay,
    getStatusColor,
    theme,
    i18nLanguage = "en",
}: ColumnDefinitionsProps) => {
    return {
        // Common columns
        customerName: {
            field: "customerName",
            headerName: t("fields.chart_details_customer_name"),
            width: 200,
            flex: 1,
            minWidth: 200,
            renderCell: createAccountNameCell(theme),
        },

        // Currency columns
        outstandingAmount: {
            field: "outstandingAmount",
            headerName: t("fields.chart_details_outstanding_amount"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createCurrencyCell(t, chartDetails, i18nLanguage),
        },

        dueAmount: {
            field: "amount",
            headerName: t("fields.chart_details_due_amount"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createCurrencyCell(t, chartDetails, i18nLanguage),
        },

        overdueAmount: {
            field: "outstandingAmount",
            headerName: t("fields.chart_details_outstanding_amount"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createCurrencyCell(t, chartDetails, i18nLanguage),
        },

        originalAmount: {
            field: "originalAmount",
            headerName: t("fields.original_amount", "Original Amount"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createCurrencyCell(t, chartDetails, i18nLanguage),
        },

        promiseToPayAmount: {
            field: "promiseToPayAmount",
            headerName: t("fields.chart_details_promise_to_pay_amount"),
            width: 140,
            flex: 1,
            minWidth: 140,
            renderCell: createPromiseAmountCell(
                t,
                chartDetails,
                i18nLanguage
            ),
        },

        // Date columns
        lastActivity: {
            field: "lastActivity",
            headerName: t("fields.chart_details_last_activity"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createDateCell(formatDateForDisplay),
        },

        lastActivityDate: {
            field: "lastActivityDate",
            headerName: t("fields.chart_details_last_activity_date"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createDateCell(formatDateForDisplay),
        },

        promiseToPayDate: {
            field: "promiseToPayDate",
            headerName: t("fields.chart_details_promise_to_pay_date"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createDateCell(formatDateForDisplay),
        },

        newestInvoiceDate: {
            field: "newestInvoiceDate",
            headerName: t("fields.chart_details_newest_invoice_date"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createDateCell(formatDateForDisplay),
        },

        // Days columns
        daysOverdue: {
            field: "daysOverdue",
            headerName: t("fields.chart_details_days_overdue", "Days Overdue"),
            width: 120,
            flex: 1,
            minWidth: 120,
            renderCell: createDaysOverdueCell(t, theme),
        },

        daysToPayment: {
            field: "daysToPayment",
            headerName: t("fields.days_past_due", "Days Past Due"),
            width: 140,
            flex: 1,
            minWidth: 140,
            renderCell: createDaysToPaymentCell(t, theme),
        },

        daysUntilDue: {
            field: "daysToPayment",
            headerName: t(
                "fields.chart_details_days_until_due",
                "Days Until Due"
            ),
            width: 140,
            flex: 1,
            minWidth: 140,
            renderCell: createDaysUntilDueCell(t, theme),
        },

        // Status/Phase columns
        phase: {
            field: "phase",
            headerName: t("fields.chart_details_phase", "Category"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createPhaseCell(t, getStatusColor, theme),
        },

        status: {
            field: "status",
            headerName: t("values.chart_details_status"),
            width: 120,
            flex: 1,
            minWidth: 120,
            renderCell: createStatusCell(t, getStatusColor, theme),
        },

        collectionPhase: {
            field: "collectionPhase",
            headerName: t("fields.chart_details_collection_phase"),
            width: 140,
            flex: 1,
            minWidth: 140,
            renderCell: createCollectionPhaseCell(t, getStatusColor, theme),
        },

        // Text columns
        assignedAgent: {
            field: "assignedAgent",
            headerName: t("fields.chart_details_assigned_agent"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createTextCell(),
        },

        invoiceNumber: {
            field: "invoiceNumber",
            headerName: t("fields.invoice_number"),
            width: 120,
            flex: 1,
            minWidth: 120,
            renderCell: createTextCell(),
        },

        invoiceCount: {
            field: "invoiceCount",
            headerName: t("fields.chart_details_invoice_count"),
            width: 100,
            flex: 1,
            minWidth: 100,
            renderCell: createInvoiceCountCell(),
        },

        invoiceAmount: {
            field: "invoiceAmount",
            headerName: t("fields.chart_details_invoice_amount"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createCurrencyCell(t, chartDetails, i18nLanguage),
        },

        overdueInvoiceAmount: {
            field: "overdueInvoiceAmount",
            headerName: t("fields.chart_details_overdue_invoice_amount"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createCurrencyCell(t, chartDetails, i18nLanguage),
        },

        // Overdue status change column
        overdueStatusChange: {
            field: "overdueStatusChange",
            headerName: t("fields.chart_details_overdue_status_change"),
            width: 200,
            flex: 1,
            minWidth: 200,
            renderCell: (params: any) => {
                const status = params.value;
                if (!status) return <Typography variant="body2">-</Typography>;

                const isEntered =
                    status.toLowerCase().includes("entered") ||
                    status.toLowerCase().includes("added");
                const isExited =
                    status.toLowerCase().includes("exited") ||
                    status.toLowerCase().includes("removed");
                const isActiveDuringPeriod = status
                    .toLowerCase()
                    .includes("active during period");

                const getChipStyle = () => {
                    if (isEntered)
                        return {
                            bg: theme.palette.chartPalette.dark,
                            color: "white",
                        };
                    if (isExited)
                        return {
                            bg: theme.palette.chartPalette.light,
                            color: "white",
                        };
                    if (isActiveDuringPeriod)
                        return {
                            bg: theme.palette.chartPalette.main,
                            color: "white",
                        };
                    return {
                        bg: alpha(theme.palette.chartPalette.main, 0.4),
                        color: "white",
                    };
                };
                const chipStyle = getChipStyle();

                return (
                    <Chip
                        label={status}
                        size="small"
                        variant="filled"
                        sx={{
                            fontWeight: 600,
                            fontSize: "0.75rem",
                            backgroundColor: chipStyle.bg,
                            color: chipStyle.color,
                        }}
                    />
                );
            },
        },

        // Date column (generic)
        date: {
            field: "date",
            headerName: t("fields.chart_details_date"),
            width: 120,
            flex: 1,
            minWidth: 120,
            renderCell: createTextCell(),
        },

        // New columns for collected-vs-promise
        paymentDate: {
            field: "paymentDate",
            headerName: t("fields.chart_details_payment_date"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createDateCell(formatDateForDisplay),
        },

        paymentAmount: {
            field: "paymentAmount",
            headerName: t("fields.chart_details_payment_amount"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createCurrencyCell(t, chartDetails, i18nLanguage),
        },

        paymentAmountInCustomerCurrency: {
            field: "paymentAmountInCustomerCurrency",
            headerName: t(
                "fields.chart_details_payment_amount_in_customer_currency"
            ),
            width: 200,
            flex: 1,
            minWidth: 200,
            renderCell: createPaymentAmountInCustomerCurrencyCell(
                t,
                chartDetails,
                i18nLanguage
            ),
        },

        invoiceCurrentStatus: {
            field: "invoiceCurrentStatus",
            headerName: t("fields.chart_details_invoice_current_status"),
            width: 150,
            flex: 1,
            minWidth: 150,
            renderCell: createStatusCell(t, getStatusColor, theme),
        },
    };
};

// Chart type specific column configurations
export const getChartColumns = (
    chartType: string,
    columnDefs: ReturnType<typeof createColumnDefinitions>,
    _isMobile: boolean
): ColumnDefinition[] => {
    const baseColumns = [columnDefs.customerName];

    switch (chartType) {
        case "collected-mtd":
        case "collected-vs-promise":
            return [
                columnDefs.paymentDate,
                columnDefs.paymentAmount,
                columnDefs.paymentAmountInCustomerCurrency,
                columnDefs.invoiceNumber,
                columnDefs.customerName,
                columnDefs.invoiceCurrentStatus,
            ];

        case "collection-efforts":
        case "automated-phase-split":
            return [
                ...baseColumns,
                columnDefs.phase,
                columnDefs.outstandingAmount,
                columnDefs.daysOverdue,
                columnDefs.assignedAgent,
                columnDefs.promiseToPayAmount,
                columnDefs.lastActivity,
                columnDefs.invoiceCount,
                columnDefs.date,
            ];

        case "active-customers":
            return [
                columnDefs.customerName,
                columnDefs.overdueStatusChange,
                columnDefs.date,
            ];

        case "overdue-amount":
            return [
                columnDefs.customerName,
                columnDefs.overdueAmount,
                columnDefs.daysOverdue,
                columnDefs.invoiceCount,
                columnDefs.phase,
            ];

        case "overdue-customers":
            return [
                ...baseColumns,
                columnDefs.outstandingAmount,
                columnDefs.daysOverdue,
                columnDefs.invoiceCount,
                columnDefs.phase,
            ];

        case "overdue-invoices":
            return [
                columnDefs.invoiceNumber,
                columnDefs.customerName,
                columnDefs.outstandingAmount,
                columnDefs.daysOverdue,
            ];

        case "aging-portfolio":
            return [
                columnDefs.invoiceNumber,
                columnDefs.customerName,
                columnDefs.invoiceAmount,
                columnDefs.overdueInvoiceAmount,
                columnDefs.daysOverdue,
            ];

        case "total-due":
        case "due-today":
        case "due-this-week":
        case "due-this-month":
        case "due-next-month":
            return [
                columnDefs.invoiceNumber,
                columnDefs.customerName,
                columnDefs.dueAmount,
                columnDefs.daysUntilDue,
            ];

        case "receivables-maturity-schedule":
            return [
                columnDefs.invoiceNumber,
                columnDefs.customerName,
                columnDefs.dueAmount,
                columnDefs.daysUntilDue,
                columnDefs.originalAmount,
            ];

        default:
            return [
                ...baseColumns,
                columnDefs.outstandingAmount,
                columnDefs.status,
                columnDefs.date,
            ];
    }
};
