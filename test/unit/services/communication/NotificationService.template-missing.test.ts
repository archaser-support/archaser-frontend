import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { prisma } from "@/lib/prisma";
import NotificationService from "@/server/services/NotificationService";
import { createPrismaMock } from "@/test/mocks/prisma";

// Mock dependencies
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/UserService", () => ({
    getUsersByAccountId: vi.fn(),
}));

const mockLogMessage = vi.fn();
vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => ({
            logMessage: mockLogMessage,
        })),
    },
    LogLevel: {
        INFO: "INFO",
        ERROR: "ERROR",
        WARNING: "WARNING",
    },
}));

vi.mock("@/server/services/NotificationRealtimeService", () => ({
    default: {
        getInstance: vi.fn(() => ({
            triggerNotificationUpdate: vi.fn(),
        })),
    },
}));

describe("NotificationService - Template Missing Notifications", () => {
    let notificationService: NotificationService;
    let getUsersByAccountId: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockLogMessage.mockClear();
        notificationService = NotificationService.getInstance();
        const userServiceModule = await import("@/server/services/UserService");
        getUsersByAccountId = userServiceModule.getUsersByAccountId;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("createTemplateMissingNotification", () => {
        const mockAccount = {
            id: 1,
            name: "Test Account",
        };

        const mockUsers = [
            { id: "user1", account_id: 1, email: "user1@test.com" },
            { id: "user2", account_id: 1, email: "user2@test.com" },
        ];

        it("should create notifications for all users when template is missing", async () => {
            // Arrange
            vi.mocked(getUsersByAccountId).mockResolvedValue(mockUsers);
            (prisma.account.findUnique as any).mockResolvedValue(mockAccount);
            (prisma.notification.findMany as any).mockResolvedValue([]);
            (prisma.notification.create as any).mockImplementation((args: any) =>
                Promise.resolve({
                    id: `notification-${args.data.user_id}`,
                    ...args.data,
                    created_at: new Date(),
                })
            );

            // Act
            await notificationService.createTemplateMissingNotification(
                1, // accountId
                123, // customerId
                "John Doe", // customerName
                "Hebrew", // customerLanguage
                "Email", // activityType
                "Email", // channel
                456 // templateId
            );

            // Assert
            expect(vi.mocked(getUsersByAccountId)).toHaveBeenCalledWith(1);
            expect(prisma.account.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                select: { name: true },
            });
            expect(prisma.notification.create).toHaveBeenCalledTimes(2);

            // Verify notification content for first user
            const firstNotificationCall = (prisma.notification.create as any).mock.calls[0][0];
            expect(firstNotificationCall.data.title).toBe("Template Missing for Activity");
            expect(firstNotificationCall.data.message).toBe(
                "Could not create Email activity for John Doe in Hebrew because there is no template for Hebrew."
            );
            expect(firstNotificationCall.data.type).toBe("Primary");
            expect(firstNotificationCall.data.priority).toBe("High");
            expect(firstNotificationCall.data.user_id).toBe("user1");
            expect(firstNotificationCall.data.account_id).toBe(1);
            expect(firstNotificationCall.data.action_url).toBe("/app/customers/123?tab=general");
            expect(firstNotificationCall.data.metadata).toEqual({
                customerId: 123,
                customerName: "John Doe", // Uses the customerName parameter, not account name
                customerLanguage: "Hebrew",
                activityType: "Email",
                channel: "Email",
                templateId: 456,
            });
        });

        it("should handle SMS channel notifications", async () => {
            // Arrange
            vi.mocked(getUsersByAccountId).mockResolvedValue(mockUsers);
            (prisma.account.findUnique as any).mockResolvedValue(mockAccount);
            (prisma.notification.findMany as any).mockResolvedValue([]);
            (prisma.notification.create as any).mockResolvedValue({
                id: "notification-1",
                created_at: new Date(),
            });

            // Act
            await notificationService.createTemplateMissingNotification(
                1,
                123,
                "Jane Smith",
                "French",
                "SMS",
                "SMS",
                789
            );

            // Assert
            const notificationCall = (prisma.notification.create as any).mock.calls[0][0];
            expect(notificationCall.data.message).toContain("SMS activity");
            expect(notificationCall.data.message).toContain("French");
            expect(notificationCall.data.metadata.channel).toBe("SMS");
        });

        it("should handle WhatsApp channel notifications", async () => {
            // Arrange
            vi.mocked(getUsersByAccountId).mockResolvedValue(mockUsers);
            (prisma.account.findUnique as any).mockResolvedValue(mockAccount);
            (prisma.notification.findMany as any).mockResolvedValue([]);
            (prisma.notification.create as any).mockResolvedValue({
                id: "notification-1",
                created_at: new Date(),
            });

            // Act
            await notificationService.createTemplateMissingNotification(
                1,
                123,
                "Company Name",
                "Spanish",
                "WhatsApp",
                "WhatsApp",
                101
            );

            // Assert
            const notificationCall = (prisma.notification.create as any).mock.calls[0][0];
            expect(notificationCall.data.message).toContain("WhatsApp activity");
            expect(notificationCall.data.metadata.channel).toBe("WhatsApp");
        });

        it("should handle empty user list gracefully", async () => {
            // Arrange
            vi.mocked(getUsersByAccountId).mockResolvedValue([]);

            // Act
            await notificationService.createTemplateMissingNotification(
                1,
                123,
                "Test Customer",
                "Hebrew",
                "Email",
                "Email",
                456
            );

            // Assert
            expect(vi.mocked(getUsersByAccountId)).toHaveBeenCalledWith(1);
            expect(prisma.notification.create).not.toHaveBeenCalled();
            // Check that logMessage was called with WARNING
            expect(mockLogMessage).toHaveBeenCalledWith(
                expect.any(String), // LogLevel
                expect.stringContaining("No users found"),
                "NotificationService",
                expect.objectContaining({
                    accountId: 1,
                    customerId: 123,
                    customerLanguage: "Hebrew",
                })
            );
        });

        it("should filter users by userId when provided", async () => {
            // Arrange
            const singleUser = [{ id: "user1", account_id: 1 }];
            vi.mocked(getUsersByAccountId).mockResolvedValue(singleUser);
            (prisma.account.findUnique as any).mockResolvedValue(mockAccount);
            (prisma.notification.findMany as any).mockResolvedValue([]);
            (prisma.notification.create as any).mockResolvedValue({
                id: "notification-1",
                created_at: new Date(),
            });

            // Act
            await notificationService.createTemplateMissingNotification(
                1,
                123,
                "Test Customer",
                "Hebrew",
                "Email",
                "Email",
                456,
                "user1" // userId filter
            );

            // Assert
            expect(prisma.notification.create).toHaveBeenCalledTimes(1);
            const notificationCall = (prisma.notification.create as any).mock.calls[0][0];
            expect(notificationCall.data.user_id).toBe("user1");
        });

        it("should handle notification creation errors gracefully", async () => {
            // Arrange
            vi.mocked(getUsersByAccountId).mockResolvedValue(mockUsers);
            (prisma.account.findUnique as any).mockResolvedValue(mockAccount);
            (prisma.notification.findMany as any).mockResolvedValue([]);
            (prisma.notification.create as any)
                .mockRejectedValueOnce(new Error("Database error"))
                .mockResolvedValueOnce({
                    id: "notification-2",
                    created_at: new Date(),
                });

            // Act
            await notificationService.createTemplateMissingNotification(
                1,
                123,
                "Test Customer",
                "Hebrew",
                "Email",
                "Email",
                456
            );

            // Assert
            // Should not throw, should log error
            expect(prisma.notification.create).toHaveBeenCalledTimes(2);
            expect(mockLogMessage).toHaveBeenCalledWith(
                expect.any(String), // LogLevel
                expect.stringContaining("Failed to create template missing notification"),
                "NotificationService",
                expect.objectContaining({
                    userId: expect.any(String),
                    accountId: 1,
                    customerId: 123,
                })
            );
        });

        it("should use fallback customer name when customer not found", async () => {
            // Arrange
            vi.mocked(getUsersByAccountId).mockResolvedValue(mockUsers);
            (prisma.account.findUnique as any).mockResolvedValue(null);
            (prisma.notification.findMany as any).mockResolvedValue([]);
            (prisma.notification.create as any).mockResolvedValue({
                id: "notification-1",
                created_at: new Date(),
            });

            // Act
            await notificationService.createTemplateMissingNotification(
                1,
                123,
                "Test Customer",
                "Hebrew",
                "Email",
                "Email",
                456
            );

            // Assert
            const notificationCall = (prisma.notification.create as any).mock.calls[0][0];
            expect(notificationCall.data.metadata.customerName).toBe("Test Customer"); // Uses the customerName parameter
        });

        it("should handle complete service failure gracefully", async () => {
            // Arrange
            vi.mocked(getUsersByAccountId).mockRejectedValue(new Error("Service unavailable"));

            // Act & Assert - should not throw
            await expect(
                notificationService.createTemplateMissingNotification(
                    1,
                    123,
                    "Test Customer",
                    "Hebrew",
                    "Email",
                    "Email",
                    456
                )
            ).resolves.not.toThrow();

            expect(mockLogMessage).toHaveBeenCalledWith(
                expect.any(String), // LogLevel
                expect.stringContaining("Failed to create template missing notifications"),
                "NotificationService",
                expect.objectContaining({
                    accountId: 1,
                    customerId: 123,
                    customerLanguage: "Hebrew",
                })
            );
        });
    });
});

