import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi, beforeEach, describe, it, expect } from "vitest";

import { minimalTables } from "@/test/fixtures/reports";
import type { Table } from "@/utils/reportFieldUtils";

vi.mock("@mui/icons-material", () => {
    const MockIcon = () => <span data-testid="mock-icon" />;
    return {
        DragIndicator: MockIcon,
        Numbers: MockIcon,
        CalendarToday: MockIcon,
        TextFields: MockIcon,
        List: MockIcon,
        Functions: MockIcon,
        Search: MockIcon,
        ExpandMore: MockIcon,
        FilterList: MockIcon,
        Close: MockIcon,
        ArrowUpward: MockIcon,
        ArrowDownward: MockIcon,
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: { defaultValue?: string }) =>
            opts?.defaultValue ?? key,
        i18n: { language: "en" },
    }),
}));

// Same approach as ShareReportModal: mock the heavy dependency so it is never loaded (avoids hang).
// Here reportFieldUtils imports @mui/icons-material; we provide a full mock so the real module is not loaded.
vi.mock("@/utils/reportFieldUtils", () => ({
    getFieldTypeIcon: () => () => <span data-testid="field-icon" />,
    isNumericField: (type: string) => /number|decimal|integer/i.test(type ?? ""),
    getFieldTypeCategory: (type: string) => {
        const n = (type ?? "").toLowerCase();
        if (/number|decimal|integer/.test(n)) return "number";
        if (/date|datetime|timestamp/.test(n)) return "date";
        if (/enum|picklist|select/.test(n)) return "enum";
        return "string";
    },
    isIdField: (fieldName: string) => {
        const n = fieldName.toLowerCase();
        return n === "id" || n.endsWith("_id");
    },
    getTableFields: (tableName: string, tables: { name: string; fields: unknown[] }[]) => {
        const t = tables.find((tb) => tb.name === tableName);
        if (!t) return [];
        return (t.fields as { name: string; type: string; label: string }[]).map((f) => ({
            name: f.name,
            type: f.type,
            label: f.label,
        }));
    },
    getRTLTooltipProps: () => ({ arrow: true, enterDelay: 300 }),
}));

vi.mock("@/shared/layout-components/grid/components/EmptyState", () => ({
    default: ({ message }: { message?: string }) => (
        <div data-testid="empty-state">{message ?? "Empty"}</div>
    ),
}));

import DragDropFieldSelector from "@/components/reports/DragDropFieldSelector";

const theme = createTheme();

const tables = minimalTables as Table[];

const selectedTables = [
    { name: "Invoice", label: "Invoice" },
];

const selectedFields = [
    { table: "Invoice", field: "amount", aggregation: undefined as string | undefined },
];

function Wrapper({ children }: { children: React.ReactNode }) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 1 } })
    );
    return (
        <ThemeProvider theme={theme}>
            <DndContext sensors={sensors} onDragEnd={() => {}}>
                <SortableContext items={[]}>{children}</SortableContext>
            </DndContext>
        </ThemeProvider>
    );
}

describe("DragDropFieldSelector", () => {
    const onFieldsChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render with selected tables and selected fields", () => {
        render(
            <DragDropFieldSelector
                selectedTables={selectedTables}
                tables={tables}
                selectedFields={selectedFields}
                onFieldsChange={onFieldsChange}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.getAllByText("Invoice").length).toBeGreaterThanOrEqual(1);
    });

    it("should not crash when selectedTables is empty", () => {
        render(
            <DragDropFieldSelector
                selectedTables={[]}
                tables={tables}
                selectedFields={[]}
                onFieldsChange={onFieldsChange}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.queryByTestId("empty-state")).toBeInTheDocument();
    });

    it("should render selected field with aggregation when provided", () => {
        const fieldsWithAgg = [
            { table: "Invoice", field: "amount", aggregation: "SUM" as const },
        ];
        render(
            <DragDropFieldSelector
                selectedTables={selectedTables}
                tables={tables}
                selectedFields={fieldsWithAgg}
                onFieldsChange={onFieldsChange}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.getByText("SUM")).toBeInTheDocument();
    });

    it("renders selected Customer relation field with multiple dots in field name", () => {
        render(
            <DragDropFieldSelector
                selectedTables={[{ name: "Customer", label: "Customer" }]}
                tables={tables}
                selectedFields={[
                    {
                        table: "Customer",
                        field: "InsurancePolicy.policy_number",
                        aggregation: undefined,
                    },
                ]}
                onFieldsChange={onFieldsChange}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.getAllByText("Insurance Policy").length).toBeGreaterThan(
            0
        );
    });
});
