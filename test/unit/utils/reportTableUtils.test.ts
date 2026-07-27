import { describe, it, expect } from "vitest";
import {
    REPORT_AGGREGATION_TYPES,
    areReportFiltersEqual,
    cloneReportFilters,
    dedupeReportFieldOutputKeys,
    getForbiddenGroupingKeysForAggregatedField,
    getForbiddenGroupingKeysForAggregatedFields,
    getFieldOutputKey,
    isReportFilterValueIncomplete,
    normalizeReportMetadataTables,
    resolveNextPaletteFieldCandidate,
    validateReportFilters,
} from "@/utils/reportTableUtils";

describe("reportTableUtils grouping helpers", () => {
    it("REPORT_AGGREGATION_TYPES lists every supported aggregation", () => {
        expect(REPORT_AGGREGATION_TYPES).toEqual([
            "SUM",
            "AVG",
            "COUNT",
            "MIN",
            "MAX",
        ]);
    });

    it("getForbiddenGroupingKeysForAggregatedField includes all __AGG suffixes when no alias", () => {
        const keys = getForbiddenGroupingKeysForAggregatedField({
            table: "Invoice",
            field: "amount",
            aggregation: "MAX",
        });
        for (const agg of REPORT_AGGREGATION_TYPES) {
            expect(keys).toContain(`Invoice.amount__${agg}`);
        }
        expect(keys).toContain("Invoice.amount");
        expect(keys).toContain("Invoice.amount__MAX");
    });

    it("getForbiddenGroupingKeysForAggregatedFields merges keys from multiple aggregated fields", () => {
        const set = getForbiddenGroupingKeysForAggregatedFields([
            { table: "Invoice", field: "amount", aggregation: "SUM" },
            { table: "Invoice", field: "id", aggregation: "COUNT" },
            { table: "Customer", field: "name" },
        ]);
        expect(set.has("Invoice.amount__AVG")).toBe(true);
        expect(set.has("Invoice.id__COUNT")).toBe(true);
        expect(set.has("Customer.name")).toBe(false);
    });

    it("dedupeReportFieldOutputKeys assigns alias for a second identical SUM", () => {
        const out = dedupeReportFieldOutputKeys([
            { table: "Invoice", field: "amount", aggregation: "SUM" },
            { table: "Invoice", field: "amount", aggregation: "SUM" },
        ]);
        expect(getFieldOutputKey(out[0])).toBe("Invoice.amount__SUM");
        expect(out[1].alias).toBe("Invoice_amount__SUM_2");
        expect(getFieldOutputKey(out[1])).toBe("Invoice_amount__SUM_2");
    });

    it("resolveNextPaletteFieldCandidate adds duplicate aggregation when all six slots are used", () => {
        const keys = new Set([
            "Invoice.amount",
            "Invoice.amount__SUM",
            "Invoice.amount__AVG",
            "Invoice.amount__COUNT",
            "Invoice.amount__MIN",
            "Invoice.amount__MAX",
        ]);
        const next = resolveNextPaletteFieldCandidate(
            { table: "Invoice", field: "amount" },
            "number",
            keys
        );
        expect(next).toEqual({
            table: "Invoice",
            field: "amount",
            aggregation: "SUM",
        });
    });

    it("getFieldOutputKey preserves multi-segment relation field names", () => {
        expect(
            getFieldOutputKey({
                table: "Customer",
                field: "InsurancePolicy.policy_number",
            })
        ).toBe("Customer.InsurancePolicy.policy_number");
    });
});

describe("isReportFilterValueIncomplete", () => {
    it("returns false for is_empty and is_not_empty", () => {
        expect(
            isReportFilterValueIncomplete({
                operator: "is_empty",
                value: "",
            })
        ).toBe(false);
        expect(
            isReportFilterValueIncomplete({
                operator: "is_not_empty",
                value: null,
            })
        ).toBe(false);
    });

    it("returns true for in with no meaningful selection", () => {
        expect(
            isReportFilterValueIncomplete({
                operator: "in",
                value: [],
            })
        ).toBe(true);
        expect(
            isReportFilterValueIncomplete({
                operator: "in",
                value: ["", null],
            })
        ).toBe(true);
    });

    it("returns false for in with at least one value", () => {
        expect(
            isReportFilterValueIncomplete({
                operator: "in",
                value: ["PN-1"],
            })
        ).toBe(false);
    });

    it("returns true for empty string equals and false for numeric zero", () => {
        expect(
            isReportFilterValueIncomplete({
                operator: "equals",
                value: "",
            })
        ).toBe(true);
        expect(
            isReportFilterValueIncomplete({
                operator: "equals",
                value: "  ",
            })
        ).toBe(true);
        expect(
            isReportFilterValueIncomplete({
                operator: "equals",
                value: 0,
            })
        ).toBe(false);
    });

    it("validates between like the report builder", () => {
        expect(
            isReportFilterValueIncomplete({
                operator: "between",
                value: ["2024-01-01"],
            })
        ).toBe(true);
        expect(
            isReportFilterValueIncomplete({
                operator: "between",
                value: ["2024-01-01", "2024-12-31"],
            })
        ).toBe(false);
    });
});

describe("report filter viewer utilities", () => {
    const t = (
        _key: string,
        opts?: string | { defaultValue?: string }
    ) => (typeof opts === "string" ? opts : opts?.defaultValue) ?? _key;

    it("normalizeReportMetadataTables maps all tables including hidden", () => {
        const result = normalizeReportMetadataTables({
            tables: [
                {
                    name: "Invoice",
                    label: "Invoice",
                    hidden: true,
                    fields: [{ name: "amount", type: "number", label: "Amount" }],
                },
            ],
        });
        expect(result).toHaveLength(1);
        expect(result[0].fields).toHaveLength(1);
    });

    it("cloneReportFilters deep-clones preset objects", () => {
        const original = [
            {
                table: "Invoice",
                field: "created_at",
                operator: "equals",
                value: { __datePreset: "last_x_days", __datePresetInput: 30 },
            },
        ];
        const cloned = cloneReportFilters(original);
        (cloned[0].value as { __datePresetInput: number }).__datePresetInput = 7;
        expect(
            (original[0].value as { __datePresetInput: number }).__datePresetInput
        ).toBe(30);
    });

    it("areReportFiltersEqual compares filter rows", () => {
        const a = [
            { table: "Invoice", field: "amount", operator: "greater_than", value: 100 },
        ];
        const b = [
            { table: "Invoice", field: "amount", operator: "greater_than", value: 100 },
        ];
        expect(areReportFiltersEqual(a, b)).toBe(true);
        expect(
            areReportFiltersEqual(a, [
                { table: "Invoice", field: "amount", operator: "greater_than", value: 200 },
            ])
        ).toBe(false);
    });

    it("validateReportFilters flags incomplete values in viewer mode", () => {
        const errors = validateReportFilters(
            [
                {
                    table: "Invoice",
                    field: "amount",
                    operator: "equals",
                    value: "",
                },
            ],
            t,
            { skipTableFieldCheck: true }
        );
        expect(Object.keys(errors)).toHaveLength(1);
    });
});
