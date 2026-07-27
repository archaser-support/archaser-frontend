import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock } from "@/test/mocks/prisma";
import { LanguageResolutionService } from "@/server/services/LanguageResolutionService";

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe("LanguageResolutionService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("resolveNotificationLanguage - template by customer country", () => {
        it("returns Hebrew when customer country is Israel (106) and Hebrew template exists", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "English",
                use_customer_language: true,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockImplementation(
                (args: { where: { ActivitiesTemplate: { account_id: number }; language: string } }) => {
                    if (args.where.language === "Hebrew") return Promise.resolve(1);
                    return Promise.resolve(0);
                }
            );

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                null,
                106 // Israel
            );

            expect(result).toBe("Hebrew");
            expect(mockPrisma.activityTemplateLanguage.count).toHaveBeenCalledWith({
                where: { ActivitiesTemplate: { account_id: 1 }, language: "Hebrew" },
            });
        });

        it("returns German when customer country is Germany (49) and German template exists", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "English",
                use_customer_language: true,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockImplementation(
                (args: { where: { ActivitiesTemplate: { account_id: number }; language: string } }) => {
                    if (args.where.language === "German") return Promise.resolve(1);
                    return Promise.resolve(0);
                }
            );

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                null,
                49 // Germany
            );

            expect(result).toBe("German");
        });

        it("returns Spanish when customer country is Spain (34) and Spanish template exists", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "English",
                use_customer_language: true,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockResolvedValue(1);

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                null,
                34 // Spain
            );

            expect(result).toBe("Spanish");
        });

        it("uses customer explicit language over country when both are provided", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "English",
                use_customer_language: true,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockImplementation(
                (args: { where: { language: string } }) => {
                    if (args.where.language === "French") return Promise.resolve(1);
                    return Promise.resolve(0);
                }
            );

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                "French",
                106 // Israel - would be Hebrew without explicit language
            );

            expect(result).toBe("French");
        });

        it("returns English for unknown country when no customer language and English template exists", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "English",
                use_customer_language: true,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockImplementation(
                (args: { where: { language: string } }) => {
                    if (args.where.language === "English") return Promise.resolve(1);
                    return Promise.resolve(0);
                }
            );

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                null,
                999 // Unknown country - map returns "English"
            );

            expect(result).toBe("English");
        });
    });

    describe("resolveNotificationLanguage - fallback when template not found for customer country", () => {
        it("falls back to account default language when no template for customer country language", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "Spanish",
                use_customer_language: true,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockImplementation(
                (args: { where: { ActivitiesTemplate: { account_id: number }; language: string } }) => {
                    if (args.where.language === "Hebrew") return Promise.resolve(0);
                    if (args.where.language === "Spanish") return Promise.resolve(1);
                    return Promise.resolve(0);
                }
            );

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                null,
                106 // Israel -> Hebrew, but no Hebrew template
            );

            expect(result).toBe("Spanish");
            expect(mockPrisma.activityTemplateLanguage.count).toHaveBeenCalledWith({
                where: { ActivitiesTemplate: { account_id: 1 }, language: "Hebrew" },
            });
            expect(mockPrisma.activityTemplateLanguage.count).toHaveBeenCalledWith({
                where: { ActivitiesTemplate: { account_id: 1 }, language: "Spanish" },
            });
        });

        it("falls back to English when no template for customer country nor for account default", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "German",
                use_customer_language: true,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockImplementation(
                (args: { where: { ActivitiesTemplate: { account_id: number }; language: string } }) => {
                    if (args.where.language === "Hebrew") return Promise.resolve(0);
                    if (args.where.language === "German") return Promise.resolve(0);
                    if (args.where.language === "English") return Promise.resolve(1);
                    return Promise.resolve(0);
                }
            );

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                null,
                106 // Israel -> Hebrew
            );

            expect(result).toBe("English");
        });

        it("returns account default language when no templates exist at all (including English)", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "French",
                use_customer_language: true,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockResolvedValue(0);

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                null,
                106 // Israel -> Hebrew
            );

            expect(result).toBe("French");
        });

        it("falls back to English when use_customer_language is false and account default has no template", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "Italian",
                use_customer_language: false,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockImplementation(
                (args: { where: { ActivitiesTemplate: { account_id: number }; language: string } }) => {
                    if (args.where.language === "Italian") return Promise.resolve(0);
                    if (args.where.language === "English") return Promise.resolve(1);
                    return Promise.resolve(0);
                }
            );

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                null,
                106,
                false
            );

            expect(result).toBe("English");
        });
    });

    describe("resolveNotificationLanguage - edge cases", () => {
        it("returns English when account is not found", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue(null);

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                999,
                null,
                106
            );

            expect(result).toBe("English");
            expect(mockPrisma.activityTemplateLanguage.count).not.toHaveBeenCalled();
        });

        it("uses account default when use_customer_language is false", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "Portuguese",
                use_customer_language: false,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockImplementation(
                (args: { where: { ActivitiesTemplate: { account_id: number }; language: string } }) => {
                    if (args.where.language === "Portuguese") return Promise.resolve(1);
                    return Promise.resolve(0);
                }
            );

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                null,
                106,
                false
            );

            expect(result).toBe("Portuguese");
        });

        it("returns English when customer country is null and use_customer_language is true", async () => {
            (mockPrisma.account.findUnique as any).mockResolvedValue({
                default_language: "English",
                use_customer_language: true,
            });
            (mockPrisma.activityTemplateLanguage.count as any).mockResolvedValue(1);

            const result = await LanguageResolutionService.resolveNotificationLanguage(
                1,
                null,
                null
            );

            expect(result).toBe("English");
        });
    });
});
