import { Account, Prisma } from "@prisma/client";

import { DbClient, prisma } from "@/lib/prisma";

import { BusinessUnitService } from "./BusinessUnitService";
import { InternalEmailTemplateService } from "./InternalEmailTemplateService";
import { PermissionService } from "./PermissionService";
import { ReportService } from "./ReportService";
import { SequenceContainerService } from "./SequenceContainerService";
import { getSystemUserId, getPortalUserId } from "./UserService";

export class AccountService {
    /**
     * Creates a new account and initializes related templates and sequences
     */
    static async createCustomer(
        customerData: Prisma.AccountCreateInput,
        userId?: string
    ): Promise<Account> {
        // Validate required fields
        const requiredFields = [
            "name",
            "company_number",
            "status",
            "promise_to_pay",
        ];
        const missingFields = requiredFields.filter(
            (field) => !customerData[field as keyof typeof customerData]
        );

        if (missingFields.length > 0) {
            throw new Error(
                `Missing required fields: ${missingFields.join(", ")}`
            );
        }

        // Validate enum values
        const validStatuses = ["Active", "Inactive"];
        const validClientTypes = ["Company", "Person", "All"];

        if (
            customerData.status &&
            !validStatuses.includes(customerData.status as string)
        ) {
            throw new Error(
                `Invalid status: ${customerData.status}. Must be one of: ${validStatuses.join(", ")}`
            );
        }

        if (
            customerData.client_type &&
            !validClientTypes.includes(customerData.client_type as string)
        ) {
            throw new Error(
                `Invalid client_type: ${customerData.client_type}. Must be one of: ${validClientTypes.join(", ")}`
            );
        }

        // Check for existing subdomain (exclude deleted accounts)
        if (customerData.sub_domain) {
            const existingAccount = await prisma.account.findFirst({
                where: {
                    sub_domain: customerData.sub_domain as string,
                    deleted_at: null,
                },
            });
            if (existingAccount) {
                throw new Error(
                    `Subdomain '${customerData.sub_domain}' already exists for another account`
                );
            }
        }

        const createdAccount = await prisma.$transaction(async (tx) => {
            const created = await tx.account.create({
                data: {
                    ...customerData,
                    created_by: userId,
                    modified_by: userId,
                } as any,
            });

            // Create audit users
            await this.createAuditUsers(created.id, tx as DbClient);

            // Initialize master templates and sequences
            await this.initializeCustomerTemplates(created.id, tx as DbClient);
            await this.initializeCustomerSequences(
                created.id,
                customerData.default_first_activity_delay_days ?? 1,
                tx as DbClient
            );

            // Create primary business unit for the account
            await BusinessUnitService.createPrimaryBusinessUnit(
                created.id,
                userId,
                undefined,
                tx as DbClient
            );

            // Clone role permissions from master account (account_id 10013)
            const permissionService = PermissionService.getInstance();
            await permissionService.cloneRolePermissions(
                10013, // Master account
                created.id,
                userId || "system",
                {
                    hasCollection:
                        (customerData as any).has_collection !== undefined
                            ? Boolean((customerData as any).has_collection)
                            : true,
                    hasCreditInsurance: Boolean(
                        (customerData as any).has_credit_insurance
                    ),
                },
                tx as DbClient
            );

            // Copy system reports from account 10013 to the new account
            const reportService = ReportService.getInstance();
            await reportService.copySystemReportsToNewAccount(
                created.id,
                userId || "system",
                tx as DbClient,
                true
            );

            return created;
        });

        return createdAccount;
    }

