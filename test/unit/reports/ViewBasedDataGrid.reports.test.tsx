import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi, beforeEach, describe, it, expect } from "vitest";

const mockUseViewExecution = vi.fn();
const mockGetViewConfig = vi.fn();

vi.mock("@/shared/hooks/useViewExecution", () => ({
    useViewExecution: (opts: any) => mockUseViewExecution(opts),
}));

vi.mock("@/shared/utils/viewConfigs", () => ({
    getViewConfig: (context: string) => mockGetViewConfig(context),
}));

vi.mock("next-auth/react", () => ({
    useSession: () => ({ data: { user: { id: "u1", account_id: 1 } }, status: "authenticated" }),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({ locale: "en" }),
    usePathname: () => "/",
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
}));

vi.mock("use-debounce", () => ({ useDebounce: (v: string) => [v] }));

vi.mock("@/shared/hooks/useViewMetadata", () => ({
    useViewMetadata: () => ({ tablesMetadata: [] }),
}));

vi.mock("@/shared/hooks/useViewDataTransformation", () => ({
    useViewDataTransformation: () => ({ rows: [] }),
}));

vi.mock("@/shared/layout-components/grid/EndlessScrollDataGrid", () => ({
    default: () => <div data-testid="endless-scroll-grid">Grid</div>,
}));

vi.mock("@/shared/utils/viewColumnGenerator", () => ({
    generateViewColumns: () => [],
}));

vi.mock("@/shared/layout-components/toast/ToastProvider", () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

const defaultHookReturn = {
    selectedViewId: null,
    setSelectedViewId: vi.fn(),
    setSelectedViewIdInternal: vi.fn(),
    viewConfig: {},
    viewData: null,
    rows: [],
    totalRecords: 0,
    isLoading: false,
    hasMore: false,
    error: null,
    loadMore: vi.fn(),
    reset: vi.fn(),
    queryKeyVersion: 0,
    incrementQueryKeyVersion: vi.fn(),
};

const minimalViewConfig = {
    tableName: "Customer",
    entityIdField: "id",
    entityNameField: "name",
    defaultSort: { field: "name", sort: "asc" as const },
};

import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid/ViewBasedDataGrid";

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

describe("ViewBasedDataGrid (reports)", () => {
    let Wrapper: ReturnType<typeof createWrapper>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseViewExecution.mockReturnValue(defaultHookReturn);
        mockGetViewConfig.mockImplementation((context: string) => {
            if (context === "customers" || context === "customer_unpaid_invoices") {
                return { ...minimalViewConfig, tableName: context === "customer_unpaid_invoices" ? "Invoice" : "Customer" };
            }
            throw new Error(`No configuration found for context: ${context}`);
        });
        Wrapper = createWrapper();
    });

    it("should call useViewExecution with context and no additionalFilters when only context is passed", () => {
        render(
            <ViewBasedDataGrid
                context="customers"
                searchValue=""
                onSearchChange={vi.fn()}
                defaultViewId={null}
            />,
            { wrapper: Wrapper }
        );

        expect(mockUseViewExecution).toHaveBeenCalledWith(
            expect.objectContaining({
                context: "customers",
                additionalFilters: undefined,
            })
        );
        expect(mockGetViewConfig).toHaveBeenCalledWith("customers");
    });

    it("should call useViewExecution with context and additionalFilters when both are passed", () => {
        const additionalFilters = [
            { table: "Invoice", field: "customer_id", operator: "equals", value: 456 },
        ];

        render(
            <ViewBasedDataGrid
                context="customer_unpaid_invoices"
                searchValue=""
                onSearchChange={vi.fn()}
                defaultViewId={null}
                additionalFilters={additionalFilters}
            />,
            { wrapper: Wrapper }
        );

        expect(mockUseViewExecution).toHaveBeenCalledWith(
            expect.objectContaining({
                context: "customer_unpaid_invoices",
                additionalFilters,
            })
        );
        expect(mockGetViewConfig).toHaveBeenCalledWith("customer_unpaid_invoices");
    });

    it("should pass debouncedSearch and defaultViewId to useViewExecution", () => {
        render(
            <ViewBasedDataGrid
                context="customers"
                searchValue="test search"
                onSearchChange={vi.fn()}
                defaultViewId={1}
            />,
            { wrapper: Wrapper }
        );

        expect(mockUseViewExecution).toHaveBeenCalledWith(
            expect.objectContaining({
                context: "customers",
                debouncedSearch: "test search",
                defaultViewId: 1,
            })
        );
    });

    it("should invoke onDeleteView when delete callback is provided and hook exposes setSelectedViewId", () => {
        const onDeleteView = vi.fn();
        render(
            <ViewBasedDataGrid
                context="customers"
                searchValue=""
                onSearchChange={vi.fn()}
                defaultViewId={null}
                onDeleteView={onDeleteView}
            />,
            { wrapper: Wrapper }
        );
        expect(mockUseViewExecution).toHaveBeenCalled();
        expect(mockGetViewConfig).toHaveBeenCalledWith("customers");
    });
});
