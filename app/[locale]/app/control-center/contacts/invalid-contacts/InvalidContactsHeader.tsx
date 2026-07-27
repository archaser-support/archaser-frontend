"use client";

import React from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";

interface InvalidContactsHeaderProps {
    locale: string;
}

const InvalidContactsHeader: React.FC<InvalidContactsHeaderProps> = ({ locale: _locale }) => {
    const { t } = useTranslation(["control_center", "common"]);

    return (
        <PageHeader
            title={t("sections.customers_with_invalid_contacts_title", { ns: "control_center" })}
            description={t("sections.customers_with_invalid_contacts_description", { ns: "control_center" })}
        />
    );
};

export default InvalidContactsHeader;

