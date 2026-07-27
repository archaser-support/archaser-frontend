import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveCustomerFirstCurrency } from "@/utils/stringFormatters";

export interface LegalCasesStatistics {
    total_cases: number;
    total_accounts: number;
    total_amount: number;
    currency: string;
}

export const calculateLegalCasesStats = async (params: {
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
    const currency = resolveCustomerFirstCurrency({
        accountCurrency: account?.currency,
    });

    // Get owner filter for access control
    const accessControl = await import(
        "@/server/services/AccessControlService"
    );
    const accessControlService =
        accessControl.AccessControlService.getInstance();
    const ownerFilter = accessControlService.getOwnerFilter(
        user_id,
        false, // isAccountManager - would need to be passed from the calling context
        undefined, // viewAsUserId
        undefined // viewAsUserRole
    );

    // Base filters for legal cases
    const baseFilters: Prisma.CustomerCollectionPeriodWhereInput = {
        Customer: {
            account_id: account_id,
            collection_status: "Active",
            ...ownerFilter,
        },
        current_category: "Legal",
        ...(search
            ? {
                Customer: {
                    OR: [
                        {
                            Company: {
                                name: {
                                    contains: search,
                                    mode: Prisma.QueryMode.insensitive,
                                },
                            },
                        },
                        {
                            Person: {
                                first_name: {
                                    contains: search,
                                    mode: Prisma.QueryMode.insensitive,
                                },
                            },
                        },
                        {
                            Person: {
                                last_name: {
                                    contains: search,
                                    mode: Prisma.QueryMode.insensitive,
                                },
                            },
                        },
                        {
                            customer_number: {
                                contains: search,
                                mode: Prisma.QueryMode.insensitive,
                            },
                        },
                    ],
                },
            }
            : {}),
    };

    // Calculate stats independently
    const [totalCases, totalCustomers, totalAmountResult] = await Promise.all([
        // Count legal cases
        prisma.customerCollectionPeriod.count({
            where: baseFilters,
        }),
        // Count customers that have legal cases (for total customers stat)
        prisma.customer.count({
            where: {
                account_id: account_id,
                collection_status: "Active",
                ...ownerFilter,
                CustomerCollectionPeriod: {
                    some: {
                        current_category: "Legal",
                        period_end_date: null,
                    },
                },
            },
        }),
        // Get total outstanding amount for legal cases
        prisma.customerCollectionPeriod.aggregate({
            where: baseFilters,
            _sum: {
                total_outstanding_amount: true,
            },
        }),
    ]);

    const stats = {
        counts: {
            total_cases: totalCases,
            total_accounts: totalCustomers,
            total_amount: totalAmountResult._sum.total_outstanding_amount || 0,
            currency: currency,
        },
    };

    // Legal cases stats calculated

    return { stats };
};
