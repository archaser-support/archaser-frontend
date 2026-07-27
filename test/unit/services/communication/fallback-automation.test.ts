import { activity_type, contact_priority } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { FallbackAutomationService } from "@/server/services/FallbackAutomationService";
import { createPrismaMock } from "@/test/mocks/prisma";
import { ActivityStatus } from "@/types/enums";

// Mock dependencies with inline vi.fn() to ensure proper hoisting
vi.mock("@/server/services/EmailService", () => ({
    EmailService: vi.fn().mockImplementation(() => ({
        setCustomerSenderNameAndReplyToEmail: vi.fn().mockResolvedValue(undefined),
        sendEmail: vi.fn().mockResolvedValue({ messageId: "test-email-id" }),
    })),
}));
vi.mock("@/server/services/SMSVendorService", () => ({
    SMSVendorService: vi.fn().mockImplementation(() => ({
        sendSMS: vi.fn().mockResolvedValue({
            success: true,
            messageId: "test-sms-id",
        }),
    })),
}));
vi.mock("@/server/services/CommunicationIntelligenceService", () => ({
    CommunicationIntelligenceService: vi.fn().mockImplementation(() => ({
        isIntelligentSelectionEnabled: vi.fn().mockResolvedValue(false),
        buildSelectionContext: vi.fn(),
        selectOptimalChannel: vi.fn(),
        updateLearningData: vi.fn(),
    })),
}));
vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => ({
            logMessage: vi.fn().mockResolvedValue(undefined),
        })),
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock: createPrismaMockForMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMockForMock(),
    };
});

describe("FallbackAutomationService", () => {
    let fallbackService: FallbackAutomationService;

    beforeEach(() => {
        vi.clearAllMocks();
        fallbackService = new FallbackAutomationService();
    });

    describe("attemptMultiChannelDelivery", () => {
        it("should initialize FallbackAutomationService successfully", () => {
            // Test that the service can be instantiated
            expect(fallbackService).toBeDefined();
            expect(fallbackService).toBeInstanceOf(FallbackAutomationService);

            // Test that attemptMultiChannelDelivery is a function
            expect(typeof fallbackService.attemptMultiChannelDelivery).toBe("function");

            // Test that handleContactResponse is a function
            expect(typeof fallbackService.handleContactResponse).toBe("function");
        });

        it("should return delivery results array", async () => {
            const { prisma } = await import("@/lib/prisma");

            const mockCustomer = {
                id: 1,
                type: "Company" as const,
                Company: {
                    Contact: [
                        {
                            id: 1,
                            priority_level: contact_priority.Primary,
                            email: "test@example.com",
                            mobile: "+1234567890",
                            first_name: "Test",
                            escalation_delay_hours: 24,
                            preferred_channels: ["Email"],
                        },
                    ],
                },
            };

            vi.mocked(prisma.customer.findUnique).mockResolvedValue(
                mockCustomer as any
            );
            vi.mocked(prisma.activityContact.create).mockResolvedValue(
                {} as any
            );
            vi.mocked(prisma.activity.update).mockResolvedValue({} as any);
            vi.mocked(prisma.contact.findUnique).mockResolvedValue({
                id: 1,
                response_history: null,
            } as any);
            vi.mocked(prisma.contact.update).mockResolvedValue({} as any);

            const results = await fallbackService.attemptMultiChannelDelivery(
                1,
                1,
                1,
                "Test content",
                "Test title"
            );

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toHaveProperty("contactId");
            expect(results[0]).toHaveProperty("channel");
            expect(results[0]).toHaveProperty("success");
            expect(results[0].contactId).toBe(1);
        });

        it("should throw error when customer has no contacts", async () => {
            const { prisma } = await import("@/lib/prisma");

            const mockCustomer = {
                id: 1,
                type: "Company" as const,
                Company: {
                    Contact: [],
                },
            };

            vi.mocked(prisma.customer.findUnique).mockResolvedValue(
                mockCustomer as any
            );

            await expect(
                fallbackService.attemptMultiChannelDelivery(
                    1,
                    1,
                    1,
                    "Test content",
                    "Test title"
                )
            ).rejects.toThrow("No contacts found for customer");
        });
    });

    describe("handleContactResponse", () => {
        it("should stop escalation when contact responds", async () => {
            const { prisma } = await import("@/lib/prisma");
            vi.mocked(prisma.activityContact.updateMany).mockResolvedValue({
                count: 1,
            });
            vi.mocked(prisma.activity.update).mockResolvedValue({} as any);

            await fallbackService.handleContactResponse(
                1, // activityId
                1, // contactId
                activity_type.Email // channel
            );

            expect(prisma.activityContact.updateMany).toHaveBeenCalledWith({
                where: {
                    activity_id: BigInt(1),
                    contact_id: 1,
                    communication_channel: activity_type.Email,
                },
                data: {
                    response_received_at: expect.any(Date),
                    response_channel: activity_type.Email,
                },
            });

            expect(prisma.activity.update).toHaveBeenCalledWith({
                where: { id: BigInt(1) },
                data: {
                    status: ActivityStatus.DELIVERED,
                    actual_delivery_time: expect.any(Date),
                },
            });
        });
    });
});
