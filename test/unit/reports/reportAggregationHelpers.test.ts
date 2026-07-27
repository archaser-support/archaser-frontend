import { describe, expect, it, vi } from "vitest";

import {
    formatAggregationValue,
    getAggregationLabelSuffix,
    translateReportAggregationType,
} from "@/shared/utils/reportAggregationHelpers";

const invoiceAmountField = { table: "Invoice", field: "amount" };
const tablesMetadata = [
    {
        name: "Invoice",
        fields: [{ name: "amount", type: "Decimal", label: "Amount" }],
    },
];

describe("reportAggregationHelpers", () => {
    it("translateReportAggregationType uses reports namespace when t resolves", () => {
        const tHe = vi.fn((key: string) =>
            key === "values.aggregation_sum" ? "סכום" : key
        );
        expect(translateReportAggregationType("SUM", tHe as any)).toBe(
            "סכום"
        );
    });

    it("formatAggregationValue uses accountCurrency when rows lack currency fields", () => {
        const data = [
            { "Invoice.amount": 100 },
            { "Invoice.amount": 50 },
        ];
        const out = formatAggregationValue(
            150,
            "SUM",
            invoiceAmountField,
            tablesMetadata,
            data,
            { language: "en" },
            "EUR"
        );
        expect(out).toContain("EUR");
        expect(out).not.toContain("USD");
        expect(out).toMatch(/^SUM:/);
    });

    it("formatAggregationValue prefixes with translated aggregation type when t is passed", () => {
        const tHe = vi.fn((key: string) =>
            key === "values.aggregation_sum" ? "סכום" : key
        );
        const data = [{ "Invoice.amount": 100 }];
        const out = formatAggregationValue(
            100,
            "SUM",
            invoiceAmountField,
            tablesMetadata,
            data,
            { language: "en" },
            "EUR",
            { t: tHe as any }
        );
        expect(out).toMatch(/^סכום:/);
        expect(out).toContain("EUR");
    });

    it("formatAggregationValue prefers row currency over accountCurrency", () => {
        const data = [{ "Invoice.amount": 10, customer_currency: "GBP" }];
        const out = formatAggregationValue(
            10,
            "SUM",
            invoiceAmountField,
            tablesMetadata,
            data,
            { language: "en" },
            "EUR"
        );
        expect(out).toContain("GBP");
        expect(out).not.toContain("EUR");
    });

    it("getAggregationLabelSuffix passes accountCurrency through for amount SUM", () => {
        const data = [{ "Invoice.amount": 200 }];
        const suffix = getAggregationLabelSuffix(
            { ...invoiceAmountField, aggregation: "SUM" },
            data,
            "Invoice.amount",
            tablesMetadata,
            { language: "en" },
            "ILS"
        );
        expect(suffix).toContain("ILS");
        expect(suffix).not.toContain("USD");
    });

    it("COUNT suffix does not use currency even for amount-typed fields", () => {
        const suffix = getAggregationLabelSuffix(
            { ...invoiceAmountField, aggregation: "COUNT" },
            [
                { "Invoice.amount__COUNT": 2 },
                { "Invoice.amount__COUNT": 3 },
            ],
            "Invoice.amount__COUNT",
            tablesMetadata,
            { language: "en" },
            "ILS"
        );
        expect(suffix).not.toMatch(/ILS|USD|EUR/);
        expect(suffix).toMatch(/5/);
    });

    it("getAggregationLabelSuffix prefers aggregationTotals for COUNT over loaded rows", () => {
        const suffix = getAggregationLabelSuffix(
            { table: "Invoice", field: "id", aggregation: "COUNT" },
            [{ "Invoice.id__COUNT": 1 }],
            "Invoice.id__COUNT",
            [],
            { language: "en" },
            undefined,
            false,
            { "Invoice.id__COUNT": 42 }
        );
        expect(suffix).toMatch(/42/);
        expect(suffix).not.toMatch(/1/);
    });
});
