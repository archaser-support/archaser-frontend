import { describe, expect, it } from "vitest";

import { reportConfigReferencesCreditInsuranceFields } from "@/server/utils/reportCreditInsuranceFieldUsage";

describe("reportCreditInsuranceFieldUsage", () => {
    it("returns false for typical unpaid-invoice system report", () => {
        expect(
            reportConfigReferencesCreditInsuranceFields({
                tables: ["Invoice"],
                fields: [
                    { table: "Invoice", field: "invoice_number" },
                    { table: "Invoice", field: "due_date" },
                ],
                filters: [
                    {
                        table: "Invoice",
                        field: "status_id",
                        operator: "equals",
                        value: 13,
                    },
                ],
                sorting: [{ field: "invoice_number", direction: "DESC" }],
                grouping: [],
            })
        ).toBe(false);
    });

    it("detects invoice credit-insurance field in fields", () => {
        expect(
            reportConfigReferencesCreditInsuranceFields({
                tables: ["Invoice"],
                fields: [
                    { table: "Invoice", field: "invoice_number" },
                    { table: "Invoice", field: "target_reporting_date" },
                ],
            })
        ).toBe(true);
    });

    it("detects invoice capacity gap fields in fields", () => {
        expect(
            reportConfigReferencesCreditInsuranceFields({
                tables: ["Invoice"],
                fields: [{ table: "Invoice", field: "capacity_gap_amount_limit" }],
            })
        ).toBe(true);
    });

    it("detects customer credit-insurance field in filters", () => {
        expect(
            reportConfigReferencesCreditInsuranceFields({
                tables: ["Customer"],
                fields: [{ table: "Customer", field: "name" }],
                filters: [
                    {
                        table: "Customer",
                        field: "policy_id",
                        operator: "equals",
                        value: 1,
                    },
                ],
            })
        ).toBe(true);
    });

    it("detects invoice CI field in sorting with primary table", () => {
        expect(
            reportConfigReferencesCreditInsuranceFields({
                tables: ["Invoice"],
                fields: [{ table: "Invoice", field: "id" }],
                sorting: [
                    { field: "reporting_breach", direction: "ASC" },
                ],
            })
        ).toBe(true);
    });

    it("detects customer InsurancePolicy.policy_number field", () => {
        expect(
            reportConfigReferencesCreditInsuranceFields({
                tables: ["Customer"],
                fields: [
                    {
                        table: "Customer",
                        field: "InsurancePolicy.policy_number",
                    },
                ],
            })
        ).toBe(true);
    });

    it("detects customer InsurancePolicy.policy_number in sorting with Customer. prefix", () => {
        expect(
            reportConfigReferencesCreditInsuranceFields({
                tables: ["Customer"],
                fields: [{ table: "Customer", field: "name" }],
                sorting: [
                    {
                        field: "Customer.InsurancePolicy.policy_number",
                        direction: "ASC",
                    },
                ],
            })
        ).toBe(true);
    });

    it("detects customer trend cost change fields in fields", () => {
        expect(
            reportConfigReferencesCreditInsuranceFields({
                tables: ["Customer"],
                fields: [{ table: "Customer", field: "total_daily_cost_change" }],
            })
        ).toBe(true);
    });

    it("detects credit-insurance fields referenced inside formulas", () => {
        expect(
            reportConfigReferencesCreditInsuranceFields({
                tables: ["Invoice", "Customer"],
                fields: [
                    { table: "Invoice", field: "amount" },
                    { table: "Customer", field: "cost_percent" },
                ],
                formulas: [
                    {
                        expression:
                            "[Invoice.amount]*[Customer.cost_percent]/100",
                    },
                ],
            })
        ).toBe(true);
    });

    it("detects registration_fee_percent as a credit-insurance field", () => {
        expect(
            reportConfigReferencesCreditInsuranceFields({
                tables: ["Customer"],
                fields: [
                    { table: "Customer", field: "registration_fee_percent" },
                ],
            })
        ).toBe(true);
    });
});
