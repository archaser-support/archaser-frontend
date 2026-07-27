"use client";

import { Description as DescriptionIcon } from "@mui/icons-material";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import AppUrls from "@/utils/appUrls";

type OverdueInvoicesCardProps = {
    count?: number;
};

const OverdueInvoicesCard = ({ count = 0 }: OverdueInvoicesCardProps) => {
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const businessUnitId = useDashboardBusinessUnitId();

    const handleCardClick = () => {
        router.push(`/${locale}${AppUrls.DASHBOARD}?tab=overdue`);
        setTimeout(() => {
            const searchParams = appendDashboardBusinessUnitId(
                new URLSearchParams({
                    type: "overdue-invoices",
                    period: new Date().toISOString().slice(0, 7),
                }),
                businessUnitId
            );
            router.push(
                `/${locale}${AppUrls.DASHBOARD}/chart-details?${searchParams.toString()}`
            );
        }, 0);
    };

    return (
        <CreditMetricCard
            icon={<DescriptionIcon />}
            iconAccent="overdue"
            label={t("fields.stats_overdue_invoices")}
            value={count.toLocaleString(locale)}
            tooltip={t("tooltips.financial_metric_overdue_invoices")}
            onClick={handleCardClick}
        />
    );
};

export default OverdueInvoicesCard;
