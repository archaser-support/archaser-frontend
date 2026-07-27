import { describe, it, expect, vi } from "vitest";
import {
    getFieldLabel,
    translateEnumValue,
    isAmountField,
    isBooleanField,
    isDateField,
    isEnumField,
} from "@/shared/utils/viewFieldHelpers";

const tablesMetadata = [
    {
        name: "Customer",
        label: "Customer",
        fields: [
            { name: "id", type: "string", label: "ID" },
            { name: "name", type: "string", label: "Name" },
            {
                name: "amount",
                type: "number",
                label: "Amount",
                translationKey: "amount",
                translationNamespace: "reports",
            },
            {
                name: "status",
                type: "enum",
                label: "Status",
                translationKey: "status",
                translationNamespace: "common",
                enumValueKeyPrefix: "status",
            },
            {
                name: "is_active",
                type: "boolean",
                label: "Active",
            },
            {
                name: "created_at",
                type: "datetime",
                label: "Created At",
            },
        ],
    },
    {
        name: "Country",
        label: "Country",
        fields: [
            { name: "id", type: "string", label: "ID" },
            {
                name: "name",
                type: "string",
                label: "Country",
                translationKey: "country",
                translationNamespace: "common",
            },
        ],
    },
    {
        name: "Invoice",
        label: "Invoice",
        fields: [
            { name: "id", type: "string", label: "ID" },
            { name: "total_amount", type: "number", label: "Total" },
            { name: "status", type: "enum", label: "Status" },
            { name: "due_date", type: "date", label: "Due Date" },
        ],
    },
];

