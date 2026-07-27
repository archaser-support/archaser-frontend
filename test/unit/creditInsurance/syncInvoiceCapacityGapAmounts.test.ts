import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, invoice_status } from "@prisma/client";

const mocks = vi.hoisted(() => ({
    customerFindUnique: vi.fn(),
    customerPolicyFindFirst: vi.fn(),
    invoiceFindMany: vi.fn(),
    invoiceUpdate: vi.fn(),
    currencyRateFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        customer: { findUnique: mocks.customerFindUnique },
        customerPolicy: { findFirst: mocks.customerPolicyFindFirst },
        invoice: {
            findMany: mocks.invoiceFindMany,
            update: mocks.invoiceUpdate,
        },
        currencyRate: { findMany: mocks.currencyRateFindMany },
    },
}));

import { syncInvoiceCapacityGapAmountsForCustomer } from "@/server/services/creditInsurance/syncInvoiceCapacityGapAmounts";

describe("syncInvoiceCapacityGapAmountsForCustomer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.customerFindUnique.mockResolvedValue({
            id: 1,
            account_id: 10,
            Account: {
                currency: "ILS",
                has_credit_insurance: true,
            },
        });
        mocks.customerPolicyFindFirst.mockResolvedValue({
            insurance_policy_id: 5,
            policy_exclusion_reason: null,
        });
        mocks.currencyRateFindMany.mockResolvedValue([]);
        mocks.invoiceUpdate.mockResolvedValue({});
    });

    it("persists dual-currency gap on open invoices with limit snapshots", async () => {
        mocks.invoiceFindMany.mockResolvedValue([
            {
                id: 100,
                status: invoice_status.Due,
                policy_id: 5,
                outstanding_debt: 3136,
                customer_outstanding_debt: 800,
                limit_assessed_amount: new Prisma.Decimal(500),
                limit_assessed_currency: "EUR",
                capacity_gap_amount: null,
                capacity_gap_amount_limit: null,
            },
        ]);

        await syncInvoiceCapacityGapAmountsForCustomer(1);

        expect(mocks.invoiceUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 100 },
                data: expect.objectContaining({
                    capacity_gap_amount_limit: expect.any(Prisma.Decimal),
                    capacity_gap_amount: expect.any(Prisma.Decimal),
                }),
            })
        );
    });

    it("zeros gap fields on closed invoices", async () => {
        mocks.invoiceFindMany.mockResolvedValue([
            {
                id: 101,
                status: invoice_status.Paid,
                policy_id: 5,
                outstanding_debt: 0,
                customer_outstanding_debt: 0,
                limit_assessed_amount: new Prisma.Decimal(500),
                limit_assessed_currency: "EUR",
                capacity_gap_amount: new Prisma.Decimal(100),
                capacity_gap_amount_limit: new Prisma.Decimal(50),
            },
        ]);

        await syncInvoiceCapacityGapAmountsForCustomer(1);

        expect(mocks.invoiceUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 101 },
                data: expect.objectContaining({
                    capacity_gap_amount: expect.any(Prisma.Decimal),
                    capacity_gap_amount_limit: expect.any(Prisma.Decimal),
                }),
            })
        );
        const updateArg = mocks.invoiceUpdate.mock.calls[0]![0];
        expect(updateArg.data.capacity_gap_amount.toNumber()).toBe(0);
        expect(updateArg.data.capacity_gap_amount_limit.toNumber()).toBe(0);
    });

    it("zeros open invoice gaps for uncovered excluded customers even with policy_id", async () => {
        mocks.customerPolicyFindFirst.mockResolvedValue({
            insurance_policy_id: 5,
            policy_exclusion_reason: "Insurer declined",
        });
        mocks.invoiceFindMany.mockResolvedValue([
            {
                id: 102,
                status: invoice_status.Due,
                policy_id: 5,
                outstanding_debt: 5000,
                customer_outstanding_debt: 5000,
                limit_assessed_amount: new Prisma.Decimal(1000),
                limit_assessed_currency: "EUR",
                capacity_gap_amount: new Prisma.Decimal(4000),
                capacity_gap_amount_limit: new Prisma.Decimal(3000),
            },
        ]);

        await syncInvoiceCapacityGapAmountsForCustomer(1);

        expect(mocks.invoiceUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 102 },
                data: expect.objectContaining({
                    capacity_gap_amount: expect.any(Prisma.Decimal),
                    capacity_gap_amount_limit: expect.any(Prisma.Decimal),
                }),
            })
        );
        const updateArg = mocks.invoiceUpdate.mock.calls[0]![0];
        expect(updateArg.data.capacity_gap_amount.toNumber()).toBe(0);
        expect(updateArg.data.capacity_gap_amount_limit.toNumber()).toBe(0);
    });

    it("scopes recompute to invoiceIds when provided", async () => {
        mocks.invoiceFindMany.mockResolvedValue([]);

        await syncInvoiceCapacityGapAmountsForCustomer(1, {
            invoiceIds: [7, 8],
        });

        expect(mocks.invoiceFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: { in: [7, 8] },
                }),
            })
        );
    });
});
