import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPrismaMock } from "@/test/mocks/prisma";

const { prismaHolder } = vi.hoisted(() => ({
    prismaHolder: {
        prisma: null as ReturnType<typeof createPrismaMock> | null,
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const prisma = createPrismaMock();
    prismaHolder.prisma = prisma;
    return { prisma };
});

import { clearCustomerExcludedFromPolicyFlagWhenIncluded } from "@/server/services/creditInsurance/syncInvoiceReportingBreach";

describe("clearCustomerExcludedFromPolicyFlagWhenIncluded", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("clears the flag on all invoices when the customer is included", async () => {
        prismaHolder.prisma!.customerPolicy.findFirst.mockResolvedValue({
            excluded_from_policy: false,
        });
        prismaHolder.prisma!.invoice.updateMany.mockResolvedValue({ count: 3 });

        const cleared = await clearCustomerExcludedFromPolicyFlagWhenIncluded(
            100,
            prismaHolder.prisma as never
        );

        expect(cleared).toBe(3);
        expect(prismaHolder.prisma!.invoice.updateMany).toHaveBeenCalledWith({
            where: {
                customer_id: 100,
                ctv_customer_excluded_from_policy: true,
            },
            data: { ctv_customer_excluded_from_policy: false },
        });
    });

    it("keeps the flag while the customer is still excluded", async () => {
        prismaHolder.prisma!.customerPolicy.findFirst.mockResolvedValue({
            excluded_from_policy: true,
        });

        const cleared = await clearCustomerExcludedFromPolicyFlagWhenIncluded(
            100,
            prismaHolder.prisma as never
        );

        expect(cleared).toBe(0);
        expect(prismaHolder.prisma!.invoice.updateMany).not.toHaveBeenCalled();
    });

    it("clears the flag when the customer has no active policy row", async () => {
        prismaHolder.prisma!.customerPolicy.findFirst.mockResolvedValue(null);
        prismaHolder.prisma!.invoice.updateMany.mockResolvedValue({ count: 0 });

        const cleared = await clearCustomerExcludedFromPolicyFlagWhenIncluded(
            100,
            prismaHolder.prisma as never
        );

        expect(cleared).toBe(0);
        expect(prismaHolder.prisma!.invoice.updateMany).toHaveBeenCalled();
    });
});
