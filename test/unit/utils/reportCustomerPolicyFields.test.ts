import { describe, expect, it } from "vitest";

import {
    extractCustomerPolicyReportField,
    getActiveCustomerPolicyRow,
    isCustomerPolicyBackedReportField,
    mergeActiveCustomerPolicySelect,
} from "@/server/utils/reportCustomerPolicyFields";

describe("reportCustomerPolicyFields", () => {
    it("identifies policy-backed report fields", () => {
        expect(isCustomerPolicyBackedReportField("policy_id")).toBe(true);
        expect(isCustomerPolicyBackedReportField("InsurancePolicy.policy_number")).toBe(
            true
        );
        expect(isCustomerPolicyBackedReportField("approved_limit")).toBe(true);
        expect(isCustomerPolicyBackedReportField("customer_number")).toBe(false);
    });

    it("extracts values from active CustomerPolicy", () => {
        const row = {
            CustomerPolicy: [
                {
                    approved_limit: 5000,
                    customer_number_policy: "CN-1",
                    InsurancePolicy: { policy_number: "POL-99" },
                },
            ],
        };

        expect(getActiveCustomerPolicyRow(row)?.approved_limit).toBe(5000);
        expect(extractCustomerPolicyReportField(row, "policy_id")).toBe("POL-99");
        expect(extractCustomerPolicyReportField(row, "InsurancePolicy.policy_number")).toBe(
            "POL-99"
        );
        expect(extractCustomerPolicyReportField(row, "approved_limit")).toBe(5000);
        expect(extractCustomerPolicyReportField(row, "customer_number_policy")).toBe(
            "CN-1"
        );
    });

    it("extracts values from the historic CustomerPolicy matching invoice policy_id", () => {
        const row = {
            CustomerPolicy: [
                {
                    approved_limit: 5000,
                    customer_number_policy: "CN-ACTIVE",
                    insurance_policy_id: 10,
                    is_active: true,
                    InsurancePolicy: { policy_number: "POL-ACTIVE" },
                },
                {
                    approved_limit: 2000,
                    customer_number_policy: "CN-HISTORIC",
                    insurance_policy_id: 5,
                    is_active: false,
                    InsurancePolicy: { policy_number: "POL-HISTORIC" },
                },
            ],
        };

        const invoiceRow = {
            policy_id: 5,
        };

        // When invoice matches historic policy_id
        expect(extractCustomerPolicyReportField(row, "policy_id", invoiceRow)).toBe("POL-HISTORIC");
        expect(extractCustomerPolicyReportField(row, "approved_limit", invoiceRow)).toBe(2000);
        expect(extractCustomerPolicyReportField(row, "customer_number_policy", invoiceRow)).toBe("CN-HISTORIC");

        // When invoice matches active policy_id
        const invoiceActive = { policy_id: 10 };
        expect(extractCustomerPolicyReportField(row, "policy_id", invoiceActive)).toBe("POL-ACTIVE");

        // When invoice has unknown policy_id, falls back to active
        const invoiceUnknown = { policy_id: 999 };
        expect(extractCustomerPolicyReportField(row, "policy_id", invoiceUnknown)).toBe("POL-ACTIVE");

        // When no invoice context, falls back to active
        expect(extractCustomerPolicyReportField(row, "policy_id")).toBe("POL-ACTIVE");
    });

    it("builds CustomerPolicy select instead of Customer.InsurancePolicy", () => {
        const select: Record<string, unknown> = {};
        mergeActiveCustomerPolicySelect(select, [
            "InsurancePolicy.policy_number",
            "approved_limit",
        ]);

        expect(select.InsurancePolicy).toBeUndefined();
        expect(select.CustomerPolicy).toMatchObject({
            select: {
                approved_limit: true,
                insurance_policy_id: true,
                is_active: true,
                InsurancePolicy: { select: { policy_number: true } },
            },
        });
    });
});
