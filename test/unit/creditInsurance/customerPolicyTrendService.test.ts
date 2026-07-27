import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
    getCustomerPolicyTrendForCustomer,
    getCustomerPolicyUsageTrend,
    getCustomerPolicyPortfolioTrend,
    resolveTrendRowUsagePct,
    takeCustomerPolicyTrendSnapshots,
} from "@/server/services/creditInsurance/customerPolicyTrendService";
import { buildCustomerPolicyTrendSnapshotPayload } from "@/server/services/creditInsurance/customerPolicyTrendSnapshotPayload";
import {
    aggregateTermsBreachByReasonFromInvoices,
    getCustomerTermsBreachByReasonSnapshot,
} from "@/server/services/creditInsurance/customerPolicyTrendTermsBreachByReason";

describe("customerPolicyTrendService", () => {
    it("exports snapshot runner", () => {
        expect(typeof takeCustomerPolicyTrendSnapshots).toBe("function");
    });

    it("exports snapshot financial payload builder", () => {
        expect(typeof buildCustomerPolicyTrendSnapshotPayload).toBe("function");
    });

    it("exports terms breach by reason aggregator", () => {
        expect(typeof aggregateTermsBreachByReasonFromInvoices).toBe("function");
        expect(typeof getCustomerTermsBreachByReasonSnapshot).toBe("function");
    });

    it("exports trend usage pct resolver", () => {
        expect(typeof resolveTrendRowUsagePct).toBe("function");
    });

    it("exports portfolio trend reader", () => {
        expect(typeof getCustomerPolicyPortfolioTrend).toBe("function");
    });

    it("exports top-customer usage reader", () => {
        expect(typeof getCustomerPolicyUsageTrend).toBe("function");
    });

    it("exports customer-level trend reader", () => {
        expect(typeof getCustomerPolicyTrendForCustomer).toBe("function");
    });
});

describe("CustomerPolicyTrend payment-term month-end snapshot", () => {
    const schemaCandidates = [
        resolve(process.cwd(), "../backend/prisma/schema.prisma"),
        resolve(process.cwd(), "backend/prisma/schema.prisma"),
        resolve(process.cwd(), "prisma/schema.prisma"),
    ];
    const schemaPath =
        schemaCandidates.find((candidate) => existsSync(candidate)) ??
        schemaCandidates[0];
    const schema = readFileSync(schemaPath, "utf8");
    const service = readFileSync(
        resolve(
            process.cwd(),
            "server/services/creditInsurance/customerPolicyTrendService.ts"
        ),
        "utf8"
    );

    it("schema defines payment-term month-end columns on CustomerPolicyTrend", () => {
        expect(schema).toContain("payment_term_cutoff_day_of_month");
        expect(schema).toContain("payment_term_substitute_day_of_month");
        expect(schema).toMatch(
            /reporting_substitute_day_of_month Int\?\s+payment_term_cutoff_day_of_month Int\?/
        );
    });

    it("daily snapshot copies payment-term month-end from CustomerPolicy", () => {
        expect(service).toContain("${cp.payment_term_cutoff_day_of_month}");
        expect(service).toContain("${cp.payment_term_substitute_day_of_month}");
        expect(service).toContain(
            "payment_term_cutoff_day_of_month = EXCLUDED.payment_term_cutoff_day_of_month"
        );
        expect(service).toContain(
            "payment_term_substitute_day_of_month = EXCLUDED.payment_term_substitute_day_of_month"
        );
    });
});
