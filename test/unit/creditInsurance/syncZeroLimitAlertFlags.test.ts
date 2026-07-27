import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

import {
    isInvoiceEligibleForZeroLimitAlert,
    syncZeroLimitAlertFlagsForCustomer,
} from "@/server/services/creditInsurance/syncZeroLimitAlertFlags";
import { prisma } from "@/lib/prisma";

const prismaMock = prisma as any;

describe("syncZeroLimitAlertFlags", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("marks only non-closed invoices before the zero-limit date", () => {
        const zeroLimitDate = new Date("2026-05-10");

        expect(
            isInvoiceEligibleForZeroLimitAlert({
                status: "Due",
                invoiceDate: new Date("2026-05-09"),
                zeroLimitDate,
                approvedLimit: new Prisma.Decimal(0),
            })
        ).toBe(true);
        expect(
            isInvoiceEligibleForZeroLimitAlert({
                status: "Paid",
                invoiceDate: new Date("2026-05-09"),
                zeroLimitDate,
                approvedLimit: new Prisma.Decimal(0),
            })
        ).toBe(false);
        expect(
            isInvoiceEligibleForZeroLimitAlert({
                status: "Due",
                invoiceDate: new Date("2026-05-10"),
                zeroLimitDate,
                approvedLimit: new Prisma.Decimal(0),
            })
        ).toBe(false);
    });

    it("recomputes invoice flags and customer aggregate from source-of-truth", async () => {
        prismaMock.customerPolicy.findFirst.mockResolvedValue({
            id: 11,
            approved_limit: new Prisma.Decimal(0),
            zero_limit_date: new Date("2026-05-10"),
        });
        prismaMock.invoice.findMany.mockResolvedValue([
            {
                id: 1,
                status: "Due",
                invoice_date: new Date("2026-05-09"),
                zero_limit_alert: false,
            },
            {
                id: 2,
                status: "Due",
                invoice_date: new Date("2026-05-10"),
                zero_limit_alert: true,
            },
            {
                id: 3,
                status: "Paid",
                invoice_date: new Date("2026-05-01"),
                zero_limit_alert: true,
            },
        ]);

        const result = await syncZeroLimitAlertFlagsForCustomer({
            customerId: 42,
            dbClient: prismaMock as any,
        });

        expect(prismaMock.invoice.updateMany).toHaveBeenNthCalledWith(1, {
            where: { id: { in: [1] } },
            data: { zero_limit_alert: true },
        });
        expect(prismaMock.invoice.updateMany).toHaveBeenNthCalledWith(2, {
            where: { id: { in: [2, 3] } },
            data: { zero_limit_alert: false },
        });
        expect(prismaMock.customer.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: { zero_limit_alert_exist: true },
        });
        expect(result).toEqual({ zeroLimitAlertExist: true });
    });

    it("requires zero-limit date only when strict validation is requested", async () => {
        prismaMock.customerPolicy.findFirst.mockResolvedValue({
            id: 11,
            approved_limit: new Prisma.Decimal(0),
            zero_limit_date: null,
        });

        await expect(
            syncZeroLimitAlertFlagsForCustomer({
                customerId: 42,
                dbClient: prismaMock as any,
                validateZeroLimitDate: true,
            })
        ).rejects.toThrow(
            "Approve zero limit date is required when approved limit is 0"
        );
    });

    it("clears the customer aggregate when no invoices remain flagged", async () => {
        prismaMock.customerPolicy.findFirst.mockResolvedValue({
            id: 11,
            approved_limit: new Prisma.Decimal(0),
            zero_limit_date: new Date("2026-05-10"),
        });
        prismaMock.invoice.findMany.mockResolvedValue([
            {
                id: 3,
                status: "Paid",
                invoice_date: new Date("2026-05-01"),
                zero_limit_alert: true,
            },
        ]);

        const result = await syncZeroLimitAlertFlagsForCustomer({
            customerId: 42,
            dbClient: prismaMock as any,
        });

        expect(prismaMock.invoice.updateMany).toHaveBeenCalledWith({
            where: { id: { in: [3] } },
            data: { zero_limit_alert: false },
        });
        expect(prismaMock.customer.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: { zero_limit_alert_exist: false },
        });
        expect(result).toEqual({ zeroLimitAlertExist: false });
    });
});
