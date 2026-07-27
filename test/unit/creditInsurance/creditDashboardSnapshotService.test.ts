import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    aggregateCreditDashboardSnapshotRowsByDate,
    computeCreditDashboardHealthIndex,
    getCreditDashboardSummaryHistory,
    type CreditDashboardHistoryPoint,
} from "@/server/services/creditInsurance/creditDashboardSnapshotService";

vi.mock("@/lib/prisma", () => ({
    prisma: {
        $queryRaw: vi.fn(),
    },
}));

vi.mock("@/shared/creditInsurance/insurancePolicyLifecycle", () => ({
    startOfTodayUtc: vi.fn(() => new Date("2026-06-26T00:00:00.000Z")),
    effectivelyActivePrismaWhere: vi.fn(() => ({})),
}));

import { prisma } from "@/lib/prisma";

function makePoint(
    snapshotDate: string,
    overrides: Partial<CreditDashboardHistoryPoint> = {}
): CreditDashboardHistoryPoint {
    return {
        snapshotDate,
        totalReceivables: 100,
        compliantExposure: 80,
        atRiskExposure: 20,
        healthIndex: 80,
        overdueBlockCustomerCount: 1,
        capacityGapTotalAmount: 10,
        termsBreachTotalAmount: 5,
        withoutPolicyTotalAmount: 3,
        reportingCountdownInvoiceCount: 2,
        limitWarningsCustomerCount: 4,
        ...overrides,
    };
}

function makeSnapshotRow(
    snapshotDate: string,
    overrides: Partial<{
        total_receivables: number;
        compliant_exposure: number;
        at_risk_exposure: number;
        health_index: number;
        overdue_block_customer_count: number;
        capacity_gap_total_amount: number;
        terms_breach_total_amount: number;
        without_policy_total_amount: number;
        reporting_countdown_invoice_count: number;
        limit_warnings_customer_count: number;
    }> = {}
) {
    return {
        snapshot_date: new Date(`${snapshotDate}T00:00:00.000Z`),
        total_receivables: 100,
        compliant_exposure: 80,
        at_risk_exposure: 20,
        health_index: 80,
        overdue_block_customer_count: 1,
        capacity_gap_total_amount: 10,
        terms_breach_total_amount: 5,
        without_policy_total_amount: 3,
        reporting_countdown_invoice_count: 2,
        limit_warnings_customer_count: 4,
        ...overrides,
    };
}

describe("computeCreditDashboardHealthIndex", () => {
    it("returns 100 when total receivables is zero", () => {
        expect(computeCreditDashboardHealthIndex(0, 0)).toBe(100);
    });

    it("computes and clamps health index from totals", () => {
        expect(computeCreditDashboardHealthIndex(75, 100)).toBe(75);
        expect(computeCreditDashboardHealthIndex(150, 100)).toBe(100);
        expect(computeCreditDashboardHealthIndex(-10, 100)).toBe(0);
    });
});

describe("aggregateCreditDashboardSnapshotRowsByDate", () => {
    it("sums additive fields and recomputes health index", () => {
        const aggregated = aggregateCreditDashboardSnapshotRowsByDate([
            makePoint("2026-06-01", {
                totalReceivables: 200,
                compliantExposure: 150,
                atRiskExposure: 50,
                healthIndex: 75,
                overdueBlockCustomerCount: 2,
            }),
            makePoint("2026-06-01", {
                totalReceivables: 100,
                compliantExposure: 50,
                atRiskExposure: 50,
                healthIndex: 50,
                overdueBlockCustomerCount: 3,
            }),
        ]);

        expect(aggregated).toEqual([
            {
                snapshotDate: "2026-06-01",
                totalReceivables: 300,
                compliantExposure: 200,
                atRiskExposure: 100,
                healthIndex: computeCreditDashboardHealthIndex(200, 300),
                overdueBlockCustomerCount: 5,
                capacityGapTotalAmount: 20,
                termsBreachTotalAmount: 10,
                withoutPolicyTotalAmount: 6,
                reportingCountdownInvoiceCount: 4,
                limitWarningsCustomerCount: 8,
            },
        ]);
    });
});

describe("getCreditDashboardSummaryHistory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns account-wide series for admin All", async () => {
        vi.mocked(prisma.$queryRaw).mockResolvedValue([
            makeSnapshotRow("2026-06-25"),
            makeSnapshotRow("2026-06-26"),
        ]);

        const history = await getCreditDashboardSummaryHistory(
            1,
            14,
            undefined,
            "daily",
            {
                isAdmin: true,
                selectedBusinessUnitId: null,
                accessibleBusinessUnitIds: null,
            }
        );

        expect(history.series).toHaveLength(2);
        expect(history.series[1]?.snapshotDate).toBe("2026-06-26");
        expect(history.monthPct.totalReceivables).toBeNull();
    });

    it("returns per-business-unit series for a selected unit", async () => {
        vi.mocked(prisma.$queryRaw).mockResolvedValue([
            makeSnapshotRow("2026-06-26", { total_receivables: 42 }),
        ]);

        const history = await getCreditDashboardSummaryHistory(
            1,
            14,
            undefined,
            "daily",
            {
                isAdmin: false,
                selectedBusinessUnitId: 7,
                accessibleBusinessUnitIds: [7, 8],
            }
        );

        expect(history.series).toHaveLength(1);
        expect(history.series[0]?.totalReceivables).toBe(42);
    });

    it("aggregates accessible business unit rows for non-admin All", async () => {
        vi.mocked(prisma.$queryRaw).mockResolvedValue([
            makeSnapshotRow("2026-06-26", {
                total_receivables: 200,
                compliant_exposure: 150,
                at_risk_exposure: 50,
            }),
            makeSnapshotRow("2026-06-26", {
                total_receivables: 100,
                compliant_exposure: 50,
                at_risk_exposure: 50,
            }),
        ]);

        const history = await getCreditDashboardSummaryHistory(
            1,
            14,
            undefined,
            "daily",
            {
                isAdmin: false,
                selectedBusinessUnitId: null,
                accessibleBusinessUnitIds: [7, 8],
            }
        );

        expect(history.series).toHaveLength(1);
        expect(history.series[0]?.totalReceivables).toBe(300);
        expect(history.series[0]?.healthIndex).toBe(
            computeCreditDashboardHealthIndex(200, 300)
        );
    });

    it("returns empty series when user has no accessible business units on All", async () => {
        const history = await getCreditDashboardSummaryHistory(
            1,
            14,
            undefined,
            "daily",
            {
                isAdmin: false,
                selectedBusinessUnitId: null,
                accessibleBusinessUnitIds: [],
            }
        );

        expect(history.series).toEqual([]);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("computes monthPct when at least 30 daily points exist", async () => {
        const rows = Array.from({ length: 31 }, (_, index) =>
            makeSnapshotRow(`2026-05-${String(index + 1).padStart(2, "0")}`, {
                total_receivables: 100 + index,
            })
        );
        vi.mocked(prisma.$queryRaw).mockResolvedValue(rows);

        const history = await getCreditDashboardSummaryHistory(
            1,
            14,
            undefined,
            "daily",
            {
                isAdmin: true,
                selectedBusinessUnitId: null,
                accessibleBusinessUnitIds: null,
            }
        );

        expect(history.monthPct.totalReceivables).not.toBeNull();
    });
});
