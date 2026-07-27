import { Contact } from "@prisma/client";
import { prismaJobs } from "@/lib/prisma";
import { ContactService } from "@/server/services/ContactService";
import { ContactInput } from "@/server/services/ImportService";

function getPrisma() {
    return prismaJobs();
}

function parseDateOrNull(value: string | null | undefined): Date | null {
    if (!value || typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
}

function buildContactData(
    value: ContactInput & { erp_contact_id?: string },
    companyId: number,
    customerId: number
) {
    const contactData: Record<string, unknown> = {
        first_name: value.first_name,
        last_name: value.last_name || null,
        email: value.email || null,
        phone: value.phone || null,
        mobile: value.mobile || null,
        role: value.role || null,
        company_wide_address: value.company_wide_address ?? false,
        receives_standard_reminder: value.receives_standard_reminder ?? false,
        receives_escalated_reminder: value.receives_escalated_reminder ?? false,
        company_id: companyId,
        customer_id: customerId,
    };

    if (value.generic_text1 !== undefined) {
        contactData.generic_text1 = value.generic_text1 || null;
    }
    if (value.generic_text2 !== undefined) {
        contactData.generic_text2 = value.generic_text2 || null;
    }
    if (value.generic_number1 !== undefined && value.generic_number1 !== null) {
        contactData.generic_number1 = value.generic_number1;
    }
    if (value.generic_number2 !== undefined && value.generic_number2 !== null) {
        contactData.generic_number2 = value.generic_number2;
    }
    const date1 = parseDateOrNull(value.generic_date1);
    if (date1) {
        contactData.generic_date1 = date1;
    }
    const date2 = parseDateOrNull(value.generic_date2);
    if (date2) {
        contactData.generic_date2 = date2;
    }

    const erpContactId = value.erp_contact_id?.trim();
    if (erpContactId) {
        contactData.erp_contact_id = erpContactId;
    }

    return contactData;
}

export class ImportContactService {
    async findCustomerWithCompany(customerNumber: string, accountId: number) {
        const customer = await getPrisma().customer.findFirst({
            where: {
                customer_number: customerNumber,
                account_id: accountId,
            },
            select: {
                id: true,
                company_id: true,
            },
        });

        if (!customer) {
            throw new Error(`Customer with number ${customerNumber} not found`);
        }

        if (!customer.company_id) {
            throw new Error(
                `Customer ${customerNumber} is not linked to any company`
            );
        }

        return {
            customerId: customer.id,
            companyId: customer.company_id,
        };
    }

    async importContact(
        value: ContactInput & { erp_contact_id?: string },
        companyId: number,
        customerId: number,
        userId?: string
    ): Promise<Contact> {
        const contactService = new ContactService();
        const contactData = buildContactData(value, companyId, customerId);
        const erpContactId = value.erp_contact_id?.trim();

        if (erpContactId) {
            const existing = await getPrisma().contact.findFirst({
                where: {
                    company_id: companyId,
                    erp_contact_id: erpContactId,
                },
                select: { id: true },
            });

            if (existing) {
                return contactService.upsertContact(
                    {
                        id: existing.id,
                        ...(contactData as Parameters<
                            ContactService["upsertContact"]
                        >[0]),
                    },
                    userId
                );
            }
        }

        return contactService.upsertContact(
            contactData as Parameters<ContactService["upsertContact"]>[0],
            userId
        );
    }
}
