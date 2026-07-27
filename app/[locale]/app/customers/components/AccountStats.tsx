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
import type { CustomerStats } from "@/types/Customer";
import {
    formatCurrencyWithRTLSupport,
    resolveCustomerFirstCurrency,
} from "@/utils/stringFormatters";

interface AccountStatsProps {
    statsData?: { stats: CustomerStats };
    statsLoading: boolean;
}

type StatCardConfig = {
    key: string;
    icon: React.ReactNode;
    iconAccent: MetricStatCardIconAccent;
    label: string;
    getValue: (stats: CustomerStats | undefined) => React.ReactNode;
};

const AccountStats: React.FC<AccountStatsProps> = ({
    statsData,
    statsLoading,
}) => {
    const { t, i18n } = useTranslation(["customers", "common"]);
    const stats = statsData?.stats;
    const locale = i18n.language === "he" ? "he-IL" : "en-US";

    // Avoid terminal-fallback warn while stats are still loading (currency unset).
    const currencyCode = statsLoading
        ? "USD"
        : resolveCustomerFirstCurrency({
              fallbackCurrency: stats?.counts?.currency,
          });

    const loadingValue = <Skeleton variant="text" width={80} height={28} />;

    const statCards: StatCardConfig[] = [
        {
            key: "total_customers",
            icon: <PeopleIcon />,
            iconAccent: "default",
            label: t("sections.total_customers", { ns: "common" }),
            getValue: (s) =>
                statsLoading
                    ? loadingValue
                    : (s?.counts?.total_customers ?? 0).toLocaleString(locale),
        },
        {
            key: "open_invoice_count",
            icon: <ReceiptIcon />,
            iconAccent: "receivables",
            label: t("sections.overdue_and_due_invoices"),
            getValue: (s) =>
                statsLoading
                    ? loadingValue
                    : (s?.counts?.open_invoice_count ?? 0).toLocaleString(
                          locale
                      ),
        },
        {
            key: "total_overdue_amount",
            icon: <ReceiptIcon />,
            iconAccent: "overdue",
            label: t("fields.total_outstanding_amount"),
            getValue: (s) =>
                statsLoading
                    ? loadingValue
                    : formatCurrencyWithRTLSupport(
                          Number(s?.counts?.total_overdue_amount ?? 0),
                          currencyCode,
                          locale,
                          i18n.language
                      ),
        },
        {
            key: "total_due_amount",
            icon: <MoneyIcon />,
            iconAccent: "receivables",
            label: t("fields.total_due_amount"),
            getValue: (s) =>
                statsLoading
                    ? loadingValue
                    : formatCurrencyWithRTLSupport(
                          Number(s?.counts?.total_due_amount ?? 0),
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
                        value={card.getValue(stats)}
                    />
                </Box>
            ))}
        </Box>
    );
};

export default AccountStats;
