import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, beforeEach, describe, it, expect } from "vitest";

import FilterBuilder, {
    REPORT_LOOKUP_FIELD_KEYS_WITH_IN,
} from "@/components/reports/FilterBuilder";
import api from "@/app/api";
import { minimalTables } from "@/test/fixtures/reports";
import type { Table } from "@/utils/reportFieldUtils";

// Same approach as ShareReportModal / DragDropFieldSelector: mock heavy deps so they are never loaded (avoids hang).
vi.mock("@/utils/reportFieldUtils", () => ({}));

// Mock MUI icons so FilterBuilder loads without hang
vi.mock("@mui/icons-material", () => ({
    Add: () => <span data-testid="icon-add" />,
    Clear: () => <span data-testid="icon-clear" />,
    Delete: () => <span data-testid="icon-delete" />,
    ExpandLess: () => <span data-testid="icon-expand-less" />,
    ExpandMore: () => <span data-testid="icon-expand-more" />,
    Person: () => <span data-testid="icon-person" />,
    Search: () => <span data-testid="icon-search" />,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: { ns?: string; defaultValue?: string }) =>
            opts?.defaultValue ?? key,
        i18n: { language: "en", changeLanguage: vi.fn() },
    }),
}));

vi.mock("@/hooks/useSessionState", () => ({
    useSessionState: () => ({
        session: {
            user: { account_id: 1, view_as_user_account_id: 1, id: "u1" },
        },
        isSessionReady: true,
        sessionError: null,
    }),
}));

vi.mock("@/app/api", () => ({
    default: {
        get: vi.fn(),
    },
}));

vi.mock("@/utils/datePresetUtils", () => ({
    isDatePresetValue: vi.fn(() => false),
    resolveDatePreset: vi.fn(() => ({ start: null, end: null })),
}));

vi.mock("@/utils/datetimeOperations", () => ({
    formatDateForDisplay: vi.fn((d: Date) => d?.toISOString?.() ?? ""),
    getUserTimezone: vi.fn(() => "UTC"),
    getDatePickerFormat: vi.fn(() => "yyyy-MM-dd"),
    getUserDateLocale: vi.fn(() => "en-US"),
}));

vi.mock("@mui/x-date-pickers/DatePicker", () => ({
    DatePicker: ({ value, onChange }: any) => (
        <input
            data-testid="date-picker"
            aria-label="date"
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
        />
    ),
}));

vi.mock("@mui/x-date-pickers/DateTimePicker", () => ({
    DateTimePicker: ({ value, onChange }: any) => (
        <input
            data-testid="datetime-picker"
            aria-label="datetime"
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
        />
    ),
}));

const theme = createTheme();

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <ThemeProvider theme={theme}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </ThemeProvider>
        );
    };
}