    /**
     * Initializes dispute reasons and activity templates for a new customer
     */
    private static async initializeCustomerTemplates(
        accountId: number,
        dbClient: DbClient = prisma
    ): Promise<void> {
        // Clone master dispute reasons WITH their language records from account 10013
        // Try with master_template: true first, but if none found, get all from account 10013
        let masterDisputeReasons = await dbClient.disputeReason.findMany({
            where: {
                account_id: 10013, // Master template account
                master_template: true,
                status: "Active",
            },
            include: {
                DisputeReasonLanguage: true,
            },
        });

        // If no master_template ones found, get all dispute reasons from account 10013
        if (masterDisputeReasons.length === 0) {
            masterDisputeReasons = await dbClient.disputeReason.findMany({
                where: {
                    account_id: 10013,
                    status: "Active",
                },
                include: {
                    DisputeReasonLanguage: true,
                },
            });
        }

        if (masterDisputeReasons.length > 0) {
            for (const masterReason of masterDisputeReasons) {
                // Create the new dispute reason
                const newReason = await dbClient.disputeReason.create({
                    data: {
                        name: masterReason.name,
                        status: masterReason.status,
                        master_template: false,
                        account_id: accountId,
                        editable: masterReason.editable,
                    },
                });

                // Clone the language records for this dispute reason
                if (
                    masterReason.DisputeReasonLanguage &&
                    masterReason.DisputeReasonLanguage.length > 0
                ) {
                    const newLanguageRecords =
                        masterReason.DisputeReasonLanguage.map(
                            (langRecord) => ({
                                language: langRecord.language,
                                name: langRecord.name,
                                dispute_reason_id: newReason.id,
                                // account_id and master_template removed — those fields
                                // are now derived from the parent DisputeReason row
                            })
                        );

                    await dbClient.disputeReasonLanguage.createMany({
                        data: newLanguageRecords as any,
                    });
                }
            }
        }

        // Clone master activity templates with their language records
        const masterTemplates = await dbClient.activitiesTemplate.findMany({
            where: {
                master_template: true,
                active: true,
            },
            include: {
                ActivityTemplateLanguage: true,
            },
        });

        if (masterTemplates.length > 0) {
            for (const masterTemplate of masterTemplates) {
                // Create the new template
                const newTemplate = await dbClient.activitiesTemplate.create({
                    data: {
                        name: masterTemplate.name,
                        category: masterTemplate.category,
                        language: masterTemplate.language,
                        active: masterTemplate.active,
                        dispute_resolution: masterTemplate.dispute_resolution,
                        master_template: false,
                        account_id: accountId,
                    },
                });

                // Clone the language records for this template
                if (
                    masterTemplate.ActivityTemplateLanguage &&
                    masterTemplate.ActivityTemplateLanguage.length > 0
                ) {
                    const newLanguageRecords =
                        masterTemplate.ActivityTemplateLanguage.map(
                            (langRecord) => ({
                                language: langRecord.language,
                                email_subject: langRecord.email_subject,
                                email_content: langRecord.email_content,
                                sms_content: langRecord.sms_content,
                                whatsapp_content: langRecord.whatsapp_content,
                                template_id: newTemplate.id,
                            })
                        );

                    await dbClient.activityTemplateLanguage.createMany({
                        data: newLanguageRecords as any,
                    });
                }
            }
        }

        // Initialize internal email templates
        const internalEmailTemplateService = new InternalEmailTemplateService();
        await internalEmailTemplateService.initializeCustomerTemplates(
            accountId,
            dbClient
        );
    }

