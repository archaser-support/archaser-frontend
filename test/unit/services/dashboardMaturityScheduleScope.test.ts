import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    invoiceFindMany: vi.fn(),
    customerFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        invoice: {
            findMany: mocks.invoiceFindMany,
        },
        customer: {
            findMany: mocks.customerFindMany,
        },
    },
    defaultPrisma: {
        invoice: {
            findMany: mocks.invoiceFindMany,
        },
        customer: {
            findMany: mocks.customerFindMany,
        },
    },
}));

import {
    getInvoicesByMaturityRange,
    getReceivablesMaturityScheduleData,
} from "@/shared/services/dashboardService";

describe("maturity schedule account scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.invoiceFindMany.mockResolvedValue([]);
        mocks.customerFindMany.mockResolvedValue([]);
    });

    it("scopes child-view maturity range invoices to account and customer filters", async () => {
        await getInvoicesByMaturityRange(42, {}, "8-30 days", undefined, "child");

        expect(mocks.invoiceFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    account_id: 42,
                    Customer: expect.objectContaining({
                        AND: expect.arrayContaining([
                            {
                                collection_status: {
                                    in: ["Active", "Inactive"],
                                },
                            },
                        ]),
                    }),
                }),
            })
        );
    });

    it("scopes maturity schedule overview invoices to account in child view", async () => {
        await getReceivablesMaturityScheduleData(
            99,
            {},
            undefined,
            "child"
        );

        expect(mocks.invoiceFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    account_id: 99,
                }),
            })
        );
    });
});
