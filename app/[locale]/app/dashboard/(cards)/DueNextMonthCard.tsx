"use client";

import { AttachMoney as MoneyIcon } from "@mui/icons-material";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import AppUrls from "@/utils/appUrls";
import { pushFinancialChartDetails } from "@/shared/dashboard/financialChartDetailsTitle";
import { formatMoney } from "@/utils/stringFormatters";

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
            pushFinancialChartDetails(
                router,
                `/${locale}${AppUrls.DASHBOARD}/chart-details?${searchParams.toString()}`,
                t,
                locale
            );
        }, 0);
    };

    return (
        <CreditMetricCard
            icon={<MoneyIcon />}
            iconAccent="capacity"
            label={t("fields.stats_due_next_month")}
            value={formatMoney(
                count || 0,
                currency,
                {
                    style: "symbol",
                    locale: i18n.language === "he" ? "he-IL" : "en-US",
                    language: i18n.language,
                    wholeNumbers: true,
                }
            )}
            tooltip={t("tooltips.financial_metric_due_next_month")}
            onClick={handleCardClick}
        />
    );
};

export default DueNextMonthCard;
