import { beforeEach, describe, expect, it, vi } from "vitest";

import { InsurancePolicyService } from "@/server/services/InsurancePolicyService";
import { createPrismaMock } from "@/test/mocks/prisma";

const { prismaHolder } = vi.hoisted(() => ({
    prismaHolder: {
        prisma: null as ReturnType<typeof createPrismaMock> & {
            insurancePolicy: ReturnType<typeof createPrismaMock>["customer"];
            insurancePolicyCountry: ReturnType<typeof createPrismaMock>["customer"];
            namedPolicy: ReturnType<typeof createPrismaMock>["customer"];
        } | null,
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const prisma = createPrismaMock() as ReturnType<typeof createPrismaMock> & {
        insurancePolicy: ReturnType<typeof createPrismaMock>["customer"];
        insurancePolicyCountry: ReturnType<typeof createPrismaMock>["customer"];
        namedPolicy: ReturnType<typeof createPrismaMock>["customer"];
    };
    prisma.insurancePolicy = createPrismaMock().customer;
    prisma.insurancePolicyCountry = createPrismaMock().customer;
    prisma.namedPolicy = createPrismaMock().customer;
    prismaHolder.prisma = prisma;
    return { prisma };
});

describe("InsurancePolicyService.getCustomerPrefillForEdit month-end fields", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("includes policy master month-end fields on policy-level prefill", async () => {
        const prisma = prismaHolder.prisma!;
        prisma.insurancePolicy.findFirst.mockResolvedValue({
            max_payment_term: 30,
            max_allowed_mep: 90,
            reporting_days: 7,
            mep_cutoff_day_of_month: 24,
            mep_substitute_day_of_month: 2,
            reporting_cutoff_day_of_month: 20,
            reporting_substitute_day_of_month: 5,
            payment_term_cutoff_day_of_month: 18,
            payment_term_substitute_day_of_month: 3,
            min_credit_score: 70,
            max_dcl: 10000,
        });
        prisma.insurancePolicyCountry.findFirst.mockResolvedValue(null);
        prisma.namedPolicy.findFirst.mockResolvedValue(null);

        const result = await InsurancePolicyService.getCustomerPrefillForEdit({
            policyId: 1,
            accountId: 100,
            countryId: null,
            customerNumber: "C-1",
            customerNumberPolicy: null,
        });

        expect(result).toMatchObject({
            source: "policy",
            mep_cutoff_day_of_month: 24,
            mep_substitute_day_of_month: 2,
            reporting_cutoff_day_of_month: 20,
            reporting_substitute_day_of_month: 5,
            payment_term_cutoff_day_of_month: 18,
            payment_term_substitute_day_of_month: 3,
        });
    });

    it("uses policy master month-end fields even when country overrides MEP", async () => {
        const prisma = prismaHolder.prisma!;
        prisma.insurancePolicy.findFirst.mockResolvedValue({
            max_payment_term: 30,
            max_allowed_mep: 90,
            reporting_days: 7,
            mep_cutoff_day_of_month: 24,
            mep_substitute_day_of_month: 2,
            reporting_cutoff_day_of_month: null,
            reporting_substitute_day_of_month: null,
            min_credit_score: 70,
            max_dcl: 10000,
        });
        prisma.insurancePolicyCountry.findFirst.mockResolvedValue({
            payment_term_cap: 45,
            country_mep: 60,
            reporting_days: 10,
            country_max_limit: 5000,
        });
        prisma.namedPolicy.findFirst.mockResolvedValue(null);

        const result = await InsurancePolicyService.getCustomerPrefillForEdit({
            policyId: 1,
            accountId: 100,
            countryId: 5,
            customerNumber: "C-1",
            customerNumberPolicy: null,
        });

        expect(result).toMatchObject({
            source: "country",
            max_allowed_mep: 60,
            mep_cutoff_day_of_month: 24,
            mep_substitute_day_of_month: 2,
        });
    });
});
