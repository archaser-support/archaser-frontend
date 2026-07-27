import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { AccessControlService } from "./AccessControlService";

// Centralized agent statistics calculation
export interface AgentStatistics {
    total_customers: number;
    total_invoices: number;
    total_outstanding_amount: number;
    currency: string;
}

export const calculateAgentStats = async (params: {
    account_id: number;
    user_id: string;
    search?: string;
    outcome?: string;
    country?: string;
    user_role?: string;
    is_account_manager?: boolean;
    view_as_user_id?: string;
    view_as_user_role?: string;
    businessUnitId?: number;
    isAdmin?: boolean;
    authBusinessUnitId?: number | null;
}) => {
    const {
        account_id,
        user_id,
        search = "",
        outcome = "",
        country = "",
        user_role,
        is_account_manager = false,
        view_as_user_id,
        view_as_user_role,
        businessUnitId,
        isAdmin = false,
        authBusinessUnitId,
    } = params;

    // Get account currency
    const account = await prisma.account.findUnique({
        where: { id: account_id },
        select: { currency: true },
    });
    const currency = account?.currency || "";

    // Get proper owner filter using AccessControlService
    const accessControl = AccessControlService.getInstance();
    const ownerFilter = await accessControl.getOwnerFilter(
        user_id,
        is_account_manager,
        view_as_user_id,
        view_as_user_role
    );

    // Get BU filter
    const buFilter = await accessControl.getBusinessUnitFilter(
        authBusinessUnitId,
        isAdmin,
        account_id
    );

    // Base filters for agents (customers in Agent category)
    const baseFilters: Prisma.CustomerCollectionPeriodWhereInput = {
        Customer: {
            account_id: account_id,
            collection_status: "Active",
            ...(country ? { Country: { name: { equals: country } } } : {}),
            ...(businessUnitId ? { business_unit_id: businessUnitId } : {}),
            AND: [
                ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
                ...(Object.keys(buFilter).length > 0 ? [buFilter] : []),
            ],
        },
        customer_id: {
            not: undefined,
        },
        current_category: "Agent",
        period_end_date: null, // Only count active collection periods (same as table filter)
        ...(outcome ? { last_call_result: outcome } : {}),
        ...(search
            ? {
                Customer: {
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
                },
            }
            : {}),
    };

    // Get counts and totals
    const [totalCustomers, totalInvoices, totalAmount] = await Promise.all([
        prisma.customerCollectionPeriod.count({ where: baseFilters }),
        prisma.invoice.count({
            where: {
                customer_id: {
                    in: await prisma.customerCollectionPeriod
                        .findMany({
                            where: baseFilters,
                            select: { customer_id: true },
                        })
                        .then((periods) => periods.map((p) => p.customer_id)),
                },
                status: { notIn: ["Paid", "Void", "Cancelled"] },
                due_date: {
                    lt: new Date(), // Only count overdue invoices
                },
            },
        }),
        prisma.customerCollectionPeriod.aggregate({
            where: baseFilters,
            _sum: {
                total_outstanding_amount: true,
            },
        }),
    ]);

    return {
        stats: {
            counts: {
                total_customers: totalCustomers,
                total_invoices: totalInvoices,
                total_outstanding_amount:
                    totalAmount._sum.total_outstanding_amount || 0,
                currency: currency,
            },
        },
    };
};
