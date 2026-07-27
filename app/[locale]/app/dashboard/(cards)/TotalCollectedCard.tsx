"use client";

import { MonetizationOn as MonetizationOnIcon } from "@mui/icons-material";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { COLLECTED_MTD_CHART_TYPE } from "@/shared/dashboard/collectedMtdChartDetails";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import AppUrls from "@/utils/appUrls";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

type TotalCollectedCardProps = {
    amount?: string;
    currency?: string;
};

const TotalCollectedCard = ({
    amount = "0",
    currency = "USD",
}: TotalCollectedCardProps) => {
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
                    type: COLLECTED_MTD_CHART_TYPE,
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
            icon={<MonetizationOnIcon />}
            iconAccent="compliant"
            label={t("fields.stats_total_collected_m_t_d")}
            value={formatCurrencyWithRTLSupport(
                parseFloat(amount) || 0,
                currency,
                locale,
                i18n.language
            )}
            tooltip={t("tooltips.financial_metric_total_collected_mtd")}
            onClick={handleCardClick}
        />
    );
};

export default TotalCollectedCard;
