import { describe, expect, it } from "vitest";

import { buildCustomerPolicyTrendSnapshotPayload } from "@/server/services/creditInsurance/customerPolicyTrendSnapshotPayload";
import { computeCustomerHealthIndex } from "@/server/services/creditInsurance/customerDashboardKpisService";
import { computeCustomerRiskExposure } from "@/server/services/creditInsurance/invoiceInsuranceFields";

describe("buildCustomerPolicyTrendSnapshotPayload", () => {
    it("maps account currency and dashboard-aligned exposure KPIs", () => {
        const totalReceivables = 20_000;
        const capacityGapAmount = 3_000;
        const termsBreachOutstanding = 1_500;
        const termsBreachForAtRisk = 1_000;
        const atRisk = computeCustomerRiskExposure({
            totalAr: totalReceivables,
            capacityGapAmount,
            termsBreachOutstanding: termsBreachForAtRisk,
        });

        const payload = buildCustomerPolicyTrendSnapshotPayload({
            accountCurrency: "ils",
            totalReceivables,
            capacityGapAmount,
            termsBreachOutstanding,
            termsBreachOutstandingForAtRisk: termsBreachForAtRisk,
            arInLimitCurrency: 18_000,
            approvedLimit: 15_000,
            topUpTotal: null,
        });

        expect(payload.financialCurrency).toBe("ILS");
        expect(payload.totalReceivables).toBe(20_000);
        expect(payload.capacityGapAmount).toBe(3_000);
        expect(payload.termsBreachAmount).toBe(1_500);
        expect(payload.atRiskExposure).toBe(atRisk);
        expect(payload.healthIndex).toBe(
            computeCustomerHealthIndex(totalReceivables, atRisk)
        );
        expect(payload.compliantExposure).toBe(totalReceivables - atRisk);
    });

    it("defaults financial currency to USD when account currency is missing", () => {
        const payload = buildCustomerPolicyTrendSnapshotPayload({
            accountCurrency: null,
            totalReceivables: 1_000,
            capacityGapAmount: 0,
            termsBreachOutstanding: 0,
            termsBreachOutstandingForAtRisk: 0,
            arInLimitCurrency: 1_000,
            approvedLimit: 2_000,
            topUpTotal: null,
        });

        expect(payload.financialCurrency).toBe("USD");
    });

    it("returns health index 100 when total receivables is zero", () => {
        const payload = buildCustomerPolicyTrendSnapshotPayload({
            accountCurrency: "USD",
            totalReceivables: 0,
            capacityGapAmount: 500,
            termsBreachOutstanding: 200,
            termsBreachOutstandingForAtRisk: 200,
            arInLimitCurrency: 0,
            approvedLimit: 10_000,
            topUpTotal: null,
        });

        expect(payload.healthIndex).toBe(100);
        expect(payload.atRiskExposure).toBe(0);
        expect(payload.compliantExposure).toBe(0);
    });

    it("caps at-risk exposure at total receivables", () => {
        const payload = buildCustomerPolicyTrendSnapshotPayload({
            accountCurrency: "USD",
            totalReceivables: 1_000,
            capacityGapAmount: 2_000,
            termsBreachOutstanding: 500,
            termsBreachOutstandingForAtRisk: 500,
            arInLimitCurrency: 1_000,
            approvedLimit: 500,
            topUpTotal: null,
        });

        expect(payload.atRiskExposure).toBe(1_000);
        expect(payload.compliantExposure).toBe(0);
        expect(payload.healthIndex).toBe(0);
    });

    it("populates usage % triple from dashboard aggregate formulas", () => {
        const payload = buildCustomerPolicyTrendSnapshotPayload({
            accountCurrency: "USD",
            totalReceivables: 11_000,
            capacityGapAmount: 1_000,
            termsBreachOutstanding: 0,
            termsBreachOutstandingForAtRisk: 0,
            arInLimitCurrency: 11_000,
            approvedLimit: 10_000,
            topUpTotal: 5_000,
        });

        expect(payload.policyUsagePct).toBe(100);
        expect(payload.topUpUsagePct).toBeCloseTo(20, 2);
        expect(payload.effectiveUsagePct).toBeCloseTo(73.33, 1);
    });

    it("returns null usage metrics when approved limit is missing or zero", () => {
        const payload = buildCustomerPolicyTrendSnapshotPayload({
            accountCurrency: "USD",
            totalReceivables: 5_000,
            capacityGapAmount: 0,
            termsBreachOutstanding: 0,
            termsBreachOutstandingForAtRisk: 0,
            arInLimitCurrency: 5_000,
            approvedLimit: null,
            topUpTotal: null,
        });

        expect(payload.policyUsagePct).toBeNull();
        expect(payload.topUpUsagePct).toBeNull();
        expect(payload.effectiveUsagePct).toBeNull();
    });
});
