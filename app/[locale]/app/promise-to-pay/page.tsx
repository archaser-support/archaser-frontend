"use client";

import React from "react";
import { useTranslation } from "react-i18next";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import Seo from "@/shared/layout-components/seo/seo";

import PromiseToPayList from "./PromiseToPayList";

export default function Page() {
    const { t } = useTranslation(["common", "promise_to_pay"]);

    return (
        <>
            <Seo title={t("fields.title", { ns: "promise_to_pay" })} />
            <InternalPageWrapper>
                <PromiseToPayList />
            </InternalPageWrapper>
        </>
    );
}