    /**
     * Initializes activity sequences for a new customer
     */
    private static async initializeCustomerSequences(
        accountId: number,
        default_first_activity_delay_days: number,
        dbClient: DbClient = prisma
    ): Promise<void> {
        // First, create default sequence containers for each category
        const sequenceContainerService = new SequenceContainerService();
        const containerMap =
            await sequenceContainerService.createDefaultContainersForCustomer(
                accountId,
                dbClient
            );

        // Get the created sequence containers
        const sequenceContainers = await dbClient.sequenceContainer.findMany({
            where: {
                account_id: accountId,
                is_default: true,
            },
        });

        // Create a map of category to container ID
        const categoryToContainerMap = new Map<string, number>();
        sequenceContainers.forEach((container) => {
            categoryToContainerMap.set(container.category, container.id);
        });

        const masterSequences = await dbClient.activitiesSequence.findMany({
            where: {
                master_template: true,
                active: true,
            },
        });

        if (masterSequences.length > 0) {
            // Get all master templates for reference
            const masterTemplates = await dbClient.activitiesTemplate.findMany({
                where: {
                    master_template: true,
                    active: true,
                },
            });

            // Get customer's templates
            const customerTemplates = await dbClient.activitiesTemplate.findMany({
                where: {
                    account_id: accountId,
                },
            });

            // Get unique categories from master sequences
            const categoriesInMasterSequences = new Set(
                masterSequences.map((seq) => seq.category)
            );

            // Ensure containers exist for all categories that have master sequences
            for (const category of Array.from(categoriesInMasterSequences)) {
                if (!categoryToContainerMap.has(category)) {
                    // Create a default container for this category if it doesn't exist
                    const newContainer = await sequenceContainerService.create({
                        name: `Default ${category}`,
                        category: category as any,
                        account_id: accountId,
                        is_default: true,
                        active: true,
                        master_template: false,
                    }, undefined, dbClient);
                    categoryToContainerMap.set(category, newContainer.id);
                }
            }

            const newSequences = masterSequences
                .map((sequence) => {
                    const templateName = masterTemplates.find(
                        (template) =>
                            template.id === sequence.activity_template_id
                    )?.name;

                    const templateId = customerTemplates.find(
                        (ct) => ct.name === templateName
                    )?.id;

                    const containerId = categoryToContainerMap.get(
                        sequence.category
                    );

                    // Only include sequences that have both templateId and containerId
                    if (!templateId || !containerId) {
                        return null;
                    }

                    return {
                        step:
                            sequence.step !== undefined &&
                                sequence.step !== null
                                ? sequence.step
                                : null,
                        active: sequence.active,
                        activity_type: sequence.activity_type,
                        category: sequence.category,
                        days_from_prev_step: sequence.days_from_prev_step,
                        account_id: accountId,
                        activity_template_id: templateId,
                        master_template: false,
                        last_category_step: sequence.last_category_step,
                        time_of_day: sequence.time_of_day || "09:00",
                        sequence_container_id: containerId,
                    } as Prisma.ActivitiesSequenceCreateManyInput;
                })
                .filter(
                    (seq): seq is Prisma.ActivitiesSequenceCreateManyInput =>
                        seq !== null && seq !== undefined
                );

            if (newSequences.length > 0) {
                await dbClient.activitiesSequence.createMany({
                    data: newSequences,
                });
            }
        }
    }

    /**
     * Creates a new customer bank account and resets other primary bank accounts to false
     */
    static async createCustomerBankAccount(
        bankAccountData: Prisma.AccountBankAccountsCreateInput,
        userId?: string
    ): Promise<Prisma.AccountBankAccountsGetPayload<Record<string, never>>> {
        const newBankAccount = await (
            prisma as any
        ).customerBankAccounts.create({
            data: {
                ...bankAccountData,
                created_by: userId,
                modified_by: userId,
            } as any,
        });

        await this.resetOtherPrimaryBankAccounts(
            newBankAccount.account_id,
            newBankAccount.id
        );

        await this.addMissingCustomerBankAccounts(
            newBankAccount.account_id,
            newBankAccount.id,
            newBankAccount.country_id,
            newBankAccount.state_id,
            newBankAccount.primary
        );

        return newBankAccount;
    }

    /**
     * Updates a customer bank account and resets other primary bank accounts to false
     */
    static async updateCustomerBankAccount(
        bankAccountId: number,
        bankAccountData: Prisma.AccountBankAccountsUpdateInput,
        userId?: string
    ): Promise<Prisma.AccountBankAccountsGetPayload<Record<string, never>>> {
        const updatedBankAccount = await (
            prisma as any
        ).customerBankAccounts.update({
            where: { id: bankAccountId },
            data: {
                ...bankAccountData,
                modified_by: userId,
            } as any,
        });

        await this.resetOtherPrimaryBankAccounts(
            updatedBankAccount.account_id,
            Number(updatedBankAccount.id)
        );

        await this.addMissingCustomerBankAccounts(
            updatedBankAccount.account_id,
            Number(updatedBankAccount.id),
            updatedBankAccount.country_id,
            updatedBankAccount.state_id,
            updatedBankAccount.primary
        );

        return updatedBankAccount;
    }

