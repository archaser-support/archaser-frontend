import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReportService } from "@/server/services/ReportService";
import { MAIN_REPORTS_MENU_CONTEXT } from "@/shared/utils/viewConfigs";

vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => ({ logMessage: vi.fn() })),
    },
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        report: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}));

describe("ReportService.listReports main menu context", () => {
    const service = ReportService.getInstance();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("filters to reports menu context for regular account users", async () => {
        const { prisma } = await import("@/lib/prisma");

        (prisma.report.findMany as any).mockResolvedValue([]);
        (prisma.report.count as any).mockResolvedValue(0);

        await service.listReports(20001, "user-1", "Account Admin");

        expect(prisma.report.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    context: MAIN_REPORTS_MENU_CONTEXT,
                }),
            })
        );
    });

    it("does not apply main menu context filter for archaser admin account", async () => {
        const { prisma } = await import("@/lib/prisma");

        (prisma.report.findMany as any).mockResolvedValue([]);
        (prisma.report.count as any).mockResolvedValue(0);

        await service.listReports(10013, "admin-1", "archaser_admin");

        const call = (prisma.report.findMany as any).mock.calls[0][0];
        expect(call.where.context).toBeUndefined();
    });

    it("uses explicit context query when provided", async () => {
        const { prisma } = await import("@/lib/prisma");

        (prisma.report.findMany as any).mockResolvedValue([]);
        (prisma.report.count as any).mockResolvedValue(0);

        await service.listReports(20001, "user-1", "Account Admin", {
            context: "customers",
        });

        expect(prisma.report.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    context: "customers",
                }),
            })
        );
    });
});