describe("viewFieldHelpers", () => {
    describe("getFieldLabel", () => {
        it("should return translated label when metadata has translationKey and translationNamespace", () => {
            const t = vi.fn((key: string, opts?: { ns?: string }) => {
                if (key === "fields.amount" && opts?.ns === "reports")
                    return "Amount (translated)";
                return key;
            });
            const label = getFieldLabel(
                "Customer",
                "amount",
                tablesMetadata,
                t as any
            );
            expect(label).toBe("Amount (translated)");
            expect(t).toHaveBeenCalledWith("fields.amount", {
                ns: "reports",
            });
        });

        it("should return relation field translated label for dotted field when relation has translation keys", () => {
            const t = vi.fn((key: string, opts?: { ns?: string }) => {
                if (key === "fields.country" && opts?.ns === "common")
                    return "Country (translated)";
                return key;
            });
            const label = getFieldLabel(
                "Customer",
                "Country.name",
                tablesMetadata,
                t as any
            );
            expect(label).toBe("Country (translated)");
        });

        it("should fallback to field label when no translation key", () => {
            const t = vi.fn((key: string) => key);
            const label = getFieldLabel(
                "Customer",
                "name",
                tablesMetadata,
                t as any
            );
            expect(label).toBe("Name");
        });

        it("should fallback to field name when field not in metadata", () => {
            const t = vi.fn((key: string) => key);
            const label = getFieldLabel(
                "Customer",
                "unknown_field",
                tablesMetadata,
                t as any
            );
            expect(label).toBe("unknown_field");
        });
    });

    describe("translateEnumValue", () => {
        it("should call t with values.{prefix}_{value} and return translation", () => {
            const t = vi.fn((key: string, opts?: { ns?: string }) => {
                if (key === "values.status_active" && opts?.ns === "common")
                    return "Active";
                return key;
            });
            const result = translateEnumValue(
                { table: "Customer", field: "status" },
                "active",
                t as any,
                "customers",
                tablesMetadata
            );
            expect(result).toBe("Active");
            expect(t).toHaveBeenCalledWith("values.status_active", {
                ns: "common",
            });
        });

        it("should return empty string for null, undefined, empty, or dash", () => {
            const t = vi.fn((key: string) => key);
            expect(
                translateEnumValue(
                    { table: "Invoice", field: "status" },
                    null,
                    t as any
                )
            ).toBe("");
            expect(
                translateEnumValue(
                    { table: "Invoice", field: "status" },
                    undefined,
                    t as any
                )
            ).toBe("");
            expect(
                translateEnumValue(
                    { table: "Invoice", field: "status" },
                    "",
                    t as any
                )
            ).toBe("");
            expect(
                translateEnumValue(
                    { table: "Invoice", field: "status" },
                    "-",
                    t as any
                )
            ).toBe("");
        });

        it("should handle status 1/0 as active/inactive", () => {
            const t = vi.fn((key: string, opts?: { ns?: string }) => {
                if (key === "values.status_active") return "Active";
                if (key === "values.status_inactive") return "Inactive";
                return key;
            });
            expect(
                translateEnumValue(
                    { table: "Contact", field: "status" },
                    1,
                    t as any
                )
            ).toBe("Active");
            expect(
                translateEnumValue(
                    { table: "Contact", field: "status" },
                    0,
                    t as any
                )
            ).toBe("Inactive");
        });

        it("formats call_outcome snake_case via activities outcomes translations", () => {
            const t = vi.fn((key: string, opts?: { ns?: string }) => {
                if (
                    key === "values.outcomes_schedule_follow_up" &&
                    opts?.ns === "activities"
                ) {
                    return "Schedule Follow-up Call";
                }
                if (
                    key === "values.outcomes_no_answer" &&
                    opts?.ns === "activities"
                ) {
                    return "No Answer";
                }
                return key;
            });
            expect(
                translateEnumValue(
                    { table: "Activity", field: "call_outcome" },
                    "schedule_follow_up",
                    t as any
                )
            ).toBe("Schedule Follow-up Call");
            expect(
                translateEnumValue(
                    { table: "Activity", field: "call_outcome" },
                    "no_answer",
                    t as any
                )
            ).toBe("No Answer");
            expect(t).toHaveBeenCalledWith("values.outcomes_schedule_follow_up", {
                ns: "activities",
            });
        });

        it("title-cases unknown call_outcome snake_case tokens", () => {
            const t = vi.fn((key: string) => key);
            expect(
                translateEnumValue(
                    { table: "Activity", field: "call_outcome" },
                    "some_custom_outcome",
                    t as any
                )
            ).toBe("Some Custom Outcome");
        });
    });

    describe("isAmountField", () => {
        it("should return true for field names containing amount, price, cost, debt, balance, total_invoices_overdue, overdue_sum, outstanding", () => {
            expect(
                isAmountField(
                    { table: "Invoice", field: "total_amount" },
                    tablesMetadata
                )
            ).toBe(true);
            expect(
                isAmountField(
                    { table: "Invoice", field: "price" },
                    tablesMetadata
                )
            ).toBe(true);
            expect(
                isAmountField(
                    { table: "Invoice", field: "outstanding_balance" },
                    tablesMetadata
                )
            ).toBe(true);
        });

        it("should return true when metadata type is number/Float/Decimal and name suggests amount", () => {
            expect(
                isAmountField(
                    { table: "Customer", field: "amount" },
                    tablesMetadata
                )
            ).toBe(true);
        });

        it("should return false for non-amount fields", () => {
            expect(
                isAmountField(
                    { table: "Customer", field: "name" },
                    tablesMetadata
                )
            ).toBe(false);
            expect(
                isAmountField(
                    { table: "Customer", field: "status" },
                    tablesMetadata
                )
            ).toBe(false);
        });

        it("should return false when fieldConfig is null/undefined", () => {
            expect(isAmountField(null, tablesMetadata)).toBe(false);
            expect(isAmountField(undefined, tablesMetadata)).toBe(false);
        });
    });

    describe("isBooleanField", () => {
        it("should return true when metadata type is boolean, Boolean, or bool", () => {
            expect(
                isBooleanField(
                    { table: "Customer", field: "is_active" },
                    tablesMetadata
                )
            ).toBe(true);
        });

        it("should return false for enum-like fields by name (status, type, category, collection_status)", () => {
            expect(
                isBooleanField(
                    { table: "Customer", field: "status" },
                    tablesMetadata
                )
            ).toBe(false);
        });

        it("should return true for field names matching boolean patterns (receives_, is_, has_, enabled, disabled)", () => {
            const meta = [
                {
                    name: "X",
                    fields: [
                        { name: "is_verified", type: "string", label: "Verified" },
                    ],
                },
            ];
            expect(
                isBooleanField({ table: "X", field: "is_verified" }, meta)
            ).toBe(true);
        });

        it("should return false when fieldConfig is null/undefined", () => {
            expect(isBooleanField(null, tablesMetadata)).toBe(false);
        });
    });

    describe("isDateField", () => {
        it("should return true when metadata type is date, datetime, or timestamp", () => {
            expect(
                isDateField(
                    { table: "Customer", field: "created_at" },
                    tablesMetadata
                )
            ).toBe(true);
            expect(
                isDateField(
                    { table: "Invoice", field: "due_date" },
                    tablesMetadata
                )
            ).toBe(true);
        });

        it("should return true when field name includes date or time", () => {
            const meta = [
                {
                    name: "X",
                    fields: [{ name: "some_date", type: "string", label: "Date" }],
                },
            ];
            expect(
                isDateField({ table: "X", field: "some_date" }, meta)
            ).toBe(true);
        });

        it("should return false for non-date fields", () => {
            expect(
                isDateField(
                    { table: "Customer", field: "name" },
                    tablesMetadata
                )
            ).toBe(false);
        });

        it("should return false when fieldConfig is null/undefined", () => {
            expect(isDateField(null, tablesMetadata)).toBe(false);
        });
    });

    describe("isEnumField", () => {
        it("should return true when metadata type is enum, picklist, or select", () => {
            expect(
                isEnumField(
                    { table: "Customer", field: "status" },
                    tablesMetadata
                )
            ).toBe(true);
            expect(
                isEnumField(
                    { table: "Invoice", field: "status" },
                    tablesMetadata
                )
            ).toBe(true);
        });

        it("should return true for known enum field names (category, current_category, collection_status, type, status)", () => {
            const meta = [
                {
                    name: "X",
                    fields: [{ name: "type", type: "string", label: "Type" }],
                },
            ];
            expect(isEnumField({ table: "X", field: "type" }, meta)).toBe(true);
        });

        it("should return false for non-enum fields", () => {
            expect(
                isEnumField(
                    { table: "Customer", field: "name" },
                    tablesMetadata
                )
            ).toBe(false);
        });

        it("should return false when fieldConfig is null/undefined", () => {
            expect(isEnumField(null, tablesMetadata)).toBe(false);
        });
    });
});
