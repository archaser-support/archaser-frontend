import { Contact, contact_status, email_status, Prisma } from "@prisma/client";

import { DbClient, prisma } from "@/lib/prisma";
import { clearStuckFlagForCustomer } from "@/server/cron-jobs/activityWorkflowManager";
import { LogLevel } from "@/types/enums";
import { identifyCountryFromPhoneNumber } from "@/utils/phoneNumberUtils";

import { LogService } from "./LogService";
export class ContactService {
    private logService = LogService.getInstance();
    public async getPrimaryContact(
        customerId: number
    ): Promise<Contact | null> {
        try {
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                select: { company_id: true },
            });
            if (!customer?.company_id) return null;

            return await prisma.contact.findFirst({
                where: { company_id: customer.company_id, status: contact_status.Active },
                orderBy: [
                    { receives_standard_reminder: "desc" },
                    { receives_escalated_reminder: "desc" },
                ],
            });
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "ContactService.getPrimaryContact",
                "ContactService",
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

    public async getContactById(id: number): Promise<Contact | null> {
        try {
            const contact = await prisma.contact.findUnique({
                where: { id },
                include: {
                    Company: {
                        select: { name: true },
                    },
                    Country: {
                        select: { id: true, name: true, iso2: true },
                    },
                },
            });

            return contact;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "ContactService.getContactById",
                "ContactService",
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

    public async getContacts(params: {
        page?: number;
        limit?: number;
        search?: string;
        companyId?: number;
        status?: string;
    }): Promise<{ contacts: Contact[]; totalRecords: number }> {
        try {
            const {
                page = 1,
                limit = 10,
                search = "",
                companyId,
                status = "",
            } = params;
            const skip = (page - 1) * limit;

            const where: Prisma.ContactWhereInput = {
                AND: [
                    ...(companyId ? [{ company_id: companyId }] : []),
                    ...(search
                        ? [
                            {
                                OR: [
                                    {
                                        first_name: {
                                            contains: search,
                                            mode: Prisma.QueryMode
                                                .insensitive,
                                        },
                                    },
                                    {
                                        last_name: {
                                            contains: search,
                                            mode: Prisma.QueryMode
                                                .insensitive,
                                        },
                                    },
                                    {
                                        email: {
                                            contains: search,
                                            mode: Prisma.QueryMode
                                                .insensitive,
                                        },
                                    },
                                    {
                                        phone: {
                                            contains: search,
                                            mode: Prisma.QueryMode
                                                .insensitive,
                                        },
                                    },
                                    {
                                        mobile: {
                                            contains: search,
                                            mode: Prisma.QueryMode
                                                .insensitive,
                                        },
                                    },
                                ],
                            },
                        ]
                        : []),
                    ...(status
                        ? [
                            {
                                status: status as contact_status,
                            },
                        ]
                        : []),
                ],
            };

            const [contacts, totalRecords] = await Promise.all([
                prisma.contact.findMany({
                    skip,
                    take: limit,
                    where,
                    include: {
                        Company: { select: { name: true } },
                    },
                    orderBy: {
                        status: "asc",
                    },
                }),
                prisma.contact.count({ where }),
            ]);

            return { contacts, totalRecords };
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "ContactService.getContacts",
                "ContactService",
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

    public async upsertContact(
        data: {
            id?: number;
            first_name: string;
            last_name?: string;
            email?: string;
            phone?: string;
            mobile?: string;
            company_id: number;
            status?: contact_status;
            role?: string;
            company_wide_address?: boolean;
            receives_standard_reminder?: boolean;
            receives_escalated_reminder?: boolean;
            state_id?: number;
            customer_id?: number;
            generic_text1?: string | null;
            generic_text2?: string | null;
            generic_number1?: number | null;
            generic_number2?: number | null;
            generic_date1?: Date | null;
            generic_date2?: Date | null;
            erp_contact_id?: string | null;
        },
        userId?: string,
        options?: {
            systemGenerated?: boolean;
            isPortal?: boolean;
            account_id?: number;
            dbClient?: DbClient;
            runPostCommitEffects?: boolean;
        }
    ): Promise<Contact> {
        try {
            const dbClient = options?.dbClient ?? prisma;
            const runPostCommitEffects =
                options?.runPostCommitEffects ?? options?.dbClient == null;

            if (options?.dbClient && runPostCommitEffects) {
                throw new Error(
                    "ContactService.upsertContact post-commit effects require a committed client"
                );
            }
            // Validate required fields
            if (!data.first_name || !data.company_id) {
                throw new Error("First name and company ID are required");
            }

            // Verify company exists
            const company = await dbClient.company.findUnique({
                where: { id: data.company_id },
                select: { id: true },
            });

            if (!company) {
                throw new Error(`Company with ID ${data.company_id} not found`);
            }

            // Identify country from phone number if provided
            let countryId: number | null = null;
            const phoneNumber = data.mobile || data.phone;

            if (phoneNumber) {
                // Check if the phone number starts with + (has country code)
                const hasCountryCode = phoneNumber.trim().startsWith("+");

                if (hasCountryCode) {
                    try {
                        const countryInfo =
                            identifyCountryFromPhoneNumber(phoneNumber);

                        if (countryInfo) {
                            // Find country in database by ISO2 code
                            const country = await dbClient.country.findFirst({
                                where: { iso2: countryInfo.iso2 },
                                select: { id: true },
                            });

                            if (country) {
                                countryId = country.id;
                            }
                        }
                    } catch (countryError) {
                        // Silent error handling
                    }
                }

                // If no country was identified (either no country code or identification failed), use customer's country
                if (!countryId && data.customer_id) {
                    const customer = await dbClient.customer.findUnique({
                        where: { id: data.customer_id },
                        select: { country_id: true },
                    });

                    if (customer?.country_id) {
                        countryId = customer.country_id;
                    }
                }
            } else {
                // If no phone number provided, use customer's country as fallback
                if (data.customer_id) {
                    const customer = await dbClient.customer.findUnique({
                        where: { id: data.customer_id },
                        select: { country_id: true },
                    });

                    if (customer?.country_id) {
                        countryId = customer.country_id;
                    }
                }
            }

            // Calculate full_name from first_name and last_name
            // Ensure there is a space between first and last name when both exist
            const firstName = String(data.first_name).trim();
            const lastName = data.last_name
                ? String(data.last_name).trim()
                : null;
            // Only add space if last_name exists and is not empty
            const fullName = lastName
                ? `${firstName} ${lastName}`.trim()
                : firstName || null;

            // Base contact data without company_id and country_id (for updates)
            const baseContactData: any = {
                first_name: firstName,
                last_name: lastName,
                full_name: fullName,
                email: data.email ? String(data.email).trim() : null,
                phone: data.phone ? String(data.phone).trim() : null,
                mobile: data.mobile ? String(data.mobile).trim() : null,
                role: data.role ? String(data.role).trim() : null,
                status: data.status !== undefined ? data.status : contact_status.Active,
                company_wide_address: data.company_wide_address ?? false,
                receives_standard_reminder:
                    data.receives_standard_reminder ?? false,
                receives_escalated_reminder:
                    data.receives_escalated_reminder ?? false,
                state_id: data.state_id || null,
                customer_id: data.customer_id || null,
            };

            if (data.generic_text1 !== undefined) {
                baseContactData.generic_text1 = data.generic_text1 ?? null;
            }
            if (data.generic_text2 !== undefined) {
                baseContactData.generic_text2 = data.generic_text2 ?? null;
            }
            if (data.generic_number1 !== undefined) {
                baseContactData.generic_number1 = data.generic_number1 ?? null;
            }
            if (data.generic_number2 !== undefined) {
                baseContactData.generic_number2 = data.generic_number2 ?? null;
            }
            if (data.generic_date1 !== undefined) {
                baseContactData.generic_date1 = data.generic_date1 ?? null;
            }
            if (data.generic_date2 !== undefined) {
                baseContactData.generic_date2 = data.generic_date2 ?? null;
            }
            if (data.erp_contact_id !== undefined) {
                baseContactData.erp_contact_id = data.erp_contact_id
                    ? String(data.erp_contact_id).trim()
                    : null;
            }

            // Full contact data including company_id, status, and country_id (for creation)
            const fullContactData: any = {
                ...baseContactData,
                company_id: data.company_id,
                status: data.status !== undefined ? data.status : contact_status.Active,
                country_id: countryId,
            };

            if (data.id) {
                // Verify contact exists before updating
                const existingContact = await dbClient.contact.findUnique({
                    where: { id: data.id },
                    select: {
                        id: true,
                        email: true,
                        mobile: true,
                        phone: true,
                    },
                });

                if (!existingContact) {
                    // Contact not found for update
                    throw new Error(`Contact with ID ${data.id} not found`);
                }

                if (data.email && existingContact.email !== data.email) {
                    baseContactData.email_status = email_status.Valid;
                }

                // Always update country based on current mobile/phone number
                const phoneNumber = data.mobile || data.phone;
                if (phoneNumber) {
                    // Check if the phone number starts with + (has country code)
                    const hasCountryCode = phoneNumber.trim().startsWith("+");

                    if (hasCountryCode) {
                        try {
                            const countryInfo =
                                identifyCountryFromPhoneNumber(phoneNumber);
                            if (countryInfo) {
                                const country = await dbClient.country.findFirst({
                                    where: { iso2: countryInfo.iso2 },
                                    select: { id: true },
                                });
                                if (country) {
                                    baseContactData.country_id = country.id;
                                }
                            }
                        } catch (countryError) {
                            // Silent error handling
                        }
                    }

                    // If no country was identified (either no country code or identification failed), use customer's country
                    if (!baseContactData.country_id && data.customer_id) {
                        const customer = await dbClient.customer.findUnique({
                            where: { id: data.customer_id },
                            select: { country_id: true },
                        });

                        if (customer?.country_id) {
                            baseContactData.country_id = customer.country_id;
                        }
                    }
                } else {
                    // If no phone number provided, use customer's country as fallback
                    if (data.customer_id) {
                        const customer = await prisma.customer.findUnique({
                            where: { id: data.customer_id },
                            select: { country_id: true },
                        });

                        if (customer?.country_id) {
                            baseContactData.country_id = customer.country_id;
                        }
                    }
                }

                // Determine audit user ID based on context
                let auditUserId: string | undefined = userId;
                if (options?.account_id) {
                    const { getSystemUserId, getPortalUserId } = await import(
                        "./UserService"
                    );
                    if (options.isPortal) {
                        auditUserId = getPortalUserId(options.account_id);
                    } else if (options.systemGenerated) {
                        auditUserId = getSystemUserId(options.account_id);
                    }
                } else if (data.customer_id) {
                    // Get account_id from customer if not provided in options
                    const customer = await dbClient.customer.findUnique({
                        where: { id: data.customer_id },
                        select: { account_id: true },
                    });
                    if (customer?.account_id) {
                        const { getSystemUserId, getPortalUserId } =
                            await import("./UserService");
                        if (options?.isPortal) {
                            auditUserId = getPortalUserId(customer.account_id);
                        } else if (options?.systemGenerated) {
                            auditUserId = getSystemUserId(customer.account_id);
                        }
                    }
                }

                const contact = await dbClient.contact.update({
                    where: { id: data.id },
                    data: {
                        ...baseContactData,
                        modified_by: auditUserId,
                    },
                });

                // Clear stuck flag for customer if contact was updated successfully
                if (runPostCommitEffects && data.customer_id) {
                    await clearStuckFlagForCustomer(data.customer_id);
                }
                return contact;
            } else {
                // Determine audit user ID based on context
                let auditUserId: string | undefined = userId;
                if (options?.account_id) {
                    const { getSystemUserId, getPortalUserId } = await import(
                        "./UserService"
                    );
                    if (options.isPortal) {
                        auditUserId = getPortalUserId(options.account_id);
                    } else if (options.systemGenerated) {
                        auditUserId = getSystemUserId(options.account_id);
                    }
                } else if (data.customer_id) {
                    // Get account_id from customer if not provided in options
                    const customer = await dbClient.customer.findUnique({
                        where: { id: data.customer_id },
                        select: { account_id: true },
                    });
                    if (customer?.account_id) {
                        const { getSystemUserId, getPortalUserId } =
                            await import("./UserService");
                        if (options?.isPortal) {
                            auditUserId = getPortalUserId(customer.account_id);
                        } else if (options?.systemGenerated) {
                            auditUserId = getSystemUserId(customer.account_id);
                        }
                    }
                }

                const contact = await dbClient.contact.create({
                    data: {
                        ...fullContactData,
                        created_by: auditUserId,
                        modified_by: auditUserId,
                    },
                });

                // Clear stuck flag for customer if contact was created successfully
                if (runPostCommitEffects && data.customer_id) {
                    await clearStuckFlagForCustomer(data.customer_id);
                }
                return contact;
            }
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "ContactService.upsertContact",
                "ContactService",
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

    public async resetOtherPrimaryContact(
        companyId: number,
        contactId: number
    ): Promise<void> {
        if (!companyId) return;

        try {
            await prisma.contact.updateMany({
                where: {
                    company_id: companyId,
                    id: { not: contactId },
                    receives_standard_reminder: true,
                },
                data: {
                    receives_standard_reminder: false,
                },
            });
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "ContactService.resetOtherPrimaryContact",
                "ContactService",
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

    public async resetOtherSecondaryContact(
        companyId: number,
        contactId: number
    ): Promise<void> {
        if (!companyId) return;

        try {
            await prisma.contact.updateMany({
                where: {
                    company_id: companyId,
                    id: { not: contactId },
                    receives_escalated_reminder: true,
                },
                data: {
                    receives_escalated_reminder: false,
                },
            });
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "ContactService.resetOtherSecondaryContact",
                "ContactService",
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
}
