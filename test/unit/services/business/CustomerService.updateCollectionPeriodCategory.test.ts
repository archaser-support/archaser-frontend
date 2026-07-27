import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    logMessage: vi.fn().mockResolvedValue(undefined),
    createCategoryChangeActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", async (importOriginal) => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const actual = await importOriginal<typeof import("@/lib/prisma")>();
    return {
        ...actual,
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => ({
            logMessage: mocks.logMessage,
        })),
    },
}));

vi.mock("@/server/services/ActivityService", () => ({
    ActivityService: class {
        createCategoryChangeActivity = mocks.createCategoryChangeActivity;
    },
}));

import { prisma } from "@/lib/prisma";
import { createPrismaMock } from "@/test/mocks/prisma";
import { CustomerService } from "@/server/services/CustomerService";

describe("CustomerService.updateCollectionPeriodCategory", () => {
    let service: CustomerService;
    let mockPrisma: ReturnType<typeof createPrismaMock>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = prisma as any;
        service = new CustomerService();
    });

    it("rejects manual category changes for credit-only accounts", async () => {
        mockPrisma.account.findUnique.mockResolvedValueOnce({
            has_collection: false,
            has_credit_insurance: true,
        });

        await expect(
            service.updateCollectionPeriodCategory(
                10,
                "Agent",
                "Automated",
                99,
                501,
                { isManualCategoryChange: true }
            )
        ).rejects.toThrow(
            "Collection category changes are not available for credit-only accounts"
        );

        expect(mocks.createCategoryChangeActivity).not.toHaveBeenCalled();
    });

    it("allows automated category changes for credit-only accounts", async () => {
        mockPrisma.account.findUnique.mockResolvedValueOnce({
            has_collection: false,
            has_credit_insurance: true,
        });
        mockPrisma.customerCollectionPeriod.update.mockResolvedValueOnce({
            id: 10,
            current_category: "Agent",
            previous_category: "Automated",
            modified_at: new Date(),
        });

        await service.updateCollectionPeriodCategory(
            10,
            "Agent",
            "Automated",
            99,
            501,
            { isManualCategoryChange: false }
        );

        expect(mockPrisma.account.findUnique).not.toHaveBeenCalled();
        expect(mocks.createCategoryChangeActivity).toHaveBeenCalled();
    });
});
