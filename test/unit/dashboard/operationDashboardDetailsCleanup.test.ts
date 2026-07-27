import { describe, it, expect, vi } from "vitest";

import {
    isConvertedOperationDashboardDetailType,
    isOperationDashboardOrphanDetailType,
    OPERATION_DASHBOARD_ORPHAN_DETAIL_TYPES,
} from "@/shared/dashboard/operationDashboardDetailsLegacy";

vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: { findUnique: vi.fn(), findMany: vi.fn() },
        activity: { count: vi.fn(), findMany: vi.fn() },
        dispute: { count: vi.fn(), findMany: vi.fn() },
        customerCollectionPeriod: { count: vi.fn(), findMany: vi.fn() },
        customer: { count: vi.fn(), findMany: vi.fn() },
    },
}));

vi.mock("@/server/services/AccessControlService", () => ({
    AccessControlService: {
        getInstance: () => ({
            getOwnerFilter: vi.fn().mockResolvedValue({}),
        }),
    },
}));

vi.mock("@/server/services/PermissionService", () => ({
    PermissionService: {
        getInstance: () => ({
            hasPermission: vi.fn().mockResolvedValue(false),
        }),
    },
}));

describe("operationDashboardDetailsLegacy", () => {
    it("marks the eight wired KPI drills as converted", () => {
        for (const type of [
            "manual-activities",
            "total-calls",
            "activity-success-rate",
            "system-activities",
            "portal-activities",
            "disputes-created",
            "disputes-closed",
            "promises-to-pay",
        ]) {
            expect(isConvertedOperationDashboardDetailType(type)).toBe(true);
            expect(isOperationDashboardOrphanDetailType(type)).toBe(false);
        }
    });

    it("keeps orphan URL types on the legacy list", () => {
        for (const type of OPERATION_DASHBOARD_ORPHAN_DETAIL_TYPES) {
            expect(isOperationDashboardOrphanDetailType(type)).toBe(true);
            expect(isConvertedOperationDashboardDetailType(type)).toBe(false);
        }
    });
});

describe("getOperationDashboardDetails converted retirement", () => {
    it("returns empty without querying for converted drill types", async () => {
        const { getOperationDashboardDetails } = await import(
            "@/server/services/OperationDashboardService"
        );
        const { prisma } = await import("@/lib/prisma");

        const result = await getOperationDashboardDetails({
            account_id: 5,
            user_id: "user-1",
            type: "manual-activities",
            startDate: new Date("2026-07-01"),
            endDate: new Date("2026-07-12"),
        });

        expect(result).toEqual({ data: [], totalRecords: 0 });
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.user.findMany).not.toHaveBeenCalled();
        expect(prisma.activity.count).not.toHaveBeenCalled();
    });

    it("returns empty for promises-to-pay without CCP queries", async () => {
        const { getOperationDashboardDetails } = await import(
            "@/server/services/OperationDashboardService"
        );
        const { prisma } = await import("@/lib/prisma");

        const result = await getOperationDashboardDetails({
            account_id: 5,
            user_id: "user-1",
            type: "promises-to-pay",
        });

        expect(result).toEqual({ data: [], totalRecords: 0 });
        expect(prisma.customerCollectionPeriod.count).not.toHaveBeenCalled();
    });
});
