import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationDeliveryIntent } from "@/server/services/creditInsurance/NotificationRuleEvaluator";

const mocks = vi.hoisted(() => ({
    evaluateCreditAccount: vi.fn(),
    getActiveQualificationKeys: vi.fn(),
    isActive: vi.fn(),
    recordDelivery: vi.fn(),
    clearStaleEntries: vi.fn(),
    createNotification: vi.fn(),
    sendCreditAlertEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", async (importOriginal) => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const actual = await importOriginal<typeof import("@/lib/prisma")>();
    return {
        ...actual,
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/creditInsurance/NotificationRuleEvaluator", () => ({
    NotificationRuleEvaluator: class {
        evaluateCreditAccount = mocks.evaluateCreditAccount;
        getActiveQualificationKeys = mocks.getActiveQualificationKeys;
    },
    PrismaNotificationRuleEvaluatorProvider: class {},
}));

vi.mock("@/server/services/creditInsurance/NotificationDeliveryLogService", () => ({
    NotificationDeliveryLogService: {
        getInstance: () => ({
            isActive: mocks.isActive,
            recordDelivery: mocks.recordDelivery,
            clearStaleEntries: mocks.clearStaleEntries,
        }),
    },
}));

vi.mock("@/server/services/NotificationService", () => ({
    default: {
        getInstance: () => ({
            createNotification: mocks.createNotification,
        }),
    },
}));

vi.mock("@/server/services/creditInsurance/CreditNotificationEmailService", () => ({
    CreditNotificationEmailService: class {
        sendCreditAlertEmail = mocks.sendCreditAlertEmail;
    },
}));

import { prisma } from "@/lib/prisma";
import { NotificationRuleDeliveryService } from "@/server/services/creditInsurance/NotificationRuleDeliveryService";

const sampleIntent: NotificationDeliveryIntent = {
    ruleSetId: 1,
    ruleId: 11,
    triggerType: "overdue_block",
    recipientUserId: "u1",
    channel: "in_app",
    dedupKey: "credit:overdue_block:customer:101:recipient:u1:channel:in_app",
    title: "Overdue block detected",
    message: "Customer 101 is in overdue block.",
    actionUrl: "/app/credit-dashboard/report?type=overdue",
    metadata: { customerId: 101 },
    priority: "High",
};

describe("NotificationRuleDeliveryService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.evaluateCreditAccount.mockResolvedValue([
            sampleIntent,
            {
                ...sampleIntent,
                channel: "email" as const,
                dedupKey:
                    "credit:overdue_block:customer:101:recipient:u1:channel:email",
            },
        ]);
        mocks.getActiveQualificationKeys.mockResolvedValue([
            {
                ruleId: 11,
                entityType: "customer",
                entityId: "101",
                offsetDays: null,
            },
        ]);
        mocks.isActive.mockResolvedValue(false);
        mocks.recordDelivery.mockResolvedValue(undefined);
        mocks.clearStaleEntries.mockResolvedValue(0);
        mocks.createNotification.mockResolvedValue({ id: "n1" });
        mocks.sendCreditAlertEmail.mockResolvedValue(true);
        (prisma as any).notificationRuleSet.count.mockResolvedValue(1);
        (prisma as any).account.findMany.mockResolvedValue([{ id: 55 }]);
    });

    it("delivers in-app and email intents with per-channel dedup ledger entries", async () => {
        const service = new NotificationRuleDeliveryService();
        const result = await service.processCreditAccount({ accountId: 55 });

        expect(result.delivered).toBe(2);
        expect(mocks.createNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "u1",
                accountId: 55,
                actionUrl: "/app/credit-dashboard/report?type=overdue",
                type: "Secondary",
            })
        );
        expect(mocks.sendCreditAlertEmail).toHaveBeenCalledWith({
            accountId: 55,
            intent: expect.objectContaining({ channel: "email" }),
        });
        expect(mocks.recordDelivery).toHaveBeenCalledTimes(2);
        expect(mocks.recordDelivery).toHaveBeenCalledWith(
            expect.objectContaining({
                accountId: 55,
                ruleId: 11,
                channel: "in_app",
                dedupKey: sampleIntent.dedupKey,
            })
        );
        expect(mocks.recordDelivery).toHaveBeenCalledWith(
            expect.objectContaining({
                channel: "email",
                dedupKey:
                    "credit:overdue_block:customer:101:recipient:u1:channel:email",
            })
        );
    });

    it("skips delivery when dedup key is already active", async () => {
        mocks.isActive.mockResolvedValue(true);
        const service = new NotificationRuleDeliveryService();
        const result = await service.processCreditAccount({ accountId: 55 });

        expect(result.delivered).toBe(0);
        expect(mocks.createNotification).not.toHaveBeenCalled();
        expect(mocks.sendCreditAlertEmail).not.toHaveBeenCalled();
        expect(mocks.recordDelivery).not.toHaveBeenCalled();
    });

    it("skips email ledger entry when email send fails", async () => {
        mocks.sendCreditAlertEmail.mockResolvedValue(false);
        mocks.evaluateCreditAccount.mockResolvedValue([
            {
                ...sampleIntent,
                channel: "email" as const,
                dedupKey:
                    "credit:overdue_block:customer:101:recipient:u1:channel:email",
            },
        ]);

        const service = new NotificationRuleDeliveryService();
        const result = await service.processCreditAccount({ accountId: 55 });

        expect(result.delivered).toBe(0);
        expect(mocks.recordDelivery).not.toHaveBeenCalled();
    });

    it("clears stale ledger entries after processing", async () => {
        const service = new NotificationRuleDeliveryService();
        await service.processCreditAccount({ accountId: 55 });

        expect(mocks.clearStaleEntries).toHaveBeenCalledWith(55, [
            {
                ruleId: 11,
                entityType: "customer",
                entityId: "101",
                offsetDays: null,
            },
        ]);
    });

    it("processes only credit-insurance accounts with enabled rules", async () => {
        (prisma as any).notificationRuleSet.count.mockResolvedValue(0);
        const service = new NotificationRuleDeliveryService();
        const result = await service.processAllCreditInsuranceAccounts();

        expect(result.accountsProcessed).toBe(0);
        expect(mocks.evaluateCreditAccount).not.toHaveBeenCalled();
    });
});
