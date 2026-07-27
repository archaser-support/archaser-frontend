
import {
    category,
    Contact,
    Customer,
    CustomerCollectionPeriod,
    contact_status
} from "@prisma/client";

import { DbClient, prisma } from "@/lib/prisma";
import { ActivityStatus, LogLevel } from "@/types/enums";
import { isCreditOnlyAccount } from "@/shared/utils/accountProducts";
import { scheduleDateTime } from "@/utils/datetimeOperations";

import { ActivityService } from "./ActivityService";
import { CollectionPeriodService } from "./CollectionPeriodService";
import { CustomerAggregationService } from "./CustomerAggregationService";
import { LogService } from "./LogService";
import { ParentCustomerValidationService } from "./ParentCustomerValidationService";

export class CustomerService {
    private logService = LogService.getInstance();
    private activityService: ActivityService;

    constructor() {
        this.activityService = new ActivityService();
    }

    public static async findCustomersByCustomerNumber(
        customerNumbers: string[],
        accountId: number
    ): Promise<Map<string, number>> {
        // First try exact match
        let customers = await prisma.customer.findMany({
            where: {
                customer_number: {
                    in: customerNumbers,
                },
                account_id: accountId,
            },
            select: {
                id: true,
                customer_number: true,
            },
        });

        // If we didn't find all customers, try trimming whitespace
        const foundCustomerNumbers = customers.map((d) => d.customer_number);
        const missingCustomerNumbers = customerNumbers.filter(
            (dn) => !foundCustomerNumbers.includes(dn)
        );

        if (missingCustomerNumbers.length > 0) {
            // Try with trimmed customer numbers
            const trimmedCustomers = await prisma.customer.findMany({
                where: {
                    account_id: accountId,
                    OR: missingCustomerNumbers.map((dn) => ({
                        customer_number: {
                            equals: dn.trim(),
                            mode: "insensitive",
                        },
                    })),
                },
                select: {
                    id: true,
                    customer_number: true,
                },
            });

            // Add trimmed results to our customers list
            customers = [...customers, ...trimmedCustomers];
        }

        const customerByCustomerNumber: Map<string, number> = new Map();
        for (const customer of customers) {
            if (customer.customer_number) {
                // Map both the exact customer_number and the trimmed version
                customerByCustomerNumber.set(
                    customer.customer_number,
                    customer.id
                );
                customerByCustomerNumber.set(
                    customer.customer_number.trim(),
                    customer.id
                );
            }
        }

        return customerByCustomerNumber;
    }

