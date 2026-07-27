"use client";

import { AttachMoney as MoneyIcon } from "@mui/icons-material";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import AppUrls from "@/utils/appUrls";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

type DueTodayCardProps = {
    count?: number;
    currency?: string;
};

const DueTodayCard = ({ count = 0, currency = "USD" }: DueTodayCardProps) => {
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const businessUnitId = useDashboardBusinessUnitId();

    const handleCardClick = () => {
        router.push(`/${locale}${AppUrls.DASHBOARD}?tab=due`);
        setTimeout(() => {
            const searchParams = appendDashboardBusinessUnitId(
                new URLSearchParams({
                    type: "due-today",
                    period: new Date().toISOString().slice(0, 10),
                }),
                businessUnitId
            );
            router.push(
                `/${locale}${AppUrls.DASHBOARD}/chart-details?${searchParams.toString()}`
            );
        }, 100);
    };

    return (
        <CreditMetricCard
            icon={<MoneyIcon />}
            iconAccent="atRisk"
            label={t("fields.stats_due_today")}
            value={formatCurrencyWithRTLSupport(
                count || 0,
                currency,
                locale,
                i18n.language
            )}
            tooltip={t("tooltips.financial_metric_due_today")}
            onClick={handleCardClick}
        />
    );
};

export default DueTodayCard;
