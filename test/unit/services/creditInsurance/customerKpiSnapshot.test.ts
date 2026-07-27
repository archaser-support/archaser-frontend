import { describe, expect, it } from "vitest";

import {
    computeCustomerKpiSnapshotFromInvoices,
    computePolicyCapacityGapKpi,
    resolveCustomerCapacityGapForKpi,
} from "@/server/services/creditInsurance/customerKpiSnapshot";

describe("resolveCustomerCapacityGapForKpi", () => {
    it("caps capacity at excess over limit when AR exceeds approved limit", () => {
        expect(
            resolveCustomerCapacityGapForKpi({
                totalAr: 10_600,
                sumInvoiceGaps: 1000,
                approvedLimit: 10_000,
                retainedCapacityGap: 0,
            })
        ).toEqual({ capacity: 600, retainedCapacityGap: 600 });
    });

    it("retains gap when AR drops below limit until invoice gaps decay", () => {
        const retained = resolveCustomerCapacityGapForKpi({
            totalAr: 11_900,
            sumInvoiceGaps: 2400,
            approvedLimit: 10_000,
            retainedCapacityGap: 0,
        });
        expect(retained).toEqual({ capacity: 1900, retainedCapacityGap: 1900 });

        expect(
            resolveCustomerCapacityGapForKpi({
                totalAr: 7200,
                sumInvoiceGaps: 300,
                approvedLimit: 10_000,
                retainedCapacityGap: retained.retainedCapacityGap,
            })
        ).toEqual({ capacity: 0, retainedCapacityGap: 0 });
    });
});

describe("computePolicyCapacityGapKpi", () => {
    it("matches resolveCustomerCapacityGapForKpi for over-limit day", () => {
        expect(
            computePolicyCapacityGapKpi({
                totalAr: 10_600,
                sumInvoiceGaps: 1000,
                approvedLimit: 10_000,
                retainedCapacityGap: 0,
            })
        ).toEqual({ capacityGapAmount: 600, retainedCapacityGap: 600 });
    });
});

describe("computeCustomerKpiSnapshotFromInvoices", () => {
    it("computes Jan 27 golden row (capacity cleared, health 100%)", () => {
        const snapshot = computeCustomerKpiSnapshotFromInvoices({
            approvedLimit: 10_000,
            asOf: new Date(2026, 0, 27),
            openInvoices: [
                {
                    outstanding: 7000,
                    limitAssessedAmount: 7000,
                    capacityGapAmount: 6400,
                    capacityGapAmountLimit: 6400,
                    inCapacityGap: true,
                    targetReportingDate: null,
                    ctvPaymentTerm: false,
                    ctvCustomerOverdueMep: false,
                },
            ],
            retainedCapacityGap: 0,
        });

        expect(snapshot.totalAr).toBe(7000);
        expect(snapshot.termBreach).toBe(0);
        expect(snapshot.capacity).toBe(0);
        expect(snapshot.notInsured).toBe(0);
        expect(Math.round(snapshot.healthIndex * 100)).toBe(100);
    });

    it("uncovered exposure → term breach and notInsured equal full open AR", () => {
        const snapshot = computeCustomerKpiSnapshotFromInvoices({
            approvedLimit: 10_000,
            asOf: new Date(2026, 0, 27),
            uncoveredExposure: true,
            openInvoices: [
                {
                    outstanding: 4_000,
                    limitAssessedAmount: 4_000,
                    capacityGapAmount: 0,
                    capacityGapAmountLimit: 0,
                    inCapacityGap: false,
                    targetReportingDate: null,
                    ctvPaymentTerm: true,
                    ctvCustomerOverdueMep: false,
                },
            ],
            retainedCapacityGap: 0,
        });

        expect(snapshot.termBreach).toBe(4_000);
        expect(snapshot.notInsured).toBe(4_000);
    });
});
