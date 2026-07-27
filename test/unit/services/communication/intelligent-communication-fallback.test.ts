import { activity_type, contact_priority, delivery_status } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { CommunicationIntelligenceService } from "@/server/services/CommunicationIntelligenceService";
import { FallbackAutomationService } from "@/server/services/FallbackAutomationService";
import { createPrismaMock } from "@/test/mocks/prisma";
import { ActivityStatus } from "@/types/enums";

// Mock dependencies
vi.mock("@/server/services/EmailService");
vi.mock("@/server/services/SMSVendorService");
vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => ({
            logMessage: vi.fn().mockResolvedValue(undefined),
        })),
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

describe("Intelligent Communication Fallback - SMS/Email", () => {
    let fallbackService: FallbackAutomationService;
    let intelligenceService: CommunicationIntelligenceService;

    beforeEach(() => {
        fallbackService = new FallbackAutomationService();
        intelligenceService = new CommunicationIntelligenceService();
        vi.clearAllMocks();
    });

    describe("Channel Selection Logic", () => {
        it("should get preferred channels correctly", () => {
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: "test@company.com",
                mobile: "+1234567890",
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: ["SMS", "Email"],
                customer_id: 1,
            };

            // Use reflection to access private method for testing
            const getPreferredChannels = (fallbackService as any).getPreferredChannels.bind(fallbackService);

            const channels = getPreferredChannels(testContact);

            expect(channels).toEqual([activity_type.SMS, activity_type.Email]);
        });

        it("should use default channel order when no preferences set", () => {
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: "test@company.com",
                mobile: "+1234567890",
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: [],
                customer_id: 1,
            };

            // Use reflection to access private method for testing
            const getPreferredChannels = (fallbackService as any).getPreferredChannels.bind(fallbackService);

            const channels = getPreferredChannels(testContact);

            expect(channels).toEqual([activity_type.Email, activity_type.SMS]);
        });

        it("should only include channels with valid contact information", () => {
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: "test@company.com",
                mobile: null, // No mobile
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: ["SMS", "Email"],
                customer_id: 1,
            };

            // Use reflection to access private method for testing
            const getPreferredChannels = (fallbackService as any).getPreferredChannels.bind(fallbackService);

            const channels = getPreferredChannels(testContact);

            expect(channels).toEqual([activity_type.Email]); // Only email should be included
        });

        it("should handle WhatsApp channels correctly", () => {
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: "test@company.com",
                mobile: "+1234567890",
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: ["WhatsApp", "SMS", "Email"],
                customer_id: 1,
            };

            // Use reflection to access private method for testing
            const getPreferredChannels = (fallbackService as any).getPreferredChannels.bind(fallbackService);

            const channels = getPreferredChannels(testContact);

            expect(channels).toEqual([activity_type.WhatsApp, activity_type.SMS, activity_type.Email]);
        });

        it("should handle mixed valid/invalid channels", () => {
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: null, // No email
                mobile: "+1234567890",
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: ["Email", "SMS", "WhatsApp"],
                customer_id: 1,
            };

            // Use reflection to access private method for testing
            const getPreferredChannels = (fallbackService as any).getPreferredChannels.bind(fallbackService);

            const channels = getPreferredChannels(testContact);

            expect(channels).toEqual([activity_type.SMS, activity_type.WhatsApp]); // Only mobile-based channels
        });
    });

    describe("Escalation Level Logic", () => {
        it("should return correct escalation levels", () => {
            // Use reflection to access private method for testing
            const getEscalationLevel = (fallbackService as any).getEscalationLevel.bind(fallbackService);

            expect(getEscalationLevel(contact_priority.Primary)).toBe(1);
            expect(getEscalationLevel(contact_priority.Secondary)).toBe(2);
            expect(getEscalationLevel(contact_priority.Emergency)).toBe(3);
        });

        it("should handle unknown priority levels", () => {
            // Use reflection to access private method for testing
            const getEscalationLevel = (fallbackService as any).getEscalationLevel.bind(fallbackService);

            // Test with undefined/null priority
            expect(getEscalationLevel(undefined as any)).toBe(1);
            expect(getEscalationLevel(null as any)).toBe(1);
        });
    });

    describe("Content Replacement", () => {
        it("should replace contact-specific content correctly", async () => {
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: "test@company.com",
                mobile: "+1234567890",
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: ["Email", "SMS"],
                customer_id: 1,
            };

            const content = "Hello {first_name}, this is a test message for {contact_name}";

            // Use reflection to access private method for testing
            const replaceContactContent = (fallbackService as any).replaceContactContent.bind(fallbackService);

            const result = await replaceContactContent(content, testContact);

            expect(result).toBe("Hello John, this is a test message for John");
        });

        it("should handle missing contact names gracefully", async () => {
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: "test@company.com",
                mobile: "+1234567890",
                first_name: null, // No first name
                escalation_delay_hours: 24,
                preferred_channels: ["Email", "SMS"],
                customer_id: 1,
            };

            const content = "Hello {first_name}, this is a test message for {contact_name}";

            // Use reflection to access private method for testing
            const replaceContactContent = (fallbackService as any).replaceContactContent.bind(fallbackService);

            const result = await replaceContactContent(content, testContact);

            expect(result).toBe("Hello , this is a test message for ");
        });
    });

    describe("Channel Validation", () => {
        it("should throw error when no email address available for email channel", async () => {
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: null, // No email
                mobile: "+1234567890",
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: ["Email"],
                customer_id: 1,
            };

            // Use reflection to access private method for testing
            const sendViaChannel = (fallbackService as any).sendViaChannel.bind(fallbackService);

            await expect(sendViaChannel(
                1, // activityId
                testContact,
                activity_type.Email,
                "Test content",
                "Test title",
                "SMS content",
                1 // accountId
            )).rejects.toThrow("No email address available");
        });

        it("should throw error when no mobile number available for SMS channel", async () => {
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: "test@company.com",
                mobile: null, // No mobile
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: ["SMS"],
                customer_id: 1,
            };

            const { prisma } = await import("@/lib/prisma");
            vi.mocked(prisma.customer.findUnique).mockResolvedValue({
                id: 1,
                country_id: 1,
            } as any);

            // Use reflection to access private method for testing
            const sendViaChannel = (fallbackService as any).sendViaChannel.bind(fallbackService);

            await expect(sendViaChannel(
                1, // activityId
                testContact,
                activity_type.SMS,
                "Test content",
                "Test title",
                "SMS content",
                1 // accountId
            )).rejects.toThrow("No mobile number available");
        });

        it("should throw error for unsupported channel types", async () => {
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: "test@company.com",
                mobile: "+1234567890",
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: ["Email", "SMS"],
                customer_id: 1,
            };

            // Use reflection to access private method for testing
            const sendViaChannel = (fallbackService as any).sendViaChannel.bind(fallbackService);

            await expect(sendViaChannel(
                1, // activityId
                testContact,
                "UnsupportedChannel" as activity_type,
                "Test content",
                "Test title",
                "SMS content",
                1 // accountId
            )).rejects.toThrow("Unsupported channel: UnsupportedChannel");
        });
    });

    describe("Learning Data Integration", () => {
        it("should handle learning data update failures gracefully", async () => {
            const mockOutcome = {
                activity_id: 1,
                channel: activity_type.Email,
                success: false,
                delivery_status: delivery_status.Failed,
                cost: 0,
            };

            const { prisma } = await import("@/lib/prisma");

            // Mock the activity lookup
            vi.mocked(prisma.activity.findUnique).mockResolvedValue({
                id: 1,
                CustomerCollectionPeriod: {
                    Customer: {
                        id: 1,
                        account_id: 1,
                    },
                },
            } as any);
            vi.mocked(prisma.communicationLearningData.create).mockRejectedValue(new Error("Database error"));

            // Should not throw error
            await expect(intelligenceService.updateLearningData(1, mockOutcome)).resolves.not.toThrow();
        });
    });

    describe("Contact Response Handling", () => {
        it("should handle contact response correctly", async () => {
            const { prisma } = await import("@/lib/prisma");

            // Mock database calls
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

    describe("Fallback Logic Tests", () => {
        it("should demonstrate email to SMS fallback concept", () => {
            // This test demonstrates the fallback logic concept
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: "test@company.com",
                mobile: "+1234567890",
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: ["Email", "SMS"],
                customer_id: 1,
            };

            // Get preferred channels
            const getPreferredChannels = (fallbackService as any).getPreferredChannels.bind(fallbackService);
            const channels = getPreferredChannels(testContact);

            // Verify fallback order
            expect(channels).toEqual([activity_type.Email, activity_type.SMS]);

            // In a real scenario:
            // 1. Try Email first
            // 2. If Email fails, try SMS
            // 3. If both fail, return failure result
        });

        it("should demonstrate SMS to Email fallback concept", () => {
            // This test demonstrates the reverse fallback logic
            const testContact = {
                id: 1,
                priority_level: contact_priority.Primary,
                email: "test@company.com",
                mobile: "+1234567890",
                first_name: "John",
                escalation_delay_hours: 24,
                preferred_channels: ["SMS", "Email"],
                customer_id: 1,
            };

            // Get preferred channels
            const getPreferredChannels = (fallbackService as any).getPreferredChannels.bind(fallbackService);
            const channels = getPreferredChannels(testContact);

            // Verify fallback order
            expect(channels).toEqual([activity_type.SMS, activity_type.Email]);

            // In a real scenario:
            // 1. Try SMS first
            // 2. If SMS fails, try Email
            // 3. If both fail, return failure result
        });
    });
});