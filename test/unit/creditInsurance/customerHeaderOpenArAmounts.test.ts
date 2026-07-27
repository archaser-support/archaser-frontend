import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    invoiceFindMany: vi.fn(),
    queryRaw: vi.fn(),
    convertAmountToCurrencyLatestRate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        invoice: {
            findMany: mocks.invoiceFindMany,
        },
        $queryRaw: mocks.queryRaw,
    },
    defaultPrisma: {
        invoice: {
            findMany: mocks.invoiceFindMany,
        },
        $queryRaw: mocks.queryRaw,
    },
}));

vi.mock(
    "@/server/services/creditInsurance/customerCreditInsuranceHeaderAmounts",
    async (importOriginal) => {
        const actual = await importOriginal<
            typeof import("@/server/services/creditInsurance/customerCreditInsuranceHeaderAmounts")
        >();
        return {
            ...actual,
            convertAmountToCurrencyLatestRate:
                mocks.convertAmountToCurrencyLatestRate,
        };
    }
);

import { resolveCustomerHeaderOpenArAmounts } from "@/server/services/creditInsurance/openReceivableByCustomerCurrency";

const baseCustomer = {
    total_due_amount: 9_500,
    total_overdue_amount: 0,
    customer_due_currency1: "GBP",
    customer_due_amount1: 2_000,
    customer_overdue_currency1: null,
    customer_overdue_amount1: 0,
    customer_due_currency2: null,
    customer_due_amount2: 0,
    customer_overdue_currency2: null,
    customer_overdue_amount2: 0,
};

describe("resolveCustomerHeaderOpenArAmounts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns FX-aware primary and live secondary for three Due GBP invoices", async () => {
        mocks.invoiceFindMany.mockResolvedValue([
            {
                customer_id: 42,
                outstanding_debt: 0,
                customer_outstanding_debt: 1_000,
                amount: 1_000,
                customer_currency: "GBP",
            },
            {
                customer_id: 42,
                outstanding_debt: 0,
                customer_outstanding_debt: 1_000,
                amount: 1_000,
                customer_currency: "GBP",
            },
            {
                customer_id: 42,
                outstanding_debt: 0,
                customer_outstanding_debt: 1_000,
                amount: 1_000,
                customer_currency: "GBP",
            },
        ]);
        mocks.convertAmountToCurrencyLatestRate.mockResolvedValue(4_500);
        mocks.queryRaw.mockResolvedValue([{ ar: 3_000 }]);

        const result = await resolveCustomerHeaderOpenArAmounts({
            accountId: 1,
            customerId: 42,
            accountCurrency: "ILS",
            customer: baseCustomer,
        });

        expect(result.total_ar).toBe(13_500);
        expect(result.total_ar_secondary).toBe(3_000);
        expect(result.credit_insurance_secondary_currency).toBe("GBP");
        expect(mocks.convertAmountToCurrencyLatestRate).toHaveBeenCalledWith(
            "GBP",
            "ILS",
            1_000
        );
    });

    it("FX-converts foreign customer_outstanding_debt when outstanding_debt is zero", async () => {
        mocks.invoiceFindMany.mockResolvedValue([
            {
                customer_id: 7,
                outstanding_debt: 0,
                customer_outstanding_debt: 10_000,
                amount: 10_000,
                customer_currency: "GBP",
            },
        ]);
        mocks.convertAmountToCurrencyLatestRate.mockResolvedValue(50_000);
        mocks.queryRaw.mockResolvedValue([{ ar: 10_000 }]);

        const result = await resolveCustomerHeaderOpenArAmounts({
            accountId: 1,
            customerId: 7,
            accountCurrency: "ILS",
            customer: {
                ...baseCustomer,
                customer_due_amount1: 10_000,
            },
        });

        expect(result.total_ar).toBe(50_000);
        expect(mocks.convertAmountToCurrencyLatestRate).toHaveBeenCalledWith(
            "GBP",
            "ILS",
            10_000
        );
    });

    it("falls back to denormalized primary when live account-currency sum is zero", async () => {
        mocks.invoiceFindMany.mockResolvedValue([]);
        mocks.queryRaw.mockResolvedValue([{ ar: 0 }]);

        const result = await resolveCustomerHeaderOpenArAmounts({
            accountId: 1,
            customerId: 42,
            accountCurrency: "ILS",
            customer: baseCustomer,
        });

        expect(result.total_ar).toBe(9_500);
    });

    it("falls back to invoice buckets when live secondary sum is zero", async () => {
        mocks.invoiceFindMany.mockResolvedValue([
            {
                customer_id: 42,
                outstanding_debt: 13_500,
                customer_outstanding_debt: 3_000,
                amount: 3_000,
                customer_currency: "GBP",
            },
        ]);
        mocks.queryRaw.mockResolvedValue([{ ar: 0 }]);

        const result = await resolveCustomerHeaderOpenArAmounts({
            accountId: 1,
            customerId: 42,
            accountCurrency: "ILS",
            customer: {
                ...baseCustomer,
                customer_due_amount1: 3_000,
            },
        });

        expect(result.total_ar).toBe(13_500);
        expect(result.total_ar_secondary).toBe(3_000);
        expect(result.credit_insurance_secondary_currency).toBe("GBP");
    });

    it("returns single-currency amounts without secondary when only account currency applies", async () => {
        mocks.invoiceFindMany.mockResolvedValue([
            {
                customer_id: 42,
                outstanding_debt: 5_000,
                customer_outstanding_debt: 5_000,
                amount: 5_000,
                customer_currency: "ILS",
            },
        ]);
        mocks.queryRaw.mockResolvedValue([{ ar: 0 }]);

        const result = await resolveCustomerHeaderOpenArAmounts({
            accountId: 1,
            customerId: 42,
            accountCurrency: "ILS",
            customer: {
                total_due_amount: 5_000,
                total_overdue_amount: 0,
                customer_due_currency1: "ILS",
                customer_due_amount1: 5_000,
                customer_overdue_currency1: null,
                customer_overdue_amount1: 0,
                customer_due_currency2: null,
                customer_due_amount2: 0,
                customer_overdue_currency2: null,
                customer_overdue_amount2: 0,
            },
        });

        expect(result.total_ar).toBe(5_000);
        expect(result.total_ar_secondary).toBeNull();
        expect(result.credit_insurance_secondary_currency).toBeNull();
    });
});