    static async deleteCustomerBankAccount(
        bankAccountId: number
    ): Promise<void> {
        const deletedBankAccount = await (
            prisma as any
        ).customerBankAccounts.delete({
            where: { id: bankAccountId },
        });

        // delete customer bank accounts that are associated with the deleted bank account
        await prisma.customerBanks.deleteMany({
            where: {
                customer_bank_account_id: bankAccountId,
            },
        });
    }

    /**
     * Resets other primary bank accounts to false
     */
    private static async resetOtherPrimaryBankAccounts(
        accountId: number,
        newBankAccountId: number
    ): Promise<void> {
        await (prisma as any).customerBankAccounts.updateMany({
            where: {
                account_id: Number(accountId),
                primary: true,
                id: {
                    not: newBankAccountId,
                },
            },
            data: {
                primary: false,
            },
        });
    }

    private static async addMissingCustomerBankAccounts(
        accountId: number,
        bankAccountId: number,
        countryId: number | null,
        stateId: number | null,
        primary: boolean
    ): Promise<void> {
        if (!countryId) return;

        // For primary bank accounts, get all customers regardless of country/state
        // For non-primary bank accounts, get customers from the same country
        const customers = await prisma.customer.findMany({
            where: {
                account_id: accountId,
                ...(primary
                    ? {}
                    : { country_id: countryId, state_id: stateId }),
            },
            select: {
                id: true,
                country_id: true,
                state_id: true,
            },
        });

        if (customers.length === 0) return;

        // Get all existing bank account associations for these customers in one query
        const existingBankAccounts = await prisma.customerBanks.findMany({
            where: {
                customer_id: { in: customers.map((c) => c.id) },
                account_id: accountId,
            },
            select: {
                id: true,
                customer_id: true,
                account_id: true,
                customer_bank_account_id: true,
            },
        });

        // Get bank account details for all referenced bank accounts
        const bankAccountIds = Array.from(
            new Set(existingBankAccounts.map((b) => b.customer_bank_account_id))
        );
        const bankAccounts = await (
            prisma as any
        ).customerBankAccounts.findMany({
            where: {
                id: { in: bankAccountIds },
            },
            select: {
                id: true,
                country_id: true,
                state_id: true,
            },
        });

        // Create a map of bank account ID to bank account details
        const bankAccountMap = new Map(
            bankAccounts.map((ba: any) => [ba.id, ba])
        );

        // Group existing bank accounts by customer ID for efficient lookup
        const bankAccountsByCustomer = existingBankAccounts.reduce(
            (acc, bank) => {
                if (!acc[bank.customer_id]) {
                    acc[bank.customer_id] = [];
                }
                const bankAccount = bankAccountMap.get(
                    bank.customer_bank_account_id
                );
                acc[bank.customer_id].push({
                    ...bank,
                    CustomerBankAccount: bankAccount || null,
                } as typeof bank & {
                    CustomerBankAccount: {
                        id: number;
                        country_id: number | null;
                        state_id: number | null;
                    } | null;
                });
                return acc;
            },
            {} as Record<
                number,
                Array<
                    (typeof existingBankAccounts)[0] & {
                        CustomerBankAccount: {
                            id: number;
                            country_id: number | null;
                            state_id: number | null;
                        } | null;
                    }
                >
            >
        );

        // Prepare bulk operations
        const customersToDelete: number[] = [];
        const customersToAdd: Array<{
            customer_id: number;
            account_id: number;
            customer_bank_account_id: number;
        }> = [];

        // Process each customer
        for (const customer of customers) {
            const customerBanks = bankAccountsByCustomer[customer.id] || [];

            if (primary) {
                // For primary bank accounts: if customer has no bank accounts, add the primary one
                if (customerBanks.length === 0) {
                    customersToAdd.push({
                        customer_id: customer.id,
                        account_id: accountId,
                        customer_bank_account_id: bankAccountId,
                    });
                }
            } else {
                // For non-primary bank accounts: check if customer has bank accounts from different countries
                const hasNonMatchingBanks = customerBanks.some(
                    (bank) =>
                        bank.CustomerBankAccount &&
                        bank.CustomerBankAccount.country_id !== countryId &&
                        bank.CustomerBankAccount.state_id !== stateId
                );

                if (hasNonMatchingBanks) {
                    // Mark for deletion and addition
                    customersToDelete.push(customer.id);
                    customersToAdd.push({
                        customer_id: customer.id,
                        account_id: accountId,
                        customer_bank_account_id: bankAccountId,
                    });
                } else {
                    // Check if customer already has a matching bank account
                    const hasMatchingBank = customerBanks.some(
                        (bank) =>
                            bank.CustomerBankAccount &&
                            bank.CustomerBankAccount.country_id === countryId
                    );

                    if (!hasMatchingBank) {
                        customersToAdd.push({
                            customer_id: customer.id,
                            account_id: accountId,
                            customer_bank_account_id: bankAccountId,
                        });
                    }
                }
            }
        }

        // Execute bulk operations
        if (customersToDelete.length > 0) {
            await prisma.customerBanks.deleteMany({
                where: {
                    customer_id: { in: customersToDelete },
                    account_id: accountId,
                },
            });
        }

        if (customersToAdd.length > 0) {
            await prisma.customerBanks.createMany({
                data: customersToAdd,
            });
        }
    }

