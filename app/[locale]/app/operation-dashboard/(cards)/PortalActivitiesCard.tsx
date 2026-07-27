"use client";

import { Public as PublicIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";

import { buildOperationDashboardDetailsUrl } from "../operationDashboardDetailsUrl";

type PortalActivitiesCardProps = {
    count?: number;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
};

const PortalActivitiesCard = ({
    count = 0,
    startDate,
    endDate,
    selectedUserId,
}: PortalActivitiesCardProps) => {
    const { t } = useTranslation(["activities"]);
    const router = useRouter();
    const businessUnitId = useDashboardBusinessUnitId();

    return (
        <CreditMetricCard
            icon={<PublicIcon />}
            iconAccent="default"
            label={t("fields.portal_activities", { ns: "activities" })}
            value={count.toLocaleString()}
            onClick={() =>
                router.push(
                    buildOperationDashboardDetailsUrl("portal-activities", {
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

export default PortalActivitiesCard;
