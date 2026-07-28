import { createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect } from "vitest";

vi.mock("@mui/icons-material", () => ({ Warning: () => null }));

import { generateViewColumns } from "@/shared/utils/viewColumnGenerator";

const theme = createTheme();
const t = vi.fn((key: string) => key);

describe("viewColumnGenerator", () => {
    it("should return GridColDef array from generateViewColumns", () => {
        const viewConfig = {
            fields: [
                { table: "Customer", field: "name", aggregation: undefined },
                { table: "Customer", field: "amount", aggregation: "SUM" },
            ],
        };
        const rows: any[] = [];
        const tablesMetadata = [
            {
                name: "Customer",
                fields: [
                    { name: "name", type: "string", label: "Name" },
                    { name: "amount", type: "number", label: "Amount" },
                ],
            },
        ];

        const columns = generateViewColumns({
            viewConfig,
            rows,
            tablesMetadata,
            context: "customers",
            tableName: "Customer",
            theme,
            router: {} as any,
            i18n: { language: "en" },
            t: t as any,
        });

        expect(Array.isArray(columns)).toBe(true);
        expect(columns.length).toBeGreaterThanOrEqual(2);
        expect(columns[0]).toHaveProperty("field");
        expect(columns[0]).toHaveProperty("headerName");
    });

    it("uses table label in header for COUNT aggregation (not field label)", () => {
        const viewConfig = {
            fields: [
                { table: "Invoice", field: "id", aggregation: "COUNT" },
            ],
        };
        const tablesMetadata = [
            {
                name: "Invoice",
                label: "Invoices",
                fields: [
                    { name: "id", type: "integer", label: "Identifier" },
                ],
            },
        ];

        const columns = generateViewColumns({
            viewConfig,
            rows: [],
            tablesMetadata,
            context: "invoices",
            tableName: "Invoice",
            theme,
            router: {} as any,
            i18n: { language: "en" },
            t: t as any,
            enableAggregation: true,
        });

        const countCol = columns.find((c) => c.field === "Invoice.id__COUNT");
        expect(countCol).toBeDefined();
        expect(String(countCol?.headerName)).toContain("Invoices");
        expect(String(countCol?.headerName)).not.toContain("Identifier");
    });

    it("resolves Customer.InsurancePolicy.policy_number from flat row key", () => {
        const viewConfig = {
            fields: [
                {
                    table: "Customer",
                    field: "InsurancePolicy.policy_number",
                    aggregation: undefined,
                },
            ],
        };
        const tablesMetadata = [
            {
                name: "Customer",
                fields: [
                    {
                        name: "InsurancePolicy.policy_number",
                        type: "string",
                        label: "Insurance Policy",
                    },
                ],
            },
        ];
        const key = "Customer.InsurancePolicy.policy_number";
        const rows = [{ [key]: "PN-999" }];

        const columns = generateViewColumns({
            viewConfig,
            rows,
            tablesMetadata,
            context: "customers",
            tableName: "Customer",
            theme,
            router: {} as any,
            i18n: { language: "en" },
            t: t as any,
        });

        const col = columns.find((c) => c.field === key);
        expect(col).toBeDefined();
        const vg = col?.valueGetter as ((p: { row: any }) => any) | undefined;
        expect(vg?.({ row: rows[0], value: undefined })).toBe("PN-999");
    });

    it("renders aggregated amount from flat Invoice.amount__SUM key", () => {
        const viewConfig = {
            fields: [
                { table: "Invoice", field: "amount", aggregation: "SUM" },
            ],
        };
        const tablesMetadata = [
            {
                name: "Invoice",
                fields: [
                    { name: "amount", type: "Decimal", label: "Amount" },
                ],
            },
        ];
        const key = "Invoice.amount__SUM";
        const rows = [
            {
                id: "group-1",
                [key]: 65,
                "___formatted_Invoice.amount__SUM": "ILS 65.00",
            },
        ];

        const columns = generateViewColumns({
            viewConfig,
            rows,
            tablesMetadata,
            context: "reports",
            tableName: "Customer",
            theme,
            router: {} as any,
            i18n: { language: "en" },
            t: t as any,
            enableAggregation: true,
        });

        const col = columns.find((c) => c.field === key);
        expect(col?.renderCell).toBeDefined();

        const renderCell = col?.renderCell as (p: {
            row: (typeof rows)[0];
            field: string;
            value: unknown;
        }) => React.ReactNode;

        render(
            <>
                {renderCell({
                    row: rows[0],
                    field: key,
                    value: rows[0][key],
                })}
            </>
        );

        expect(screen.getByText("ILS 65.00")).toBeInTheDocument();
    });

    it("falls back to raw aggregated value when formatted string is empty", () => {
        const viewConfig = {
            fields: [
                { table: "Invoice", field: "amount", aggregation: "SUM" },
            ],
        };
        const tablesMetadata = [
            {
                name: "Invoice",
                fields: [
                    { name: "amount", type: "Decimal", label: "Amount" },
                ],
            },
        ];
        const key = "Invoice.amount__SUM";
        const rows = [
            {
                id: "group-1",
                [key]: 65,
                "___formatted_Invoice.amount__SUM": "",
            },
        ];

        const columns = generateViewColumns({
            viewConfig,
            rows,
            tablesMetadata,
            context: "reports",
            tableName: "Customer",
            theme,
            router: {} as any,
            i18n: { language: "en" },
            t: t as any,
            enableAggregation: true,
        });

        const col = columns.find((c) => c.field === key);
        const renderCell = col?.renderCell as (p: {
            row: (typeof rows)[0];
            field: string;
            value: unknown;
        }) => React.ReactNode;

        render(
            <>
                {renderCell({
                    row: rows[0],
                    field: key,
                    value: rows[0][key],
                })}
            </>
        );

        expect(screen.getByText("65")).toBeInTheDocument();
    });

    it("renders placeholder when value is null/blank", () => {
        const viewConfig = {
            fields: [{ table: "Customer", field: "name", aggregation: undefined }],
        };
        const tablesMetadata = [
            {
                name: "Customer",
                fields: [{ name: "name", type: "string", label: "Name" }],
            },
        ];
        const rows = [{ id: 1, "Customer.name": null }];
        const columns = generateViewColumns({
            viewConfig,
            rows,
            tablesMetadata,
            context: "customers",
            tableName: "Customer",
            theme,
            router: {} as any,
            i18n: { language: "en" },
            t: t as any,
        });

        const nameCol = columns.find((c) => c.field === "Customer.name" || c.field === "name");
        const renderCell = nameCol?.renderCell as (p: {
            row: (typeof rows)[0];
            field: string;
            value: unknown;
        }) => React.ReactNode;

        render(
            <>
                {renderCell({
                    row: rows[0],
                    field: nameCol!.field,
                    value: rows[0]["Customer.name"],
                })}
            </>
        );

        expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("renders em dash for category when hideCollectionCategoryDisplay is true", () => {
        const viewConfig = {
            fields: [{ table: "Customer", field: "category", aggregation: undefined }],
        };
        const tablesMetadata = [
            {
                name: "Customer",
                fields: [{ name: "category", type: "string", label: "Category" }],
            },
        ];
        const rows = [{ category: "Automated (2)" }];

        const columns = generateViewColumns({
            viewConfig,
            rows,
            tablesMetadata,
            context: "customers",
            tableName: "Customer",
            theme,
            router: {} as any,
            i18n: { language: "en" },
            t: t as any,
            hideCollectionCategoryDisplay: true,
        });

        const categoryCol = columns.find(
            (c) => c.field === "Customer.category" || c.field === "category"
        );
        const renderCell = categoryCol?.renderCell as (p: {
            row: (typeof rows)[0];
            field: string;
            value: unknown;
        }) => React.ReactNode;

        expect(categoryCol).toBeDefined();
        render(
            <>
                {renderCell({
                    row: rows[0],
                    field: categoryCol!.field,
                    value: rows[0].category,
                })}
            </>
        );

        expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("includes interleaved formula columns with formula labels", () => {
        const viewConfig = {
            fields: [
                { table: "Invoice", field: "amount" },
                { table: "Customer", field: "cost_percent" },
            ],
            formulas: [
                {
                    id: "f1",
                    label: "Premium",
                    expression: "[Invoice.amount]*[Customer.cost_percent]/100",
                    format: "number",
                },
            ],
            columnOrder: [
                "Invoice.amount",
                "formula:f1",
                "Customer.cost_percent",
            ],
        };
        const tablesMetadata = [
            {
                name: "Invoice",
                fields: [{ name: "amount", type: "number", label: "Amount" }],
            },
            {
                name: "Customer",
                fields: [
                    {
                        name: "cost_percent",
                        type: "number",
                        label: "Insurance Premium Rate (%)",
                    },
                ],
            },
        ];

        const columns = generateViewColumns({
            viewConfig,
            rows: [
                {
                    "Invoice.amount": 100,
                    "Customer.cost_percent": 5,
                    "formula:f1": 5,
                    "___formatted_formula:f1": "5",
                },
            ],
            tablesMetadata,
            context: "reports",
            tableName: "Invoice",
            theme,
            router: {} as any,
            i18n: { language: "en" },
            t: t as any,
        });

        expect(columns.map((c) => c.field)).toEqual([
            "Invoice.amount",
            "formula:f1",
            "Customer.cost_percent",
        ]);
        expect(columns.find((c) => c.field === "formula:f1")?.headerName).toBe(
            "Premium"
        );
    });

    it("keeps Customer.name clickable when ___formatted_ is present (Nest execute)", () => {
        const push = vi.fn();
        const viewConfig = {
            fields: [{ table: "Customer", field: "name" }],
        };
        const tablesMetadata = [
            {
                name: "Customer",
                fields: [{ name: "name", type: "string", label: "Name" }],
            },
        ];
        const columns = generateViewColumns({
            viewConfig,
            rows: [
                {
                    id: 15,
                    customer_id: 15,
                    "Customer.name": "Acme",
                    "___formatted_Customer.name": "Acme",
                    "__link_Customer.name": { type: "customer", id: 15 },
                },
            ],
            tablesMetadata,
            context: "customers",
            tableName: "Customer",
            theme,
            router: { push } as any,
            i18n: { language: "en" },
            t: t as any,
            linkHandlers: {
                customer: (id: number) => `/app/customers/${id}`,
            },
        });

        const nameCol = columns.find((c) => c.field === "Customer.name");
        expect(nameCol?.renderCell).toBeDefined();
        const cell = nameCol!.renderCell!({
            row: {
                id: 15,
                customer_id: 15,
                "Customer.name": "Acme",
                "___formatted_Customer.name": "Acme",
                "__link_Customer.name": { type: "customer", id: 15 },
            },
            value: "Acme",
        } as any);

        render(<>{cell}</>);
        const link = screen.getByText("Acme");
        expect(link).toHaveAttribute("data-cell-link", "true");
    });
});