    public async upsertCustomer(
        customerData: Partial<Customer> & {
            name?: string;
            company_code?: string;
            owner_email?: string;
        },
        userId?: string,
        options?: {
            systemGenerated?: boolean;
            isPortal?: boolean;
        }
    ): Promise<Customer> {
        try {
            // Trim whitespace from string fields to prevent lookup issues
            const trimmedCustomerData = { ...customerData };
            if (trimmedCustomerData.customer_number) {
                trimmedCustomerData.customer_number = String(
                    trimmedCustomerData.customer_number
                ).trim();
            }
            if (trimmedCustomerData.email) {
                trimmedCustomerData.email = String(
                    trimmedCustomerData.email
                ).trim();
            }
            if (trimmedCustomerData.phone) {
                trimmedCustomerData.phone = String(
                    trimmedCustomerData.phone
                ).trim();
            }
            if (trimmedCustomerData.address_line1) {
                trimmedCustomerData.address_line1 = String(
                    trimmedCustomerData.address_line1
                ).trim();
            }
            if (trimmedCustomerData.address_line2) {
                trimmedCustomerData.address_line2 = String(
                    trimmedCustomerData.address_line2
                ).trim();
            }
            if (trimmedCustomerData.city) {
                trimmedCustomerData.city = String(
                    trimmedCustomerData.city
                ).trim();
            }
            if (trimmedCustomerData.postal_code) {
                trimmedCustomerData.postal_code = String(
                    trimmedCustomerData.postal_code
                ).trim();
            }

            // Handle input fields that need to be processed
            if (customerData.name) {
                const trimmedName = String(customerData.name).trim();
                // The name field from input needs to be processed based on customer type
                // This will be handled by the calling code that knows the customer type
            }
            if (customerData.company_code) {
                const trimmedCompanyCode = String(
                    customerData.company_code
                ).trim();
                // The company_code field from input needs to be processed
                // This will be handled by the calling code that knows how to map it
            }
            if (customerData.owner_email) {
                const trimmedOwnerEmail = String(
                    customerData.owner_email
                ).trim();
                // The owner_email field from input needs to be processed
                // This will be handled by the calling code that knows how to map it
            }

            // If creating a new customer (no id), set the default automated sequence
            if (!trimmedCustomerData.id && trimmedCustomerData.account_id) {
                const defaultSequence =
                    await prisma.sequenceContainer.findFirst({
                        where: {
                            account_id: trimmedCustomerData.account_id,
                            category: "Automated",
                            is_default: true,
                            active: true,
                        },
                        select: { id: true },
                    });

                if (defaultSequence) {
                    trimmedCustomerData.sequence_container_id =
                        defaultSequence.id;
                }
            }

            // If creating a new customer and business_unit_id is missing, set it to user's BU or root BU
            if (
                !trimmedCustomerData.id &&
                !trimmedCustomerData.business_unit_id &&
                trimmedCustomerData.account_id
            ) {
                let defaultBusinessUnitId: number | null = null;

                // First try to use user's business unit
                if (userId) {
                    const user = await prisma.user.findUnique({
                        where: { id: userId },
                        select: { business_unit_id: true },
                    });

                    if (user?.business_unit_id) {
                        defaultBusinessUnitId = user.business_unit_id;
                    }
                }

                // If user has no BU, use account's primary business unit (root BU)
                if (!defaultBusinessUnitId) {
                    const primaryBusinessUnit =
                        await prisma.businessUnit.findFirst({
                            where: {
                                account_id: trimmedCustomerData.account_id,
                                is_primary: true,
                            },
                            select: { id: true },
                        });

                    if (primaryBusinessUnit) {
                        defaultBusinessUnitId = primaryBusinessUnit.id;
                    }
                }

                if (defaultBusinessUnitId) {
                    trimmedCustomerData.business_unit_id =
                        defaultBusinessUnitId;
                }
            }

            const isUpdate = !!trimmedCustomerData.id;

            // Determine audit user ID based on context
            let auditUserId: string | undefined = userId;
            if (trimmedCustomerData.account_id) {
                const { getSystemUserId, getPortalUserId } = await import(
                    "./UserService"
                );
                if (options?.isPortal) {
                    auditUserId = getPortalUserId(
                        trimmedCustomerData.account_id
                    );
                } else if (options?.systemGenerated) {
                    auditUserId = getSystemUserId(
                        trimmedCustomerData.account_id
                    );
                }
            }

            const savedCustomer = await prisma.customer.upsert({
                where: { id: trimmedCustomerData.id ?? -1 },
                create: {
                    ...(trimmedCustomerData as any),
                    created_by: auditUserId,
                    modified_by: auditUserId,
                },
                update: {
                    ...(trimmedCustomerData as any),
                    modified_by: auditUserId,
                },
            });

            if (!isUpdate) {
                try {
                    const { autoAssignPendingReviewDcl } = await import(
                        "@/server/services/creditInsurance/AutoAssignPendingReviewDclService"
                    );
                    await autoAssignPendingReviewDcl({
                        customerId: savedCustomer.id,
                        accountId: savedCustomer.account_id,
                        countryId: savedCustomer.country_id ?? null,
                        customerNumber: savedCustomer.customer_number ?? null,
                        modifiedBy: auditUserId ?? null,
                    });
                } catch (autoAssignErr) {
                    console.error(
                        "[CustomerService.upsertCustomer] autoAssignPendingReviewDcl failed:",
                        autoAssignErr
                    );
                }
            }

            return savedCustomer;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "CustomerService.upsertCustomer",
                "CustomerService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }

    public async getCustomerById(
        customerId: number
    ): Promise<Customer & { contacts: Contact[] }> {
        try {
            const result = await prisma.customer.findUnique({
                where: { id: customerId },
                include: {
                    Company: {
                        include: {
                            Contact: true,
                        },
                    },
                },
            });
            if (!result) throw new Error("Customer not found");
            return { ...result, contacts: result.Company?.Contact ?? [] };
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "CustomerService.getCustomerById",
                "CustomerService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }

    public async getCustomerCollectionPeriod(
        customerId: number
    ): Promise<CustomerCollectionPeriod | null> {
        try {
            const collectionPeriod =
                await prisma.customerCollectionPeriod.findFirst({
                    where: {
                        customer_id: customerId,
                        period_end_date: null,
                    },
                    include: {
                        Customer: {
                            include: {
                                Company: {
                                    include: {
                                        Contact: {
                                            where: { status: contact_status.Active },
                                            orderBy: [
                                                {
                                                    receives_standard_reminder:
                                                        "desc",
                                                },
                                                {
                                                    receives_escalated_reminder:
                                                        "desc",
                                                },
                                            ],
                                            take: 1,
                                        },
                                    },
                                },
                                Person: true,
                                Country: true,
                            },
                        },
                    },
                });

            if (!collectionPeriod) {
                return null;
            }

            // Fetch Account separately using account_id
            const account = collectionPeriod.Customer.account_id
                ? await prisma.account.findUnique({
                    where: { id: collectionPeriod.Customer.account_id },
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                        sub_domain: true,
                        currency: true,
                        category_for_new_collection: true,
                    },
                })
                : null;

            // Attach Account to customer object for compatibility
            const customerWithAccount = {
                ...collectionPeriod.Customer,
                Account: account,
            };

            return {
                ...collectionPeriod,
                Customer: customerWithAccount,
            } as CustomerCollectionPeriod;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "CustomerService.getCustomerCollectionPeriod",
                "CustomerService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }

    /**
     * @deprecated Use updateCollectionPeriodCategory instead
     */
    public async updateCustomerCollectionPeriod(
        periodId: number,
        data: {
            previous_category?: category;
            current_category?: category;
            promise_to_pay_date?: Date;
        }
    ): Promise<CustomerCollectionPeriod> {
        try {
            const updatedCollectionPeriod =
                await prisma.customerCollectionPeriod.update({
                    where: { id: periodId },
                    data: {
                        previous_category: data.previous_category ?? null,
                        current_category: data.current_category ?? null,
                        promise_to_pay_date: data.promise_to_pay_date,
                    },
                    include: {
                        Customer: {
                            select: {
                                id: true,
                                account_id: true,
                            },
                        },
                    },
                });

            // Fetch Account separately using account_id
            const account = updatedCollectionPeriod.Customer.account_id
                ? await prisma.account.findUnique({
                    where: {
                        id: updatedCollectionPeriod.Customer.account_id,
                    },
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                        sub_domain: true,
                        currency: true,
                    },
                })
                : null;

            // Attach Account to customer object for compatibility
            const customerWithAccount = {
                ...updatedCollectionPeriod.Customer,
                Account: account,
            };

            return {
                ...updatedCollectionPeriod,
                Customer: customerWithAccount,
            } as CustomerCollectionPeriod;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "CustomerService.updateCustomerCollectionPeriod",
                "CustomerService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }

    public async updateCustomerCollectionPeriodCallInfo(
        periodId: number | null,
        data: {
            last_call?: Date;
            last_call_result?: string;
            follow_up_time?: Date;
            // current_category?: category;
            // previous_category?: category;
            promise_to_pay_date?: Date;
            promise_to_pay_amount?: number;
            promise_to_pay_count?: number | { increment: number };
        }
    ): Promise<CustomerCollectionPeriod | null> {
        try {
            // If no period ID is provided, we can't update a collection period
            if (!periodId) {
                return null;
            }

            const result = await prisma.customerCollectionPeriod.update({
                where: { id: periodId },
                data: {
                    last_call: data.last_call,
                    last_call_result: data.last_call_result,
                    follow_up_time: data.follow_up_time,
                    // current_category: data.current_category,
                    promise_to_pay_date: data.promise_to_pay_date,
                    promise_to_pay_amount: data.promise_to_pay_amount,
                    promise_to_pay_count: data.promise_to_pay_count,
                },
                include: {
                    Customer: {
                        select: {
                            id: true,
                            account_id: true,
                        },
                    },
                },
            });

            // Invalidate operation dashboard cache if promise data was updated
            // Promises affect operation dashboard stats
            if (
                data.promise_to_pay_date !== undefined ||
                data.promise_to_pay_amount !== undefined ||
                data.promise_to_pay_count !== undefined
            ) {
                (async () => {
                    try {
                        const { invalidateOperationDashboardCacheForAccount } =
                            await import(
                                "@/server/utils/cacheInvalidationHelper"
                            );
                        await invalidateOperationDashboardCacheForAccount(
                            result.Customer.account_id
                        );
                    } catch (error) {
                        // Cache invalidation failure should not break update
                        console.error(
                            "Failed to invalidate operation dashboard cache:",
                            error
                        );
                    }
                })();
            }

            // Invalidate dashboard cache when collection period is updated (affects promise to pay data)
            if (result.Customer.account_id) {
                try {
                    const { invalidateDashboardCacheForAccount } = await import(
                        "@/server/utils/cacheInvalidationHelper"
                    );
                    await invalidateDashboardCacheForAccount(
                        result.Customer.account_id
                    );
                } catch (error) {
                    // Cache invalidation failure should not break the update
                    console.error(
                        "Failed to invalidate dashboard cache:",
                        error
                    );
                }
            }

            // Fetch Account separately using account_id
            const account = result.Customer.account_id
                ? await prisma.account.findUnique({
                    where: { id: result.Customer.account_id },
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                        sub_domain: true,
                        currency: true,
                    },
                })
                : null;

            // Attach Account to customer object for compatibility
            const customerWithAccount = {
                ...result.Customer,
                Account: account,
            };

            return {
                ...result,
                Customer: customerWithAccount,
            } as CustomerCollectionPeriod;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "CustomerService.updateCustomerCollectionPeriodCallInfo",
                error
            );
            throw error;
        }
    }

    /**
     * Calculate due amounts for multiple customers.
        // Include all invoices with status = "Due", including negative amounts (credits)
     *
     * @param customerIds - List of customer IDs to calculate due amounts for
     * @returns A Map where the key is the customer ID and the value contains the due amount data
     */
    public static async calculateDueAmountsForCustomers(
        customerIds: number[],
        dbClient: DbClient = prisma
    ): Promise<Map<number, Partial<Customer>>> {
        const result: Map<number, Partial<Customer>> = new Map();

        if (!customerIds.length) return result;

        // Run all aggregations in parallel
        const [totalGrouped, currencyGrouped, countGrouped] = await Promise.all(
            [
                // Sum of outstanding_debt per customer (only due invoices)
                // Include all invoices with status = "Due", including negative amounts (credits)
                dbClient.invoice.groupBy({
                    by: ["customer_id"],
                    where: {
                        customer_id: { in: customerIds },
                        status: "Due",
                        OR: [
                            { outstanding_debt: { not: 0 } },
                            { customer_outstanding_debt: { not: 0 } },
                        ],
                    },
                    _sum: {
                        outstanding_debt: true,
                        customer_outstanding_debt: true,
                    },
                }),
                // Sum of outstanding debt per customer & currency (only due invoices)
                // Include all invoices with status = "Due", including negative amounts (credits)
                dbClient.invoice.groupBy({
                    by: ["customer_id", "customer_currency"],
                    where: {
                        customer_id: { in: customerIds },
                        status: "Due",
                        OR: [
                            { outstanding_debt: { not: 0 } },
                            { customer_outstanding_debt: { not: 0 } },
                        ],
                    },
                    _sum: {
                        outstanding_debt: true,
                        customer_outstanding_debt: true,
                    },
                }),
                // Count of due invoices per customer
                // Include all invoices with status_id = 13, including negative amounts (credits)
                dbClient.invoice.groupBy({
                    by: ["customer_id"],
                    where: {
                        customer_id: { in: customerIds },
                        status: "Due",
                        OR: [
                            { outstanding_debt: { not: 0 } },
                            { customer_outstanding_debt: { not: 0 } },
                        ],
                    },
                    _count: {
                        id: true,
                    },
                }),
            ]
        );

        // Ensure we have valid results from the database queries
        if (!totalGrouped || !currencyGrouped || !countGrouped) {
            for (const customerId of customerIds) {
                result.set(customerId, {
                    total_due_amount: 0,
                    no_of_due_invoices: 0,
                    customer_due_amount1: 0,
                    customer_due_currency1: null,
                    customer_due_amount2: 0,
                    customer_due_currency2: null,
                });
            }
            return result;
        }

        // Process each customer
        for (const customerId of customerIds) {
            const totalGroup = totalGrouped.find(
                (g) => g.customer_id === customerId
            );
            const outstandingDebt = totalGroup?._sum?.outstanding_debt ?? 0;
            const customerOutstandingDebt =
                totalGroup?._sum?.customer_outstanding_debt ?? 0;
            // total_due_amount is the base amount in account's currency (outstanding_debt)
            const total = outstandingDebt;
            const count =
                countGrouped.find((g) => g.customer_id === customerId)?._count
                    ?.id ?? 0;

            // Get currency-specific amounts for this customer
            const customerCurrencies = currencyGrouped.filter(
                (g) => g.customer_id === customerId
            );

            // Apply fallback logic for currency-specific amounts (customer currencies)
            const currenciesWithCalculatedAmounts = customerCurrencies
                .map((c) => {
                    const outstandingDebt = c._sum?.outstanding_debt ?? 0;
                    const customerOutstandingDebt =
                        c._sum?.customer_outstanding_debt ?? 0;
                    // Use outstanding_debt if > 0, otherwise use customer_outstanding_debt (fallback for customer currencies)
                    const calculatedAmount =
                        customerOutstandingDebt !== 0
                            ? customerOutstandingDebt
                            : outstandingDebt;
                    return {
                        ...c,
                        calculatedAmount,
                    };
                })
                .filter((c) => c.customer_currency && c.calculatedAmount > 0)
                .sort((a, b) => b.calculatedAmount - a.calculatedAmount);

            const data: Partial<Customer> = {
                total_due_amount: total,
                no_of_due_invoices: count,
                // Always initialize currency amounts to prevent stale data
                customer_due_amount1: 0,
                customer_due_currency1: null,
                customer_due_amount2: 0,
                customer_due_currency2: null,
            };

            // Add the top 2 currencies using the same calculation logic as total_due_amount
            if (currenciesWithCalculatedAmounts.length > 0) {
                const firstCurrency = currenciesWithCalculatedAmounts[0];
                data.customer_due_amount1 = firstCurrency.calculatedAmount;
                data.customer_due_currency1 =
                    firstCurrency.customer_currency || null;
            }

            if (currenciesWithCalculatedAmounts.length > 1) {
                const secondCurrency = currenciesWithCalculatedAmounts[1];
                data.customer_due_amount2 = secondCurrency.calculatedAmount;
                data.customer_due_currency2 =
                    secondCurrency.customer_currency || null;
            }

            result.set(customerId, data);
        }

        return result;
    }

    /**
     * Calculate outstanding amounts for multiple customers and update their collection periods.
     * This is the single source of truth for outstanding amount calculations and collection period management.
     *
     * @param customerIds - List of customer IDs to calculate outstanding amounts for
     * @returns A Map where the key is the customer ID and the value contains the calculation results
     */
    public static async calculateOutstandingAmountsForCustomers(
        customerIds: number[],
        dbClient: DbClient = prisma
    ): Promise<Map<number, Partial<CustomerCollectionPeriod>>> {
        const result: Map<
            number,
            Partial<CustomerCollectionPeriod>
        > = new Map();

        if (!customerIds.length) return result;

        // Run all aggregations in parallel
        const [totalGrouped, currencyGrouped, countGrouped] = await Promise.all(
            [
                // Sum of outstanding_debt per customer (only overdue invoices)
                dbClient.invoice.groupBy({
                    by: ["customer_id"],
                    where: {
                        customer_id: { in: customerIds },
                        status: "Overdue",
                    },
                    _sum: {
                        outstanding_debt: true,
                        customer_outstanding_debt: true,
                    },
                }),
                // Sum of outstanding debt per customer & currency (only overdue invoices)
                dbClient.invoice.groupBy({
                    by: ["customer_id", "customer_currency"],
                    where: {
                        customer_id: { in: customerIds },
                        status: "Overdue",
                    },
                    _sum: {
                        customer_outstanding_debt: true,
                    },
                }),
                // Count of overdue invoices per customer
                dbClient.invoice.groupBy({
                    by: ["customer_id"],
                    where: {
                        customer_id: { in: customerIds },
                        status: "Overdue",
                    },
                    _count: {
                        id: true,
                    },
                }),
            ]
        );

        // Process each customer
        for (const customerId of customerIds) {
            const totalGroup = totalGrouped.find(
                (g) => g.customer_id === customerId
            );
            const outstandingDebt = totalGroup?._sum?.outstanding_debt ?? 0;
            const customerOutstandingDebt =
                totalGroup?._sum?.customer_outstanding_debt ?? 0;
            const total =
                outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt;
            const count =
                countGrouped.find((g) => g.customer_id === customerId)?._count
                    ?.id ?? 0;

            const customerGroups = currencyGrouped.filter(
                (g) => g.customer_id === customerId
            );
            const sortedGroups = customerGroups
                .filter((g) => !!g.customer_currency)
                .sort((a, b) =>
                    (a.customer_currency ?? "").localeCompare(
                        b.customer_currency ?? ""
                    )
                );

            const data: Partial<CustomerCollectionPeriod> = {
                total_outstanding_amount: total,
                no_of_overdue_invoices: count,
                // Always initialize currency amounts to prevent stale data
                customer_currency1: null,
                customer_outstanding_amount1: 0,
                customer_currency2: null,
                customer_outstanding_amount2: 0,
            };

            if (sortedGroups.length >= 1) {
                data.customer_currency1 =
                    sortedGroups[0].customer_currency ?? "";
                data.customer_outstanding_amount1 =
                    sortedGroups[0]._sum.customer_outstanding_debt ?? 0;
            }

            if (sortedGroups.length >= 2) {
                data.customer_currency2 =
                    sortedGroups[1].customer_currency ?? "";
                data.customer_outstanding_amount2 =
                    sortedGroups[1]._sum.customer_outstanding_debt ?? 0;
            }

            result.set(customerId, data);

            // Update collection period and handle closure if needed
            await this.updateCollectionPeriodForCustomer(
                customerId,
                data,
                dbClient
            );
        }

        return result;
    }

    /**
     * Comprehensive recalculation function that calculates both due and overdue amounts for specified customers.
     * This function ensures data consistency by always recalculating from source data.
     *
     * IMPORTANT: This function also automatically triggers parent customer aggregated data recalculation
     * when child customers' due/overdue amounts change. This ensures parent aggregation stays in sync
     * whenever invoice status changes affect child customers.
     *
     * @param customerIds - List of customer IDs to recalculate amounts for
     * @param userId - Optional user ID for audit trail (used for parent aggregation)
     * @returns A Map containing both due and overdue calculation results
     */
    public static async recalculateAllAmountsForCustomers(
        customerIds: number[],
        userId?: string,
        options: {
            dbClient?: DbClient;
            runPostCommitEffects?: boolean;
        } = {}
    ): Promise<
        Map<
            number,
            {
                due: Partial<Customer>;
                overdue: Partial<CustomerCollectionPeriod>;
            }
        >
    > {
        const result: Map<
            number,
            {
                due: Partial<Customer>;
                overdue: Partial<CustomerCollectionPeriod>;
            }
        > = new Map();

        if (!customerIds.length) return result;
        const dbClient = options.dbClient ?? prisma;
        const runPostCommitEffects =
            options.runPostCommitEffects ?? options.dbClient == null;

        // Calculate both due and overdue amounts in parallel
        const [dueAmounts, overdueAmounts] = await Promise.all([
            this.calculateDueAmountsForCustomers(customerIds, dbClient),
            this.calculateOutstandingAmountsForCustomers(customerIds, dbClient),
        ]);

        // Combine results
        for (const customerId of customerIds) {
            const dueData = dueAmounts.get(customerId) ?? {
                total_due_amount: 0,
                no_of_due_invoices: 0,
                customer_due_amount1: 0,
                customer_due_currency1: null,
                customer_due_amount2: 0,
                customer_due_currency2: null,
            };
            const overdueData = overdueAmounts.get(customerId) ?? {
                total_outstanding_amount: 0,
                no_of_overdue_invoices: 0,
                customer_currency1: null,
                customer_outstanding_amount1: 0,
                customer_currency2: null,
                customer_outstanding_amount2: 0,
            };

            result.set(customerId, {
                due: dueData,
                overdue: overdueData,
            });

            const targetStatus =
                (dueData.no_of_due_invoices ?? 0) > 0 ||
                (overdueData.no_of_overdue_invoices ?? 0) > 0
                    ? "Active"
                    : "Inactive";

            await dbClient.customer.update({
                where: { id: customerId },
                data: {
                    collection_status: targetStatus as any,
                    // Sync Due Amounts
                    total_due_amount: dueData.total_due_amount ?? 0,
                    no_of_due_invoices: dueData.no_of_due_invoices ?? 0,
                    customer_due_amount1: dueData.customer_due_amount1 ?? 0,
                    customer_due_currency1: dueData.customer_due_currency1 ?? null,
                    customer_due_amount2: dueData.customer_due_amount2 ?? 0,
                    customer_due_currency2: dueData.customer_due_currency2 ?? null,

                    // Sync Overdue Amounts (New Multi-currency fields)
                    total_overdue_amount:
                        overdueData.total_outstanding_amount ?? 0,
                    number_of_overdue_invoices:
                        overdueData.no_of_overdue_invoices ?? 0,
                    customer_overdue_amount1:
                        overdueData.customer_outstanding_amount1 ?? 0,
                    customer_overdue_currency1:
                        overdueData.customer_currency1 ?? null,
                    customer_overdue_amount2:
                        overdueData.customer_outstanding_amount2 ?? 0,
                    customer_overdue_currency2:
                        overdueData.customer_currency2 ?? null,

                    // Sync Legacy Overdue field for backward compatibility
                    total_invoices_overdue:
                        overdueData.total_outstanding_amount ?? 0,
                },
            });
        }

        // CENTRALIZED TRIGGER: Recalculate parent aggregated data for all affected child customers
        // This ensures parent aggregation is always updated when child customer due/overdue amounts change
        // Note: The aggregation service has built-in deduplication to prevent concurrent duplicate recalculations
        if (runPostCommitEffects) {
            try {
                const aggregationService =
                    CustomerAggregationService.getInstance();
                const stats =
                    await aggregationService.recalculateParentsForChildren(
                        customerIds,
                        userId
                    );

                // Log if any parents were skipped due to concurrent recalculation
                if (stats.skippedParents > 0) {
                    const logService = LogService.getInstance();
                    await logService.logMessage(
                        LogLevel.INFO,
                        `Skipped ${stats.skippedParents} parent(s) already being recalculated concurrently`,
                        "CustomerService",
                        {
                            customerIds,
                            skippedParents: stats.skippedParents,
                            uniqueParents: stats.uniqueParents,
                        }
                    );
                }
            } catch (error: any) {
                // Log error but don't fail the recalculation
                // Parent aggregation is important but shouldn't block customer amount recalculation
                const logService = LogService.getInstance();
                await logService.logMessage(
                    LogLevel.WARNING,
                    `Failed to recalculate parent aggregated data after customer amount recalculation`,
                    "CustomerService",
                    {
                        customerIds,
                        error: error.message,
                        stack: error.stack,
                    }
                );
            }

            // Invalidate dashboard cache for affected accounts
            try {
                // Get unique account IDs from customers
                const customers = await prisma.customer.findMany({
                    where: { id: { in: customerIds } },
                    select: { account_id: true },
                    distinct: ["account_id"],
                });
                const accountIds = customers.map((c) => c.account_id);

                if (accountIds.length > 0) {
                    const { invalidateDashboardCacheForAccounts } =
                        await import(
                            "@/server/utils/cacheInvalidationHelper"
                        );
                    await invalidateDashboardCacheForAccounts(accountIds);
                }
            } catch (error) {
                // Cache invalidation failure should not break the recalculation
                console.error("Failed to invalidate dashboard cache:", error);
            }
        }

        return result;
    }

    /**
     * Update collection period for a single customer and handle closure if needed
     * @private
     */
    private static async updateCollectionPeriodForCustomer(
        customerId: number,
        data: Partial<CustomerCollectionPeriod>,
        dbClient: DbClient = prisma
    ): Promise<void> {
        const collectionPeriod =
            await dbClient.customerCollectionPeriod.findFirst({
                where: { customer_id: customerId, period_end_date: null },
                include: {
                    Customer: {
                        select: {
                            account_id: true,
                        },
                    },
                },
            });

        if (!collectionPeriod) {
            // If no collection period exists but outstanding amount is <= 0, deactivate customer
            // ONLY if they also have no due invoices
            if ((data.total_outstanding_amount ?? 0) <= 0) {
                const customer = await dbClient.customer.findUnique({
                    where: { id: customerId },
                    select: { no_of_due_invoices: true },
                });

                if (customer && (customer.no_of_due_invoices ?? 0) <= 0) {
                    await dbClient.customer
                        .update({
                            where: { id: customerId },
                            data: { collection_status: "Inactive" },
                        })
                        .catch(() => {
                            // Silently fail if update fails
                        });
                }
            }
            return; // No open collection period to update
        }

        const shouldCloseCollectionPeriod =
            data.total_outstanding_amount === 0 ||
            data.total_outstanding_amount === undefined ||
            data.total_outstanding_amount === null ||
            data.total_outstanding_amount < 0;

        // Debug logging
        if (shouldCloseCollectionPeriod) {
            const collectionPeriodService = new CollectionPeriodService();
            const closureResult =
                await collectionPeriodService.closeCollectionPeriod(
                    collectionPeriod.id,
                    {
                        reason: "All outstanding amounts have been paid or are negative",
                        logContext: {
                            processName:
                                "CustomerService.calculateOutstandingAmountsForCustomers",
                            customerId: customerId,
                        },
                    },
                    dbClient
                );

            // Closure result handled - no action needed
        } else {
            // Update the collection period without closing it
            await dbClient.customerCollectionPeriod.update({
                where: { id: collectionPeriod.id },
                data: {
                    total_outstanding_amount: data.total_outstanding_amount,
                    no_of_overdue_invoices: data.no_of_overdue_invoices,
                    customer_currency1: data.customer_currency1,
                    customer_outstanding_amount1:
                        data.customer_outstanding_amount1,
                    customer_currency2: data.customer_currency2,
                    customer_outstanding_amount2:
                        data.customer_outstanding_amount2,
                },
            });
        }
    }

    /**
     * Calculate outstanding amounts for a single customer (backward compatibility)
     * @deprecated Use calculateOutstandingAmountsForCustomers instead
     */
    public static async calculateOutstandingAmountForCustomer(
        customerId: number,
        dbClient: DbClient = prisma
    ): Promise<void> {
        const results = await this.calculateOutstandingAmountsForCustomers([
            customerId,
        ], dbClient);
        // The update logic is now handled within calculateOutstandingAmountsForCustomers
    }

    public async activateCustomers(customerIds: number[]) {
        await prisma.customer.updateMany({
            where: { id: { in: customerIds } },
            data: { collection_status: "Active" },
        });
    }

    public async calculateNextAutomatedActivityTime(
        customerDetailsMap: Map<
            number,
            {
                account_id: number;
                last_automated_step: number;
                period_start_date: Date;
                previous_category?: string;
            }
        >
    ): Promise<
        Map<number, { schedule_time: Date; schedule_calculation: string }>
    > {
        const startTime = new Date();

        // Initialize calculation tracking
        const calculationStats = {
            totalCustomers: customerDetailsMap.size,
            customersWithSequences: 0,
            customersWithPreviousActivities: 0,
            calculationsCompleted: 0,
            errors: [] as string[],
        };

        // Step 1: Get all unique customer IDs and next steps
        const accountIds = Array.from(
            new Set(
                Array.from(customerDetailsMap.values()).map((d) => d.account_id)
            )
        );
        const nextSteps = Array.from(
            new Set(
                Array.from(customerDetailsMap.values()).map(
                    (d) => d.last_automated_step + 1
                )
            )
        );

        // Step 2: Get all customers with their oldest invoice due_date
        const customerIds = Array.from(customerDetailsMap.keys());
        const customers = await prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: {
                id: true,
                account_id: true,
                first_activity_delay_days: true,
                sequence_container_id: true, // Add sequence container ID
                Country: {
                    select: {
                        iso2: true,
                    },
                },
                State: {
                    select: {
                        iso2: true,
                    },
                },
                // Add Invoice relation to get oldest due_date
                Invoice: {
                    where: {
                        status: "Overdue",
                        due_date: { not: null },
                    },
                    select: {
                        due_date: true,
                    },
                    orderBy: {
                        due_date: "asc", // Get oldest due_date first
                    },
                    take: 1, // Only get the oldest one
                },
            },
        });

        // Step 2.5: Get default sequence containers for customers
        const defaultSequenceContainers =
            await prisma.sequenceContainer.findMany({
                where: {
                    account_id: { in: accountIds },
                    category: "Automated",
                    is_default: true,
                    active: true,
                },
                select: {
                    id: true,
                    account_id: true,
                },
            });

        // Group default containers by account_id
        const defaultContainersByAccount = new Map<number, number>();
        defaultSequenceContainers.forEach((container) => {
            defaultContainersByAccount.set(container.account_id, container.id);
        });

        // Step 3: Get all activity sequences for the unique customer IDs and next steps
        // Include sequence_container_id to support customer-specific sequences
        const activitySequences = await prisma.activitiesSequence.findMany({
            where: {
                category: "Automated",
                active: true,
                account_id: { in: accountIds },
                step: { in: nextSteps },
                OR: [{ step_type: null }, { step_type: "overdue" }],
            },
            select: {
                id: true,
                account_id: true,
                time_of_day: true,
                days_from_prev_step: true,
                step: true,
                sequence_container_id: true, // Add sequence container ID
            },
        });

        // Step 3.5: Filter out customers that don't have a next step available
        // This prevents trying to calculate times for customers at the last step
        const validNextSteps = new Set(
            activitySequences.map((seq) => seq.step)
        );
        const validCustomerDetailsMap = new Map();
        for (const [customerId, details] of Array.from(
            customerDetailsMap.entries()
        )) {
            const nextStep = details.last_automated_step + 1;
            if (validNextSteps.has(nextStep)) {
                validCustomerDetailsMap.set(customerId, details);
            }
        }

        // Step 4: Create a lookup map for sequences (include sequence_container_id in key)
        const sequenceMap = new Map<string, any>();
        for (const seq of activitySequences) {
            const key = `${seq.account_id}-${seq.step}-${seq.sequence_container_id || "default"}`;
            sequenceMap.set(key, seq);
        }

        // Step 5: Build customer sequence map (only for customers with valid next steps)
        const customerSequenceMap = new Map<number, any>();
        for (const customer of customers) {
            const details = validCustomerDetailsMap.get(customer.id);
            if (details) {
                const nextStep = details.last_automated_step + 1;

                // Resolve the sequence container ID (use customer's or account's default)
                const sequenceContainerId =
                    customer.sequence_container_id ||
                    defaultContainersByAccount.get(customer.account_id) ||
                    null;

                // Try to find sequence with the resolved container ID
                let sequence = null;
                if (sequenceContainerId) {
                    const key = `${customer.account_id}-${nextStep}-${sequenceContainerId}`;
                    sequence = sequenceMap.get(key);
                }

                // If no sequence found with container ID, try default
                if (!sequence) {
                    const defaultKey = `${customer.account_id}-${nextStep}-default`;
                    sequence = sequenceMap.get(defaultKey);
                }

                if (sequence) {
                    customerSequenceMap.set(customer.id, {
                        account_id: sequence.account_id,
                        step: sequence.step ?? 0,
                        time_of_day: sequence.time_of_day ?? "00:00",
                        days_from_prev_step: sequence.days_from_prev_step ?? 0,
                    });
                    calculationStats.customersWithSequences++;
                } else {
                    // Log when no sequence is found (important for debugging)
                    await this.logService.logMessage(
                        LogLevel.WARNING,
                        `No sequence found for customer ${customer.id}, account ${customer.account_id}, step ${nextStep}, container ${sequenceContainerId}`,
                        "CustomerService.calculateNextAutomatedActivityTime",
                        {
                            customer_id: customer.id,
                            account_id: customer.account_id,
                            next_step: nextStep,
                            sequence_container_id: sequenceContainerId,
                            last_automated_step: details.last_automated_step,
                        }
                    );
                }
            }
        }

        // Step 6: Get previous activity times (optimized query)
        const previousActivityTimeMap = new Map<number, Date>();

        // Initialize with current date for step 0, period_start_date for others
        for (const [customerId, details] of Array.from(
            validCustomerDetailsMap.entries()
        )) {
            if (details.last_automated_step === 0) {
                // For first step, always use current date (fresh start)
                // This covers both fresh starts and transitions from Agent/Legal
                previousActivityTimeMap.set(customerId, new Date());
            } else {
                // For subsequent steps, use current date as fallback (not old period_start_date)
                // The actual previous activity time will be set later in the query
                previousActivityTimeMap.set(customerId, new Date());
            }
        }

        // Get previous activities in batches to avoid large queries
        // CRITICAL FIX: Filter by sequence_container_id to ensure we only get activities from the customer's assigned sequence
        const validCustomerIds = Array.from(validCustomerDetailsMap.keys());
        const BATCH_SIZE = 500;
        for (let i = 0; i < validCustomerIds.length; i += BATCH_SIZE) {
            const batch = validCustomerIds.slice(i, i + BATCH_SIZE);

            // Get customers in this batch to access their sequence_container_id
            const customersInBatch = customers.filter((c) => batch.includes(c.id));

            // For each customer, find their most recent delivered activity from their assigned sequence
            for (const customer of customersInBatch) {
                const details = validCustomerDetailsMap.get(customer.id);
                if (!details) continue;

                // Resolve the sequence container ID (use customer's or account's default)
                const sequenceContainerId =
                    customer.sequence_container_id ||
                    defaultContainersByAccount.get(customer.account_id) ||
                    null;

                // CRITICAL FIX: Do NOT filter by sequence_container_id here.
                // We need to find the last delivered/sent automated activity regardless of which container it belonged to.
                // Also include SENT status and fallback to other timestamps if actual_delivery_time is missing.
                const previousActivity = await prisma.activity.findFirst({
                    where: {
                        customer_id: customer.id,
                        status: { in: [ActivityStatus.DELIVERED, ActivityStatus.SENT] },
                        ActivitiesSequence: {
                            category: "Automated",
                            // Remove strict container filtering to allow cross-container transitions
                            // sequence_container_id: sequenceContainerId,
                        },
                    },
                    orderBy: [
                        // Use created_at as the most reliable chronological sort
                        // actual_delivery_time might be null even for Delivered/Sent activities
                        { created_at: "desc" },
                    ],
                    select: {
                        actual_delivery_time: true,
                        last_sent_time: true,
                        created_at: true,
                    },
                });

                // Calculate the activity time using fallbacks
                const activityTime =
                    previousActivity?.actual_delivery_time ??
                    previousActivity?.last_sent_time ??
                    previousActivity?.created_at;

                if (activityTime) {
                    // Don't override the base date for step 0 (fresh start or transition from Agent/Legal)
                    if (details.last_automated_step === 0) {
                        // Keep the current date that was set earlier, don't override with old activity time
                        calculationStats.customersWithPreviousActivities++;
                    } else {
                        // For step > 0, use the actual previous activity time from the correct sequence
                        previousActivityTimeMap.set(
                            customer.id,
                            activityTime
                        );
                        calculationStats.customersWithPreviousActivities++;
                    }
                }
            }
        }

        // Step 7: Calculate schedule times (only for customers with valid next steps)
        const customerMap = new Map<
            number,
            { schedule_time: Date; schedule_calculation: string }
        >();
        for (const [customerId, details] of Array.from(
            validCustomerDetailsMap.entries()
        )) {
            try {
                const customer = customers.find((d) => d.id === customerId);
                const nextSequence = customerSequenceMap.get(customerId);

                if (customer && nextSequence) {
                    const previousActivityDate =
                        previousActivityTimeMap.get(customerId) ??
                        details.period_start_date ??
                        new Date();

                    const daysToAdd =
                        details.last_automated_step === 0
                            ? details.previous_category === "Agent" ||
                                details.previous_category === "Legal"
                                ? 0 // No delay when transitioning from Agent/Legal
                                : (customer.first_activity_delay_days ?? 1) // Normal delay for first-time automated
                            : (nextSequence.days_from_prev_step ?? 0);

                    // Schedule next activity: automatically skips weekends and holidays by default
                    // Calculation includes all adjustment steps for admin visibility in ActivityTimeline tooltip
                    const scheduleResult = await scheduleDateTime({
                        baseDate: previousActivityDate,
                        customerCountry: customer.Country?.iso2,
                        customerState: customer.State?.iso2,
                        timeOfDay: nextSequence.time_of_day,
                        daysToAdd: daysToAdd,
                        isFirstStep: details.last_automated_step === 0,
                        // skipWeekends and skipHolidays default to true, ensuring no notifications on non-business days
                    });

                    customerMap.set(customerId, {
                        schedule_time: scheduleResult.scheduledTime,
                        schedule_calculation: scheduleResult.calculation,
                    });
                    calculationStats.calculationsCompleted++;
                } else {
                    // Log why customer was skipped
                    const nextStep = details.last_automated_step + 1;
                    const reason = !customer
                        ? `Customer ${customerId} not found in customers array`
                        : !nextSequence
                            ? `No sequence found for customer ${customerId}, account ${details.account_id}, step ${nextStep}, sequence_container_id ${customer?.sequence_container_id || "null"}`
                            : "Unknown reason";

                    calculationStats.errors.push(
                        `Skipped customer ${customerId}: ${reason}`
                    );
                }
            } catch (error) {
                const errorMsg = `Error calculating schedule time for customer ${customerId}: ${error}`;
                calculationStats.errors.push(errorMsg);
            }
        }

        // Log customers that were in input but not in validCustomerDetailsMap
        const skippedCustomers = Array.from(customerDetailsMap.keys()).filter(
            (id) => !validCustomerDetailsMap.has(id)
        );
        if (skippedCustomers.length > 0) {
            skippedCustomers.forEach((customerId) => {
                const details = customerDetailsMap.get(customerId);
                const nextStep = details
                    ? details.last_automated_step + 1
                    : "unknown";
                calculationStats.errors.push(
                    `Customer ${customerId} skipped: Next step ${nextStep} not found in valid next steps (${Array.from(validNextSteps).join(", ")})`
                );
            });
        }

        return customerMap;
    }

    /**
     * Set create_next_activity flag for collection period
     * This is a consolidated function that can be called from other functions
     */
    public async setCreateNextActivityFlag(
        collectionId: number,
        shouldCreateNextActivity: boolean,
        reason?: string,
        dbClient: DbClient = prisma
    ): Promise<void> {
        const startTime = new Date();

        await dbClient.customerCollectionPeriod.update({
            where: { id: collectionId },
            data: {
                create_next_activity: shouldCreateNextActivity,
            },
        });
    }

    public async updateCollectionPeriodCategory(
        collectionId: number | null,
        nextCategory: string,
        currentCategory: string,
        accountId: number,
        customerId: number,
        options?: {
            preservePreviousCategory?: boolean;
            reason?: string;
            userId?: string;
            isManualCategoryChange?: boolean;
            resetStepToZero?: boolean;
            translate?: (key: string) => string;
            dbClient?: DbClient;
            runPostCommitEffects?: boolean;
        }
    ): Promise<CustomerCollectionPeriod | null> {
        const startTime = new Date();
        const dbClient = options?.dbClient ?? prisma;
        const runPostCommitEffects =
            options?.runPostCommitEffects ?? options?.dbClient == null;

        try {
            // Validate inputs
            if (nextCategory === currentCategory) {
                await this.logService.logMessage(
                    LogLevel.INFO,
                    "Category is already set to the requested value",
                    "updateCollectionPeriodCategory",
                    { collectionId, currentCategory, nextCategory }
                );
                return null;
            }

            // If no collection ID is provided, we can't update a collection period
            if (!collectionId) {
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    "Collection ID is required but was not provided",
                    "updateCollectionPeriodCategory",
                    { collectionId, customerId, accountId }
                );
                return null;
            }

            if (options?.isManualCategoryChange) {
                const account = await dbClient.account.findUnique({
                    where: { id: accountId },
                    select: {
                        has_collection: true,
                        has_credit_insurance: true,
                    },
                });
                if (isCreditOnlyAccount(account)) {
                    throw new Error(
                        "Collection category changes are not available for credit-only accounts"
                    );
                }
            }

            // Validate category value
            const validCategories = [
                "Automated",
                "Promise_to_pay",
                "Dispute",
                "Agent",
                "Legal",
            ];
            if (!validCategories.includes(nextCategory)) {
                const error = new Error(
                    `Invalid category value: ${nextCategory}. Must be one of: ${validCategories.join(", ")}`
                );
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    error.message,
                    "updateCollectionPeriodCategory",
                    { collectionId, nextCategory, validCategories }
                );
                throw error;
            }

            // Create activity only if categories are different
            try {
                await this.activityService.createCategoryChangeActivity({
                    customerId,
                    collectionId,
                    accountId,
                    currentCategory,
                    nextCategory,
                    userId: options?.userId,
                    isManual: options?.isManualCategoryChange || false,
                    translate: options?.translate,
                    dbClient,
                    runPostCommitEffects,
                });
            } catch (activityError: any) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    "Failed to create category change activity",
                    "updateCollectionPeriodCategory",
                    {
                        collectionId,
                        customerId,
                        error: activityError.message,
                        stack: activityError.stack,
                    }
                );
                throw new Error(
                    `Failed to create category change activity: ${activityError.message || "Unknown error"}`
                );
            }

