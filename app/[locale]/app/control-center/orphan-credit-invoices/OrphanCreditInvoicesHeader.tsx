"use client";

import React from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";

interface OrphanCreditInvoicesHeaderProps {
    locale: string;
}

const OrphanCreditInvoicesHeader: React.FC<OrphanCreditInvoicesHeaderProps> = ({ locale: _locale }) => {
    const { t } = useTranslation(["control_center", "common"]);

    return (
        <PageHeader
            title={t("sections.orphan_credit_invoices_title", { ns: "control_center" })}
            description={t("sections.orphan_credit_invoices_description", { ns: "control_center" })}
        />
    );
};

export default OrphanCreditInvoicesHeader;


