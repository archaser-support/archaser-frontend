"use client";

import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import { PortalInvoice, InvoiceColumn } from "@/types/PortalInvoice";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

/**
 * Shared column definitions for invoice tables
 * These can be reused across all invoice display components
 */
export const useInvoiceColumns = (): InvoiceColumn[] => {
    const { t, i18n } = useTranslation(["invoices", "portal", "common"]);
    const theme = useTheme();

    return [
        {
            key: "invoiceNumber",
            label: t("fields.invoice_number"),
            mobilePriority: 5, // Highest priority for mobile
            tooltip: t("fields.invoice_number_help"),
        },
        {
            key: "customerAmount",
            label: t("fields.amount"),
            mobilePriority: 4,
            tooltip: t("fields.amount"),
            render: (row: PortalInvoice) => {
                const currency = row.customerCurrency
                    ? `${row.customerCurrency} `
                    : "";
                const amount =
                    row.customerAmount != null
                        ? formatAmountWithoutSymbol(row.customerAmount)
                        : "N/A";
                return `${currency}${amount}`;
            },
        },
        {
            key: "dueDate",
            label: t("fields.due_date"),
            mobilePriority: 3,
            tooltip: t("fields.due_date"),
        },
        {
            key: "customerTotalPaid",
            label: t("fields.total_paid"),
            mobilePriority: 2,
            tooltip: t("fields.total_paid"),
            render: (row: PortalInvoice) => {
                const currency = row.customerCurrency
                    ? `${row.customerCurrency} `
                    : "";
                const totalPaid =
                    row.customerTotalPaid != null
                        ? formatAmountWithoutSymbol(row.customerTotalPaid)
                        : "N/A";
                return `${currency}${totalPaid}`;
            },
        },
        {
            key: "customerOutstandingDebt",
            label: t("fields.outstanding_debt"),
            mobilePriority: 4,
            tooltip: t("fields.outstanding_debt"),
            render: (row: PortalInvoice) => {
                const currency = row.customerCurrency
                    ? `${row.customerCurrency} `
                    : "";
                const outstandingDebt =
                    row.customerOutstandingDebt != null
                        ? formatAmountWithoutSymbol(row.customerOutstandingDebt)
                        : "N/A";
                return `${currency}${outstandingDebt}`;
            },
        },
    ];
};

/**
 * Simplified column definitions for dispute invoice tables
 */
export const useDisputeInvoiceColumns = (
    customerCurrency: string | null
): InvoiceColumn[] => {
    const { t } = useTranslation(["invoices", "portal", "common"]);

    return [
        {
            key: "invoiceNumber",
            label: t("fields.invoice_number"),
            mobilePriority: 5,
            tooltip: t("fields.invoice_number"),
        },
        {
            key: "customerAmount",
            label: t("fields.amount"),
            mobilePriority: 4,
            tooltip: t("fields.amount"),
            render: (row: PortalInvoice) => {
                const showCustomerCurrency =
                    customerCurrency && customerCurrency !== row.currency;
                const amount = showCustomerCurrency
                    ? `${row.currency} ${formatAmountWithoutSymbol(row.customerAmount)} (${customerCurrency} ${formatAmountWithoutSymbol(row.amount)})`
                    : `${row.currency} ${formatAmountWithoutSymbol(row.customerAmount)}`;
                return amount;
            },
        },
        {
            key: "dueDate",
            label: t("fields.due_date"),
            mobilePriority: 3,
            tooltip: t("fields.due_date"),
        },
        {
            key: "status",
            label: t("fields.status", { ns: "common" }),
            mobilePriority: 2,
            tooltip: t("fields.status", { ns: "common" }),
        },
    ];
};
