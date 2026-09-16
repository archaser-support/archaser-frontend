import type { Metadata } from "next";

import initTranslations from "@/app/i18n";

import CreditDashboardReportPage from "./CreditDashboardReportPage";
import { REPORT_TITLE_KEY } from "./creditReportTitles";
import { isCreditReportType } from "./creditReportTypes";

type SearchParams = { [key: string]: string | string[] | undefined };

function firstSearchParam(
    value: string | string[] | undefined
): string | undefined {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
    const { locale } = await params;
    const resolvedSearchParams = await searchParams;
    const typeParam = firstSearchParam(resolvedSearchParams.type) || "overdue";
    const type = isCreditReportType(typeParam) ? typeParam : "overdue";

    const { t } = await initTranslations(locale, ["dashboard"]);
    const title = t(`credit_insurance_report.${REPORT_TITLE_KEY[type]}`);

    return {
        title: t("credit_insurance_report.seo_title", { title }),
    };
}

export default function CreditDashboardReportRoutePage() {
    return <CreditDashboardReportPage />;
}
