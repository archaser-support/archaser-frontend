"use client";

import { CustomersNavIcon } from "@/shared/components/sidebar-icons";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";

import { pushOperationDashboardDetails } from "../operationDashboardDetailsUrl";

type MissingContactsCardProps = {
    count?: number;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
};

const MissingContactsCard = ({
    count = 0,
    startDate,
    endDate,
    selectedUserId,
}: MissingContactsCardProps) => {
    const { t } = useTranslation(["common"]);
    const router = useRouter();
    const businessUnitId = useDashboardBusinessUnitId();

    return (
        <CreditMetricCard
            icon={<CustomersNavIcon />}
            iconAccent="noPolicy"
            label={t("fields.missing_contacts", { ns: "common" })}
            value={count.toLocaleString()}
            onClick={() =>
                pushOperationDashboardDetails(
                    router,
                    t,
                    "missing-contacts", {
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

export default MissingContactsCard;
