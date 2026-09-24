"use client";

import { useTranslation } from "react-i18next";

import { PortalInvoice, InvoiceColumn } from "@/types/PortalInvoice";
import {
    formatCurrencyWithRTLSupport,
    resolveCustomerFirstCurrency,
} from "@/utils/stringFormatters";

/**
 * Shared column definitions for invoice tables
 * These can be reused across all invoice display components
 */
export const useInvoiceColumns = (): InvoiceColumn[] => {
    const { t, i18n } = useTranslation(["invoices", "portal", "common"]);

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
                if (row.customerAmount == null) {
                    return "N/A";
                }
                const currency = resolveCustomerFirstCurrency({
                    customerCurrencyPrimary: row.customerCurrency,
                    fallbackCurrency: row.currency,
                });
                return formatCurrencyWithRTLSupport(
                    row.customerAmount,
                    currency,
                    "en-US",
                    i18n.language
                );
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
                if (row.customerTotalPaid == null) {
                    return "N/A";
                }
                const currency = resolveCustomerFirstCurrency({
                    customerCurrencyPrimary: row.customerCurrency,
                    fallbackCurrency: row.currency,
                });
                return formatCurrencyWithRTLSupport(
                    row.customerTotalPaid,
                    currency,
                    "en-US",
                    i18n.language
                );
            },
        },
        {
            key: "customerOutstandingDebt",
            label: t("fields.outstanding_debt"),
            mobilePriority: 4,
            tooltip: t("fields.outstanding_debt"),
            render: (row: PortalInvoice) => {
                if (row.customerOutstandingDebt == null) {
                    return "N/A";
                }
                const currency = resolveCustomerFirstCurrency({
                    customerCurrencyPrimary: row.customerCurrency,
                    fallbackCurrency: row.currency,
                });
                return formatCurrencyWithRTLSupport(
                    row.customerOutstandingDebt,
                    currency,
                    "en-US",
                    i18n.language
                );
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
    const { t, i18n } = useTranslation(["invoices", "portal", "common"]);

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
                const rowCurrency = resolveCustomerFirstCurrency({
                    fallbackCurrency: row.currency,
                });
                const primary = formatCurrencyWithRTLSupport(
                    row.customerAmount ?? 0,
                    rowCurrency,
                    "en-US",
                    i18n.language
                );
                const showCustomerCurrency =
                    customerCurrency && customerCurrency !== row.currency;
                if (showCustomerCurrency && row.amount != null) {
                    const secondary = formatCurrencyWithRTLSupport(
                        row.amount,
                        customerCurrency,
                        "en-US",
                        i18n.language
                    );
                    return `${primary} (${secondary})`;
                }
                return primary;
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
