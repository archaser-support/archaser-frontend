import React from "react";
import { useTranslation } from "react-i18next";

import { GenericStats, STAT_ICONS } from "@/shared/layout-components/stats";
import type { DisputeStats as DisputeStatsType } from "@/types/CustomerDispute";
import { formatAmountWithoutSymbol, formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

interface DisputeStatsProps {
    statsData?: { stats: DisputeStatsType };
    statsLoading: boolean;
}

const DisputeStats: React.FC<DisputeStatsProps> = ({
    statsData,
    statsLoading,
}) => {
    const { t, i18n } = useTranslation(["disputes", "common"]);
    // Create custom stat configs for disputes since they have unique data structure
    const statConfigs = [
        {
            key: "total_disputes",
            labelKey: "fields.dispute_total_disputes",
            value:
                statsData?.stats?.disputeAssignFrequencyList?.reduce(
                    (sum, item) => sum + item.dispute_count,
                    0
                ) || 0,
            icon: <STAT_ICONS.GAVEL />,
            status: "info" as const,
        },
        {
            key: "total_customers",
            labelKey: "sections.total_customers",
            value: statsData?.stats?.counts?.total_customers || 0,
            icon: <STAT_ICONS.PEOPLE />,
            status: "success" as const,
        },
        {
            key: "total_invoices",
            labelKey: "fields.total_invoices",
            value: statsData?.stats?.counts?.total_invoices || 0,
            icon: <STAT_ICONS.RECEIPT />,
            status: "error" as const,
        },
        {
            key: "dispute_amount",
            labelKey: "fields.total_amount",
            value: statsData?.stats?.counts?.total_outstanding_amount ?? 0,
            icon: <STAT_ICONS.MONEY />,
            status: "warning" as const,
            formatter: (val: any) => {
                const currency = statsData?.stats?.counts?.currency || "";
                return formatCurrencyWithRTLSupport(Number(val), currency, i18n.language === "he" ? "he-IL" : "en-US", i18n.language);
            },
        },
    ];

    return (
        <GenericStats
            statsData={statsData}
            statsLoading={statsLoading}
            statConfigs={statConfigs}
            translate={(key: string) => t(key, { ns: "disputes" })}
        />
    );
};

export default DisputeStats;
