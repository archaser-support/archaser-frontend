"use client";

import { Gavel as GavelIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";

import { buildOperationDashboardDetailsUrl } from "../operationDashboardDetailsUrl";

type DisputesCreatedCardProps = {
    count?: number;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
};

const DisputesCreatedCard = ({
    count = 0,
    startDate,
    endDate,
    selectedUserId,
}: DisputesCreatedCardProps) => {
    const { t } = useTranslation(["disputes"]);
    const router = useRouter();
    const businessUnitId = useDashboardBusinessUnitId();

    return (
        <CreditMetricCard
            icon={<GavelIcon />}
            iconAccent="terms"
            label={t("fields.disputes_created", { ns: "disputes" })}
            value={count.toLocaleString()}
            onClick={() =>
                router.push(
                    buildOperationDashboardDetailsUrl("disputes-created", {
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

export default DisputesCreatedCard;
