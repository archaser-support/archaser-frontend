import { prisma } from "@/lib/prisma";

export class LanguageResolutionService {
    /**
     * Determines the appropriate language for notifications based on account settings
     * Uses existing default_language field as fallback
     */
    static async resolveNotificationLanguage(
        accountId: number,
        customerLanguage: string | null,
        customerCountryId: number | null,
        useCustomerLanguage: boolean = true // New parameter to control strategy
    ): Promise<string> {
        // Get account settings
        const account = await prisma.account.findUnique({
            where: { id: accountId },
            select: {
                default_language: true,
                use_customer_language: true,
            } as any,
        });

        if (!account) {
            return "English"; // Fallback
        }

        const defaultLanguage = (account.default_language as unknown as string) || "English";

        // Strategy 1: Use customer's language (if enabled and available)
        if (account.use_customer_language) {
            const resolvedCustomerLanguage = this.resolveCustomerLanguage(
                customerLanguage,
                customerCountryId
            );

            // Check if template exists for this language
            const templateExists = await this.checkTemplateExists(
                accountId,
                resolvedCustomerLanguage
            );

            if (templateExists) {
                return resolvedCustomerLanguage;
            }
        }

        // Strategy 2: Use account's default language
        // Check if template exists for default language
        if (defaultLanguage !== "English") {
            const defaultTemplateExists = await this.checkTemplateExists(
                accountId,
                defaultLanguage
            );

            if (defaultTemplateExists) {
                return defaultLanguage;
            }
        }

        // Strategy 3: Fallback to English (hardcoded)
        // Always check if English template exists before returning
        const englishTemplateExists = await this.checkTemplateExists(
            accountId,
            "English"
        );

        if (englishTemplateExists) {
            return "English";
        }

        // If no templates exist at all, return default language anyway
        // (the template selection logic will handle this gracefully)
        return defaultLanguage;
    }

    /**
     * Resolves customer language based on country or explicit language setting
     */
    private static resolveCustomerLanguage(
        customerLanguage: string | null,
        customerCountryId: number | null
    ): string {
        // If customer has explicit language setting, use it
        if (customerLanguage) {
            return customerLanguage;
        }

        // Determine language based on country
        const countryLanguageMap: { [key: number]: string } = {
            106: "Hebrew", // Israel
            49: "German", // Germany
            34: "Spanish", // Spain
            33: "French", // France
            39: "Italian", // Italy
            351: "Portuguese", // Portugal
        };

        return countryLanguageMap[customerCountryId || 0] || "English";
    }

    /**
     * Check if templates exist for a specific language
     */
    private static async checkTemplateExists(
        accountId: number,
        language: string
    ): Promise<boolean> {
        const templateCount = await prisma.activityTemplateLanguage.count({
            where: {
                // account_id removed — ActivityTemplateLanguage no longer has this field.
                // Language rows are account-scoped via their parent ActivitiesTemplate.
                ActivitiesTemplate: {
                    account_id: accountId,
                },
                language: language,
            },
        });

        return templateCount > 0;
    }
}