            // Prepare update data
            const modified_ata: any = {
                next_category: null,
                next_category_date: null,
                current_category: nextCategory as category,
                previous_category:
                    currentCategory !== nextCategory
                        ? (currentCategory as category)
                        : undefined,
            };

            // Reset step to 0 when changing to Automated from manual category change
            if (options?.resetStepToZero && nextCategory === "Automated") {
                modified_ata.last_automated_step = 0;
                modified_ata.is_last_automated_step_delivered = false;
                // CRITICAL FIX: Set create_next_activity to true immediately when resetting step
                // This allows Activity Workflow Manager to create the first automated activity
                modified_ata.create_next_activity = true;
            }

            // CRITICAL FIX: Handle category changes to Automated differently based on source category
            if (nextCategory === "Automated") {
                // When changing from Dispute or Promise_to_pay to Automated: PRESERVE last_automated_step (resume)
                // This allows the sequence to continue from where it left off
                if (
                    (currentCategory === "Dispute" ||
                        currentCategory === "Promise_to_pay") &&
                    !options?.resetStepToZero
                ) {
                    // Preserve last_automated_step - don't modify it, let it resume from current step
                    // Only reset is_last_automated_step_delivered to allow next activity creation
                    modified_ata.is_last_automated_step_delivered = false;
                    // Ensure create_next_activity is true to resume the sequence
                    if (modified_ata.create_next_activity !== true) {
                        modified_ata.create_next_activity = true;
                    }
                    // Log the resume behavior
                    await this.logService.logMessage(
                        LogLevel.INFO,
                        `Resuming automated sequence from step ${modified_ata.last_automated_step || "current"} after ${currentCategory} category`,
                        "updateCollectionPeriodCategory",
                        {
                            collectionId,
                            currentCategory,
                            nextCategory,
                            preservedStep: modified_ata.last_automated_step,
                            reason: "resume_after_dispute_or_ptp",
                        }
                    );
                }
                // When changing from Agent to Automated: RESET last_automated_step to 0 (restart from step 1)
                // This ensures a fresh start when coming from Agent category
                else if (currentCategory === "Agent") {
                    modified_ata.is_last_automated_step_delivered = false;
                    // Always ensure create_next_activity is true when changing from Agent to Automated
                    // This allows Activity Workflow Manager to immediately create the first automated activity
                    if (modified_ata.create_next_activity !== true) {
                        modified_ata.create_next_activity = true;
                    }
                    // Reset last_automated_step to 0 to start from step 1 if not already set by resetStepToZero
                    if (
                        modified_ata.last_automated_step === undefined &&
                        !options?.resetStepToZero
                    ) {
                        modified_ata.last_automated_step = 0;
                    }
                    // Log the restart behavior
                    await this.logService.logMessage(
                        LogLevel.INFO,
                        `Restarting automated sequence from step 1 after Agent category`,
                        "updateCollectionPeriodCategory",
                        {
                            collectionId,
                            currentCategory,
                            nextCategory,
                            resetStep: 0,
                            reason: "restart_after_agent",
                        }
                    );
                }
            }

