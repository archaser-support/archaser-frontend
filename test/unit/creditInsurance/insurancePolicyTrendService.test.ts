import { describe, expect, it } from "vitest";

import {
    computePolicyUsagePct,
    getInsurancePolicyConfigChanges,
    getInsurancePolicyCountryTrend,
    getInsurancePolicyTrend,
    getNamedPolicyTrend,
    syncInsurancePolicyTrendSnapshotForAccount,
    takeInsurancePolicyTrendSnapshots,
} from "@/server/services/creditInsurance/insurancePolicyTrendService";

describe("insurancePolicyTrendService", () => {
    it("exports snapshot runner", () => {
        expect(typeof takeInsurancePolicyTrendSnapshots).toBe("function");
    });

    it("exports per-account snapshot sync", () => {
        expect(typeof syncInsurancePolicyTrendSnapshotForAccount).toBe("function");
    });

    it("exports header trend reader", () => {
        expect(typeof getInsurancePolicyTrend).toBe("function");
    });

    it("exports country trend reader", () => {
        expect(typeof getInsurancePolicyCountryTrend).toBe("function");
    });

    it("exports named policy trend reader", () => {
        expect(typeof getNamedPolicyTrend).toBe("function");
    });

    it("exports config changes reader", () => {
        expect(typeof getInsurancePolicyConfigChanges).toBe("function");
    });
});

describe("computePolicyUsagePct", () => {
    it("returns null when max cover is missing or zero", () => {
        expect(computePolicyUsagePct(1000, null)).toBeNull();
        expect(computePolicyUsagePct(1000, 0)).toBeNull();
    });

    it("computes usage percentage capped at 999.99", () => {
        expect(computePolicyUsagePct(500, 1000)).toBe(50);
        expect(computePolicyUsagePct(15000, 1000)).toBe(999.99);
    });
});
