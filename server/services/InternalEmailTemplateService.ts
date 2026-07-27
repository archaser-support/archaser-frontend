import { Prisma } from "@prisma/client";

import { DbClient, prisma } from "@/lib/prisma";

export class InternalEmailTemplateService {
    /**
     * Get internal email template by type and customer
     */
    async getTemplate(type: string, accountId: number) {
        const template = await prisma.internalEmailTemplate.findFirst({
            where: {
                type: type as any,
                account_id: accountId,
                active: true,
            },
        });

        // Fallback to master template if no customer-specific template
        if (!template) {
            return await prisma.internalEmailTemplate.findFirst({
                where: {
                    type: type as any,
                    master_template: true,
                    active: true,
                },
            });
        }

        return template;
    }

    /**
     * Initialize internal email templates for a new customer
     */
    async initializeCustomerTemplates(
        accountId: number,
        dbClient: DbClient = prisma
    ): Promise<void> {
        const masterTemplates = await dbClient.internalEmailTemplate.findMany({
            where: {
                master_template: true,
                active: true,
            },
        });

        if (masterTemplates.length > 0) {
            const newTemplates: Prisma.InternalEmailTemplateCreateManyInput[] =
                masterTemplates.map((template) => ({
                    name: template.name,
                    type: template.type,
                    subject: template.subject,
                    content: template.content,
                    active: template.active,
                    master_template: false,
                    account_id: accountId,
                }));

            await dbClient.internalEmailTemplate.createMany({
                data: newTemplates,
            });
        }
    }

    /**
     * Replace template variables with actual values
     */
    replaceTemplateVariables(
        template: string,
        variables: Record<string, any>
    ): string {
        let result = template;

        Object.entries(variables).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`;
            result = result.replace(new RegExp(placeholder, "g"), value || "");
        });

        return result;
    }

    /**
     * Get all templates for a customer
     */
    async getCustomerTemplates(accountId: number) {
        return await prisma.internalEmailTemplate.findMany({
            where: {
                account_id: accountId,
            },
            orderBy: { type: "asc" },
        });
    }

    /**
     * Create a new template
     */
    async createTemplate(data: {
        name: string;
        type: string;
        subject: string;
        content: string;
        accountId: number;
    }) {
        return await prisma.internalEmailTemplate.create({
            data: {
                name: data.name,
                type: data.type as any,
                subject: data.subject,
                content: data.content,
                account_id: data.accountId,
                master_template: false,
            },
        });
    }

    /**
     * Update an existing template
     */
    async updateTemplate(
        id: number,
        data: {
            name?: string;
            subject?: string;
            content?: string;
            active?: boolean;
        }
    ) {
        return await prisma.internalEmailTemplate.update({
            where: { id },
            data,
        });
    }

    /**
     * Delete a template
     */
    async deleteTemplate(id: number) {
        return await prisma.internalEmailTemplate.delete({
            where: { id },
        });
    }
}