            // CRITICAL FIX: Also ensure create_next_activity is true for ANY change to Automated category
            // This handles edge cases where the category change might not come from Agent, Dispute, or PTP
            if (
                nextCategory === "Automated" &&
                modified_ata.create_next_activity !== true
            ) {
                modified_ata.create_next_activity = true;
            }

            // Update the collection period
            let updatedCollectionPeriod;
            try {
                updatedCollectionPeriod =
                    await dbClient.customerCollectionPeriod.update({
                        where: {
                            id: collectionId,
                        },
                        data: modified_ata,
                    });
            } catch (dbError: any) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    "Database error updating collection period",
                    "updateCollectionPeriodCategory",
                    {
                        collectionId,
                        modified_ata,
                        error: dbError.message,
                        code: dbError.code,
                    }
                );
                throw new Error(
                    `Failed to update collection period in database: ${dbError.message || "Unknown database error"}`
                );
            }

            // Set create_next_activity flag using consolidated function
            // Note: If create_next_activity was already set in modified_ata, this ensures it stays true
            if (nextCategory === "Automated") {
                // Only call setCreateNextActivityFlag if it wasn't already set in modified_ata
                // This prevents unnecessary database calls and ensures consistency
                if (modified_ata.create_next_activity !== true) {
                    try {
                        await this.setCreateNextActivityFlag(
                            collectionId,
                            true,
                            `Category changed to Automated from ${currentCategory}`,
                            dbClient
                        );
                    } catch (flagError: any) {
                        await this.logService.logMessage(
                            LogLevel.ERROR,
                            "Failed to set create_next_activity flag",
                            "updateCollectionPeriodCategory",
                            { collectionId, error: flagError.message }
                        );
                        // Don't throw - this is not critical for the category update
                    }
                } else {
                    // Log that create_next_activity was already set in the initial update
                    await this.logService.logMessage(
                        LogLevel.DEBUG,
                        "create_next_activity already set to true in initial update",
                        "updateCollectionPeriodCategory",
                        {
                            collectionId,
                            reason: "resetStepToZero or Agent to Automated change",
                        }
                    );
                }
            }

            // Handle promise to pay category changes
            if (
                runPostCommitEffects &&
                updatedCollectionPeriod.current_category === "Promise_to_pay"
            ) {
                try {
                    await this.activityService.createPromiseToPayScheduledActivity(
                        collectionId,
                        options?.userId
                    );
                } catch (error: any) {
                    await this.logService.logMessage(
                        LogLevel.WARNING,
                        "Failed to create promise to pay scheduled activity",
                        "updateCollectionPeriodCategory",
                        { collectionId, error: error.message }
                    );
                    // Don't throw the error, just log it
                }
            } else if (
                runPostCommitEffects &&
                currentCategory === "Promise_to_pay" &&
                updatedCollectionPeriod.current_category &&
                (updatedCollectionPeriod.current_category as string) !==
                "Promise_to_pay"
            ) {
                try {
                    // Cancel scheduled activities when changing from Promise_to_pay to another category
                    await this.activityService.cancelScheduledActivities(
                        collectionId,
                        "Category Change from Promise to Pay"
                    );
                } catch (error: any) {
                    await this.logService.logMessage(
                        LogLevel.WARNING,
                        "Failed to cancel scheduled activities",
                        "updateCollectionPeriodCategory",
                        { collectionId, error: error.message }
                    );
                    // Don't throw - this is not critical for the category update
                }
            }

            // Handle dispute category changes - cancel scheduled activities when moving out of Dispute
            if (
                runPostCommitEffects &&
                currentCategory === "Dispute" &&
                updatedCollectionPeriod.current_category &&
                (updatedCollectionPeriod.current_category as string) !==
                "Dispute"
            ) {
                try {
                    // Cancel scheduled activities when changing from Dispute to another category
                    await this.activityService.cancelScheduledActivities(
                        collectionId,
                        "Category Change from Dispute"
                    );
                } catch (error: any) {
                    await this.logService.logMessage(
                        LogLevel.WARNING,
                        "Failed to cancel scheduled activities",
                        "updateCollectionPeriodCategory",
                        { collectionId, error: error.message }
                    );
                    // Don't throw - this is not critical for the category update
                }
            }

            // Handle automated category changes - cancel scheduled activities when moving out of Automated
            if (
                runPostCommitEffects &&
                currentCategory === "Automated" &&
                updatedCollectionPeriod.current_category &&
                (updatedCollectionPeriod.current_category as string) !==
                "Automated" &&
                (updatedCollectionPeriod.current_category as string) !==
                "Promise_to_pay"
            ) {
                try {
                    // Cancel scheduled activities when changing from Automated to another category
                    await this.activityService.cancelScheduledActivities(
                        collectionId,
                        "Category Change from Automated"
                    );
                } catch (error: any) {
                    await this.logService.logMessage(
                        LogLevel.WARNING,
                        "Failed to cancel scheduled activities",
                        "updateCollectionPeriodCategory",
                        { collectionId, error: error.message }
                    );
                    // Don't throw - this is not critical for the category update
                }
            }

            // Invalidate dashboard cache after category change
            if (runPostCommitEffects) {
                try {
                    const { invalidateDashboardCacheForAccount } = await import(
                        "@/server/utils/cacheInvalidationHelper"
                    );
                    await invalidateDashboardCacheForAccount(accountId);
                } catch (error) {
                    // Cache invalidation failure should not break the category update
                    console.error(
                        "[CATEGORY CHANGE SERVICE] Failed to invalidate dashboard cache:",
                        error
                    );
                }
            }

            return updatedCollectionPeriod;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "Error updating collection period category",
                "updateCollectionPeriodCategory",
                {
                    collectionId,
                    customerId,
                    accountId,
                    currentCategory,
                    nextCategory,
                    error: error.message || "Unknown error",
                    stack: error.stack,
                }
            );
            // Re-throw with a more descriptive message if the error doesn't have one
            if (error.message) {
                throw error;
            } else {
                throw new Error(
                    `Failed to update collection period category: ${error.toString()}`
                );
            }
        }
    }

    /**
     * Update parent customer for a customer
     * @param customerId The customer ID
     * @param parentCustomerId The parent customer ID (null to remove parent)
     * @param userId The user ID performing the update
     * @param userAccessInfo Optional user access information for permission checks
     * @returns Updated customer
     */
    public async updateParentCustomer(
        customerId: number,
        parentCustomerId: number | null,
        userId: string,
        userAccessInfo?: {
            accountId: number;
            role: string;
            businessUnitId?: number | null;
            isAccountManager?: boolean;
        }
    ): Promise<Customer> {
        // Get current customer to check old parent
        const currentCustomer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: {
                id: true,
                parent_customer_id: true,
                account_id: true,
            } as any,
        });

        if (!currentCustomer) {
            throw new Error("Customer not found");
        }

        const oldParentId = (currentCustomer as any).parent_customer_id;

        // Validate parent customer assignment
        const validationService = ParentCustomerValidationService.getInstance();
        const validation = await validationService.validateParentCustomer(
            customerId,
            parentCustomerId,
            userAccessInfo
                ? {
                    userId,
                    accountId: userAccessInfo.accountId,
                    role: userAccessInfo.role,
                    businessUnitId: userAccessInfo.businessUnitId,
                    isAccountManager: userAccessInfo.isAccountManager,
                }
                : undefined
        );

        if (!validation.isValid) {
            throw new Error(validation.error || "Invalid parent customer");
        }

        // Update customer record
        const updatedCustomer = await prisma.customer.update({
            where: { id: customerId },
            data: {
                parent_customer_id: parentCustomerId,
                modified_by: userId,
                modified_at: new Date(),
            } as any,
        });

        // Recalculate aggregated data for affected parents
        const aggregationService = CustomerAggregationService.getInstance();

        // If old parent exists, recalculate its aggregated data
        if (oldParentId) {
            try {
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Recalculating aggregated data for old parent customer ${oldParentId} after removing child ${customerId}`,
                    "CustomerService",
                    { oldParentId, customerId, userId }
                );
                await aggregationService.calculateAggregatedData(
                    oldParentId,
                    userId
                );
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Successfully recalculated aggregated data for old parent customer ${oldParentId}`,
                    "CustomerService",
                    { oldParentId, customerId }
                );
            } catch (error: any) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to recalculate aggregated data for old parent ${oldParentId}`,
                    "CustomerService",
                    {
                        parentId: oldParentId,
                        customerId,
                        error: error.message,
                        stack: error.stack,
                    }
                );
                // Don't throw - continue with new parent recalculation
            }
        }

        // If new parent exists, recalculate its aggregated data
        if (parentCustomerId) {
            try {
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Recalculating aggregated data for new parent customer ${parentCustomerId} after adding child ${customerId}`,
                    "CustomerService",
                    { newParentId: parentCustomerId, customerId, userId }
                );
                await aggregationService.calculateAggregatedData(
                    parentCustomerId,
                    userId
                );
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Successfully recalculated aggregated data for new parent customer ${parentCustomerId}`,
                    "CustomerService",
                    { newParentId: parentCustomerId, customerId }
                );
            } catch (error: any) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to recalculate aggregated data for new parent ${parentCustomerId}`,
                    "CustomerService",
                    {
                        parentId: parentCustomerId,
                        customerId,
                        error: error.message,
                        stack: error.stack,
                    }
                );
                // Don't throw - parent update succeeded, aggregation can be retried
            }
        }

        // Invalidate dashboard cache after parent customer update
        try {
            const accountId =
                userAccessInfo?.accountId ||
                (currentCustomer as any).account_id;
            const { invalidateDashboardCacheForAccount } = await import(
                "@/server/utils/cacheInvalidationHelper"
            );
            await invalidateDashboardCacheForAccount(accountId);
        } catch (error) {
            // Cache invalidation failure should not break the parent update
            console.error("Failed to invalidate dashboard cache:", error);
        }

        return updatedCustomer;
    }
}
