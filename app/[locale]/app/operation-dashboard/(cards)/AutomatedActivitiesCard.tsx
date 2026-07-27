"use client";

import { AutoAwesome as AutoAwesomeIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";

import { buildOperationDashboardDetailsUrl } from "../operationDashboardDetailsUrl";

type AutomatedActivitiesCardProps = {
    count?: number;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
};

const AutomatedActivitiesCard = ({
    count = 0,
    startDate,
    endDate,
    selectedUserId,
}: AutomatedActivitiesCardProps) => {
    const { t } = useTranslation(["activities"]);
    const router = useRouter();
    const businessUnitId = useDashboardBusinessUnitId();

    return (
        <CreditMetricCard
            icon={<AutoAwesomeIcon />}
            iconAccent="default"
            label={t("fields.automated_activities", { ns: "activities" })}
            value={count.toLocaleString()}
            onClick={() =>
                router.push(
                    buildOperationDashboardDetailsUrl("automated-activities", {
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

export default AutomatedActivitiesCard;
