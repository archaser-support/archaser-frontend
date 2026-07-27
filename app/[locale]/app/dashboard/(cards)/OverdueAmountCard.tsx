"use client";

import { AttachMoney as MoneyIcon } from "@mui/icons-material";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import AppUrls from "@/utils/appUrls";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

type OverdueAmountCardProps = {
    count?: number;
    currency?: string;
    viewMode?: "child" | "parent";
};

const OverdueAmountCard = ({
    count = 0,
    currency = "USD",
    viewMode = "child",
}: OverdueAmountCardProps) => {
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
                    type: "overdue-amount",
                    period: new Date().toISOString().slice(0, 7),
                    viewMode,
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
            iconAccent="overdue"
            label={t("fields.stats_overdue_amount")}
            value={formatCurrencyWithRTLSupport(
                count || 0,
                currency,
                locale,
                i18n.language
            )}
            tooltip={t("tooltips.financial_metric_overdue_amount")}
            onClick={handleCardClick}
        />
    );
};

export default OverdueAmountCard;
