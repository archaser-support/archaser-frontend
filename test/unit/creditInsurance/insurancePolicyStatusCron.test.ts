import { describe, expect, it, vi, beforeEach } from "vitest";

const updateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
    prisma: {
        insurancePolicy: {
            updateMany,
        },
    },
}));

describe("runInsurancePolicyStatusMaintenance", () => {
    beforeEach(() => {
        updateMany.mockReset();
        updateMany.mockResolvedValue({ count: 0 });
    });

    it("deactivates expired, premature active, activates scheduled, and syncs top-ups", async () => {
        const { runInsurancePolicyStatusMaintenance } = await import(
            "@/server/services/creditInsurance/insurancePolicyStatusCron"
        );

        await runInsurancePolicyStatusMaintenance();

        expect(updateMany).toHaveBeenCalledTimes(5);

        const expiredCall = updateMany.mock.calls[0][0];
        expect(expiredCall.where.policy_kind).toBe("Primary");
        expect(expiredCall.where.status).toBe("Active");
        expect(expiredCall.data.auto_activate_on_term_start).toBe(false);

        const prematureCall = updateMany.mock.calls[1][0];
        expect(prematureCall.where.start_date).toEqual({ gt: expect.any(Date) });
        expect(prematureCall.data.auto_activate_on_term_start).toBe(true);

        const activateCall = updateMany.mock.calls[2][0];
        expect(activateCall.where.auto_activate_on_term_start).toBe(true);
        expect(activateCall.where.status).toBe("Inactive");
        expect(activateCall.data.status).toBe("Active");
        expect(activateCall.data.auto_activate_on_term_start).toBe(false);

        const topUpDeactivateCall = updateMany.mock.calls[3][0];
        expect(topUpDeactivateCall.where.policy_kind).toBe("TopUp");

        const topUpActivateCall = updateMany.mock.calls[4][0];
        expect(topUpActivateCall.where.policy_kind).toBe("TopUp");
    });
});
