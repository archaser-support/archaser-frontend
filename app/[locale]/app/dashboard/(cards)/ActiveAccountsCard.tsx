"use client";

import { Group as GroupIcon } from "@mui/icons-material";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import AppUrls from "@/utils/appUrls";

type OverdueCustomersCardProps = {
    count?: number;
    viewMode?: "child" | "parent";
};

const OverdueCustomersCard = ({
    count = 0,
    viewMode = "child",
}: OverdueCustomersCardProps) => {
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
                    type: "overdue-customers",
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
            icon={<GroupIcon />}
            iconAccent="overdue"
            label={t("fields.stats_overdue_customers")}
            value={count.toLocaleString(locale)}
            tooltip={t("tooltips.financial_metric_overdue_customers")}
            onClick={handleCardClick}
        />
    );
};

export default OverdueCustomersCard;
