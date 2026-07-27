/**
 * Thin summary for financial dashboard customer chart-details metric cards.
 * Reuses the customer filter contract + ReportQueryBuilder so cards match
 * report-list membership without materializing full grid rows.
 */

import { prisma } from "@/lib/prisma";
import { LogService } from "@/server/services/LogService";
import { ReportQueryBuilder } from "@/server/services/ReportQueryBuilder";
import type { ReportConfig } from "@/server/services/ReportService";
import {
    buildDashboardCustomerChartFilters,
    expandDashboardActiveDynamicsWhere,
    type DashboardCustomerChartFamily,
} from "@/shared/dashboard/dashboardCustomerChartFilters";
import { prepareDashboardCustomerExecuteFilters } from "@/server/services/dashboardCustomerExecuteFilters";

export interface DashboardCustomerChartSummaryInput {
    type: string;
    period?: string | null;
    viewMode?: string | null;
    accountId: number;
    businessUnitFilter?: Record<string, unknown>;
    ownerFilter?: Record<string, unknown>;
    now?: Date;
}

export interface DashboardCustomerChartSummaryResult {
    totalRecords: number;
    totalAmount: number;
}

function amountForFamily(
    family: DashboardCustomerChartFamily,
    customer: {
        CustomerCollectionPeriod?: Array<{
            total_outstanding_amount: number | null;
        }>;
    }
): number {
    if (family !== "overdue") {
        return 0;
    }
    const period = customer.CustomerCollectionPeriod?.[0];
    return period?.total_outstanding_amount || 0;
}

export async function getDashboardCustomerChartSummary(
    input: DashboardCustomerChartSummaryInput
): Promise<DashboardCustomerChartSummaryResult | null> {
    const contract = buildDashboardCustomerChartFilters({
        type: input.type,
        period: input.period,
        viewMode: input.viewMode,
        now: input.now,
    });

    if (
        !contract.isCustomerShaped ||
        !contract.isCustomerList ||
        !contract.family ||
        contract.parentViewModeRequiresSpecialHandling
    ) {
        return null;
    }

    const prepared = prepareDashboardCustomerExecuteFilters(
        contract.additionalFilters,
        {
            businessUnitFilter: input.businessUnitFilter,
            now: input.now,
        }
    );

    const config: ReportConfig = {
        tables: ["Customer"],
        fields: [{ table: "Customer", field: "id" }],
        filters: [],
        sorting: [],
        grouping: [],
    };

    const queryBuilder = new ReportQueryBuilder(LogService.getInstance());
    const businessUnitFilter = prepared.skipBusinessUnitFilter
        ? undefined
        : input.businessUnitFilter;

    let primaryWhereExtras = prepared.primaryWhereExtras;
    if (
        contract.family === "active_dynamics" &&
        !primaryWhereExtras &&
        input.period
    ) {
        primaryWhereExtras =
            expandDashboardActiveDynamicsWhere(input.period.slice(0, 7), {
                businessUnitFilter: input.businessUnitFilter,
                now: input.now,
            }) ?? undefined;
    }

    const { where } = queryBuilder.buildQuery(
        config,
        input.accountId,
        prepared.filters,
        undefined,
        businessUnitFilter,
        input.ownerFilter && Object.keys(input.ownerFilter).length > 0
            ? input.ownerFilter
            : undefined,
        primaryWhereExtras
    );

    if (contract.family === "active_dynamics") {
        const totalRecords = await prisma.customer.count({ where });
        return { totalRecords, totalAmount: 0 };
    }

    const customers = await prisma.customer.findMany({
        where,
        select: {
            CustomerCollectionPeriod: {
                where: { period_end_date: null },
                orderBy: { created_at: "desc" },
                take: 1,
                select: { total_outstanding_amount: true },
            },
        },
    });

    const totalAmount = customers.reduce(
        (sum, customer) => sum + amountForFamily(contract.family!, customer),
        0
    );

    return {
        totalRecords: customers.length,
        totalAmount,
    };
}
