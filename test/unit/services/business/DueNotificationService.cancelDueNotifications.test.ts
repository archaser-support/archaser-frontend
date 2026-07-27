import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/EmailService", () => ({
    EmailService: class {},
}));

vi.mock("@/server/services/ActivityService", () => ({
    ActivityService: class {},
}));

vi.mock("@/server/services/SMSVendorService", () => ({
    SMSVendorService: class {},
}));

import { prisma } from "@/lib/prisma";
import { DueNotificationService } from "@/server/services/DueNotificationService";

describe("DueNotificationService.cancelDueNotificationsForInvoices", () => {
    let mockPrisma: any;
    let service: DueNotificationService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = prisma;
        mockPrisma.$transaction.mockImplementation((callback: any) =>
            callback(mockPrisma)
        );
        service = new DueNotificationService();
    });

    it("cancels and recreates due notifications inside a transaction", async () => {
        mockPrisma.invoice.findMany
            .mockResolvedValueOnce([
                { id: 1, invoice_number: "INV-1", customer_id: 42 },
            ])
            .mockResolvedValueOnce([{ id: 2, customer_id: 42 }]);
        mockPrisma.activity.findMany.mockResolvedValue([
            {
                id: 10,
                account_id: 7,
                customer_id: 42,
                type: "Email",
                status: "SCHEDULED",
                schedule_time: new Date("2024-01-20T10:00:00.000Z"),
                activity_sequence_id: 99,
                activity_template: null,
                collection_period_id: null,
                invoice_id: 1,
                title: "Due notification",
                content: "content",
                created_by: "system",
                title_params: { invoiceNumber: "INV-1, INV-2" },
                ActivityContact: [{ contact_id: 5 }],
            },
        ]);
        mockPrisma.activity.update.mockResolvedValue({});
        mockPrisma.invoice.findUnique.mockResolvedValue({
            due_notification_state: { "99": "scheduled" },
        });
        mockPrisma.invoice.update.mockResolvedValue({});
        mockPrisma.activity.create.mockResolvedValue({ id: 11 });

        await service.cancelDueNotificationsForInvoices([1]);

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.activity.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: {
                status: "CANCELLED",
                status_reason: "Related invoice(s) disputed",
                title: "{{activities.fields.activity_due_notification_canceled}}",
                title_params: { invoiceNumber: "INV-1, INV-2" },
            },
        });
        expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { due_notification_state: {} },
        });
        expect(mockPrisma.activity.create).toHaveBeenCalled();
    });
});
