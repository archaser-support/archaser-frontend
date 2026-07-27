import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Centralized promise-to-pay statistics calculation
export interface PromiseToPayStatistics {
    total_customers: number;
    total_invoices: number;
    total_outstanding_amount: number;
    currency: string;
}

export const calculatePromiseToPayStats = async (params: {
    account_id: number;
    user_id: string;
    search?: string;
}) => {
    const { account_id, user_id, search = "" } = params;

    // Get account currency
    const account = await prisma.account.findUnique({
        where: { id: account_id },
        select: { currency: true },
    });
    const currency = account?.currency || "";

    // Base filters for promise-to-pay records
    const baseFilters: Prisma.CustomerCollectionPeriodWhereInput = {
        period_end_date: null,
        current_category: "Promise_to_pay",
        Customer: {
            account_id,
            Activity: {
                some: { type: { in: ["Email", "Call", "SMS", "WhatsApp"] } },
            },
            ...(search
                ? {
                    OR: [
                        {
                            Company: {
                                name: {
                                    contains: search,
                                    mode: "insensitive",
                                },
                            },
                        },
                        {
                            Person: {
                                first_name: {
                                    contains: search,
                                    mode: "insensitive",
                                },
                            },
                        },
                        {
                            Person: {
                                last_name: {
                                    contains: search,
                                    mode: "insensitive",
                                },
                            },
                        },
                    ],
                }
                : {}),
        },
    };

    // Get latest collection periods for each customer
    const latestCollectionPeriods = await prisma.customerCollectionPeriod.groupBy(
        {
            by: ["customer_id"],
            where: baseFilters,
            _max: { id: true },
        }
    );

    const latestPeriodIds = latestCollectionPeriods
        .map((cp) => cp._max.id)
        .filter((id): id is number => id !== null);

    // Get unique customers count
    const totalCustomers = latestPeriodIds.length;

    // Get total outstanding amount
    const totalAmountResult = await prisma.customerCollectionPeriod.aggregate({
        where: { ...baseFilters, id: { in: latestPeriodIds } },
        _sum: {
            total_outstanding_amount: true,
        },
    });
    const totalOutstandingAmount =
        totalAmountResult._sum.total_outstanding_amount || 0;

    // Get total invoices count
    const totalInvoices = await prisma.invoice.count({
        where: {
            customer_id: {
                in: await prisma.customerCollectionPeriod
                    .findMany({
                        where: { ...baseFilters, id: { in: latestPeriodIds } },
                        select: { customer_id: true },
                    })
                    .then((periods) => periods.map((p) => p.customer_id)),
            },
            status: { notIn: ["Paid", "Void", "Cancelled"] },
        },
    });

    return {
        stats: {
            counts: {
                total_customers: totalCustomers,
                total_invoices: totalInvoices,
                total_outstanding_amount: totalOutstandingAmount,
                currency: currency,
            },
        },
    };
};
