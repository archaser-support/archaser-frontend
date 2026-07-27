"use client";

import React from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";

interface NoContactsHeaderProps {
    locale: string;
}

const NoContactsHeader: React.FC<NoContactsHeaderProps> = ({ locale: _locale }) => {
    const { t } = useTranslation(["control_center", "common"]);

    return (
        <PageHeader
            title={t("sections.customers_without_contact_title", { ns: "control_center" })}
            description={t("sections.customers_without_contact_description", { ns: "control_center" })}
        />
    );
};

export default NoContactsHeader;


