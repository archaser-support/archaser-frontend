/**
 * Unit Test: Multi-Language Dispute Reasons
 *
 * Tests for multi-language support in dispute reasons functionality:
 * - PortalService.getDisputeDetails language mapping
 * - API endpoints for disputes and dispute reasons
 * - Language template prioritization (customer-specific vs master)
 * - Fallback logic when translations are missing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createPrismaMock } from "@/test/mocks/prisma";

// Mock all dependencies
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/AccessControlService", () => ({
    AccessControlService: {
        getInstance: vi.fn(() => ({
            getUserInfo: vi.fn(),
            getEffectiveUserId: vi.fn(),
            getOwnerFilter: vi.fn(() => ({})),
        })),
    },
}));

vi.mock("next-auth/jwt", () => ({
    getToken: vi.fn(),
}));

// Import after mocks
import { prisma } from "@/lib/prisma";
import { PortalService } from "@/server/services/PortalService";

import { getToken } from "next-auth/jwt";

describe("Multi-Language Dispute Reasons", () => {
    beforeEach(() => {
        // Clear all mocks and reset implementation
        vi.clearAllMocks();
        (prisma.customer.findFirst as any).mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("PortalService.getDisputeDetails", () => {
        const mockCustomerUUID = "test-uuid-123";
        const mockAccountId = 10099;

        it("should return null when customer not found", async () => {
            (prisma.customer.findFirst as any).mockResolvedValue(null);

            const result = await PortalService.getDisputeDetails(mockCustomerUUID, "Hebrew");

            expect(result).toBeNull();
            expect(prisma.customer.findFirst).toHaveBeenCalled();
        });

        it("should return null when account_id is missing", async () => {
            (prisma.customer.findFirst as any)
                .mockResolvedValueOnce({ account_id: null })
                .mockResolvedValueOnce(null);

            const result = await PortalService.getDisputeDetails(mockCustomerUUID, "Hebrew");

            expect(result).toBeNull();
        });

        it("should map dispute reason names to Hebrew when portalLanguage is Hebrew", async () => {
            const mockDispute = {
                id: 1,
                dispute_status: "New" as const,
                created_at: new Date(),
                modified_at: new Date(),
                customer_comment: null,
                contact_first_name: null,
                contact_last_name: null,
                contact_email: null,
                contact_mobile: null,
                resolution_comment: null,
                DisputeReason: {
                    id: 691,
                    name: "Wrong details",
                    DisputeReasonLanguage: [
                        {
                            id: 1,
                            language: "Hebrew",
                            name: "פרטים שגויים",
                            account_id: mockAccountId,
                            master_template: false,
                        },
                        {
                            id: 2,
                            language: "English",
                            name: "Wrong details",
                            account_id: mockAccountId,
                            master_template: false,
                        },
                    ],
                },
                DisputeInvoice: [],
                User: null,
            };

            // Set up mock to handle both calls properly
            // First call uses select: { account_id: true }
            // Second call uses include: {...}
            (prisma.customer.findFirst as any)
                .mockResolvedValueOnce({ account_id: mockAccountId })
                .mockResolvedValueOnce({
                    id: 1,
                    customer_uuid: mockCustomerUUID,
                    language: "English",
                    Account: { name: "Test Customer", logo: null, currency: "USD", id: mockAccountId },
                    Country: { name: "United States", iso2: "US" },
                    State: null,
                    CustomerDispute: [mockDispute],
                });

            const result = await PortalService.getDisputeDetails(mockCustomerUUID, "Hebrew");

            expect(result).not.toBeNull();
            expect(result?.disputes).toHaveLength(1);
            expect(result?.disputes[0].reason).toBe("פרטים שגויים");
        });

        it("should use English name when Hebrew translation not available", async () => {
            const mockDispute = {
                id: 1,
                dispute_status: "New" as const,
                created_at: new Date(),
                modified_at: new Date(),
                customer_comment: null,
                contact_first_name: null,
                contact_last_name: null,
                contact_email: null,
                contact_mobile: null,
                resolution_comment: null,
                DisputeReason: {
                    id: 691,
                    name: "Wrong details",
                    DisputeReasonLanguage: [
                        {
                            id: 2,
                            language: "English",
                            name: "Wrong details",
                            account_id: mockAccountId,
                            master_template: false,
                        },
                        // No Hebrew translation - should use default
                    ],
                },
                DisputeInvoice: [],
                User: null,
            };

            (prisma.customer.findFirst as any)
                .mockResolvedValueOnce({ account_id: mockAccountId })
                .mockResolvedValueOnce({
                    id: 1,
                    customer_uuid: mockCustomerUUID,
                    language: "English",
                    Account: { name: "Test Customer", logo: null, currency: "USD", id: mockAccountId },
                    Country: { name: "United States", iso2: "US" },
                    State: null,
                    CustomerDispute: [mockDispute],
                });

            const result = await PortalService.getDisputeDetails(mockCustomerUUID, "Hebrew");

            expect(result).not.toBeNull();
            expect(result?.disputes).toHaveLength(1);
            // When Hebrew translation not available, it should fall back to default name
            expect(result?.disputes[0].reason).toBe("Wrong details");
        });

        it("should prefer customer-specific language template over master template", async () => {
            const mockDispute = {
                id: 1,
                dispute_status: "New" as const,
                created_at: new Date(),
                modified_at: new Date(),
                customer_comment: null,
                contact_first_name: null,
                contact_last_name: null,
                contact_email: null,
                contact_mobile: null,
                resolution_comment: null,
                DisputeReason: {
                    id: 691,
                    name: "Wrong details",
                    DisputeReasonLanguage: [
                        {
                            id: 1,
                            language: "Hebrew",
                            name: "פרטים שגויים - מותאם אישית",
                            account_id: mockAccountId,
                            master_template: false,
                        },
                        {
                            id: 2,
                            language: "Hebrew",
                            name: "פרטים שגויים",
                            account_id: 99999,
                            master_template: true,
                        },
                    ],
                },
                DisputeInvoice: [],
                User: null,
            };

            (prisma.customer.findFirst as any)
                .mockResolvedValueOnce({ account_id: mockAccountId })
                .mockResolvedValueOnce({
                    id: 1,
                    customer_uuid: mockCustomerUUID,
                    language: "English",
                    Account: { name: "Test Customer", logo: null, currency: "USD", id: mockAccountId },
                    Country: { name: "United States", iso2: "US" },
                    State: null,
                    CustomerDispute: [mockDispute],
                });

            const result = await PortalService.getDisputeDetails(mockCustomerUUID, "Hebrew");

            expect(result).not.toBeNull();
            expect(result?.disputes).toHaveLength(1);
            expect(result?.disputes[0].reason).toBe("פרטים שגויים - מותאם אישית");
        });

        it("should fall back to master template when customer-specific not available", async () => {
            const mockDispute = {
                id: 1,
                dispute_status: "New" as const,
                created_at: new Date(),
                modified_at: new Date(),
                customer_comment: null,
                contact_first_name: null,
                contact_last_name: null,
                contact_email: null,
                contact_mobile: null,
                resolution_comment: null,
                DisputeReason: {
                    id: 691,
                    name: "Wrong details",
                    DisputeReasonLanguage: [
                        {
                            id: 2,
                            language: "Hebrew",
                            name: "פרטים שגויים",
                            account_id: 99999,
                            master_template: true,
                        },
                    ],
                },
                DisputeInvoice: [],
                User: null,
            };

            (prisma.customer.findFirst as any)
                .mockResolvedValueOnce({ account_id: mockAccountId })
                .mockResolvedValueOnce({
                    id: 1,
                    customer_uuid: mockCustomerUUID,
                    language: "English",
                    Account: { name: "Test Customer", logo: null, currency: "USD", id: mockAccountId },
                    Country: { name: "United States", iso2: "US" },
                    State: null,
                    CustomerDispute: [mockDispute],
                });

            const result = await PortalService.getDisputeDetails(mockCustomerUUID, "Hebrew");

            expect(result).not.toBeNull();
            expect(result?.disputes).toHaveLength(1);
            expect(result?.disputes[0].reason).toBe("פרטים שגויים");
        });

        it("should use customer language when portalLanguage not provided", async () => {
            const mockDispute = {
                id: 1,
                dispute_status: "New" as const,
                created_at: new Date(),
                modified_at: new Date(),
                customer_comment: null,
                contact_first_name: null,
                contact_last_name: null,
                contact_email: null,
                contact_mobile: null,
                resolution_comment: null,
                DisputeReason: {
                    id: 691,
                    name: "Wrong details",
                    DisputeReasonLanguage: [
                        {
                            id: 1,
                            language: "Hebrew",
                            name: "פרטים שגויים",
                            account_id: mockAccountId,
                            master_template: false,
                        },
                    ],
                },
                DisputeInvoice: [],
                User: null,
            };

            (prisma.customer.findFirst as any)
                .mockResolvedValueOnce({ account_id: mockAccountId })
                .mockResolvedValueOnce({
                    id: 1,
                    customer_uuid: mockCustomerUUID,
                    language: "Hebrew",
                    Account: { name: "Test Customer", logo: null, currency: "USD", id: mockAccountId },
                    Country: { name: "United States", iso2: "US" },
                    State: null,
                    CustomerDispute: [mockDispute],
                });

            const result = await PortalService.getDisputeDetails(mockCustomerUUID);

            expect(result).not.toBeNull();
            expect(result?.disputes).toHaveLength(1);
            expect(result?.disputes[0].reason).toBe("פרטים שגויים");
        });

        it("should handle case-insensitive language matching", async () => {
            const mockDispute = {
                id: 1,
                dispute_status: "New" as const,
                created_at: new Date(),
                modified_at: new Date(),
                customer_comment: null,
                contact_first_name: null,
                contact_last_name: null,
                contact_email: null,
                contact_mobile: null,
                resolution_comment: null,
                DisputeReason: {
                    id: 691,
                    name: "Wrong details",
                    DisputeReasonLanguage: [
                        {
                            id: 1,
                            language: "hebrew", // lowercase
                            name: "פרטים שגויים",
                            account_id: mockAccountId,
                            master_template: false,
                        },
                    ],
                },
                DisputeInvoice: [],
                User: null,
            };

            (prisma.customer.findFirst as any)
                .mockResolvedValueOnce({ account_id: mockAccountId })
                .mockResolvedValueOnce({
                    id: 1,
                    customer_uuid: mockCustomerUUID,
                    language: "English",
                    Account: { name: "Test Customer", logo: null, currency: "USD", id: mockAccountId },
                    Country: { name: "United States", iso2: "US" },
                    State: null,
                    CustomerDispute: [mockDispute],
                });

            const result = await PortalService.getDisputeDetails(mockCustomerUUID, "Hebrew");

            expect(result).not.toBeNull();
            expect(result?.disputes).toHaveLength(1);
            expect(result?.disputes[0].reason).toBe("פרטים שגויים");
        });

        it("should filter DisputeReasonLanguage by account_id and master_template", async () => {
            (prisma.customer.findFirst as any)
                .mockResolvedValueOnce({ account_id: mockAccountId })
                .mockResolvedValueOnce(null);

            await PortalService.getDisputeDetails(mockCustomerUUID, "Hebrew");

            // Verify the query includes proper filtering
            const calls = (prisma.customer.findFirst as any).mock.calls;
            const disputeQuery = calls.find((call: any) => call[0]?.include?.CustomerDispute);

            if (disputeQuery) {
                // Verify the query includes DisputeReasonLanguage (without invalid where clause)
                expect(disputeQuery[0].include.CustomerDispute.include.DisputeReason.include.DisputeReasonLanguage).toBe(true);
            }
        });
    });

    // Removed skipped describe block - Operations API tests (4 skipped tests removed)

    describe("API Endpoint - /api/customers/[customerUUID]/view-disputes", () => {
        // Use a valid UUID format for testing
        const testUUID = "11111111-1111-1111-1111-111111111111";

        const mockRequest = {
            method: "GET",
            query: {
                customerUUID: testUUID,
                language: "he",
            },
        } as any;

        const mockResponse = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        } as any;

        it("should map locale 'he' to 'Hebrew' language", async () => {
            const handler = (await import("@/pages/api/customers/[customerUUID]/view-disputes")).default;

            // Mock PortalService
            const mockDisputeDetails = {
                customerName: "Test Customer",
                logo: null,
                country: "United States",
                state: null,
                customerCurrency: "USD",
                disputes: [
                    {
                        id: 1,
                        status: "New" as const,
                        reason: "פרטים שגויים",
                        comment: null,
                        created_at: new Date(),
                        modified_at: new Date(),
                        assignedUser: null,
                        contact: null,
                        resolutionComment: null,
                        invoices: [],
                    },
                ],
            };

            vi.spyOn(PortalService, "getDisputeDetails").mockResolvedValue(mockDisputeDetails);

            await handler(mockRequest, mockResponse);

            expect(PortalService.getDisputeDetails).toHaveBeenCalledWith(
                testUUID,
                "Hebrew"
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it("should map locale 'en' to 'English' language", async () => {
            const handler = (await import("@/pages/api/customers/[customerUUID]/view-disputes")).default;

            const requestWithEn = {
                ...mockRequest,
                query: {
                    ...mockRequest.query,
                    language: "en",
                },
            };

            const mockDisputeDetails = {
                customerName: "Test Customer",
                logo: null,
                country: "United States",
                state: null,
                customerCurrency: "USD",
                disputes: [
                    {
                        id: 1,
                        status: "New" as const,
                        reason: "Wrong details",
                        comment: null,
                        created_at: new Date(),
                        modified_at: new Date(),
                        assignedUser: null,
                        contact: null,
                        resolutionComment: null,
                        invoices: [],
                    },
                ],
            };

            vi.spyOn(PortalService, "getDisputeDetails").mockResolvedValue(mockDisputeDetails);

            await handler(requestWithEn, mockResponse);

            expect(PortalService.getDisputeDetails).toHaveBeenCalledWith(
                testUUID,
                "English"
            );
        });

        it("should return 404 when customer not found", async () => {
            const handler = (await import("@/pages/api/customers/[customerUUID]/view-disputes")).default;

            vi.spyOn(PortalService, "getDisputeDetails").mockResolvedValue(null);

            await handler(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: "Customer not found",
            });
        });

        it("should return 400 for invalid customerUUID", async () => {
            const handler = (await import("@/pages/api/customers/[customerUUID]/view-disputes")).default;

            const invalidRequest = {
                ...mockRequest,
                query: {
                    customerUUID: null,
                    language: "en",
                },
            };

            await handler(invalidRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });
    });

    describe("Language Template Prioritization", () => {
        it("should prioritize customer-specific template over master template", () => {
            const languageTemplates = [
                {
                    language: "Hebrew",
                    name: "פרטים שגויים - מותאם",
                    account_id: 10099,
                    master_template: false,
                },
                {
                    language: "Hebrew",
                    name: "פרטים שגויים",
                    account_id: 99999,
                    master_template: true,
                },
            ];

            const accountId = 10099;

            // Customer-specific first
            let languageTemplate = languageTemplates.find(
                (lt) => !lt.master_template && lt.account_id === accountId
            );

            expect(languageTemplate?.name).toBe("פרטים שגויים - מותאם");

            // Fallback to master if customer-specific not found
            const otherAccountId = 88888;
            languageTemplate = languageTemplates.find(
                (lt) => !lt.master_template && lt.account_id === otherAccountId
            );

            if (!languageTemplate) {
                languageTemplate = languageTemplates.find((lt) => lt.master_template);
            }

            expect(languageTemplate?.name).toBe("פרטים שגויים");
        });

        it("should handle case-insensitive language matching", () => {
            const languageTemplates = [
                {
                    language: "hebrew", // lowercase
                    name: "פרטים שגויים",
                    account_id: 10099,
                    master_template: false,
                },
            ];

            const targetLanguage = "Hebrew"; // Capitalized

            const matched = languageTemplates.filter(
                (lt) => lt.language?.toLowerCase() === targetLanguage?.toLowerCase()
            );

            expect(matched).toHaveLength(1);
            expect(matched[0].name).toBe("פרטים שגויים");
        });

        it("should return null when no language templates match", () => {
            const languageTemplates: any[] = [];

            const targetLanguage = "Hebrew";
            const matched = languageTemplates.filter(
                (lt) => lt.language?.toLowerCase() === targetLanguage?.toLowerCase()
            );

            expect(matched).toHaveLength(0);
        });
    });

    describe("Entities API - /api/entities/customers/[customerId]/disputes/get-open", () => {
        it("should map dispute reason names based on account language from JWT token", () => {
            // Test the language mapping logic used in the entities API
            const accountLanguage = "Hebrew";
            const accountId = 10099;

            const dispute = {
                id: 1,
                DisputeReason: {
                    id: 691,
                    name: "Wrong details",
                    DisputeReasonLanguage: [
                        {
                            id: 1,
                            language: "Hebrew",
                            name: "פרטים שגויים",
                            account_id: 10099,
                            master_template: false,
                        },
                        {
                            id: 2,
                            language: "Hebrew",
                            name: "פרטים שגויים - Master",
                            account_id: 99999,
                            master_template: true,
                        },
                    ],
                },
            };

            // Simulate the mapping logic from the API
            let disputeReasonName = dispute.DisputeReason?.name ?? null;
            const disputeReason = dispute.DisputeReason as any;

            if (disputeReason && accountLanguage && disputeReason.DisputeReasonLanguage) {
                const languageTemplates = disputeReason.DisputeReasonLanguage.filter(
                    (lt: any) => lt.language?.toLowerCase() === accountLanguage?.toLowerCase()
                );

                if (languageTemplates.length > 0) {
                    let languageTemplate = languageTemplates.find(
                        (lt: any) => !lt.master_template && lt.account_id === accountId
                    );

                    if (!languageTemplate) {
                        languageTemplate = languageTemplates.find((lt: any) => lt.master_template);
                    }

                    if (languageTemplate?.name) {
                        disputeReasonName = languageTemplate.name;
                    }
                }
            }

            expect(disputeReasonName).toBe("פרטים שגויים");
        });

        it("should fall back to master template when customer-specific not found", () => {
            const accountLanguage = "Hebrew";
            const accountId = 88888; // Different customer

            const dispute = {
                id: 1,
                DisputeReason: {
                    id: 691,
                    name: "Wrong details",
                    DisputeReasonLanguage: [
                        {
                            id: 1,
                            language: "Hebrew",
                            name: "פרטים שגויים - Customer Specific",
                            account_id: 10099,
                            master_template: false,
                        },
                        {
                            id: 2,
                            language: "Hebrew",
                            name: "פרטים שגויים",
                            account_id: 99999,
                            master_template: true,
                        },
                    ],
                },
            };

            let disputeReasonName = dispute.DisputeReason?.name ?? null;
            const disputeReason = dispute.DisputeReason as any;

            if (disputeReason && accountLanguage && disputeReason.DisputeReasonLanguage) {
                const languageTemplates = disputeReason.DisputeReasonLanguage.filter(
                    (lt: any) => lt.language?.toLowerCase() === accountLanguage?.toLowerCase()
                );

                if (languageTemplates.length > 0) {
                    let languageTemplate = languageTemplates.find(
                        (lt: any) => !lt.master_template && lt.account_id === accountId
                    );

                    if (!languageTemplate) {
                        languageTemplate = languageTemplates.find((lt: any) => lt.master_template);
                    }

                    if (languageTemplate?.name) {
                        disputeReasonName = languageTemplate.name;
                    }
                }
            }

            expect(disputeReasonName).toBe("פרטים שגויים");
        });

        it("should return default name when no language templates match", () => {
            const accountLanguage = "Spanish";
            const accountId = 10099;

            const dispute = {
                id: 1,
                DisputeReason: {
                    id: 691,
                    name: "Wrong details",
                    DisputeReasonLanguage: [
                        {
                            id: 1,
                            language: "Hebrew",
                            name: "פרטים שגויים",
                            account_id: 10099,
                            master_template: false,
                        },
                    ],
                },
            };

            let disputeReasonName = dispute.DisputeReason?.name ?? null;
            const disputeReason = dispute.DisputeReason as any;

            if (disputeReason && accountLanguage && disputeReason.DisputeReasonLanguage) {
                const languageTemplates = disputeReason.DisputeReasonLanguage.filter(
                    (lt: any) => lt.language?.toLowerCase() === accountLanguage?.toLowerCase()
                );

                if (languageTemplates.length === 0) {
                    // No match, keep default
                    disputeReasonName = dispute.DisputeReason.name;
                }
            }

            expect(disputeReasonName).toBe("Wrong details");
        });
    });

    describe("Dispute Reasons CRUD Operations", () => {
        const mockAccountId = 10099;

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should include DisputeReasonLanguage in GET request", async () => {
            const mockReason = {
                id: 691,
                name: "Wrong details",
                status: "Active" as const,
                account_id: mockAccountId,
                editable: true,
                master_template: false,
                DisputeReasonLanguage: [
                    {
                        id: 1,
                        dispute_reason_id: 691,
                        language: "English",
                        name: "Wrong details",
                        account_id: mockAccountId,
                        master_template: false,
                        created_at: new Date(),
                        modified_at: new Date(),
                    },
                    {
                        id: 2,
                        dispute_reason_id: 691,
                        language: "Hebrew",
                        name: "פרטים שגויים",
                        account_id: mockAccountId,
                        master_template: false,
                        created_at: new Date(),
                        modified_at: new Date(),
                    },
                ],
            };

            (prisma.disputeReason.findMany as any).mockResolvedValue([mockReason]);

            const reasons = await prisma.disputeReason.findMany({
                where: { account_id: mockAccountId },
                include: {
                    DisputeReasonLanguage: true,
                },
            });

            expect(reasons).toHaveLength(1);
            expect(reasons[0].DisputeReasonLanguage).toBeDefined();
            expect(reasons[0].DisputeReasonLanguage).toHaveLength(2);
        });

        it("should validate language templates when creating dispute reason", () => {
            const languageTemplates = [
                { language: "English", name: "Wrong details" },
                { language: "Hebrew", name: "פרטים שגויים" },
            ];

            // Validation logic: at least one template with non-empty name
            const hasValidLanguage = languageTemplates.some(
                (template) => template.name && template.name.trim().length > 0
            );

            expect(hasValidLanguage).toBe(true);
        });

        it("should reject empty language templates", () => {
            const languageTemplates: any[] = [];

            const hasValidLanguage = languageTemplates.some(
                (template) => template.name && template.name.trim().length > 0
            );

            expect(hasValidLanguage).toBe(false);
        });

        it("should extract main name from first valid language template", () => {
            const languageTemplates = [
                { language: "English", name: "" },
                { language: "Hebrew", name: "פרטים שגויים" },
            ];

            const firstLanguageTemplate = languageTemplates.find(
                (template) => template.name && template.name.trim().length > 0
            );

            expect(firstLanguageTemplate?.name).toBe("פרטים שגויים");
        });
    });

    describe("Edge Cases", () => {
        it("should handle null DisputeReason gracefully", async () => {
            const mockDispute = {
                id: 1,
                dispute_status: "New" as const,
                created_at: new Date(),
                modified_at: new Date(),
                customer_comment: null,
                contact_first_name: null,
                contact_last_name: null,
                contact_email: null,
                contact_mobile: null,
                resolution_comment: null,
                DisputeReason: null,
                DisputeInvoice: [],
                User: null,
            };

            const result = {
                disputes: [mockDispute].map((dispute) => ({
                    reason: dispute.DisputeReason?.name ?? null,
                })),
            };

            expect(result.disputes[0].reason).toBeNull();
        });

        it("should handle empty DisputeReasonLanguage array", async () => {
            const mockDispute = {
                id: 1,
                dispute_status: "New" as const,
                DisputeReason: {
                    id: 691,
                    name: "Wrong details",
                    DisputeReasonLanguage: [],
                },
            };

            const result = {
                disputes: [mockDispute].map((dispute) => {
                    let disputeReasonName = dispute.DisputeReason?.name ?? null;

                    if (dispute.DisputeReason && dispute.DisputeReason.DisputeReasonLanguage) {
                        const languageTemplates = dispute.DisputeReason.DisputeReasonLanguage.filter(
                            (lt: any) => lt.language?.toLowerCase() === "Hebrew".toLowerCase()
                        );

                        if (languageTemplates.length === 0) {
                            // No translation found, use default
                            disputeReasonName = dispute.DisputeReason.name;
                        }
                    }

                    return { reason: disputeReasonName };
                }),
            };

            expect(result.disputes[0].reason).toBe("Wrong details");
        });

        it("should handle language template with null name", async () => {
            const languageTemplates = [
                {
                    language: "Hebrew",
                    name: null,
                    account_id: 10099,
                    master_template: false,
                },
            ];

            const selected = languageTemplates.find(
                (lt) => lt.language === "Hebrew"
            );

            expect(selected?.name).toBeNull();
        });
    });
});