describe("FilterBuilder", () => {
    const tables = minimalTables as Table[];
    const onFiltersChange = vi.fn();
    let Wrapper: ReturnType<typeof createWrapper>;

    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();
        Wrapper = createWrapper();
        vi.mocked(api.get).mockImplementation(async (url: string) => {
            if (url.includes("/country")) {
                return {
                    data: [
                        { id: 1, name: "Testland", emoji: "🏳️" },
                        { id: 2, name: "Otherland", emoji: "🏳️" },
                    ],
                };
            }
            if (url.includes("/state")) {
                return {
                    data: [
                        { id: 1, name: "State One", country_id: 1 },
                        { id: 2, name: "State Two", country_id: 1 },
                    ],
                };
            }
            if (url.includes("dispute-reasons")) {
                return {
                    data: {
                        disputeReasons: [
                            { id: 1, name: "Reason A" },
                            { id: 2, name: "Reason B" },
                        ],
                    },
                };
            }
            if (url.includes("insurance-policies")) {
                return {
                    data: {
                        policies: [
                            { id: 10, policy_number: "POL-A" },
                            { id: 11, policy_number: "POL-B" },
                        ],
                    },
                };
            }
            if (url.includes("business-units")) {
                return {
                    data: {
                        data: [
                            { id: 1, name: "North Division", status: "Active" },
                            {
                                id: 2,
                                name: "Legacy Unit",
                                status: "Inactive",
                            },
                        ],
                    },
                };
            }
            if (url.includes("/entities/users")) {
                return { data: { users: [] } };
            }
            return { data: { users: [] } };
        });
    });

    describe("render and add/remove filters", () => {
        it("should render with empty filters and show Add Filter and no-filters message", () => {
            render(
                <FilterBuilder
                    selectedTables={["Invoice"]}
                    tables={tables}
                    filters={[]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            expect(
                screen.getByText(/No filters added|no filters|messages\.no_filters/i)
            ).toBeInTheDocument();
            expect(
                screen.getAllByRole("button", { name: /add filter|actions\.add_filter/i })[0]
            ).toBeInTheDocument();
        });

        it("should call onFiltersChange with one filter when Add Filter is clicked", async () => {
            const user = userEvent.setup();
            render(
                <FilterBuilder
                    selectedTables={["Invoice"]}
                    tables={tables}
                    filters={[]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            await user.click(screen.getAllByRole("button", { name: /add filter|actions\.add_filter/i })[0]);
            expect(onFiltersChange).toHaveBeenCalledTimes(1);
            expect(onFiltersChange).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        table: "Invoice",
                        field: expect.any(String),
                        operator: expect.any(String),
                        value: expect.anything(),
                    }),
                ])
            );
        });

        it("should render with one filter and number value 0 without crashing", () => {
            render(
                <FilterBuilder
                    selectedTables={["Invoice"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Invoice",
                            field: "amount",
                            operator: "equals",
                            value: 0,
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            expect(
                screen.getAllByRole("button", { name: /add filter|actions\.add_filter/i })[0]
            ).toBeInTheDocument();
        });

        it("should clear field when Autocomplete clear button is clicked", async () => {
            const user = userEvent.setup();
            render(
                <FilterBuilder
                    selectedTables={["Customer"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Customer",
                            field: "name",
                            operator: "equals",
                            value: "",
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );

            const expandTrigger = screen
                .getByText(/Customer.*Name/i)
                .closest('[role="button"]');
            expect(expandTrigger).toBeTruthy();
            await user.click(expandTrigger!);

            const fieldCombobox = screen.getByRole("combobox", {
                name: /fields\.field|^field$/i,
            });
            const fieldAutocomplete = fieldCombobox.closest(
                ".MuiAutocomplete-root"
            );
            expect(fieldAutocomplete).toBeTruthy();

            const clearButton = (
                fieldAutocomplete as HTMLElement
            ).querySelector(".MuiAutocomplete-clearIndicator");
            expect(clearButton).toBeTruthy();
            await user.click(clearButton!);

            expect(onFiltersChange).toHaveBeenCalledWith([
                expect.objectContaining({
                    table: "Customer",
                    field: "",
                    operator: "equals",
                    value: "",
                }),
            ]);
        });

        it("should call onFiltersChange with empty array when last filter is removed", async () => {
            const user = userEvent.setup();
            render(
                <FilterBuilder
                    selectedTables={["Invoice"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Invoice",
                            field: "amount",
                            operator: "equals",
                            value: 10,
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            const removeFilterButton = screen.getByRole("button", {
                name: /delete|actions\.delete/i,
            });
            await user.click(removeFilterButton);
            expect(onFiltersChange).toHaveBeenCalledWith([]);
        });
    });

    describe("filter value shape", () => {
        it("should render filter with operator in and value as array", () => {
            render(
                <FilterBuilder
                    selectedTables={["Customer"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Customer",
                            field: "status",
                            operator: "in",
                            value: ["active", "pending"],
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            expect(
                screen.getAllByRole("button", { name: /add filter|actions\.add_filter/i })[0]
            ).toBeInTheDocument();
        });

        it("should render filter with operator is_empty (no value input required)", () => {
            render(
                <FilterBuilder
                    selectedTables={["Invoice"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Invoice",
                            field: "status",
                            operator: "is_empty",
                            value: null,
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            expect(
                screen.getAllByRole("button", { name: /add filter|actions\.add_filter/i })[0]
            ).toBeInTheDocument();
        });

        it("should render filter with operator between and value as array", () => {
            render(
                <FilterBuilder
                    selectedTables={["Customer"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Customer",
                            field: "amount",
                            operator: "between",
                            value: [10, 20],
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            expect(
                screen.getAllByRole("button", { name: /add filter|actions\.add_filter/i })[0]
            ).toBeInTheDocument();
        });
    });

    describe("lookup string fields (in operator)", () => {
        it("exposes REPORT_LOOKUP_FIELD_KEYS_WITH_IN for dotted relation fields", () => {
            expect(
                REPORT_LOOKUP_FIELD_KEYS_WITH_IN.has(
                    "InsurancePolicy.policy_number"
                )
            ).toBe(true);
            expect(REPORT_LOOKUP_FIELD_KEYS_WITH_IN.has("Country.name")).toBe(
                true
            );
            expect(
                REPORT_LOOKUP_FIELD_KEYS_WITH_IN.has("BusinessUnit.name")
            ).toBe(true);
        });

        it("shows filter summary for InsurancePolicy.policy_number with In and multiple values", () => {
            render(
                <FilterBuilder
                    selectedTables={["Customer"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Customer",
                            field: "InsurancePolicy.policy_number",
                            operator: "in",
                            value: ["POL-A", "POL-B"],
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            expect(
                screen.getByText(
                    /Customer.*Insurance Policy.*In.*POL-A.*POL-B/i
                )
            ).toBeInTheDocument();
        });

        it("shows filter summary for Country.name with In and multiple values", () => {
            render(
                <FilterBuilder
                    selectedTables={["Customer"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Customer",
                            field: "Country.name",
                            operator: "in",
                            value: ["Testland", "Otherland"],
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            expect(
                screen.getByText(
                    /Customer.*Country.*In.*Testland.*Otherland/i
                )
            ).toBeInTheDocument();
        });

        it("shows filter summary for BusinessUnit.name with In and multiple values", () => {
            render(
                <FilterBuilder
                    selectedTables={["Customer"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Customer",
                            field: "BusinessUnit.name",
                            operator: "in",
                            value: ["North Division", "Legacy Unit"],
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            expect(
                screen.getByText(
                    /Customer.*Business Unit.*In.*North Division.*Legacy Unit/i
                )
            ).toBeInTheDocument();
        });
    });

    describe("viewer mode", () => {
        it("hides add and delete controls", () => {
            render(
                <FilterBuilder
                    mode="viewer"
                    selectedTables={["Invoice"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Invoice",
                            field: "amount",
                            operator: "greater_than",
                            value: 100,
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            expect(
                screen.queryByRole("button", { name: /add filter|actions\.add_filter/i })
            ).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/delete|actions\.delete/i)).not.toBeInTheDocument();
        });

        it("hides table and field selectors in flat divider layout", () => {
            render(
                <FilterBuilder
                    mode="viewer"
                    selectedTables={["Invoice"]}
                    tables={tables}
                    filters={[
                        {
                            table: "Invoice",
                            field: "amount",
                            operator: "greater_than",
                            value: 100,
                        },
                    ]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            expect(screen.queryByLabelText(/^table$/i)).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/^field$/i)).not.toBeInTheDocument();
        });
    });

    describe("selectedTables", () => {
        it("should disable Add Filter when selectedTables is empty", () => {
            render(
                <FilterBuilder
                    selectedTables={[]}
                    tables={tables}
                    filters={[]}
                    onFiltersChange={onFiltersChange}
                />,
                { wrapper: Wrapper }
            );
            const addFilterButton = screen.getByRole("button", {
                name: /add filter|actions\.add_filter/i,
            });
            expect(addFilterButton).toBeDisabled();
        });
    });
});
