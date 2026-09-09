import type { Metadata } from "next";

import initTranslations from "@/app/i18n";
import { getFinancialChartDetailsTitle } from "@/shared/dashboard/financialChartDetailsTitle";

import ChartDetailsPage from "./ChartDetailsPage";

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
    const resolved = await searchParams;
    const type = firstSearchParam(resolved.type) || "";
    const period = firstSearchParam(resolved.period);
    const daysRange = firstSearchParam(resolved.daysRange);

    const { t } = await initTranslations(locale, ["dashboard"]);
    const title = type
        ? getFinancialChartDetailsTitle(t, {
              type,
              period,
              daysRange,
              locale,
          })
        : t("fields.chart_details_default_title", {
              ns: "dashboard",
              defaultValue: "Chart Details",
          });

    return { title };
}

export default function FinancialChartDetailsRoutePage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    return <ChartDetailsPage params={params} />;
}
