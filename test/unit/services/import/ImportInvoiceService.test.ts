import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportInvoiceService } from "@/server/services/import/ImportInvoiceService";
import { createPrismaMock } from "@/test/mocks/prisma";

const mockCreateMany = vi.fn();

const { prismaHolder } = vi.hoisted(() => ({
    prismaHolder: {
        prisma: null as ReturnType<typeof createPrismaMock> | null,
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    prismaHolder.prisma = createPrismaMock();
    return { prisma: prismaHolder.prisma };
});

vi.mock("@/server/services/InvoiceService", () => ({
    InvoiceService: vi.fn().mockImplementation(() => ({
        createMany: mockCreateMany,
    })),
}));

describe("ImportInvoiceService", () => {
    let mockPrisma: ReturnType<typeof createPrismaMock>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPrisma = prismaHolder.prisma!;
        // Default: no existing payment records
        mockPrisma.invoicePayment.findMany.mockResolvedValue([]);
        mockCreateMany.mockResolvedValue({
            results: [],
            affectedCustomerIds: [],
        });
    });

    it("sorts invoices before delegating to InvoiceService.createMany", async () => {
        const service = new ImportInvoiceService();
        await service.importInvoices([
            {
                account_id: 1,
                customer_number: "A",
                invoice_number: "INV-2",
                invoice_date: "2024-02-01",
                due_date: "2024-03-01",
                amount: 100,
            },
            {
                account_id: 1,
                customer_number: "A",
                invoice_number: "INV-1",
                invoice_date: "2024-01-01",
                due_date: "2024-02-01",
                amount: 50,
            },
        ]);

        expect(mockCreateMany).toHaveBeenCalledWith([
            expect.objectContaining({ invoice_number: "INV-1" }),
            expect.objectContaining({ invoice_number: "INV-2" }),
        ]);
    });

    it("normalizes billing catalog field names before createMany", async () => {
        const service = new ImportInvoiceService();
        await service.importInvoices([
            {
                account_id: 1,
                customer_number: "5405",
                invoice_number: "INV-1",
                invoice_date: "2026-06-22",
                due_date: "2026-07-02",
                base_amount: 5000,
                invoice_amount: 1000,
                currency: "GBP",
            } as unknown as import("@/server/services/InvoiceService").InvoiceInput,
        ]);

        expect(mockCreateMany).toHaveBeenCalledWith([
            expect.objectContaining({
                amount: 5000,
                customer_amount: 1000,
                customer_currency: "GBP",
            }),
        ]);
    });

    it("zeroes out total_paid for invoices that already have payment records (payments win)", async () => {
        // Simulate a deferred payment exists for INV-1 but not INV-2
        mockPrisma.invoicePayment.findMany.mockResolvedValue([
            { invoice_number: "INV-1" },
        ]);

        const service = new ImportInvoiceService();
        await service.importInvoices([
            {
                account_id: 1,
                customer_number: "A",
                invoice_number: "INV-1",
                invoice_date: "2024-01-01",
                due_date: "2024-02-01",
                amount: 1000,
                customer_total_paid: 500,
            },
            {
                account_id: 1,
                customer_number: "A",
                invoice_number: "INV-2",
                invoice_date: "2024-01-05",
                due_date: "2024-02-05",
                amount: 800,
                customer_total_paid: 800,
            },
        ]);

        const callArg = mockCreateMany.mock.calls[0][0] as any[];
        const inv1 = callArg.find((i: any) => i.invoice_number === "INV-1");
        const inv2 = callArg.find((i: any) => i.invoice_number === "INV-2");

        // INV-1 has a payment record — file totals should be zeroed
        expect(inv1?.customer_total_paid).toBe(0);
        expect(inv1?.total_paid).toBe(0);

        // INV-2 has no payment record — file totals should be preserved
        expect(inv2?.customer_total_paid).toBe(800);
    });

    it("passes through all invoices unchanged when no payment records exist", async () => {
        mockPrisma.invoicePayment.findMany.mockResolvedValue([]);

        const service = new ImportInvoiceService();
        await service.importInvoices([
            {
                account_id: 1,
                customer_number: "A",
                invoice_number: "INV-X",
                invoice_date: "2024-01-01",
                due_date: "2024-02-01",
                amount: 200,
                customer_total_paid: 100,
            },
        ]);

        const callArg = mockCreateMany.mock.calls[0][0] as any[];
        expect(callArg[0]?.customer_total_paid).toBe(100);
    });
});
