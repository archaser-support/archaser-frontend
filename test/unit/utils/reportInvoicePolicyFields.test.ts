import { describe, expect, it } from "vitest";

import {
    extractInvoicePolicyReportField,
    resolvePolicyNumberForInvoiceReportRow,
} from "@/server/utils/reportInvoicePolicyFields";

describe("reportInvoicePolicyFields", () => {
    it("extracts policy number from Invoice.InsurancePolicy", () => {
        expect(
            extractInvoicePolicyReportField(
                {
                    policy_id: 3,
                    InsurancePolicy: { policy_number: "POL-HIST" },
                },
                "InsurancePolicy.policy_number"
            )
        ).toBe("POL-HIST");
    });

    it("prefers invoice policy over active customer policy on invoice reports", () => {
        expect(
            resolvePolicyNumberForInvoiceReportRow(
                {
                    policy_id: 3,
                    InsurancePolicy: { policy_number: "POL-OLD" },
                },
                "InsurancePolicy.policy_number",
                {
                    CustomerPolicy: [
                        {
                            is_active: true,
                            InsurancePolicy: { policy_number: "POL-CURRENT" },
                        },
                    ],
                }
            )
        ).toBe("POL-OLD");
    });

    it("falls back to customer policy when invoice has no policy_id", () => {
        expect(
            resolvePolicyNumberForInvoiceReportRow(
                { policy_id: null, InsurancePolicy: null },
                "InsurancePolicy.policy_number",
                {
                    CustomerPolicy: [
                        {
                            is_active: true,
                            InsurancePolicy: { policy_number: "POL-CURRENT" },
                        },
                    ],
                }
            )
        ).toBe("POL-CURRENT");
    });
});
