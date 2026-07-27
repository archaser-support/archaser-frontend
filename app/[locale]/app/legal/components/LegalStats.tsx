"use client";

import {
    AccountBalance as AccountBalanceIcon,
    AttachMoney as MoneyIcon,
    People as PeopleIcon,
} from "@mui/icons-material";
import { Box, Skeleton } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import type { MetricStatCardIconAccent } from "@/app/theme";
import type { LegalCasesResponse } from "@/shared/services/legalService";
import {
    formatCurrencyWithRTLSupport,
    resolveCustomerFirstCurrency,
} from "@/utils/stringFormatters";

interface LegalStatsProps {
    statsData?: LegalCasesResponse;
    statsLoading: boolean;
}

type StatCardConfig = {
    key: string;
    icon: React.ReactNode;
    iconAccent: MetricStatCardIconAccent;
    label: string;
    getValue: () => React.ReactNode;
};

const LegalStats: React.FC<LegalStatsProps> = ({ statsData, statsLoading }) => {
    const { t, i18n } = useTranslation(["legal", "common"]);
    const counts = statsData;
    const locale = i18n.language === "he" ? "he-IL" : "en-US";
    const currencyCode = resolveCustomerFirstCurrency({
        fallbackCurrency: counts?.currency,
    });

    const loadingValue = <Skeleton variant="text" width={80} height={28} />;

    const statCards: StatCardConfig[] = [
        {
            key: "total_cases",
            icon: <AccountBalanceIcon />,
            iconAccent: "default",
            label: t("sections.total_cases"),
            getValue: () =>
                statsLoading
                    ? loadingValue
                    : (counts?.totalRecords ?? 0).toLocaleString(locale),
        },
        {
            key: "total_customers",
            icon: <PeopleIcon />,
            iconAccent: "compliant",
            label: t("sections.total_customers", { ns: "common" }),
            getValue: () =>
                statsLoading
                    ? loadingValue
                    : (counts?.totalCustomers ?? 0).toLocaleString(locale),
        },
        {
            key: "legal_overdue_amount",
            icon: <MoneyIcon />,
            iconAccent: "receivables",
            label: t("sections.legal_overdue_amount"),
            getValue: () =>
                statsLoading
                    ? loadingValue
                    : formatCurrencyWithRTLSupport(
                          Number(counts?.totalAmount ?? 0),
                          currencyCode,
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

export default LegalStats;
