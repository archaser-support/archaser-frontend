import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationDeliveryLogService } from "@/server/services/creditInsurance/NotificationDeliveryLogService";
import { createPrismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/prisma", async (importOriginal) => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const actual = await importOriginal<typeof import("@/lib/prisma")>();
    return {
        ...actual,
        prisma: createPrismaMock(),
    };
});

import { prisma } from "@/lib/prisma";

describe("NotificationDeliveryLogService", () => {
    let service: NotificationDeliveryLogService;
    let mockPrisma: ReturnType<typeof createPrismaMock>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = prisma as ReturnType<typeof createPrismaMock>;
        service = NotificationDeliveryLogService.getInstance();
    });

    it("detects active dedup keys from uncleared log rows", async () => {
        mockPrisma.notificationDeliveryLog.findFirst.mockResolvedValueOnce({
            id: 1n,
        });

        const active = await service.isActive("credit:overdue_block:customer:1");

        expect(active).toBe(true);
        expect(mockPrisma.notificationDeliveryLog.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    cleared_at: null,
                    metadata: {
                        path: ["dedupKey"],
                        equals: "credit:overdue_block:customer:1",
                    },
                }),
            })
        );
    });

    it("records in-app delivery with dedup metadata", async () => {
        await service.recordDelivery({
            accountId: 10,
            ruleId: 5,
            entityType: "customer",
            entityId: "101",
            offsetDays: null,
            dedupKey: "credit:overdue_block:customer:101:recipient:u1:channel:in_app",
            channel: "in_app",
            metadata: { customerId: 101 },
        });

        expect(mockPrisma.notificationDeliveryLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                account_id: 10,
                rule_id: 5,
                entity_type: "customer",
                entity_id: "101",
                channel: "in_app",
                metadata: expect.objectContaining({
                    dedupKey:
                        "credit:overdue_block:customer:101:recipient:u1:channel:in_app",
                    customerId: 101,
                }),
            }),
        });
    });

    it("records email delivery with channel", async () => {
        await service.recordDelivery({
            accountId: 10,
            ruleId: 5,
            entityType: "customer",
            entityId: "101",
            offsetDays: null,
            dedupKey: "credit:overdue_block:customer:101:recipient:u1:channel:email",
            channel: "email",
        });

        expect(mockPrisma.notificationDeliveryLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                channel: "email",
            }),
        });
    });

    it("clears stale active logs when qualification no longer matches", async () => {
        mockPrisma.notificationDeliveryLog.findMany.mockResolvedValueOnce([
            {
                id: 1n,
                rule_id: 5,
                entity_type: "customer",
                entity_id: "101",
                offset_days: null,
            },
            {
                id: 2n,
                rule_id: 5,
                entity_type: "customer",
                entity_id: "102",
                offset_days: null,
            },
        ]);

        const cleared = await service.clearStaleEntries(10, [
            {
                ruleId: 5,
                entityType: "customer",
                entityId: "101",
                offsetDays: null,
            },
        ]);

        expect(cleared).toBe(1);
        expect(mockPrisma.notificationDeliveryLog.updateMany).toHaveBeenCalledWith({
            where: { id: { in: [2n] } },
            data: expect.objectContaining({
                cleared_at: expect.any(Date),
            }),
        });
    });
});
