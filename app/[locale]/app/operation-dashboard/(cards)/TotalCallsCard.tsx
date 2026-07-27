"use client";

import { Phone as PhoneIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";

import { buildOperationDashboardDetailsUrl } from "../operationDashboardDetailsUrl";

type TotalCallsCardProps = {
    total?: number;
    successRate?: number;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
};

const TotalCallsCard = ({
    total = 0,
    successRate = 0,
    startDate,
    endDate,
    selectedUserId,
}: TotalCallsCardProps) => {
    const { t } = useTranslation(["activities"]);
    const router = useRouter();
    const businessUnitId = useDashboardBusinessUnitId();

    return (
        <CreditMetricCard
            icon={<PhoneIcon />}
            iconAccent="reporting"
            label={t("fields.total_calls", { ns: "activities" })}
            value={total.toLocaleString()}
            footnote={`${t("fields.call_success_rate", { ns: "activities" })}: ${successRate.toFixed(1)}%`}
            tooltip={t("tooltips.call_success_rate_tooltip", {
                ns: "activities",
                defaultValue:
                    "Formula: (Completed Calls / Total Calls) × 100. Only calls with COMPLETED status are considered successful.",
            })}
            onClick={() =>
                router.push(
                    buildOperationDashboardDetailsUrl("total-calls", {
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

export default TotalCallsCard;
