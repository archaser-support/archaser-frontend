"use client";
import { Box, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { useDisputeInvoiceColumns } from "@/shared/components/portal/invoiceColumns";
import InvoiceDisplay from "@/shared/components/portal/InvoiceDisplay";
import { PortalInvoice } from "@/types/PortalInvoice";

type InvoiceTableProps = {
    invoices: PortalInvoice[];
    locale: string;
    customerCurrency: string | null;
};

export default function InvoiceTable({
    invoices,
    locale,
    customerCurrency,
}: InvoiceTableProps) {
    const { t, i18n } = useTranslation([
        "disputes",
        "invoices",
        "portal",
        "common",
    ]);
    const columns = useDisputeInvoiceColumns(customerCurrency);

    // Debug logging removed for production

    return (
        <Box>
            <Typography
                variant="h6"
                sx={{
                    mb: 2,
                    color: "#1a202c",
                    fontWeight: 600,
                    fontSize: "1rem",
                    textAlign: i18n.language === "he" ? "right" : "left",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                {t("fields.invoice_list", { ns: "invoices" })}
            </Typography>
            <InvoiceDisplay
                invoices={invoices}
                columns={columns}
                isSelectable={false}
                emptyMessage={t("fields.no_invoices_found", { ns: "invoices" })}
            />
        </Box>
    );
}
