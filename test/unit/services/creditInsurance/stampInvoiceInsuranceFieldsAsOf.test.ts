import { describe, expect, it, vi, beforeEach } from "vitest";

import { stampInvoiceInsuranceFieldsAsOf } from "@/server/services/creditInsurance/stampInvoiceInsuranceFieldsAsOf";
import { createPrismaMock } from "@/test/mocks/prisma";

const { mockLoadEffectiveInsurance } = vi.hoisted(() => ({
    mockLoadEffectiveInsurance: vi.fn(),
}));

vi.mock(
    "@/server/services/creditInsurance/loadEffectiveInsuranceForCustomers",
    () => ({
        loadEffectiveInsuranceForCustomers: mockLoadEffectiveInsurance,
    })
);

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

function d(iso: string): Date {
    const [y, m, day] = iso.split("-").map(Number);
    return new Date(y, m - 1, day);
}

describe("stampInvoiceInsuranceFieldsAsOf", () => {
    let mockPrisma: ReturnType<typeof createPrismaMock>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { prisma } = await import("@/lib/prisma");
        mockPrisma = prisma as ReturnType<typeof createPrismaMock>;
        mockLoadEffectiveInsurance.mockResolvedValue(
            new Map([
                [
                    1,
                    {
                        reporting_days: 25,
                        max_allowed_mep: 15,
                        max_payment_term: 30,
                        overdue_block: false,
                        excluded_from_policy: false,
                    },
                ],
            ])
        );
    });

    it("stamps reporting_breach false when evaluated at invoice_date before target reporting date", async () => {
        mockPrisma.invoice.findUnique.mockResolvedValue({
            id: 10,
            status: "Due",
            invoice_date: d("2026-01-11"),
            due_date: d("2026-01-22"),
            payment_term: 11,
            actual_reporting_date: null,
            customer_id: 1,
            policy_id: 20,
        });
        mockPrisma.insurancePolicy.findFirst.mockResolvedValue({
            end_date: d("2027-01-01"),
            score_validity_period_months: 12,
            min_credit_score: 50,
            dcl_customer_since_months: 6,
        });
        mockPrisma.invoice.update.mockResolvedValue({ id: 10 });

        await stampInvoiceInsuranceFieldsAsOf(10, d("2026-01-11"), mockPrisma);

        expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: expect.objectContaining({
                reporting_breach: false,
                target_reporting_date: d("2026-02-16"),
            }),
        });
    });

    it("no-ops when invoice or customer insurance is missing", async () => {
        mockPrisma.invoice.findUnique.mockResolvedValue(null);
        await stampInvoiceInsuranceFieldsAsOf(99, d("2026-01-01"), mockPrisma);
        expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    });
});
