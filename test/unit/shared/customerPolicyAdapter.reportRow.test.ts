import { describe, expect, it } from "vitest";

import { resolvePolicyNumberFromReportRow } from "@/shared/customerPolicyAdapter";

describe("resolvePolicyNumberFromReportRow", () => {
    it("reads flat Customer.InsurancePolicy.policy_number key", () => {
        expect(
            resolvePolicyNumberFromReportRow({
                "Customer.InsurancePolicy.policy_number": "PN-FLAT",
            })
        ).toBe("PN-FLAT");
    });

    it("reads nested Customer.CustomerPolicy InsurancePolicy", () => {
        expect(
            resolvePolicyNumberFromReportRow({
                Customer: {
                    CustomerPolicy: [
                        {
                            is_active: true,
                            InsurancePolicy: { policy_number: "PN-NESTED" },
                        },
                    ],
                },
            })
        ).toBe("PN-NESTED");
    });

    it("prefers Invoice.InsurancePolicy.policy_number over customer policy", () => {
        expect(
            resolvePolicyNumberFromReportRow({
                "Invoice.InsurancePolicy.policy_number": "PN-INV-FLAT",
                Customer: {
                    CustomerPolicy: [
                        {
                            is_active: true,
                            InsurancePolicy: { policy_number: "PN-CUST" },
                        },
                    ],
                },
            })
        ).toBe("PN-INV-FLAT");
    });
});
