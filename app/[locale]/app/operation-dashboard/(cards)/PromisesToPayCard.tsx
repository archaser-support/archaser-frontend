"use client";

import { CalendarToday as CalendarTodayIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";

import { buildOperationDashboardDetailsUrl } from "../operationDashboardDetailsUrl";

type PromisesToPayCardProps = {
    total?: number;
    fulfillmentRate?: number;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
};

const PromisesToPayCard = ({
    total = 0,
    fulfillmentRate = 0,
    startDate,
    endDate,
    selectedUserId,
}: PromisesToPayCardProps) => {
    const { t } = useTranslation(["dashboard"]);
    const router = useRouter();
    const businessUnitId = useDashboardBusinessUnitId();

    return (
        <CreditMetricCard
            icon={<CalendarTodayIcon />}
            iconAccent="compliant"
            label={t("fields.promises_to_pay", { ns: "dashboard" })}
            value={total.toLocaleString()}
            footnote={`${t("fields.promise_fulfillment_rate", { ns: "dashboard" })}: ${fulfillmentRate.toFixed(1)}%`}
            tooltip={t("tooltips.promise_fulfillment_rate_tooltip", {
                ns: "dashboard",
                defaultValue:
                    "Formula: (Fulfilled Promises / Total Promises) × 100. A promise is considered fulfilled when the collection period moves from 'Promise_to_pay' category to another category within the selected date range.",
            })}
            onClick={() =>
                router.push(
                    buildOperationDashboardDetailsUrl("promises-to-pay", {
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

export default PromisesToPayCard;
