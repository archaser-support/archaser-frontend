"use client";

import { ActivitySequencesNavIcon } from "@/shared/components/sidebar-icons";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";

import { pushOperationDashboardDetails } from "../operationDashboardDetailsUrl";

type UndeliveredActivitiesCardProps = {
    count?: number;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
};

const UndeliveredActivitiesCard = ({
    count = 0,
    startDate,
    endDate,
    selectedUserId,
}: UndeliveredActivitiesCardProps) => {
    const { t } = useTranslation(["activities"]);
    const router = useRouter();
    const businessUnitId = useDashboardBusinessUnitId();

    return (
        <CreditMetricCard
            icon={<ActivitySequencesNavIcon />}
            iconAccent="overdue"
            label={t("fields.undelivered_activities", { ns: "activities" })}
            value={count.toLocaleString()}
            onClick={() =>
                pushOperationDashboardDetails(
                    router,
                    t,
                    "undelivered-activities", {
                        startDate,
                        endDate,
                        selectedUserId,
                        businessUnitId,
                    }
                )
            }
        />
    );
};

export default UndeliveredActivitiesCard;
