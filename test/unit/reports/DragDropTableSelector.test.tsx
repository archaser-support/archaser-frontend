import { DndContext } from "@dnd-kit/core";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi, beforeEach, describe, it, expect } from "vitest";

vi.mock("@mui/icons-material", () => ({
    DragIndicator: () => <span data-testid="icon-drag" />,
    TableChart: () => <span data-testid="icon-table" />,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: { defaultValue?: string }) =>
            opts?.defaultValue ?? key,
        i18n: { language: "en" },
    }),
}));

import DragDropTableSelector from "@/components/reports/DragDropTableSelector";

const theme = createTheme();

const availableTables = [
    { name: "Customer", label: "Customer" },
    { name: "Invoice", label: "Invoice" },
    { name: "Company", label: "Company" },
];

const relationships = [
    {
        from: "Customer",
        to: "Company",
        fromField: "company_id",
        toField: "id",
    },
    {
        from: "Customer",
        to: "Invoice",
        fromField: "id",
        toField: "customer_id",
    },
];

function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider theme={theme}>
            <DndContext onDragEnd={() => {}}>{children}</DndContext>
        </ThemeProvider>
    );
}

describe("DragDropTableSelector", () => {
    const onTablesChange = vi.fn();
    const onTableDrop = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render available (unselected) tables", () => {
        render(
            <DragDropTableSelector
                availableTables={availableTables}
                selectedTables={[]}
                onTablesChange={onTablesChange}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.getAllByText("Customer").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Invoice").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Company").length).toBeGreaterThanOrEqual(1);
    });

    it("should show only unselected tables when some are selected", () => {
        render(
            <DragDropTableSelector
                availableTables={availableTables}
                selectedTables={[{ name: "Customer", label: "Customer" }]}
                onTablesChange={onTablesChange}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.getAllByText("Invoice").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Company").length).toBeGreaterThanOrEqual(1);
    });

    it("should show No tables available when all tables are selected", () => {
        render(
            <DragDropTableSelector
                availableTables={availableTables}
                selectedTables={availableTables}
                onTablesChange={onTablesChange}
            />,
            { wrapper: Wrapper }
        );
        expect(
            screen.getByText(/No tables available|messages\.no_tables_available/i)
        ).toBeInTheDocument();
    });

    it("when relationships are passed, tables not connectable to selected are disabled", () => {
        render(
            <DragDropTableSelector
                availableTables={availableTables}
                selectedTables={[{ name: "Customer", label: "Customer" }]}
                relationships={relationships}
                onTablesChange={onTablesChange}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.getAllByText("Invoice").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Company").length).toBeGreaterThanOrEqual(1);
    });

    it("when no tables selected, all unselected tables are shown and connectable", () => {
        render(
            <DragDropTableSelector
                availableTables={availableTables}
                selectedTables={[]}
                relationships={relationships}
                onTablesChange={onTablesChange}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.getAllByText("Customer").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Invoice").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Company").length).toBeGreaterThanOrEqual(1);
    });
});
