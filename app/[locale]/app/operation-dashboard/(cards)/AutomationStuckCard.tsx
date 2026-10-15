"use client";

import { ActivitySequencesNavIcon } from "@/shared/components/sidebar-icons";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";

import { pushOperationDashboardDetails } from "../operationDashboardDetailsUrl";

type AutomationStuckCardProps = {
    count?: number;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
};

const AutomationStuckCard = ({
    count = 0,
    startDate,
    endDate,
    selectedUserId,
}: AutomationStuckCardProps) => {
    const { t } = useTranslation(["common"]);
    const router = useRouter();
    const businessUnitId = useDashboardBusinessUnitId();

    return (
        <CreditMetricCard
            icon={<ActivitySequencesNavIcon />}
            iconAccent="atRisk"
            label={t("fields.automation_stuck", { ns: "common" })}
            value={count.toLocaleString()}
            onClick={() =>
                pushOperationDashboardDetails(
                    router,
                    t,
                    "automation-stuck", {
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

export default AutomationStuckCard;
