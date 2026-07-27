import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
    insurancePolicyFindUnique: vi.fn(),
    customerPolicyFindFirst: vi.fn(),
    customerTopUpFindFirst: vi.fn(),
    customerTopUpFindUnique: vi.fn(),
    customerTopUpCreate: vi.fn(),
    customerTopUpUpdate: vi.fn(),
    syncGap: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        insurancePolicy: { findUnique: mocks.insurancePolicyFindUnique },
        customerPolicy: { findFirst: mocks.customerPolicyFindFirst },
        customerTopUp: {
            findFirst: mocks.customerTopUpFindFirst,
            findUnique: mocks.customerTopUpFindUnique,
            create: mocks.customerTopUpCreate,
            update: mocks.customerTopUpUpdate,
        },
    },
}));

vi.mock(
    "@/server/services/creditInsurance/syncCreditInsuranceGapPipeline",
    () => ({
        syncCreditInsuranceGapPipelineForCustomer: mocks.syncGap,
    })
);

import { CustomerTopUpService } from "@/server/services/creditInsurance/CustomerTopUpService";

const effectiveTopUpPolicy = {
    id: 100,
    policy_kind: "TopUp",
    status: "Active",
    allow_concurrent_top_ups: true,
    parent_insurance_policy_id: 10,
    currency: "USD",
    account_id: 1,
    ParentInsurancePolicy: {
        id: 10,
        status: "Active",
        start_date: new Date("2026-01-01T00:00:00.000Z"),
        end_date: new Date("2026-12-31T00:00:00.000Z"),
    },
};

const createInput = {
    customerId: 5,
    insurancePolicyId: 100,
    topUpType: "Fixed" as const,
    topUpValue: new Prisma.Decimal(1000),
    currency: "USD",
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-30"),
};

describe("CustomerTopUpService effective policy validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
        mocks.syncGap.mockResolvedValue(undefined);
        mocks.customerTopUpCreate.mockResolvedValue({ id: 1 });
        mocks.customerTopUpUpdate.mockResolvedValue({ id: 1 });
        mocks.customerTopUpFindFirst.mockResolvedValue(null);
        mocks.customerPolicyFindFirst.mockResolvedValue({ id: 50 });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("create rejects top-up when parent is expired but still Active in DB", async () => {
        mocks.insurancePolicyFindUnique.mockResolvedValue({
            ...effectiveTopUpPolicy,
            ParentInsurancePolicy: {
                ...effectiveTopUpPolicy.ParentInsurancePolicy,
                end_date: new Date("2026-06-20T00:00:00.000Z"),
            },
        });

        await expect(CustomerTopUpService.create(createInput)).rejects.toThrow(
            /must be effectively active/
        );
        expect(mocks.customerTopUpCreate).not.toHaveBeenCalled();
    });

    it("create succeeds when top-up policy and parent are effectively active", async () => {
        mocks.insurancePolicyFindUnique.mockResolvedValue(effectiveTopUpPolicy);

        const result = await CustomerTopUpService.create(createInput);

        expect(result).toEqual({ id: 1 });
        expect(mocks.customerTopUpCreate).toHaveBeenCalled();
    });

    it("update rejects changes when linked top-up policy is no longer effective", async () => {
        mocks.customerTopUpFindUnique.mockResolvedValue({
            id: 1,
            customer_id: 5,
            cancelled_at: null,
            InsurancePolicy: {
                ...effectiveTopUpPolicy,
                status: "Inactive",
            },
        });

        await expect(
            CustomerTopUpService.update(1, { notes: "extended" })
        ).rejects.toThrow(/must be effectively active/);
        expect(mocks.customerTopUpUpdate).not.toHaveBeenCalled();
    });

    it("update allows cancellation without effective policy check", async () => {
        mocks.customerTopUpFindUnique.mockResolvedValue({
            id: 1,
            customer_id: 5,
            cancelled_at: null,
            InsurancePolicy: {
                ...effectiveTopUpPolicy,
                status: "Inactive",
            },
        });

        await CustomerTopUpService.update(1, {
            cancelledAt: new Date("2026-06-21"),
        });

        expect(mocks.customerTopUpUpdate).toHaveBeenCalled();
        expect(mocks.customerPolicyFindFirst).not.toHaveBeenCalled();
    });
});
