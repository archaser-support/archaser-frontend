import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi, beforeEach, describe, it, expect } from "vitest";

vi.mock("@mui/icons-material", () => ({
    Edit: () => <span data-testid="icon-edit" />,
    FilterList: () => <span data-testid="icon-filter" />,
    Refresh: () => <span data-testid="icon-refresh" />,
    Share: () => <span data-testid="icon-share" />,
}));

vi.mock("@/components/reports/ReportViewerFiltersModal", () => ({
    default: () => null,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: { defaultValue?: string }) =>
            opts?.defaultValue ?? key,
        i18n: { language: "en" },
    }),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useParams: () => ({ locale: "en" }),
}));

vi.mock("next-auth/react", () => ({
    useSession: () => ({ data: { user: {} }, status: "authenticated" }),
}));

vi.mock("use-debounce", () => ({
    useDebounce: (val: string) => [val],
}));

vi.mock("react-apexcharts", () => ({ default: () => null }));

const mockFetch = vi.fn();

vi.mock("@/shared/layout-components/grid/EndlessScrollDataGrid", async (importOriginal) => {
    const mod = await importOriginal<typeof import("@/shared/layout-components/grid/EndlessScrollDataGrid")>();
    return {
        ...mod,
        default: () => <div data-testid="endless-scroll-grid">Grid</div>,
    };
});

import ReportViewer from "@/components/reports/ReportViewer";

const theme = createTheme();

const reportConfig = {
    tables: ["Invoice"],
    fields: [{ table: "Invoice", field: "amount" }],
    sorting: [{ field: "amount", direction: "ASC" }],
    filters: [
        {
            table: "Invoice",
            field: "amount",
            operator: "greater_than",
            value: 0,
        },
    ],
};

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

describe("ReportViewer", () => {
    let Wrapper: ReturnType<typeof createWrapper>;

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = mockFetch;
        Wrapper = createWrapper();
    });

    it("should call fetch with POST /api/reports/:id/execute and body with page, limit on mount", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [], totalRecords: 0 }),
        });

        render(
            <ReportViewer reportId={1} reportConfig={reportConfig} />,
            { wrapper: Wrapper }
        );

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });

        const executeCalls = mockFetch.mock.calls.filter(
            (c: any) => c[0]?.includes?.("/execute") && c[1]?.method === "POST"
        );
        expect(executeCalls.length).toBeGreaterThanOrEqual(1);
        const [url, opts] = executeCalls[0];
        expect(url).toContain("/api/reports/1/execute");
        const body = JSON.parse(opts.body);
        expect(body).toMatchObject({ page: 1, limit: 20 });
        expect(body.replaceConfigFilters).toBeUndefined();
    });

    it("should pass through successful response data", async () => {
        const sampleData = [{ id: 1, amount: 100 }];
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: sampleData, totalRecords: 1 }),
        });

        render(
            <ReportViewer reportId={2} reportConfig={reportConfig} />,
            { wrapper: Wrapper }
        );

        await waitFor(() => expect(mockFetch).toHaveBeenCalled());
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/reports/2/execute"),
            expect.objectContaining({
                method: "POST",
                body: expect.any(String),
            })
        );
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body).toHaveProperty("page", 1);
        expect(body).toHaveProperty("limit", 20);
    });

    it("should throw when fetch returns non-ok", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

        render(
            <ReportViewer reportId={4} reportConfig={reportConfig} />,
            { wrapper: Wrapper }
        );

        await waitFor(() => expect(mockFetch).toHaveBeenCalled());
        const executeCall = mockFetch.mock.calls.find(
            (c: any) => c[0]?.includes?.("/execute")
        );
        expect(executeCall).toBeDefined();
        const res = await mockFetch.mock.results[0]?.value;
        expect(res?.ok).toBe(false);
    });
});
