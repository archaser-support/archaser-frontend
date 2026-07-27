import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        customerTopUp: { findMany: mocks.findMany },
        currencyRate: { findFirst: mocks.findFirst },
    },
}));

import { resolveEffectiveApprovedLimit } from "@/server/services/creditInsurance/resolveEffectiveApprovedLimit";
import { computeLimitAssessedAmountForNewOpenInvoice } from "@/server/services/creditInsurance/invoiceInsuranceFields";

describe("multi-top-up capacity gap (D10)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findFirst.mockResolvedValue(null);
    });

    it("sums concurrent fixed top-ups on the same TopUp policy for one parent", async () => {
        mocks.findMany.mockResolvedValue([
            {
                id: 1,
                top_up_type: "Fixed",
                top_up_value: new Prisma.Decimal(5000),
                currency: "USD",
                start_date: new Date("2026-01-01"),
                end_date: new Date("2026-12-31"),
                cancelled_at: null,
                InsurancePolicy: {
                    id: 100,
                    allow_concurrent_top_ups: true,
                    parent_insurance_policy_id: 10,
                },
            },
            {
                id: 2,
                top_up_type: "Fixed",
                top_up_value: new Prisma.Decimal(3000),
                currency: "USD",
                start_date: new Date("2026-01-01"),
                end_date: new Date("2026-12-31"),
                cancelled_at: null,
                InsurancePolicy: {
                    id: 100,
                    allow_concurrent_top_ups: true,
                    parent_insurance_policy_id: 10,
                },
            },
        ]);

        const result = await resolveEffectiveApprovedLimit(1, {
            baseApprovedLimit: new Prisma.Decimal(10_000),
            baseApprovedLimitCurrency: "USD",
            parentPrimaryPolicyId: 10,
            asOfDate: new Date("2026-06-15"),
        });

        expect(result.topUpTotalInLimitCurrency).toBe(8000);
        expect(result.effectiveApprovedLimit).toBe(18_000);
    });

    it("ignores top-ups linked to a different primary policy", async () => {
        mocks.findMany.mockResolvedValue([
            {
                id: 1,
                top_up_type: "Fixed",
                top_up_value: new Prisma.Decimal(5000),
                currency: "USD",
                start_date: new Date("2026-01-01"),
                end_date: new Date("2026-12-31"),
                cancelled_at: null,
                InsurancePolicy: {
                    id: 100,
                    allow_concurrent_top_ups: true,
                    parent_insurance_policy_id: 20,
                },
            },
        ]);

        const result = await resolveEffectiveApprovedLimit(1, {
            baseApprovedLimit: new Prisma.Decimal(10_000),
            baseApprovedLimitCurrency: "USD",
            parentPrimaryPolicyId: 10,
            asOfDate: new Date("2026-06-15"),
        });

        expect(result.topUpTotalInLimitCurrency).toBe(0);
    });

    it("waterfall stamping uses top-up only after policy headroom is consumed", () => {
        expect(
            computeLimitAssessedAmountForNewOpenInvoice({
                approvedLimit: 10_000,
                topUpTotal: 8_000,
                openArOnPolicyBeforeInvoice: 12_000,
            })
        ).toBe(6_000);
        expect(
            computeLimitAssessedAmountForNewOpenInvoice({
                approvedLimit: 10_000,
                topUpTotal: 8_000,
                openArOnPolicyBeforeInvoice: 12_000,
                newInvoiceOutstanding: 6_000,
            })
        ).toBe(6_000);
    });
});
