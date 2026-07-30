import type { TFunction } from "i18next";
import { describe, it, expect, vi } from "vitest";

// Mock MUI icons so reportFieldUtils loads without EMFILE or hang (icons are not asserted directly)
vi.mock("@mui/icons-material", () => ({
    Numbers: () => null,
    CalendarToday: () => null,
    List: () => null,
    TextFields: () => null,
    ToggleOn: () => null,
}));

import {
    getFieldTypeIcon,
    getFieldTypeCategory,
    isNumericField,
    normalizeFieldName,
    getTableFields,
    type Table,
} from "@/utils/reportFieldUtils";

const minimalTables: Table[] = [
    {
        name: "Customer",
        label: "Customer",
        fields: [
            { name: "id", type: "string", label: "ID" },
            { name: "name", type: "string", label: "Name" },
            {
                name: "crn",
                type: "string",
                label: "CRN",
                translationKey: "crn",
                translationNamespace: "customers",
            },
            { name: "amount", type: "number", label: "Amount", translationKey: "amount", translationNamespace: "reports" },
            { name: "owner_id", type: "user", label: "Owner" },
        ],
    },
    {
        name: "Company",
        label: "Company",
        fields: [
            { name: "id", type: "string", label: "ID" },
            { name: "name", type: "string", label: "Name" },
            { name: "Company.foo", type: "string", label: "Foo" },
        ],
    },
    {
        name: "Invoice",
        label: "Invoice",
        fields: [
            { name: "id", type: "string", label: "ID" },
            { name: "customer_id", type: "string", label: "Customer" },
            { name: "amount", type: "number", label: "Amount" },
            { name: "status", type: "enum", label: "Status" },
        ],
    },
];

