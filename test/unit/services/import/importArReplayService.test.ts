import { describe, expect, it, vi, beforeEach } from "vitest";

import {
    applyMaturedDeferredPayments,
    buildReplayEvents,
    compareReplayEvents,
    getInvoiceGap,
    replayCustomerArImport,
    simulateCustomerArReplay,
    sortReplayEvents,
    type ReplayEvent,
} from "@/server/services/import/importArReplayService";
import { createPrismaMock } from "@/test/mocks/prisma";

const { mockLinkDeferredPaymentAndRecalc } = vi.hoisted(() => ({
    mockLinkDeferredPaymentAndRecalc: vi.fn(),
}));

vi.mock("@/server/services/invoicePayment/linkDeferredPaymentAndRecalc", () => ({
    linkDeferredPaymentAndRecalc: mockLinkDeferredPaymentAndRecalc,
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

function d(iso: string): Date {
    const [y, mo, day] = iso.split("-").map(Number);
    return new Date(y, mo - 1, day);
}

describe("importArReplayService event ordering", () => {
    it("sorts by date ascending with invoice_open before payment_apply on same day", () => {
        const events: ReplayEvent[] = [
            {
                type: "payment_apply",
                date: d("2026-01-01"),
                payload: {
                    id: 1,
                    invoiceNumber: "5584561",
                    paymentDate: d("2026-01-01"),
                    amount: 50,
                    customerAmount: 50,
                },
            },
            {
                type: "invoice_open",
                date: d("2026-01-01"),
                payload: {
                    invoiceNumber: "5584561",
                    invoiceDate: d("2026-01-01"),
                    netAmount: 250,
                    customerNetAmount: 250,
                },
            },
        ];

        const sorted = sortReplayEvents(events);
        expect(sorted[0]?.type).toBe("invoice_open");
        expect(sorted[1]?.type).toBe("payment_apply");
    });

    it("compareReplayEvents is deterministic for mixed dates", () => {
        const earlier: ReplayEvent = {
            type: "payment_apply",
            date: d("2026-01-02"),
            payload: {
                id: 1,
                invoiceNumber: "A",
                paymentDate: d("2026-01-02"),
                amount: 1,
                customerAmount: 1,
            },
        };
        const later: ReplayEvent = {
            type: "invoice_open",
            date: d("2026-01-03"),
            payload: {
                invoiceNumber: "B",
                invoiceDate: d("2026-01-03"),
                netAmount: 100,
                customerNetAmount: 100,
            },
        };
        expect(compareReplayEvents(earlier, later)).toBeLessThan(0);
    });

    it("buildReplayEvents merges and sorts invoices and payments", () => {
        const events = buildReplayEvents(
            [
                {
                    invoiceNumber: "INV-2",
                    invoiceDate: d("2026-01-04"),
                    netAmount: 100,
                    customerNetAmount: 100,
                },
            ],
            [
                {
                    id: 10,
                    invoiceNumber: "INV-1",
                    paymentDate: d("2026-01-03"),
                    amount: 150,
                    customerAmount: 150,
                },
            ]
        );
        expect(events).toHaveLength(2);
        expect(events[0]?.type).toBe("payment_apply");
        expect(events[1]?.type).toBe("invoice_open");
    });
});

describe("simulateCustomerArReplay — grill-me Jan 2026 scenarios", () => {
    const config = { approvedLimit: 1_000_000 };

    it("5584561: stamp at Jan 1 with 250 open; after Jan 3 payment outstanding 100", () => {
        const { invoices } = simulateCustomerArReplay(
            config,
            [
                {
                    invoiceNumber: "5584561",
                    invoiceDate: d("2026-01-01"),
                    netAmount: 250,
                    customerNetAmount: 250,
                },
            ],
            [
                {
                    id: 1,
                    invoiceNumber: "5584561",
                    paymentDate: d("2026-01-03"),
                    amount: 150,
                    customerAmount: 150,
                },
            ]
        );

        const inv = invoices.find((i) => i.invoiceNumber === "5584561");
        expect(inv?.limitAssessedAmount).toBe(250);
        expect(inv?.outstanding).toBe(100);
        expect(getInvoiceGap(inv!)).toBe(0);
    });

    it("5584563: stamp at Jan 4 before payments; fully paid after second payment", () => {
        const { invoices, summary } = simulateCustomerArReplay(
            config,
            [
                {
                    invoiceNumber: "5584563",
                    invoiceDate: d("2026-01-04"),
                    netAmount: 1000,
                    customerNetAmount: 1000,
                },
            ],
            [
                {
                    id: 2,
                    invoiceNumber: "5584563",
                    paymentDate: d("2026-01-16"),
                    amount: 400,
                    customerAmount: 400,
                },
                {
                    id: 3,
                    invoiceNumber: "5584563",
                    paymentDate: d("2026-01-21"),
                    amount: 600,
                    customerAmount: 600,
                },
            ]
        );

        const inv = invoices.find((i) => i.invoiceNumber === "5584563");
        expect(inv?.limitAssessedAmount).toBe(1000);
        expect(inv?.outstanding).toBe(0);
        expect(summary.paymentsLinked).toBe(2);
        expect(summary.deferredRemaining).toBe(0);
    });

    it("5584564: stamp at Jan 5 full 900; payment applies on Jan 25 only", () => {
        const { invoices } = simulateCustomerArReplay(
            config,
            [
                {
                    invoiceNumber: "5584564",
                    invoiceDate: d("2026-01-05"),
                    netAmount: 900,
                    customerNetAmount: 900,
                },
            ],
            [
                {
                    id: 4,
                    invoiceNumber: "5584564",
                    paymentDate: d("2026-01-25"),
                    amount: 900,
                    customerAmount: 900,
                },
            ]
        );

        const inv = invoices.find((i) => i.invoiceNumber === "5584564");
        expect(inv?.limitAssessedAmount).toBe(900);
        expect(inv?.outstanding).toBe(0);
    });

    it("payment on invoice_date + 2 does not reduce stamp at invoice_date", () => {
        const { invoices } = simulateCustomerArReplay(
            { approvedLimit: 10_000 },
            [
                {
                    invoiceNumber: "INV-A",
                    invoiceDate: d("2026-01-10"),
                    netAmount: 500,
                    customerNetAmount: 500,
                },
            ],
            [
                {
                    id: 5,
                    invoiceNumber: "INV-A",
                    paymentDate: d("2026-01-12"),
                    amount: 200,
                    customerAmount: 200,
                },
            ]
        );

        const inv = invoices[0];
        expect(inv?.limitAssessedAmount).toBe(500);
        expect(inv?.outstanding).toBe(300);
    });

    it("two invoices same customer use cumulative open AR for second stamp", () => {
        const { invoices } = simulateCustomerArReplay(
            { approvedLimit: 10_000 },
            [
                {
                    invoiceNumber: "INV-1",
                    invoiceDate: d("2026-01-01"),
                    netAmount: 5_000,
                    customerNetAmount: 5_000,
                },
                {
                    invoiceNumber: "INV-2",
                    invoiceDate: d("2026-01-05"),
                    netAmount: 4_500,
                    customerNetAmount: 4_500,
                },
            ],
            []
        );

        const inv1 = invoices.find((i) => i.invoiceNumber === "INV-1");
        const inv2 = invoices.find((i) => i.invoiceNumber === "INV-2");
        expect(inv1?.limitAssessedAmount).toBe(5_000);
        expect(inv2?.limitAssessedAmount).toBe(4_500);
    });

    it("multiple payments on same invoice step outstanding down on respective dates", () => {
        const afterFirst = simulateCustomerArReplay(
            { approvedLimit: 50_000 },
            [
                {
                    invoiceNumber: "INV-P",
                    invoiceDate: d("2026-01-01"),
                    netAmount: 1000,
                    customerNetAmount: 1000,
                },
            ],
            [
                {
                    id: 6,
                    invoiceNumber: "INV-P",
                    paymentDate: d("2026-01-10"),
                    amount: 300,
                    customerAmount: 300,
                },
            ]
        );
        expect(
            afterFirst.invoices[0]?.outstanding
        ).toBe(700);

        const afterSecond = simulateCustomerArReplay(
            { approvedLimit: 50_000 },
            [
                {
                    invoiceNumber: "INV-P",
                    invoiceDate: d("2026-01-01"),
                    netAmount: 1000,
                    customerNetAmount: 1000,
                },
            ],
            [
                {
                    id: 6,
                    invoiceNumber: "INV-P",
                    paymentDate: d("2026-01-10"),
                    amount: 300,
                    customerAmount: 300,
                },
                {
                    id: 7,
                    invoiceNumber: "INV-P",
                    paymentDate: d("2026-01-20"),
                    amount: 700,
                    customerAmount: 700,
                },
            ]
        );
        expect(afterSecond.invoices[0]?.outstanding).toBe(0);
    });
});

describe("replayCustomerArImport", () => {
    let mockPrisma: ReturnType<typeof createPrismaMock>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { prisma } = await import("@/lib/prisma");
        mockPrisma = prisma as ReturnType<typeof createPrismaMock>;
        mockLinkDeferredPaymentAndRecalc.mockResolvedValue({
            alreadyLinked: false,
            invoicePayment: { id: 1 },
            updatedInvoice: { id: 10, outstanding_debt: 100 },
        });
    });

    it("links deferred payments via shared link-and-recalc helper", async () => {
        mockPrisma.customerPolicy.findFirst.mockResolvedValue({
            approved_limit: 1_000_000,
        });
        mockPrisma.invoice.findMany.mockResolvedValue([]);
        mockPrisma.invoicePayment.findMany.mockResolvedValue([]);
        mockPrisma.invoice.findFirst.mockResolvedValue({ id: 99 });
        mockPrisma.invoice.findUnique.mockResolvedValue({
            id: 99,
            outstanding_debt: 100,
        });
        mockPrisma.invoicePayment.count.mockResolvedValue(0);

        const summary = await replayCustomerArImport({
            customerId: 1111,
            accountId: 1,
            invoices: [
                {
                    invoiceNumber: "5584561",
                    invoiceDate: d("2026-01-01"),
                    netAmount: 250,
                    customerNetAmount: 250,
                    invoiceId: 99,
                },
            ],
            payments: [
                {
                    id: 50,
                    invoiceNumber: "5584561",
                    paymentDate: d("2026-01-03"),
                    amount: 150,
                    customerAmount: 150,
                    invoiceId: null,
                },
            ],
        });

        expect(mockLinkDeferredPaymentAndRecalc).toHaveBeenCalledWith({
            invoicePaymentId: 50,
            invoiceId: 99,
            forceRecalc: true,
        });
        expect(summary.paymentsLinked).toBe(1);
        expect(summary.eventsApplied).toBe(2);
    });

    it("force-recalculates when payment is already linked to invoice", async () => {
        mockPrisma.customerPolicy.findFirst.mockResolvedValue({
            approved_limit: 1_000_000,
        });
        mockPrisma.invoice.findMany.mockResolvedValue([]);
        mockPrisma.invoicePayment.findMany.mockResolvedValue([]);
        mockPrisma.invoice.findFirst.mockResolvedValue({ id: 99 });
        mockPrisma.invoice.findUnique.mockResolvedValue({
            id: 99,
            outstanding_debt: 100,
        });
        mockPrisma.invoicePayment.count.mockResolvedValue(0);
        mockLinkDeferredPaymentAndRecalc.mockResolvedValue({
            alreadyLinked: true,
            invoicePayment: { id: 50 },
            updatedInvoice: { id: 99, outstanding_debt: 100 },
        });

        await replayCustomerArImport({
            customerId: 1111,
            accountId: 1,
            invoices: [
                {
                    invoiceNumber: "5584561",
                    invoiceDate: d("2026-01-01"),
                    netAmount: 250,
                    customerNetAmount: 250,
                    invoiceId: 99,
                },
            ],
            payments: [
                {
                    id: 50,
                    invoiceNumber: "5584561",
                    paymentDate: d("2026-01-03"),
                    amount: 150,
                    customerAmount: 150,
                    invoiceId: 99,
                },
            ],
        });

        expect(mockLinkDeferredPaymentAndRecalc).toHaveBeenCalledWith({
            invoicePaymentId: 50,
            invoiceId: 99,
            forceRecalc: true,
        });
    });

    it("counts deferred remaining when invoice is still missing at payment event", async () => {
        mockPrisma.customerPolicy.findFirst.mockResolvedValue({
            approved_limit: 1_000_000,
        });
        mockPrisma.invoice.findMany.mockResolvedValue([]);
        mockPrisma.invoicePayment.findMany.mockResolvedValue([]);
        mockPrisma.invoice.findFirst.mockResolvedValue(null);
        mockPrisma.invoicePayment.count.mockResolvedValue(1);

        const summary = await replayCustomerArImport({
            customerId: 1111,
            accountId: 1,
            invoices: [],
            payments: [
                {
                    id: 60,
                    invoiceNumber: "MISSING",
                    paymentDate: d("2026-01-03"),
                    amount: 100,
                    customerAmount: 100,
                    invoiceId: null,
                },
            ],
        });

        expect(mockLinkDeferredPaymentAndRecalc).not.toHaveBeenCalled();
        expect(summary.deferredRemaining).toBeGreaterThanOrEqual(1);
    });
});

describe("applyMaturedDeferredPayments", () => {
    let mockPrisma: ReturnType<typeof createPrismaMock>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { prisma } = await import("@/lib/prisma");
        mockPrisma = prisma as ReturnType<typeof createPrismaMock>;
        mockLinkDeferredPaymentAndRecalc.mockResolvedValue({
            alreadyLinked: false,
            invoicePayment: { id: 1 },
            updatedInvoice: { id: 10, outstanding_debt: 0 },
        });
    });

    const asOf = d("2026-07-01");

    it("links deferred payments when invoice exists and payment_date <= asOf", async () => {
        mockPrisma.invoicePayment.findMany.mockResolvedValue([
            {
                id: 100,
                invoice_number: "INV-001",
                customer_id: 42,
            },
        ]);
        mockPrisma.invoice.findFirst.mockResolvedValue({ id: 77 });
        mockPrisma.invoicePayment.count.mockResolvedValue(0);

        const result = await applyMaturedDeferredPayments(1, asOf);

        expect(mockLinkDeferredPaymentAndRecalc).toHaveBeenCalledWith({
            invoicePaymentId: 100,
            invoiceId: 77,
        });
        expect(result.matured).toBe(1);
        expect(result.deferredRemaining).toBe(0);
    });

    it("skips deferred payments when matching invoice does not yet exist", async () => {
        mockPrisma.invoicePayment.findMany.mockResolvedValue([
            {
                id: 200,
                invoice_number: "INV-MISSING",
                customer_id: 42,
            },
        ]);
        mockPrisma.invoice.findFirst.mockResolvedValue(null);
        mockPrisma.invoicePayment.count.mockResolvedValue(1);

        const result = await applyMaturedDeferredPayments(1, asOf);

        expect(mockLinkDeferredPaymentAndRecalc).not.toHaveBeenCalled();
        expect(result.matured).toBe(0);
        expect(result.deferredRemaining).toBe(1);
    });

    it("is idempotent — counts alreadyLinked rows without incrementing matured", async () => {
        mockLinkDeferredPaymentAndRecalc.mockResolvedValueOnce({
            alreadyLinked: true,
            invoicePayment: { id: 300, invoice_id: 50 },
            updatedInvoice: { id: 50, outstanding_debt: 0 },
        });

        mockPrisma.invoicePayment.findMany.mockResolvedValue([
            {
                id: 300,
                invoice_number: "INV-LINKED",
                customer_id: 42,
            },
        ]);
        mockPrisma.invoice.findFirst.mockResolvedValue({ id: 50 });
        mockPrisma.invoicePayment.count.mockResolvedValue(0);

        const result = await applyMaturedDeferredPayments(1, asOf);

        expect(result.matured).toBe(0);
        expect(result.deferredRemaining).toBe(0);
    });

    it("returns zero matured when no deferred rows exist", async () => {
        mockPrisma.invoicePayment.findMany.mockResolvedValue([]);
        mockPrisma.invoicePayment.count.mockResolvedValue(0);

        const result = await applyMaturedDeferredPayments(1, asOf);

        expect(mockLinkDeferredPaymentAndRecalc).not.toHaveBeenCalled();
        expect(result.matured).toBe(0);
        expect(result.deferredRemaining).toBe(0);
    });
});
