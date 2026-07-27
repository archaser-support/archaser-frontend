import { client_type } from "@prisma/client";

import { DbClient, prismaJobs } from "@/lib/prisma";
import { BusinessUnitService } from "@/server/services/BusinessUnitService";
import { CustomerAggregationService } from "@/server/services/CustomerAggregationService";
import { PermissionService } from "@/server/services/PermissionService";

const prisma = prismaJobs();

function generateCompanyNumber(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function findCountryAndState(country_iso2: string, state_iso2?: string) {
    const country = await prisma.country.findFirst({
        where: { iso2: country_iso2 },
    });
    if (!country) throw new Error(`Country ${country_iso2} not found`);

    let state = null;
    if (state_iso2) {
        state = await prisma.state.findFirst({
            where: { iso2: state_iso2, country_id: country.id },
        });
        if (!state)
            throw new Error(
                `State ${state_iso2} not found for country ${country_iso2}`
            );
    }

    return { country, state };
}

export async function upsertCustomerAndRelated(
    customer: any,
    value: any,
    countryId: number,
    stateId: number | null,
    account_id: number,
    user_id?: string
) {
    // Find owner_id if owner_email is provided
    let ownerId: string | null = null;
    if (value.owner_email) {
        const user = await prisma.user.findFirst({
            where: { email: value.owner_email, account_id: account_id },
            select: { id: true },
        });
        if (user) {
            ownerId = user.id;
        }
    }

    // Find business_unit_id if business_unit (external_id) is provided
    // IMPORTANT: This function should only be called after business unit existence and access validation
    let businessUnitId: number | null = null;
    if (value.business_unit && String(value.business_unit).trim() !== "") {
        const trimmedExternalId = String(value.business_unit).trim();
        const businessUnit = await prisma.businessUnit.findFirst({
            where: {
                external_id: trimmedExternalId,
                account_id: account_id,
            },
            select: { id: true },
        });
        if (!businessUnit) {
            // Business unit doesn't exist - this should have been caught in validation, but fail here as well
            throw new Error(
                `Business unit not found: ${trimmedExternalId}. Please create the business unit first or use an existing one.`
            );
        }
        businessUnitId = businessUnit.id;
    }

    // If business_unit_id is still null, set default: user's BU or account's primary BU
    if (!businessUnitId && user_id) {
        // Fetch user's business unit
        const user = await prisma.user.findUnique({
            where: { id: user_id },
            select: { business_unit_id: true },
        });

        if (user?.business_unit_id) {
            businessUnitId = user.business_unit_id;
        } else {
            // If user has no BU, use account's primary business unit
            const primaryBusinessUnit = await prisma.businessUnit.findFirst({
                where: {
                    account_id: account_id,
                    is_primary: true,
                },
                select: { id: true },
            });
            if (primaryBusinessUnit) {
                businessUnitId = primaryBusinessUnit.id;
            }
        }
    }

    const existingCustomer = await prisma.customer.findFirst({
        where: {
            customer_number: value.customer_number,
            account_id: account_id,
        },
    });

    // Determine language based on country
    let language: "English" | "Hebrew" = "English"; // default
    if (countryId === 106) {
        // Israel (country ID: 106)
        language = "Hebrew";
    }

    // Get account's default_first_activity_delay_days and category_for_new_collection to inherit for new customer
    const account = await prisma.account.findUnique({
        where: { id: account_id },
        select: {
            default_first_activity_delay_days: true,
            category_for_new_collection: true,
        },
    });

    // Get customer's default automation sequence container
    const defaultSequenceContainer = await prisma.sequenceContainer.findFirst({
        where: {
            account_id: account_id,
            category: "Automated",
            is_default: true,
            active: true,
            is_deleted: false,
        },
        select: {
            id: true,
        },
    });

    const customerData = {
        customer_number: value.customer_number
            ? String(value.customer_number).trim()
            : value.customer_number,
        city: value.city ? String(value.city).trim() : null,
        address_line1: value.address_line1
            ? String(value.address_line1).trim()
            : null,
        address_line2: value.address_line2
            ? String(value.address_line2).trim()
            : null,
        postal_code: value.postal_code
            ? String(value.postal_code).trim()
            : null,
        crn: value.crn ? String(value.crn).trim() : null,
        type: "Company" as client_type,
        account_id: account_id,
        country_id: countryId,
        state_id: stateId,
        owner_id: ownerId,
        language: language,
        first_activity_delay_days:
            account?.default_first_activity_delay_days ?? null,
        category_for_new_collection:
            account?.category_for_new_collection ?? null,
        sequence_container_id: defaultSequenceContainer?.id ?? null,
        business_unit_id: businessUnitId,
        modified_at: new Date(),
    };

    // Check if parent_customer_id is provided in the import data
    let parentCustomerId: number | null = null;
    if (value.parent_customer_id || value.parent_customer_number) {
        // If parent_customer_number is provided, look it up
        if (value.parent_customer_number) {
            const parentCustomer = await prisma.customer.findFirst({
                where: {
                    customer_number: String(
                        value.parent_customer_number
                    ).trim(),
                    account_id: account_id,
                },
                select: { id: true },
            });
            if (parentCustomer) {
                parentCustomerId = parentCustomer.id;
            }
        } else if (value.parent_customer_id) {
            parentCustomerId = parseInt(value.parent_customer_id);
            if (isNaN(parentCustomerId)) {
                parentCustomerId = null;
            }
        }
    }

    // Validate parent customer access permissions if parent is provided
    // IMPORTANT: This function should only be called after parent customer access validation
    if (parentCustomerId !== null && user_id) {
        // Get user info for access control
        const user = await prisma.user.findUnique({
            where: { id: user_id },
            select: {
                role: true,
                account_id: true,
                business_unit_id: true,
            },
        });

        if (user && user.account_id) {
            // Check if user has import_customer permission
            const permissionService = PermissionService.getInstance();
            const hasImportCustomerPermission =
                await permissionService.hasPermission(
                    user.account_id,
                    user.role as string,
                    "import_customer"
                );

            const isAdmin = user.account_id === 10013;

            // Check business unit permissions for non-admin users
            if (!isAdmin && !hasImportCustomerPermission) {
                throw new Error(
                    "You do not have permission to import customers"
                );
            }

            if (!isAdmin) {
                const parentCustomer = await prisma.customer.findUnique({
                    where: { id: parentCustomerId },
                    select: { business_unit_id: true } as any,
                });

                if (parentCustomer) {
                    const parentBuId = (parentCustomer as any).business_unit_id;
                    const userBuId = user.business_unit_id || null;

                    const canAccess =
                        await BusinessUnitService.canUserAccessCustomer(
                            userBuId,
                            parentBuId
                        );

                    if (!canAccess) {
                        // User doesn't have access to parent customer - fail the import
                        throw new Error(
                            `You don't have permission to assign parent customer ${parentCustomerId}. Access denied.`
                        );
                    }
                } else {
                    // Parent customer not found - this should have been caught in validation, but fail here as well
                    throw new Error(
                        `Parent customer not found: ${parentCustomerId}. Please use an existing parent customer.`
                    );
                }
            }
        }
    }

    // Add parent_customer_id to customerData if found
    if (parentCustomerId !== null) {
        (customerData as any).parent_customer_id = parentCustomerId;
    }

    const isNewCustomer = !existingCustomer;
    const savedCustomer = existingCustomer
        ? await prisma.customer.update({
            where: { id: existingCustomer.id },
            data: customerData,
        } as any)
        : await prisma.customer.create({ data: customerData } as any);

    if (!savedCustomer) throw new Error("Failed to save customer");

    if (isNewCustomer) {
        try {
            const { autoAssignPendingReviewDcl } = await import(
                "@/server/services/creditInsurance/AutoAssignPendingReviewDclService"
            );
            await autoAssignPendingReviewDcl({
                customerId: savedCustomer.id,
                accountId: savedCustomer.account_id,
                countryId: savedCustomer.country_id ?? null,
                customerNumber: savedCustomer.customer_number ?? null,
                modifiedBy: user_id ?? null,
            });
        } catch (autoAssignErr) {
            console.error(
                "[ImportCustomerService] autoAssignPendingReviewDcl failed:",
                autoAssignErr
            );
        }
    }

    try {
        const { syncCustomerInsuranceFields } = await import(
            "@/server/services/creditInsurance/syncCustomerInsuranceFields"
        );
        await syncCustomerInsuranceFields(savedCustomer.id);
    } catch (syncErr) {
        console.error(
            "[CustomerImport] syncCustomerInsuranceFields failed:",
            syncErr
        );
    }

    // Log audit trail for customer creation (only for new customers, not updates)
    if (isNewCustomer && user_id) {
        try {
            const { SettingsAuditLogService } = await import(
                "@/server/services/SettingsAuditLogService"
            );
            const { getUserInfoFromRequest } = await import(
                "@/server/utils/auditLogHelpers"
            );
            const auditLogService = SettingsAuditLogService.getInstance();

            // Create a mock request object for getUserInfoFromRequest
            // Since we're in an import context, we'll use the user_id and account_id directly
            const customerDataForLog = {
                id: savedCustomer.id,
                customer_number: savedCustomer.customer_number,
                account_id: savedCustomer.account_id,
                type: savedCustomer.type,
                business_unit_id: savedCustomer.business_unit_id,
                parent_customer_id: (savedCustomer as any).parent_customer_id,
            };

            await auditLogService.logCreate(
                "customers",
                savedCustomer.id,
                user_id,
                savedCustomer.account_id, // Use customer's account_id
                customerDataForLog as any,
                {
                    source: "import",
                    importType: "customer",
                }
            );
        } catch (auditError) {
            // Log error but don't fail the import
            console.error(
                "Failed to log customer creation audit during import:",
                auditError
            );
        }
    }

    if (savedCustomer.type === "Company") {
        await handleCompanyRelation(savedCustomer, customer.name, account_id);
    }

    // Recalculate parent aggregated data if this customer has a parent
    if (parentCustomerId !== null) {
        try {
            const aggregationService = CustomerAggregationService.getInstance();
            await aggregationService.calculateAggregatedData(
                parentCustomerId,
                user_id || "system_import"
            );
        } catch (error: any) {
            // Error handled silently - don't fail the import
        }
    }

    // Also check if this customer is now a parent (if other customers reference it)
    // This handles the case where a parent is imported before its children
    try {
        const aggregationService = CustomerAggregationService.getInstance();
        const childCount = await prisma.customer.count({
            where: {
                parent_customer_id: savedCustomer.id,
            } as any,
        });
        if (childCount > 0) {
            await aggregationService.calculateAggregatedData(
                savedCustomer.id,
                user_id || "system_import"
            );
        }
    } catch (error: any) {
        // Error handled silently - don't fail the import
    }

    // Find appropriate bank account for the customer
    if (savedCustomer.country_id) {
        // Check if customer already has a bank account
        const existingCustomerBank = await prisma.customerBanks.findFirst({
            where: {
                customer_id: savedCustomer.id,
            },
        });

        if (!existingCustomerBank) {
            // First try to find active bank account with matching country
            const matchingCountryBankAccount =
                await prisma.accountBankAccounts.findFirst({
                    where: {
                        account_id: savedCustomer.account_id,
                        status: true,
                        country_id: savedCustomer.country_id,
                    },
                });

            if (matchingCountryBankAccount) {
                // Create customerbank record with matching country bank account
                await prisma.customerBanks.create({
                    data: {
                        customer_id: savedCustomer.id,
                        account_id: savedCustomer.account_id,
                        customer_bank_account_id: matchingCountryBankAccount.id,
                    },
                });
            } else {
                // If no matching country bank account, try to find active and primary bank account
                const primaryBankAccount =
                    await prisma.accountBankAccounts.findFirst({
                        where: {
                            account_id: savedCustomer.account_id,
                            status: true,
                            primary: true,
                        },
                    });

                if (primaryBankAccount) {
                    // Create customerbank record with primary bank account
                    await prisma.customerBanks.create({
                        data: {
                            customer_id: savedCustomer.id,
                            account_id: savedCustomer.account_id,
                            customer_bank_account_id: primaryBankAccount.id,
                        },
                    });
                }
            }
        }
    }

    return savedCustomer.id;
}

export async function handleCompanyRelation(
    customerRecord: any,
    companyName: string,
    account_id: number,
    dbClient?: DbClient
) {
    const trimmedCompanyName = String(companyName).trim();
    const runWithClient = async (client: DbClient) => {
        if (customerRecord.company_id) {
            const existingCompany = await client.company.findFirst({
                where: {
                    id: customerRecord.company_id,
                    Customer: {
                        some: {
                            account_id: account_id,
                        },
                    },
                },
            });

            if (!existingCompany) {
                throw new Error("Company not found or access denied");
            }

            await client.company.update({
                where: { id: customerRecord.company_id },
                data: { name: trimmedCompanyName },
            });
            return;
        }

        const newCompany = await client.company.create({
            data: {
                name: trimmedCompanyName,
                company_number: generateCompanyNumber(),
            },
        });

        await client.customer.update({
            where: { id: customerRecord.id },
            data: { company_id: newCompany.id },
        });
    };

    if (dbClient) {
        await runWithClient(dbClient);
        return;
    }

    await prisma.$transaction(async (tx) => {
        await runWithClient(tx as DbClient);
    });
}
