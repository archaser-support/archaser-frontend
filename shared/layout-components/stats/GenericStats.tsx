import {
    AccountBalance as AccountBalanceIcon,
    Assignment as AssignmentIcon,
    Gavel as GavelIcon,
    AttachMoney as MoneyIcon,
    People as PeopleIcon,
    Receipt as ReceiptIcon,
    Schedule as ScheduleIcon,
    TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import React from "react";

import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

import StatCard, { StatCardGrid } from "./StatCard";


export type StatConfig = {
    key: string;
    labelKey: string;
    value: number | string;
    icon: React.ReactNode;
    status: "success" | "warning" | "error" | "info";
    formatter?: (value: any) => string | number;
};

export type GenericStatsProps = {
    statsData: any;
    statsLoading: boolean;
    statConfigs: StatConfig[];
    columns?: {
        xs?: number;
        sm?: number;
        md?: number;
        lg?: number;
        xl?: number;
    };
    translate: (key: string) => string;
};

const GenericStats: React.FC<GenericStatsProps> = ({
    statsData,
    statsLoading,
    statConfigs,
    columns = { xs: 1, sm: 2, md: 2, lg: 4 },
    translate,
}) => {
    const getValue = (config: StatConfig) => {
        if (config.formatter) {
            return config.formatter(config.value);
        }
        return config.value;
    };

    const getTranslationKey = (config: StatConfig) => {
        // Use the passed translate function instead of useTranslation hook
        return translate(config.labelKey);
    };

    return (
        <StatCardGrid columns={columns}>
            {statConfigs.map((config) => (
                <StatCard
                    key={config.key}
                    label={getTranslationKey(config)}
                    value={getValue(config)}
                    icon={config.icon}
                    isLoading={statsLoading}
                    status={config.status}
                />
            ))}
        </StatCardGrid>
    );
};

// Predefined icon mappings for common use cases
export const STAT_ICONS = {
    PEOPLE: PeopleIcon,
    RECEIPT: ReceiptIcon,
    MONEY: MoneyIcon,
    TRENDING_UP: TrendingUpIcon,
    GAVEL: GavelIcon,
    SCHEDULE: ScheduleIcon,
    ACCOUNT_BALANCE: AccountBalanceIcon,
    ASSIGNMENT: AssignmentIcon,
};

// Helper function to create common stat configurations
export const createStatConfigs = (
    data: any,
    namespace: string
): StatConfig[] => {
    const configs: StatConfig[] = [];

    // Total customers/customers
    if (data?.counts?.total_customers !== undefined) {
        configs.push({
            key: "total_customers",
            labelKey: "total_customers",
            value: data.counts.total_customers,
            icon: <STAT_ICONS.PEOPLE />,
            status: "info",
        });
    }

    // Active customers/customers
    if (data?.counts?.active_customers !== undefined) {
        configs.push({
            key: "active_customers",
            labelKey: "active_customers",
            value: data.counts.active_customers,
            icon: <STAT_ICONS.TRENDING_UP />,
            status: "success",
        });
    }

    // Total invoices
    if (data?.counts?.total_invoices !== undefined) {
        configs.push({
            key: "total_invoices",
            labelKey: "total_invoices",
            value: data.counts.total_invoices,
            icon: <STAT_ICONS.RECEIPT />,
            status: "error",
        });
    }

    // Total outstanding amount
    if (data?.counts?.total_outstanding_amount !== undefined) {
        configs.push({
            key: "total_amount",
            labelKey: "total_amount",
            value: data.counts.total_outstanding_amount,
            icon: <STAT_ICONS.MONEY />,
            status: "warning",
            formatter: formatAmountWithoutSymbol,
        });
    }

    // Total overdue amount (open Overdue invoices, account currency)
    if (data?.counts?.total_overdue_amount !== undefined) {
        configs.push({
            key: "total_overdue_amount",
            labelKey: "total_outstanding_amount",
            value: data.counts.total_overdue_amount,
            icon: <STAT_ICONS.MONEY />,
            status: "error",
            formatter: formatAmountWithoutSymbol,
        });
    }

    // Total disputes
    if (data?.stats?.disputeAssignFrequencyList) {
        const totalDisputes = data.stats.disputeAssignFrequencyList.reduce(
            (sum: number, item: any) => sum + item.dispute_count,
            0
        );
        configs.push({
            key: "total_disputes",
            labelKey: "total_disputes",
            value: totalDisputes,
            icon: <STAT_ICONS.GAVEL />,
            status: "info",
        });
    }

    return configs;
};

export default GenericStats;
