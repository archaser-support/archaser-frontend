import type { Metadata } from "next";

import initTranslations from "@/app/i18n";
import { getOperationDashboardDetailsTitle } from "@/shared/dashboard/operationDashboardDetailsNavigation";

import OperationDashboardDetailsPage from "./OperationDashboardDetailsPage";

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

    const { t } = await initTranslations(locale, [
        "dashboard",
        "activities",
        "disputes",
    ]);
    const title =
        getOperationDashboardDetailsTitle(t, type) ||
        t("fields.operation_dashboard_title", { ns: "dashboard" });

    return { title };
}

export default function OperationDashboardDetailsRoutePage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    return <OperationDashboardDetailsPage params={params} />;
}
