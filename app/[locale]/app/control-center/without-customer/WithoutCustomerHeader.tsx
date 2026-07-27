"use client";

import React from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";

const WithoutCustomerHeader: React.FC = () => {
    const { t } = useTranslation(["control_center", "common"]);

    return (
        <PageHeader
            title={t("sections.invoices_without_customer_title", { ns: "control_center" })}
            description={t("sections.invoices_without_customer_description", { ns: "control_center" })}
        />
    );
};

export default WithoutCustomerHeader;
