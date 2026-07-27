"use client";

import { TrendingUp as TrendingUpIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";

import { buildOperationDashboardDetailsUrl } from "../operationDashboardDetailsUrl";

type ActivitySuccessRateCardProps = {
    successRate?: number;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
};

const ActivitySuccessRateCard = ({
    successRate = 0,
    startDate,
    endDate,
    selectedUserId,
}: ActivitySuccessRateCardProps) => {
    const { t } = useTranslation(["activities"]);
    const router = useRouter();
    const businessUnitId = useDashboardBusinessUnitId();

    return (
        <CreditMetricCard
            icon={<TrendingUpIcon />}
            iconAccent="compliant"
            label={t("fields.activity_success_rate", { ns: "activities" })}
            value={`${successRate.toFixed(1)}%`}
            tooltip={t("tooltips.activity_success_rate_tooltip", {
                ns: "activities",
                defaultValue:
                    "Formula: (Delivered Activities + Completed Activities) / Total Activities × 100. Only activities with DELIVERED or COMPLETED status are considered successful.",
            })}
            onClick={() =>
                router.push(
                    buildOperationDashboardDetailsUrl("activity-success-rate", {
                        startDate,
                        endDate,
                        selectedUserId,
                        businessUnitId,
                    })
                )
            }
        />
    );
};

export default ActivitySuccessRateCard;