describe("reportFieldUtils", () => {
    describe("getFieldTypeIcon", () => {
        it("should return same icon for number, decimal, integer", () => {
            const numIcon = getFieldTypeIcon("number");
            expect(numIcon).toBe(getFieldTypeIcon("decimal"));
            expect(numIcon).toBe(getFieldTypeIcon("integer"));
            expect(numIcon).toBe(getFieldTypeIcon("NUMBER"));
            expect(numIcon).toBeDefined();
        });

        it("should return same icon for date, datetime, timestamp", () => {
            const dateIcon = getFieldTypeIcon("date");
            expect(dateIcon).toBe(getFieldTypeIcon("datetime"));
            expect(dateIcon).toBe(getFieldTypeIcon("timestamp"));
            expect(dateIcon).toBeDefined();
        });

        it("should return same icon for boolean, bool", () => {
            const boolIcon = getFieldTypeIcon("boolean");
            expect(boolIcon).toBe(getFieldTypeIcon("bool"));
            expect(boolIcon).toBeDefined();
        });

        it("should return same icon for enum, picklist, select", () => {
            const enumIcon = getFieldTypeIcon("enum");
            expect(enumIcon).toBe(getFieldTypeIcon("picklist"));
            expect(enumIcon).toBe(getFieldTypeIcon("select"));
            expect(enumIcon).toBeDefined();
        });

        it("should return same icon for string, user, and unknown types", () => {
            const strIcon = getFieldTypeIcon("string");
            expect(strIcon).toBe(getFieldTypeIcon("text"));
            expect(strIcon).toBe(getFieldTypeIcon("user"));
            expect(strIcon).toBe(getFieldTypeIcon("unknown_type"));
            expect(strIcon).toBeDefined();
        });

        it("should return default icon for empty or undefined type", () => {
            expect(getFieldTypeIcon("")).toBeDefined();
            expect(getFieldTypeIcon(undefined as any)).toBeDefined();
        });
    });

    describe("getFieldTypeCategory", () => {
        it("should return number for number, decimal, integer", () => {
            expect(getFieldTypeCategory("number")).toBe("number");
            expect(getFieldTypeCategory("decimal")).toBe("number");
            expect(getFieldTypeCategory("integer")).toBe("number");
        });

        it("should return date for date, datetime, timestamp", () => {
            expect(getFieldTypeCategory("date")).toBe("date");
            expect(getFieldTypeCategory("datetime")).toBe("date");
            expect(getFieldTypeCategory("timestamp")).toBe("date");
        });

        it("should return enum for enum, picklist, select", () => {
            expect(getFieldTypeCategory("enum")).toBe("enum");
            expect(getFieldTypeCategory("picklist")).toBe("enum");
            expect(getFieldTypeCategory("select")).toBe("enum");
        });

        it("should return string for string, user, and unknown", () => {
            expect(getFieldTypeCategory("string")).toBe("string");
            expect(getFieldTypeCategory("user")).toBe("string");
            expect(getFieldTypeCategory("unknown")).toBe("string");
        });
    });

    describe("isNumericField", () => {
        it("should return true for number, decimal, integer (case-insensitive)", () => {
            expect(isNumericField("number")).toBe(true);
            expect(isNumericField("decimal")).toBe(true);
            expect(isNumericField("integer")).toBe(true);
            expect(isNumericField("NUMBER")).toBe(true);
        });

        it("should return false for non-numeric types", () => {
            expect(isNumericField("string")).toBe(false);
            expect(isNumericField("date")).toBe(false);
            expect(isNumericField("enum")).toBe(false);
            expect(isNumericField("")).toBe(false);
            expect(isNumericField(undefined)).toBe(false);
        });
    });

    describe("normalizeFieldName", () => {
        it("should strip Company. prefix for Customer table", () => {
            expect(normalizeFieldName("Customer", "Company.foo")).toBe("foo");
        });

        it("should not change other table or non-Company field", () => {
            expect(normalizeFieldName("Customer", "name")).toBe("name");
            expect(normalizeFieldName("Invoice", "Company.amount")).toBe("Company.amount");
            expect(normalizeFieldName("Company", "name")).toBe("name");
        });
    });

    describe("getTableFields", () => {
        const t = vi.fn((key: string, opts?: { ns?: string; defaultValue?: string }) => opts?.defaultValue ?? key) as unknown as TFunction;

        it("should return empty array when table does not exist", () => {
            expect(getTableFields("NonExistent", minimalTables, t)).toEqual([]);
        });

        it("should filter out id and *_id fields except owner/owner_id", () => {
            const fields = getTableFields("Invoice", minimalTables, t);
            const names = fields.map((f) => f.name);
            expect(names).not.toContain("id");
            expect(names).not.toContain("customer_id");
            expect(names).toContain("created_by");
            expect(names).toContain("modified_by");
        });

        it("should return translated label when translationKey and translationNamespace are set", () => {
            const tTranslate = vi.fn((key: string, opts?: { ns?: string; defaultValue?: string }) => {
                if (key === "fields.amount" && opts?.ns === "reports") return "Amount (translated)";
                return opts?.defaultValue ?? key;
            }) as unknown as TFunction;
            const fields = getTableFields("Customer", minimalTables, tTranslate);
            const amountField = fields.find((f) => f.name === "amount");
            expect(amountField).toBeDefined();
            expect(amountField!.label).toBe("Amount (translated)");
        });

        it("should translate Customer.crn when translationKey is set", () => {
            const tTranslate = vi.fn((key: string, opts?: { ns?: string; defaultValue?: string }) => {
                if (key === "fields.crn" && opts?.ns === "customers") {
                    return "מספר ח.פ.";
                }
                return opts?.defaultValue ?? key;
            }) as unknown as TFunction;
            const fields = getTableFields("Customer", minimalTables, tTranslate);
            const crnField = fields.find((f) => f.name === "crn");
            expect(crnField).toBeDefined();
            expect(crnField!.label).toBe("מספר ח.פ.");
        });

        it("should merge Company fields for Customer table when Company exists", () => {
            const fields = getTableFields("Customer", minimalTables, t);
            const names = fields.map((f) => f.name);
            expect(names).toContain("crn");
            expect(names).toContain("Company.foo");
            expect(names).toContain("created_by");
            expect(names).toContain("modified_by");
        });

        it("should include Business Unit field for Customer table with customers translation", () => {
            const tTranslate = vi.fn((key: string, opts?: { ns?: string; defaultValue?: string }) => {
                if (key === "fields.business_unit" && opts?.ns === "customers") {
                    return "Business Unit (translated)";
                }
                return opts?.defaultValue ?? key;
            }) as unknown as TFunction;
            const fields = getTableFields("Customer", minimalTables, tTranslate);
            const buField = fields.find((f) => f.name === "BusinessUnit.name");
            expect(buField).toBeDefined();
            expect(buField!.label).toBe("Business Unit (translated)");
        });

        it("should not duplicate created_by or modified_by when already in table metadata", () => {
            const tablesWithAudit: Table[] = [
                {
                    name: "Activity",
                    label: "Activity",
                    fields: [
                        { name: "title", type: "string", label: "Title" },
                        {
                            name: "created_by",
                            type: "user",
                            label: "Created By (metadata)",
                        },
                        {
                            name: "modified_by",
                            type: "user",
                            label: "Modified By (metadata)",
                        },
                    ],
                },
            ];
            const fields = getTableFields("Activity", tablesWithAudit, t);
            const createdBy = fields.filter((f) => f.name === "created_by");
            const modifiedBy = fields.filter((f) => f.name === "modified_by");
            expect(createdBy).toHaveLength(1);
            expect(modifiedBy).toHaveLength(1);
            expect(createdBy[0].label).toBe("Created By (metadata)");
            expect(modifiedBy[0].label).toBe("Modified By (metadata)");
        });

        it("unknown field type falls back to string for icon/category", () => {
            expect(getFieldTypeIcon("custom_type")).toBeDefined();
            expect(getFieldTypeCategory("custom_type")).toBe("string");
        });
    });
});