    /**
     * Checks if a customer exists by subdomain
     */
    static async getCustomerBySubdomain(
        subdomain: string
    ): Promise<Partial<Account> | null> {
        return await prisma.account.findFirst({
            where: {
                sub_domain: subdomain,
                status: "Active",
            },
            select: {
                id: true,
                name: true,
                sub_domain: true,
                status: true,
            },
        });
    }

    /**
     * Creates system_user and portal_user audit users for an account
     * These users are used for audit tracking and should not appear in user lists
     */
    private static async createAuditUsers(
        accountId: number,
        dbClient: DbClient = prisma
    ): Promise<void> {
        const systemUserId = getSystemUserId(accountId);
        const portalUserId = getPortalUserId(accountId);

        // Create or update system_user
        await dbClient.user.upsert({
            where: { id: systemUserId },
            create: {
                id: systemUserId,
                first_name: "System",
                last_name: "User",
                name: "System User",
                email: `system-${accountId}@audit.local`,
                username: `system-${accountId}@audit.local`,
                account_id: accountId,
                is_audit_user: true,
                status: "Active",
                language: "English",
                locale: "en-US",
                time_zone: "UTC",
                currency: "USD",
                sidebar_collapsed: false,
                modified_at: new Date(),
                created_at: new Date(),
            } as any,
            update: {
                // Ensure these fields are set even if user already exists
                is_audit_user: true,
                account_id: accountId,
                status: "Active",
            } as any,
        });

        // Create or update portal_user
        await dbClient.user.upsert({
            where: { id: portalUserId },
            create: {
                id: portalUserId,
                first_name: "Portal",
                last_name: "User",
                name: "Portal User",
                email: `portal-${accountId}@audit.local`,
                username: `portal-${accountId}@audit.local`,
                account_id: accountId,
                is_audit_user: true,
                status: "Active",
                language: "English",
                locale: "en-US",
                time_zone: "UTC",
                currency: "USD",
                sidebar_collapsed: false,
                modified_at: new Date(),
                created_at: new Date(),
            } as any,
            update: {
                // Ensure these fields are set even if user already exists
                is_audit_user: true,
                account_id: accountId,
                status: "Active",
            } as any,
        });
    }
}
