"use client";
import { Box, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { OperationDashboardResponse } from "@/types/OperationDashboard";

import ManualActivitiesCard from "./ManualActivitiesCard";
import DisputesCreatedCard from "./DisputesCreatedCard";
import DisputesClosedCard from "./DisputesClosedCard";
import TotalCallsCard from "./TotalCallsCard";
import PromisesToPayCard from "./PromisesToPayCard";
import ActivitySuccessRateCard from "./ActivitySuccessRateCard";

import PortalActivitiesCard from "./PortalActivitiesCard";
import SystemActivitiesCard from "./SystemActivitiesCard";

interface AggregateStatsCardsProps {
    data: OperationDashboardResponse;
    currency: string;
    startDate?: Date;
    endDate?: Date;
    selectedUserId?: string | null;
}

const AggregateStatsCards: React.FC<AggregateStatsCardsProps> = ({
    data,
    currency,
    startDate,
    endDate,
    selectedUserId,
}) => {
    const { aggregate } = data;
    const { t } = useTranslation("activities");

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Box>
                <Typography
                    variant="h6"
                    sx={{
                        mb: 2,
                        fontWeight: 600,
                        color: "text.primary",
                        fontSize: "1rem",
                    }}
                >
                    {t("sections.agent_statistics")}
                </Typography>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, 1fr)",
                            md: "repeat(3, 1fr)",
                            lg: "repeat(4, 1fr)",
                        },
                        gap: 2,
                    }}
                >
                    <ManualActivitiesCard
                        count={aggregate.activities.manual}
                        startDate={startDate}
                        endDate={endDate}
                        selectedUserId={selectedUserId}
                    />
                    <DisputesCreatedCard
                        count={aggregate.disputes.created}
                        startDate={startDate}
                        endDate={endDate}
                        selectedUserId={selectedUserId}
                    />
                    <DisputesClosedCard
                        count={aggregate.disputes.closed}
                        startDate={startDate}
                        endDate={endDate}
                        selectedUserId={selectedUserId}
                    />

                    <TotalCallsCard
                        total={aggregate.calls.total}
                        successRate={aggregate.calls.successRate}
                        startDate={startDate}
                        endDate={endDate}
                        selectedUserId={selectedUserId}
                    />
                    <PromisesToPayCard
                        total={aggregate.promises.total}
                        fulfillmentRate={aggregate.promises.fulfillmentRate}
                        startDate={startDate}
                        endDate={endDate}
                        selectedUserId={selectedUserId}
                    />
                    <ActivitySuccessRateCard
                        successRate={aggregate.activities.successRate}
                        startDate={startDate}
                        endDate={endDate}
                        selectedUserId={selectedUserId}
                    />
                </Box>
            </Box>

            {aggregate.userCounts && (
                <Box>
                    <Typography
                        variant="h6"
                        sx={{
                            mb: 2,
                            fontWeight: 600,
                            color: "text.primary",
                            fontSize: "1rem",
                        }}
                    >
                        {t("sections.system_and_portal_activities")}
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "repeat(2, 1fr)",
                                md: "repeat(3, 1fr)",
                                lg: "repeat(4, 1fr)",
                            },
                            gap: 2,
                        }}
                    >
                        <SystemActivitiesCard
                            count={aggregate.userCounts.system}
                            startDate={startDate}
                            endDate={endDate}
                            selectedUserId={selectedUserId}
                        />
                        <PortalActivitiesCard
                            count={aggregate.userCounts.portal}
                            startDate={startDate}
                            endDate={endDate}
                            selectedUserId={selectedUserId}
                        />
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default AggregateStatsCards;
