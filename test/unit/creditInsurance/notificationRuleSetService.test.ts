import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationRuleSetService } from "@/server/services/creditInsurance/NotificationRuleSetService";
import { createPrismaMock } from "@/test/mocks/prisma";

describe("NotificationRuleSetService.seedDefaultCreditRuleSetsForAccount", () => {
    const tx = createPrismaMock() as any;

    beforeEach(() => {
        vi.clearAllMocks();
        tx.notificationRuleSet.upsert.mockImplementation(async ({ create }: any) => ({
            id: create.trigger_type === "action_window" ? 4 : 1,
            ...create,
        }));
        tx.notificationRule.upsert.mockResolvedValue({ id: 100 });
        tx.notificationRuleRoleDefault.createMany.mockResolvedValue({ count: 3 });
    });

    it("upserts five credit trigger sets and role defaults idempotently", async () => {
        await NotificationRuleSetService.seedDefaultCreditRuleSetsForAccount(
            tx,
            77,
            "system"
        );

        expect(tx.notificationRuleSet.upsert).toHaveBeenCalledTimes(5);
        expect(tx.notificationRule.upsert).toHaveBeenCalledTimes(5);
        expect(tx.notificationRuleRoleDefault.createMany).toHaveBeenCalledTimes(5);
        expect(tx.notificationRuleRoleDefault.createMany).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ skipDuplicates: true })
        );
    });
});
