"use client";

import {
    AttachMoney as MoneyIcon,
    People as PeopleIcon,
    Receipt as ReceiptIcon,
    Schedule as ScheduleIcon,
} from "@mui/icons-material";
import { Box, Skeleton } from "@mui/material";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import type { MetricStatCardIconAccent } from "@/app/theme";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

import { PromiseToPayRow } from "../PromiseToPayList";

interface PromiseToPayStatsData {
    stats?: {
        counts?: {
            total_customers?: number;
            total_invoices?: number;
            total_outstanding_amount?: number;
            currency?: string;
        };
    };
}

interface PromiseToPayStatsProps {
    statsData?: PromiseToPayStatsData;
    statsLoading: boolean;
    promiseToPayList: PromiseToPayRow[];
}

type StatCardConfig = {
    key: string;
    icon: React.ReactNode;
    iconAccent: MetricStatCardIconAccent;
    label: string;
    getValue: () => React.ReactNode;
};

const PromiseToPayStats: React.FC<PromiseToPayStatsProps> = ({
    statsData,
    statsLoading,
    promiseToPayList,
}) => {
    const { t, i18n } = useTranslation(["promise_to_pay", "common"]);
    const counts = statsData?.stats?.counts;
    const locale = i18n.language === "he" ? "he-IL" : "en-US";
    const currency = counts?.currency || "";

    const loadingValue = <Skeleton variant="text" width={80} height={28} />;

    const statCards: StatCardConfig[] = useMemo(
        () => [
            {
                key: "total_promises",
                icon: <ScheduleIcon />,
                iconAccent: "default",
                label: t("fields.total_promises"),
                getValue: () =>
                    statsLoading
                        ? loadingValue
                        : promiseToPayList.length.toLocaleString(locale),
            },
            {
                key: "total_customers",
                icon: <PeopleIcon />,
                iconAccent: "compliant",
                label: t("sections.total_customers", { ns: "common" }),
                getValue: () =>
                    statsLoading
                        ? loadingValue
                        : (counts?.total_customers ?? 0).toLocaleString(locale),
            },
            {
                key: "total_invoices",
                icon: <ReceiptIcon />,
                iconAccent: "overdue",
                label: t("fields.total_invoices"),
                getValue: () =>
                    statsLoading
                        ? loadingValue
                        : (counts?.total_invoices ?? 0).toLocaleString(locale),
            },
            {
                key: "promise_to_pay_amount",
                icon: <MoneyIcon />,
                iconAccent: "receivables",
                label: t("fields.total_amount"),
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
        ],
        [
            counts?.total_customers,
            counts?.total_invoices,
            counts?.total_outstanding_amount,
            currency,
            i18n.language,
            locale,
            promiseToPayList.length,
            statsLoading,
            t,
        ]
    );

    return (
        <Box
            sx={{
                mb: 3,
                display: "grid",
                gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(2, 1fr)",
                    lg: "repeat(4, 1fr)",
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

export default PromiseToPayStats;
