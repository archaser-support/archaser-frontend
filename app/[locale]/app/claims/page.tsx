"use client";

import { useTranslation } from "react-i18next";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import Seo from "@/shared/layout-components/seo/seo";

import ClaimsList from "./ClaimsList";

export default function Page() {
    const { t } = useTranslation(["claims", "common"]);

    return (
        <>
            <Seo title={t("sections.title", { ns: "claims" })} />
            <InternalPageWrapper>
                <ClaimsList />
            </InternalPageWrapper>
        </>
    );
}
