import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getUserInfo: vi.fn(),
    getEffectiveUserId: vi.fn(),
    hasPermission: vi.fn(),
    getCreditRuleSets: vi.fn(),
    updateCreditRuleSet: vi.fn(),
}));

vi.mock("next-auth", () => ({
    getServerSession: vi.fn(),
}));

vi.mock("@/server/auth/authOptions", () => ({
    authOptions: {},
}));

vi.mock("@/lib/prisma", async (importOriginal) => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const actual = await importOriginal<typeof import("@/lib/prisma")>();
    return {
        ...actual,
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/AccessControlService", () => ({
    AccessControlService: {
        getInstance: () => ({
            getUserInfo: mocks.getUserInfo,
            getEffectiveUserId: mocks.getEffectiveUserId,
        }),
    },
}));

vi.mock("@/server/services/PermissionService", () => ({
    PermissionService: {
        getInstance: () => ({
            hasPermission: mocks.hasPermission,
        }),
    },
}));

vi.mock("@/server/services/creditInsurance/NotificationRuleSetService", () => ({
    NotificationRuleSetService: {
        getCreditRuleSets: mocks.getCreditRuleSets,
        updateCreditRuleSet: mocks.updateCreditRuleSet,
    },
}));

import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import getHandler from "@/pages/api/entities/accounts/[accountId]/notification-rule-sets";
import putHandler from "@/pages/api/entities/accounts/[accountId]/notification-rule-sets/[setId]";

describe("notification rule sets account APIs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
        mocks.getUserInfo.mockResolvedValue({
            accountId: 55,
            role: "CFO",
            viewAsUserRole: null,
        });
        mocks.getEffectiveUserId.mockReturnValue("u1");
        (prisma as any).account.findUnique.mockResolvedValue({
            has_credit_insurance: true,
        });
    });

    it("returns seeded sets for GET with view_settings permission", async () => {
        mocks.hasPermission.mockResolvedValue(true);
        mocks.getCreditRuleSets.mockResolvedValue([
            { id: 1, trigger_type: "action_window", enabled: true },
        ]);

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "GET",
            query: { accountId: "55", product: "credit_insurance" },
        });

        await getHandler(req, res);

        expect(res._getStatusCode()).toBe(200);
        expect(mocks.getCreditRuleSets).toHaveBeenCalledWith(55);
    });

    it("updates and returns sets for PUT with update_insurance_policy permission", async () => {
        mocks.hasPermission.mockResolvedValue(true);
        mocks.updateCreditRuleSet.mockResolvedValue([
            { id: 1, trigger_type: "action_window", enabled: false },
        ]);

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "PUT",
            query: { accountId: "55", setId: "1" },
            body: {
                enabled: false,
                advance_day_offsets: [14, 7, 3],
                user_override_user_ids: ["u2"],
            },
        });

        await putHandler(req, res);

        expect(res._getStatusCode()).toBe(200);
        expect(mocks.updateCreditRuleSet).toHaveBeenCalledWith(
            expect.objectContaining({
                accountId: 55,
                setId: 1,
                enabled: false,
            })
        );
    });

    it("rejects PUT when caller lacks write permission", async () => {
        mocks.hasPermission.mockResolvedValue(false);

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "PUT",
            query: { accountId: "55", setId: "1" },
            body: { enabled: false },
        });

        await putHandler(req, res);

        expect(res._getStatusCode()).toBe(403);
    });
});
