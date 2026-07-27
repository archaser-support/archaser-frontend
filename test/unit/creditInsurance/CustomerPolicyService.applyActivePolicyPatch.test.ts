import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerPolicyService } from "@/server/services/creditInsurance/CustomerPolicyService";
import { createPrismaMock } from "@/test/mocks/prisma";

const { mocks, prismaHolder } = vi.hoisted(() => ({
    mocks: {
        getActiveCustomerPolicyRow: vi.fn(),
        freezeCustomerPolicyGapOnDeactivation: vi.fn(),
        findAssignablePrimaryPolicy: vi.fn(),
        syncInvoiceCapacityGapAmountsForCustomer: vi.fn(),
    },
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

vi.mock(
    "@/server/services/creditInsurance/resolveActiveCustomerPolicy",
    () => ({
        getActiveCustomerPolicyRow: mocks.getActiveCustomerPolicyRow,
        listCustomerPolicyHistory: vi.fn(),
    })
);

vi.mock(
    "@/server/services/creditInsurance/syncCustomerPolicyGapAmounts",
    () => ({
        freezeCustomerPolicyGapOnDeactivation:
            mocks.freezeCustomerPolicyGapOnDeactivation,
    })
);

vi.mock(
    "@/server/services/creditInsurance/syncInvoiceCapacityGapAmounts",
    () => ({
        syncInvoiceCapacityGapAmountsForCustomer:
            mocks.syncInvoiceCapacityGapAmountsForCustomer,
    })
);

vi.mock("@/server/services/InsurancePolicyService", () => ({
    InsurancePolicyService: {
        findAssignablePrimaryPolicy: mocks.findAssignablePrimaryPolicy,
    },
}));

vi.mock("@/server/services/creditInsurance/applyPolicyCountryDefaults", () => ({
    getPolicyCountryDefaultsForCustomer: vi.fn().mockResolvedValue(null),
}));

const activeRow = {
    id: 42,
    customer_id: 100,
    insurance_policy_id: 5,
    customer_number_policy: "CN-1",
    approved_limit: new Prisma.Decimal("10000"),
    approved_limit_currency: "USD",
    approved_limit_expiration_date: new Date("2027-06-01T00:00:00.000Z"),
    zero_limit_date: null,
    limit_type: "DCL" as const,
    max_payment_term: 30,
    max_allowed_mep: 90,
    reporting_days: 7,
    excluded_from_policy: false,
    policy_exclusion_reason: null,
    credit_score: new Prisma.Decimal("75"),
    credit_score_input_date: new Date("2026-01-15T00:00:00.000Z"),
    active_customer_since: new Date("2020-03-01T00:00:00.000Z"),
    outdated_dcl: false,
    capacity_gap_amount: 500,
    capacity_gap_amount_date: new Date("2026-06-01T00:00:00.000Z"),
    uninsured_amount: 100,
    capacity_gap_amount1: null,
    capacity_gap_currency1: null,
    capacity_gap_amount2: null,
    capacity_gap_currency2: null,
    uninsured_amount1: null,
    uninsured_currency1: null,
    uninsured_amount2: null,
    uninsured_currency2: null,
    is_active: true,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    modified_at: new Date("2026-01-01T00:00:00.000Z"),
};

const baseArgs = {
    customerId: 100,
    accountId: 42,
    countryId: 1,
    customerNumber: "CUST-1",
    modifiedBy: "user-1",
    existingCountryId: 1,
    existing: {
        customerPolicyRowId: 42,
        insurance_policy_id: 5,
        customer_number_policy: "CN-1",
        approved_limit: new Prisma.Decimal("10000"),
        approved_limit_currency: "USD",
        approved_limit_expiration_date: new Date("2027-06-01T00:00:00.000Z"),
        zero_limit_date: null,
        limit_type: "DCL" as const,
        max_payment_term: 30,
        max_allowed_mep: 90,
        reporting_days: 7,
        excluded_from_policy: false,
        policy_exclusion_reason: null,
        credit_score: new Prisma.Decimal("75"),
        credit_score_input_date: new Date("2026-01-15T00:00:00.000Z"),
        active_customer_since: new Date("2020-03-01T00:00:00.000Z"),
        outdated_dcl: false,
        capacity_gap_amount: 500,
        capacity_gap_amount_date: new Date("2026-06-01T00:00:00.000Z"),
        uninsured_amount: 100,
        capacity_gap_amount1: null,
        capacity_gap_currency1: null,
        capacity_gap_amount2: null,
        capacity_gap_currency2: null,
        uninsured_amount1: null,
        uninsured_currency1: null,
        uninsured_amount2: null,
        uninsured_currency2: null,
    },
};

describe("CustomerPolicyService.applyActivePolicyPatch versioning", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getActiveCustomerPolicyRow.mockResolvedValue(activeRow);
        mocks.freezeCustomerPolicyGapOnDeactivation.mockResolvedValue(undefined);
        mocks.syncInvoiceCapacityGapAmountsForCustomer.mockResolvedValue({
            missingRate: false,
        });
        prismaHolder.prisma!.customerPolicy.update.mockResolvedValue(activeRow);
        prismaHolder.prisma!.customerPolicy.create.mockResolvedValue({
            ...activeRow,
            id: 43,
            approved_limit: new Prisma.Decimal("15000"),
        });
    });

    it("copy-on-writes when versioning is enabled and an allowlisted field changes", async () => {
        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            enableCopyOnWriteVersioning: true,
            patch: { approved_limit: "15000" },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({});
        expect(mocks.freezeCustomerPolicyGapOnDeactivation).toHaveBeenCalledWith(
            100,
            42,
            prismaHolder.prisma
        );
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: { is_active: false, modified_by: "user-1" },
        });
        expect(prismaHolder.prisma!.customerPolicy.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                customer_id: 100,
                is_active: true,
                created_by: "user-1",
                insurance_policy_id: 5,
                approved_limit: expect.any(Prisma.Decimal),
                modified_by: "user-1",
            }),
        });
        const createData =
            prismaHolder.prisma!.customerPolicy.create.mock.calls[0]?.[0]?.data;
        expect(new Prisma.Decimal(String(createData.approved_limit)).toString()).toBe(
            "15000"
        );
    });

    it("skips writes when versioning is enabled and no allowlisted field changes", async () => {
        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            enableCopyOnWriteVersioning: true,
            patch: { approved_limit: "10000" },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({});
        expect(mocks.freezeCustomerPolicyGapOnDeactivation).not.toHaveBeenCalled();
        expect(prismaHolder.prisma!.customerPolicy.update).not.toHaveBeenCalled();
        expect(prismaHolder.prisma!.customerPolicy.create).not.toHaveBeenCalled();
    });

    it("updates in place when versioning is disabled", async () => {
        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            patch: { approved_limit: "15000" },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({});
        expect(mocks.freezeCustomerPolicyGapOnDeactivation).not.toHaveBeenCalled();
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                approved_limit: expect.any(Prisma.Decimal),
                modified_by: "user-1",
            }),
        });
        expect(prismaHolder.prisma!.customerPolicy.create).not.toHaveBeenCalled();
    });

    it("derives excluded_from_policy from non-empty policy_exclusion_reason", async () => {
        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            patch: { policy_exclusion_reason: "Pending review" },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({});
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                policy_exclusion_reason: "Pending review",
                excluded_from_policy: true,
                capacity_gap_amount: null,
                uninsured_amount: null,
            }),
        });
        expect(mocks.syncInvoiceCapacityGapAmountsForCustomer).toHaveBeenCalledWith(
            100,
            { dbClient: prismaHolder.prisma }
        );
    });

    it("rejects unsupported policy exclusion reason", async () => {
        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            patch: { policy_exclusion_reason: "invalid-reason" },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({ error: "Invalid policy exclusion reason" });
        expect(prismaHolder.prisma!.customerPolicy.update).not.toHaveBeenCalled();
        expect(prismaHolder.prisma!.customerPolicy.create).not.toHaveBeenCalled();
    });

    it("updates in place when insurance policy id changes with versioning enabled", async () => {
        mocks.findAssignablePrimaryPolicy.mockResolvedValue({ id: 9 });
        prismaHolder.prisma!.insurancePolicy.findFirst.mockResolvedValue({
            min_credit_score: null,
            score_validity_period_months: null,
            dcl_customer_since_months: null,
            max_dcl: null,
        });

        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            enableCopyOnWriteVersioning: true,
            patch: { policy_id: 9 },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({});
        expect(mocks.freezeCustomerPolicyGapOnDeactivation).not.toHaveBeenCalled();
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                insurance_policy_id: 9,
            }),
        });
        expect(prismaHolder.prisma!.customerPolicy.create).not.toHaveBeenCalled();
    });

    it("clears policy exclusion when limit type is Named", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            ...activeRow,
            limit_type: "DCL",
            excluded_from_policy: true,
            policy_exclusion_reason: "Insurer declined",
        });
        prismaHolder.prisma!.insurancePolicy.findFirst.mockResolvedValue({
            min_credit_score: null,
            score_validity_period_months: null,
            dcl_customer_since_months: null,
            max_dcl: null,
        });

        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            existing: {
                ...baseArgs.existing,
                limit_type: "DCL",
                excluded_from_policy: true,
                policy_exclusion_reason: "Insurer declined",
            },
            patch: { limit_type: "Named" },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({ refreshTermsBreachFlags: true });
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                limit_type: "Named",
                excluded_from_policy: false,
                policy_exclusion_reason: null,
            }),
        });
    });

    it("sets pending review exclusion when switching limit type to DCL", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            ...activeRow,
            limit_type: "Named",
            excluded_from_policy: false,
            policy_exclusion_reason: null,
        });
        prismaHolder.prisma!.insurancePolicy.findFirst.mockResolvedValue({
            min_credit_score: null,
            score_validity_period_months: null,
            dcl_customer_since_months: null,
            max_dcl: null,
        });

        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            existing: {
                ...baseArgs.existing,
                limit_type: "Named",
                excluded_from_policy: false,
                policy_exclusion_reason: null,
            },
            patch: { limit_type: "DCL" },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({ refreshTermsBreachFlags: true });
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                limit_type: "DCL",
                excluded_from_policy: true,
                policy_exclusion_reason: "Pending review",
            }),
        });
    });

    it("overwrites existing exclusion reason when switching Named to DCL", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            ...activeRow,
            limit_type: "Named",
            excluded_from_policy: true,
            policy_exclusion_reason: "Credit hold",
        });
        prismaHolder.prisma!.insurancePolicy.findFirst.mockResolvedValue({
            min_credit_score: null,
            score_validity_period_months: null,
            dcl_customer_since_months: null,
            max_dcl: null,
        });

        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            existing: {
                ...baseArgs.existing,
                limit_type: "Named",
                excluded_from_policy: true,
                policy_exclusion_reason: "Credit hold",
            },
            patch: { limit_type: "DCL" },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({ refreshTermsBreachFlags: true });
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                limit_type: "DCL",
                excluded_from_policy: true,
                policy_exclusion_reason: "Pending review",
            }),
        });
    });

    it("does not request terms breach refresh when Named policy is already not excluded", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            ...activeRow,
            limit_type: "Named",
            excluded_from_policy: false,
            policy_exclusion_reason: null,
        });
        prismaHolder.prisma!.insurancePolicy.findFirst.mockResolvedValue({
            min_credit_score: null,
            score_validity_period_months: null,
            dcl_customer_since_months: null,
            max_dcl: null,
        });

        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            existing: {
                ...baseArgs.existing,
                limit_type: "Named",
                excluded_from_policy: false,
                policy_exclusion_reason: null,
            },
            patch: { max_payment_term: 45 },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({});
    });

    it("clears excluded_from_policy when policy_exclusion_reason is cleared", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            ...activeRow,
            excluded_from_policy: true,
            policy_exclusion_reason: "Credit hold",
        });

        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            existing: {
                ...baseArgs.existing,
                excluded_from_policy: true,
                policy_exclusion_reason: "Credit hold",
            },
            patch: { policy_exclusion_reason: null },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({});
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                policy_exclusion_reason: null,
                excluded_from_policy: false,
            }),
        });
        expect(mocks.syncInvoiceCapacityGapAmountsForCustomer).not.toHaveBeenCalled();
    });

    it("ignores client-sent excluded_from_policy when reason is not provided", async () => {
        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            patch: { excluded_from_policy: true },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({});
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                policy_exclusion_reason: null,
                excluded_from_policy: false,
            }),
        });
    });

    it("ignores client-sent excluded_from_policy false when reason remains set", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            ...activeRow,
            excluded_from_policy: true,
            policy_exclusion_reason: "Insurer declined",
        });

        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            existing: {
                ...baseArgs.existing,
                excluded_from_policy: true,
                policy_exclusion_reason: "Insurer declined",
            },
            patch: { excluded_from_policy: false },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({});
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                policy_exclusion_reason: "Insurer declined",
                excluded_from_policy: true,
            }),
        });
    });

    it("keeps deliberate exclusion when already on Named", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            ...activeRow,
            limit_type: "Named",
            excluded_from_policy: false,
            policy_exclusion_reason: null,
        });
        prismaHolder.prisma!.insurancePolicy.findFirst.mockResolvedValue({
            min_credit_score: null,
            score_validity_period_months: null,
            dcl_customer_since_months: null,
            max_dcl: null,
        });

        const result = await CustomerPolicyService.applyActivePolicyPatch({
            ...baseArgs,
            existing: {
                ...baseArgs.existing,
                limit_type: "Named",
                excluded_from_policy: false,
                policy_exclusion_reason: null,
            },
            patch: {
                limit_type: "Named",
                excluded_from_policy: true,
                policy_exclusion_reason: "Insurer declined",
            },
            dbClient: prismaHolder.prisma as never,
        });

        expect(result).toEqual({});
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: expect.objectContaining({
                limit_type: "Named",
                excluded_from_policy: true,
                policy_exclusion_reason: "Insurer declined",
                capacity_gap_amount: null,
            }),
        });
        expect(mocks.syncInvoiceCapacityGapAmountsForCustomer).toHaveBeenCalledWith(
            100,
            { dbClient: prismaHolder.prisma }
        );
    });
});
