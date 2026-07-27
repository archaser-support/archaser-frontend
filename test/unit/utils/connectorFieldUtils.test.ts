import { describe, expect, it } from "vitest";

import {
    applyConnectorTransform,
    computeMappingCompleteness,
    discoverFieldPathsFromRecords,
    extractNestedValue,
    mapErpRecord,
    parseMappingRules,
    validateMappedRow,
} from "@/server/utils/connectorFieldUtils";

describe("connectorFieldUtils", () => {
    it("extracts nested dot paths", () => {
        const value = extractNestedValue(
            { CUSTOMERS: { CUSTNAME: "T000001" } },
            "CUSTOMERS.CUSTNAME"
        );
        expect(value).toBe("T000001");
    });

    it("applies date and trim transforms", () => {
        expect(applyConnectorTransform("  hello  ", "trim")).toBe("hello");
        expect(
            applyConnectorTransform("2025-05-01T00:00:00Z", "date")
        ).toBe("2025-05-01");
        expect(applyConnectorTransform("usd", "currency_code")).toBe("USD");
        expect(applyConnectorTransform("yes", "boolean")).toBe(true);
    });

    it("maps ERP records using mapping rules", () => {
        const mapped = mapErpRecord(
            { CUSTNAME: "T000001", CDES: "Acme" },
            [
                { archaserField: "customer_number", erpField: "CUSTNAME", transform: "trim" },
                { archaserField: "name", erpField: "CDES" },
            ]
        );
        expect(mapped).toEqual({
            customer_number: "T000001",
            name: "Acme",
        });
    });

    it("discovers dot-path headers from sample records", () => {
        const discovered = discoverFieldPathsFromRecords([
            { CUSTNAME: "T000001", ADDR: { CITY: "NYC" } },
        ]);
        expect(discovered.rawHeaders).toContain("CUSTNAME");
        expect(discovered.rawHeaders).toContain("ADDR.CITY");
        expect(discovered.exampleValues.CUSTNAME).toBe("T000001");
    });

    it("parses and validates mapping completeness", () => {
        const rules = parseMappingRules([
            { archaserField: "customer_number", erpField: "CUSTNAME" },
            { archaserField: "name", erpField: "CDES" },
        ]);
        expect(computeMappingCompleteness("Customer", rules)).toBe(true);
        expect(
            computeMappingCompleteness("Customer", [
                { archaserField: "name", erpField: "CDES" },
            ])
        ).toBe(false);
    });

    it("validates required mapped rows", () => {
        const errors = validateMappedRow(
            "Invoice",
            {
                customer_number: "T1",
                invoice_number: "",
                invoice_date: "2025-01-01",
                base_amount: 10,
                invoice_amount: 10,
            },
            0
        );
        expect(errors.some((error) => error.includes("invoice_number"))).toBe(
            true
        );
    });

    it("treats payment base amount as optional for mapping completeness", () => {
        const rules = parseMappingRules([
            { archaserField: "customer_number", erpField: "CUSTNAME" },
            { archaserField: "invoice_number", erpField: "IVNUM" },
            { archaserField: "reference", erpField: "PAYNUM" },
            { archaserField: "customer_amount", erpField: "PAYMENT" },
            { archaserField: "customer_currency", erpField: "CODE" },
            { archaserField: "payment_date", erpField: "PAYDATE" },
        ]);
        expect(computeMappingCompleteness("Payment", rules)).toBe(true);
    });
});
