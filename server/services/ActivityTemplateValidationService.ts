import { prisma } from "@/lib/prisma";

export class ActivityTemplateValidationService {
    /**
     * Validates that an activity template has content for the specified default language
     */
    static async validateTemplateForDefaultLanguage(
        templateId: number,
        accountId: number,
        defaultLanguage: string
    ): Promise<{ isValid: boolean; missingLanguages: string[] }> {
        try {
            // Get the template with all its language versions
            // account_id no longer exists on ActivityTemplateLanguage; language rows are
            // already account-scoped via the parent ActivitiesTemplate (which has account_id)
            const template = await prisma.activitiesTemplate.findUnique({
                where: { id: templateId },
                include: {
                    ActivityTemplateLanguage: true,
                },
            });

            if (!template) {
                return {
                    isValid: false,
                    missingLanguages: [defaultLanguage],
                };
            }

            // Check if the template has content for the default language in its language records
            const hasDefaultLanguage = template.ActivityTemplateLanguage.some(
                (lang) => lang.language === defaultLanguage
            );

            // Content now lives exclusively in ActivityTemplateLanguage — check any language record
            const hasAnyContent = template.ActivityTemplateLanguage.some(
                (lang) =>
                    lang.email_content ||
                    lang.sms_content ||
                    lang.whatsapp_content
            );

            const isValid = hasDefaultLanguage || hasAnyContent;

            return {
                isValid,
                missingLanguages: hasDefaultLanguage ? [] : [defaultLanguage],
            };
        } catch (error) {
            console.error(
                "Error validating template for default language:",
                error
            );
            return {
                isValid: false,
                missingLanguages: [defaultLanguage],
            };
        }
    }

    /**
     * Gets all templates that are missing content for the customer's default language
     */
    static async getTemplatesMissingDefaultLanguage(
        accountId: number,
        defaultLanguage: string
    ): Promise<
        Array<{ id: number; name: string; missingLanguages: string[] }>
    > {
        try {
            const templates = await prisma.activitiesTemplate.findMany({
                where: { account_id: accountId },
                include: {
                    // account_id no longer on ActivityTemplateLanguage; fetch all rows
                    ActivityTemplateLanguage: true,
                },
            });

            const invalidTemplates = [];

            for (const template of templates) {
                const hasDefaultLanguage =
                    template.ActivityTemplateLanguage.some(
                        (lang) => lang.language === defaultLanguage
                    );

                // Content now lives exclusively in ActivityTemplateLanguage
                const hasAnyContent = template.ActivityTemplateLanguage.some(
                    (lang) =>
                        lang.email_content ||
                        lang.sms_content ||
                        lang.whatsapp_content
                );

                if (!hasDefaultLanguage && !hasAnyContent) {
                    invalidTemplates.push({
                        id: template.id,
                        name: template.name || `Template ${template.id}`,
                        missingLanguages: [defaultLanguage],
                    });
                }
            }

            return invalidTemplates;
        } catch (error) {
            console.error(
                "Error getting templates missing default language:",
                error
            );
            return [];
        }
    }

    /**
     * Validates all templates for a customer and returns a summary
     */
    static async validateAllTemplatesForCustomer(
        accountId: number,
        defaultLanguage: string
    ): Promise<{
        totalTemplates: number;
        validTemplates: number;
        invalidTemplates: number;
        missingDefaultLanguage: number;
        details: Array<{
            id: number;
            name: string;
            status: "valid" | "missing_default" | "no_content";
        }>;
    }> {
        try {
            const templates = await prisma.activitiesTemplate.findMany({
                where: { account_id: accountId },
                include: {
                    // account_id no longer on ActivityTemplateLanguage; fetch all rows
                    ActivityTemplateLanguage: true,
                },
            });

            let validTemplates = 0;
            let invalidTemplates = 0;
            let missingDefaultLanguage = 0;
            const details = [];

            for (const template of templates) {
                const hasDefaultLanguage =
                    template.ActivityTemplateLanguage.some(
                        (lang) => lang.language === defaultLanguage
                    );

                // Content now lives exclusively in ActivityTemplateLanguage
                const hasAnyContent = template.ActivityTemplateLanguage.some(
                    (lang) =>
                        lang.email_content ||
                        lang.sms_content ||
                        lang.whatsapp_content
                );

                if (hasDefaultLanguage) {
                    validTemplates++;
                    details.push({
                        id: template.id,
                        name: template.name || `Template ${template.id}`,
                        status: "valid" as const,
                    });
                } else if (hasAnyContent) {
                    validTemplates++;
                    missingDefaultLanguage++;
                    details.push({
                        id: template.id,
                        name: template.name || `Template ${template.id}`,
                        status: "missing_default" as const,
                    });
                } else {
                    invalidTemplates++;
                    details.push({
                        id: template.id,
                        name: template.name || `Template ${template.id}`,
                        status: "no_content" as const,
                    });
                }
            }

            return {
                totalTemplates: templates.length,
                validTemplates,
                invalidTemplates,
                missingDefaultLanguage,
                details,
            };
        } catch (error) {
            console.error(
                "Error validating all templates for customer:",
                error
            );
            return {
                totalTemplates: 0,
                validTemplates: 0,
                invalidTemplates: 0,
                missingDefaultLanguage: 0,
                details: [],
            };
        }
    }
}
