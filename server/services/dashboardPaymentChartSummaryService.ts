/**
 * Thin summary for financial dashboard payment chart-details metric cards.
 */

import { prisma } from "@/lib/prisma";
import { LogService } from "@/server/services/LogService";
import { ReportQueryBuilder } from "@/server/services/ReportQueryBuilder";
import type { ReportConfig } from "@/server/services/ReportService";
import { buildDashboardPaymentChartFilters } from "@/shared/dashboard/dashboardPaymentChartFilters";

export interface DashboardPaymentChartSummaryInput {
    type: string;
    period?: string | null;
    accountId: number;
    now?: Date;
}

export interface DashboardPaymentChartSummaryResult {
    totalRecords: number;
    totalAmount: number;
}

export async function getDashboardPaymentChartSummary(
    input: DashboardPaymentChartSummaryInput
): Promise<DashboardPaymentChartSummaryResult | null> {
    const contract = buildDashboardPaymentChartFilters({
        type: input.type,
        period: input.period,
        now: input.now,
    });

    if (
        !contract.isPaymentShaped ||
        !contract.isPaymentList ||
        !contract.family
    ) {
        return null;
    }

    const config: ReportConfig = {
        tables: ["InvoicePayment"],
        fields: [{ table: "InvoicePayment", field: "id" }],
        filters: [],
        sorting: [],
        grouping: [],
    };

    const queryBuilder = new ReportQueryBuilder(LogService.getInstance());
    const { where } = queryBuilder.buildQuery(
        config,
        input.accountId,
        contract.additionalFilters,
        undefined,
        {}, // no BU — collected MTD parity
        undefined
    );

    const payments = await prisma.invoicePayment.findMany({
        where,
        select: { amount: true },
    });

    const totalAmount = payments.reduce(
        (sum, payment) => sum + (payment.amount || 0),
        0
    );

    return {
        totalRecords: payments.length,
        totalAmount,
    };
}
