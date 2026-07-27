"use client";
import React from "react";
import { useTranslation } from "react-i18next";

import { useInvoiceColumns } from "@/shared/components/portal/invoiceColumns";
import InvoiceDisplay from "@/shared/components/portal/InvoiceDisplay";
import { PortalInvoice } from "@/types/PortalInvoice";

type InvoiceListProps = {
    invoices: PortalInvoice[];
    locale: string;
};

export default function InvoiceList({ invoices, locale }: InvoiceListProps) {
    const { t, i18n } = useTranslation(["invoices", "portal", "common"]);
    const columns = useInvoiceColumns();

    return (
        <InvoiceDisplay
            invoices={invoices}
            columns={columns}
            isSelectable={false}
            emptyMessage={t("fields.no_invoices_found")}
        />
    );
}
