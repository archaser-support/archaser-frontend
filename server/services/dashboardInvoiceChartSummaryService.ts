/**
 * Thin summary for financial dashboard invoice chart-details metric cards.
 * Reuses the dashboard invoice filter contract + ReportQueryBuilder so cards
 * match report-list membership without materializing full grid rows.
 */

import { prisma } from "@/lib/prisma";
import { LogService } from "@/server/services/LogService";
import { ReportQueryBuilder } from "@/server/services/ReportQueryBuilder";
import type { Filter } from "@/server/services/ReportExecutionService.types";
import type { ReportConfig } from "@/server/services/ReportService";
import {
    buildDashboardInvoiceChartFilters,
    type DashboardInvoiceChartFamily,
} from "@/shared/dashboard/dashboardInvoiceChartFilters";
import {
    isDatePresetValue,
    isPeriodPreset,
    resolveDatePreset,
    resolveDatePresetRange,
} from "@/utils/datePresetUtils";

export interface DashboardInvoiceChartSummaryInput {
    type: string;
    daysRange?: string | null;
    viewMode?: string | null;
    accountId: number;
    businessUnitFilter?: Record<string, unknown>;
    ownerFilter?: Record<string, unknown>;
    now?: Date;
}

export interface DashboardInvoiceChartSummaryResult {
    totalRecords: number;
    totalAmount: number;
    currency?: string;
}

function resolveFilterDatePresets(filters: Filter[]): Filter[] {
    return filters.map((filter) => {
        const newFilter = { ...filter };
        if (!isDatePresetValue(newFilter.value)) {
            return newFilter;
        }

        const preset = newFilter.value.__datePreset;
        const input = newFilter.value.__datePresetInput;
        const comparisonOps = [
            "greater_than",
            "greater_than_or_equal",
            "less_than",
            "less_than_or_equal",
        ];
        const isComparisonOp = comparisonOps.includes(newFilter.operator);

        if (isPeriodPreset(preset) && !isComparisonOp) {
            const range = resolveDatePresetRange(preset, input, false);
            if (range) {
                newFilter.operator = "between";
                newFilter.value = range;
            } else {
                newFilter.value = resolveDatePreset(preset, input, false);
            }
        } else if (isPeriodPreset(preset) && isComparisonOp) {
            const range = resolveDatePresetRange(preset, input, false);
            if (range) {
                const [start, end] = range;
                const useEnd =
                    newFilter.operator === "greater_than" ||
                    newFilter.operator === "less_than_or_equal";
                newFilter.value = useEnd ? end : start;
            } else {
                newFilter.value = resolveDatePreset(preset, input, false);
            }
        } else {
            newFilter.value = resolveDatePreset(preset, input, false);
        }

        return newFilter;
    });
}

function amountForFamily(
    family: DashboardInvoiceChartFamily,
    invoice: {
        amount: number | null;
        total_paid: number | null;
        outstanding_debt: number | null;
        customer_outstanding_debt: number | null;
    }
): number {
    if (family === "overdue") {
        return invoice.amount || 0;
    }
    if (family === "aging") {
        return (invoice.amount || 0) - (invoice.total_paid || 0);
    }
    const outstandingDebt = invoice.outstanding_debt || 0;
    const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
    return outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt;
}

export async function getDashboardInvoiceChartSummary(
    input: DashboardInvoiceChartSummaryInput
): Promise<DashboardInvoiceChartSummaryResult | null> {
    const contract = buildDashboardInvoiceChartFilters({
        type: input.type,
        daysRange: input.daysRange,
        viewMode: input.viewMode,
        now: input.now,
    });

    if (
        !contract.isInvoiceShaped ||
        !contract.isInvoiceList ||
        !contract.family ||
        contract.parentViewModeRequiresSpecialHandling
    ) {
        return null;
    }

    const resolvedFilters = resolveFilterDatePresets(contract.additionalFilters);
    const config: ReportConfig = {
        tables: ["Invoice"],
        fields: [{ table: "Invoice", field: "id" }],
        filters: [],
        sorting: [],
        grouping: [],
    };

    const queryBuilder = new ReportQueryBuilder(LogService.getInstance());
    const { where } = queryBuilder.buildQuery(
        config,
        input.accountId,
        resolvedFilters,
        undefined,
        input.businessUnitFilter,
        input.ownerFilter && Object.keys(input.ownerFilter).length > 0
            ? input.ownerFilter
            : undefined
    );

    const invoices = await prisma.invoice.findMany({
        where,
        select: {
            amount: true,
            total_paid: true,
            outstanding_debt: true,
            customer_outstanding_debt: true,
        },
    });

    const totalAmount = invoices.reduce(
        (sum, invoice) => sum + amountForFamily(contract.family!, invoice),
        0
    );

    return {
        totalRecords: invoices.length,
        totalAmount,
    };
}
