"use client";

import {
    AttachMoney as MoneyIcon,
    People as PeopleIcon,
    Receipt as ReceiptIcon,
} from "@mui/icons-material";
import { Box, Skeleton } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import type { MetricStatCardIconAccent } from "@/app/theme";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

interface AgentStatsProps {
    statsData?: {
        stats?: {
            counts?: {
                total_customers?: number;
                total_invoices?: number;
                total_outstanding_amount?: number;
                currency?: string;
            };
        };
    };
    statsLoading: boolean;
}

type StatCardConfig = {
    key: string;
    icon: React.ReactNode;
    iconAccent: MetricStatCardIconAccent;
    label: string;
    getValue: () => React.ReactNode;
};

const AgentStats: React.FC<AgentStatsProps> = ({ statsData, statsLoading }) => {
    const { t, i18n } = useTranslation(["agents", "common"]);
    const counts = statsData?.stats?.counts;
    const locale = i18n.language === "he" ? "he-IL" : "en-US";
    const currency = counts?.currency || "";

    const loadingValue = <Skeleton variant="text" width={80} height={28} />;

    const statCards: StatCardConfig[] = [
        {
            key: "total_customers",
            icon: <PeopleIcon />,
            iconAccent: "default",
            label: t("sections.total_customers", { ns: "common" }),
            getValue: () =>
                statsLoading
                    ? loadingValue
                    : (counts?.total_customers ?? 0).toLocaleString(locale),
        },
        {
            key: "total_invoices",
            icon: <ReceiptIcon />,
            iconAccent: "compliant",
            label: t("sections.total_invoices"),
            getValue: () =>
                statsLoading
                    ? loadingValue
                    : (counts?.total_invoices ?? 0).toLocaleString(locale),
        },
        {
            key: "agent_amount",
            icon: <MoneyIcon />,
            iconAccent: "receivables",
            label: t("sections.total_amount"),
            getValue: () =>
                statsLoading
                    ? loadingValue
                    : formatCurrencyWithRTLSupport(
                          Number(counts?.total_outstanding_amount ?? 0),
                          currency,
                          locale,
                          i18n.language
                      ),
        },
    ];

    return (
        <Box
            sx={{
                mb: 3,
                display: "grid",
                gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(3, 1fr)",
                    lg: "repeat(3, 1fr)",
                },
                gap: 2,
                alignItems: "stretch",
            }}
        >
            {statCards.map((card) => (
                <Box
                    key={card.key}
                    sx={{ height: "100%", minHeight: "40px" }}
                >
                    <CreditMetricCard
                        icon={card.icon}
                        iconAccent={card.iconAccent}
                        label={card.label}
                        value={card.getValue()}
                    />
                </Box>
            ))}
        </Box>
    );
};

export default AgentStats;
