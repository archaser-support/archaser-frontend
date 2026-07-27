"use client";

import { AttachMoney as MoneyIcon } from "@mui/icons-material";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import AppUrls from "@/utils/appUrls";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

type DueNextMonthCardProps = {
    count?: number;
    currency?: string;
};

const DueNextMonthCard = ({
    count = 0,
    currency = "USD",
}: DueNextMonthCardProps) => {
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const businessUnitId = useDashboardBusinessUnitId();

    const handleCardClick = () => {
        router.push(`/${locale}${AppUrls.DASHBOARD}?tab=due`);
        setTimeout(() => {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const searchParams = appendDashboardBusinessUnitId(
                new URLSearchParams({
                    type: "due-next-month",
                    period: nextMonth.toISOString().slice(0, 7),
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
            icon={<MoneyIcon />}
            iconAccent="capacity"
            label={t("fields.stats_due_next_month")}
            value={formatCurrencyWithRTLSupport(
                count || 0,
                currency,
                locale,
                i18n.language
            )}
            tooltip={t("tooltips.financial_metric_due_next_month")}
            onClick={handleCardClick}
        />
    );
};

export default DueNextMonthCard;
