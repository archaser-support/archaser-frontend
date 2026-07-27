import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { vi, beforeEach, describe, it, expect } from "vitest";

vi.mock("next-auth/react", () => ({
    useSession: () => ({
        data: {
            user: {
                id: "u1",
                account_id: 1,
                timezone: "UTC",
            },
        },
        status: "authenticated",
    }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        i18n: { language: "en" },
    }),
}));

vi.mock("@/utils/datetimeOperations", () => ({
    getUserDateLocale: () => "en",
}));

const mockFetch = vi.fn();

const mockLoadMore = vi.fn();
const mockReset = vi.fn();
let capturedQueryFn: (page: number) => Promise<any>;

vi.mock("@/shared/layout-components/grid/EndlessScrollDataGrid", () => ({
    default: () => null,
    useVirtualInfiniteScroll: (opts: { queryKey: any; queryFn: (page: number) => Promise<any> }) => {
        capturedQueryFn = opts.queryFn;
        const viewId = opts.queryKey?.[1]?.viewId;
        if (viewId) {
            opts.queryFn(1).catch(() => {});
        }
        return {
            data: [],
            totalRecords: 0,
            isLoading: false,
            hasMore: false,
            error: null,
            loadMore: mockLoadMore,
            reset: mockReset,
        };
    },
}));

import { useViewExecution } from "@/shared/hooks/useViewExecution";

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    };
}

describe("useViewExecution", () => {
    let Wrapper: ReturnType<typeof createWrapper>;

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = mockFetch;
        Wrapper = createWrapper();

        mockFetch.mockImplementation((url: string, opts?: any) => {
            if (typeof url !== "string") return Promise.reject(new Error("Invalid URL"));
            if (url.includes("?default=true")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ reports: [] }),
                });
            }
            if (url.includes("/api/reports?") && !url.includes("/execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ reports: [] }),
                });
            }
            if (url.includes("/api/reports/") && url.includes("/execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ data: [], totalRecords: 0 }),
                });
            }
            if (url.match(/\/api\/reports\/\d+$/) && !url.includes("execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ report: { report_config: {} } }),
                });
            }
            return Promise.resolve({ ok: false });
        });
    });

    it("should not send execute request when no view is selected", async () => {
        const { result } = renderHook(
            () =>
                useViewExecution({
                    context: "customers",
                    debouncedSearch: "",
                }),
            { wrapper: Wrapper }
        );

        await waitFor(() => {
            expect(result.current.selectedViewId).toBeNull();
        });

        const executeCalls = mockFetch.mock.calls.filter(
            (c: any) => c[0]?.includes?.("/execute")
        );
        expect(executeCalls.length).toBe(0);
    });

    it("should send execute with context-only (no additionalFilters) when view is selected", async () => {
        const { result } = renderHook(
            () =>
                useViewExecution({
                    context: "customers",
                    debouncedSearch: "",
                }),
            { wrapper: Wrapper }
        );

        result.current.setSelectedViewId(99);

        await waitFor(() => {
            const executeCalls = mockFetch.mock.calls.filter(
                (c: any) => c[0]?.includes?.("/99/execute") && c[1]?.method === "POST"
            );
            expect(executeCalls.length).toBeGreaterThanOrEqual(1);
        });

        const executeCall = mockFetch.mock.calls.find(
            (c: any) => c[0]?.includes?.("/99/execute") && c[1]?.method === "POST"
        );
        const body = JSON.parse(executeCall[1].body);
        expect(body).toMatchObject({ page: 1, limit: 20 });
        expect(body.filters).toBeUndefined();
    });

    it("should include additionalFilters in execute body when provided", async () => {
        const additionalFilters = [
            {
                table: "Invoice",
                field: "customer_id",
                operator: "equals",
                value: 456,
            },
        ];

        const { result } = renderHook(
            () =>
                useViewExecution({
                    context: "customer_unpaid_invoices",
                    debouncedSearch: "",
                    additionalFilters,
                }),
            { wrapper: Wrapper }
        );

        result.current.setSelectedViewId(10);

        await waitFor(() => {
            const executeCalls = mockFetch.mock.calls.filter(
                (c: any) => c[0]?.includes?.("/10/execute") && c[1]?.method === "POST"
            );
            expect(executeCalls.length).toBeGreaterThanOrEqual(1);
        });

        const executeCall = mockFetch.mock.calls.find(
            (c: any) => c[0]?.includes?.("/10/execute") && c[1]?.method === "POST"
        );
        const body = JSON.parse(executeCall[1].body);
        expect(body.filters).toEqual(additionalFilters);
    });

    it("should include businessUnitId in execute body when provided", async () => {
        const { result } = renderHook(
            () =>
                useViewExecution({
                    context: "dashboard_invoices",
                    debouncedSearch: "",
                    businessUnitId: 42,
                }),
            { wrapper: Wrapper }
        );

        result.current.setSelectedViewId(10);

        await waitFor(() => {
            const executeCalls = mockFetch.mock.calls.filter(
                (c: any) => c[0]?.includes?.("/10/execute") && c[1]?.method === "POST"
            );
            expect(executeCalls.length).toBeGreaterThanOrEqual(1);
        });

        const executeCall = mockFetch.mock.calls.find(
            (c: any) => c[0]?.includes?.("/10/execute") && c[1]?.method === "POST"
        );
        const body = JSON.parse(executeCall[1].body);
        expect(body.businessUnitId).toBe(42);
    });

    it("should include selectedUserId in execute body when provided", async () => {
        const { result } = renderHook(
            () =>
                useViewExecution({
                    context: "dashboard_activities",
                    debouncedSearch: "",
                    selectedUserId: "agent-1",
                }),
            { wrapper: Wrapper }
        );

        result.current.setSelectedViewId(10);

        await waitFor(() => {
            const executeCalls = mockFetch.mock.calls.filter(
                (c: any) => c[0]?.includes?.("/10/execute") && c[1]?.method === "POST"
            );
            expect(executeCalls.length).toBeGreaterThanOrEqual(1);
        });

        const executeCall = mockFetch.mock.calls.find(
            (c: any) => c[0]?.includes?.("/10/execute") && c[1]?.method === "POST"
        );
        const body = JSON.parse(executeCall[1].body);
        expect(body.selectedUserId).toBe("agent-1");
    });

    it("should include search and sort in execute body", async () => {
        const { result } = renderHook(
            () =>
                useViewExecution({
                    context: "customers",
                    debouncedSearch: "test query",
                    sortField: "name",
                    sortDirection: "desc",
                }),
            { wrapper: Wrapper }
        );

        result.current.setSelectedViewId(5);

        await waitFor(() => {
            const executeCalls = mockFetch.mock.calls.filter(
                (c: any) => c[0]?.includes?.("/5/execute") && c[1]?.method === "POST"
            );
            expect(executeCalls.length).toBeGreaterThanOrEqual(1);
        });

        const executeCall = mockFetch.mock.calls.find(
            (c: any) => c[0]?.includes?.("/5/execute") && c[1]?.method === "POST"
        );
        const body = JSON.parse(executeCall[1].body);
        expect(body.search).toBe("test query");
        expect(body.sortField).toBe("name");
        expect(body.sortDirection).toBe("desc");
    });

    it("prefers explicit defaultViewId over context default report", async () => {
        mockFetch.mockImplementation((url: string, opts?: any) => {
            if (typeof url !== "string") {
                return Promise.reject(new Error("Invalid URL"));
            }
            if (url.includes("?default=true")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        reports: [{ id: 100, is_system: true }],
                    }),
                });
            }
            if (url.includes("/api/reports?") && !url.includes("/execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ reports: [{ id: 100 }, { id: 200 }] }),
                });
            }
            if (url.includes("/api/reports/") && url.includes("/execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ data: [], totalRecords: 0 }),
                });
            }
            if (url.match(/\/api\/reports\/\d+$/) && !url.includes("execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ report: { report_config: {} } }),
                });
            }
            return Promise.resolve({ ok: false });
        });

        const { result } = renderHook(
            () =>
                useViewExecution({
                    context: "dashboard_credit_customers",
                    debouncedSearch: "",
                    defaultViewId: 200,
                }),
            { wrapper: Wrapper }
        );

        await waitFor(() => {
            expect(result.current.selectedViewId).toBe(200);
        });
    });

    it("applies async defaultViewId after context default was auto-selected", async () => {
        mockFetch.mockImplementation((url: string) => {
            if (typeof url !== "string") {
                return Promise.reject(new Error("Invalid URL"));
            }
            if (url.includes("?default=true")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        reports: [{ id: 100, is_system: true }],
                    }),
                });
            }
            if (url.includes("/api/reports?") && !url.includes("/execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ reports: [{ id: 100 }, { id: 200 }] }),
                });
            }
            if (url.includes("/api/reports/") && url.includes("/execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ data: [], totalRecords: 0 }),
                });
            }
            if (url.match(/\/api\/reports\/\d+$/) && !url.includes("execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ report: { report_config: {} } }),
                });
            }
            return Promise.resolve({ ok: false });
        });

        const { result, rerender } = renderHook(
            (props: { defaultViewId?: number | null }) =>
                useViewExecution({
                    context: "dashboard_credit_customers",
                    debouncedSearch: "",
                    defaultViewId: props.defaultViewId,
                }),
            {
                wrapper: Wrapper,
                initialProps: { defaultViewId: null as number | null },
            }
        );

        await waitFor(() => {
            expect(result.current.selectedViewId).toBe(100);
        });

        rerender({ defaultViewId: 200 });

        await waitFor(() => {
            expect(result.current.selectedViewId).toBe(200);
        });
    });

    it("should throw when execute returns error response", async () => {
        mockFetch.mockImplementation((url: string) => {
            if (url.includes("/execute")) {
                return Promise.resolve({
                    ok: false,
                    status: 403,
                    json: async () => ({ error: "Forbidden" }),
                });
            }
            if (url.includes("?default=true")) {
                return Promise.resolve({ ok: true, json: async () => ({ reports: [] }) });
            }
            if (url.includes("/api/reports?") && !url.includes("execute")) {
                return Promise.resolve({ ok: true, json: async () => ({ reports: [] }) });
            }
            if (url.match(/\/api\/reports\/\d+$/) && !url.includes("execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ report: { report_config: {} } }),
                });
            }
            return Promise.resolve({ ok: false });
        });

        const { result } = renderHook(
            () =>
                useViewExecution({
                    context: "customers",
                    debouncedSearch: "",
                }),
            { wrapper: Wrapper }
        );

        result.current.setSelectedViewId(7);

        await waitFor(() => expect(capturedQueryFn).toBeDefined());

        await expect(capturedQueryFn!(1)).rejects.toThrow(/Forbidden|HTTP error/);
    });

    it("after clearing a deleted selection, falls back to context default instead of re-applying stale defaultViewId", async () => {
        mockFetch.mockImplementation((url: string) => {
            if (typeof url !== "string") {
                return Promise.reject(new Error("Invalid URL"));
            }
            if (url.includes("?default=true")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        reports: [{ id: 100, is_system: true }],
                    }),
                });
            }
            if (url.includes("/api/reports?") && !url.includes("/execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        reports: [{ id: 50 }, { id: 100 }],
                    }),
                });
            }
            if (url.includes("/api/reports/") && url.includes("/execute")) {
                const match = url.match(/\/api\/reports\/(\d+)\/execute/);
                const viewId = match ? Number(match[1]) : null;
                if (viewId === 50) {
                    return Promise.resolve({
                        ok: false,
                        status: 404,
                        json: async () => ({ error: "Report not found" }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ data: [], totalRecords: 0 }),
                });
            }
            if (url.match(/\/api\/reports\/\d+$/) && !url.includes("execute")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ report: { report_config: {} } }),
                });
            }
            return Promise.resolve({ ok: false });
        });

        // Simulates list pages that pass the current/URL selection as defaultViewId.
        const { result, rerender } = renderHook(
            (props: { defaultViewId?: number | null }) =>
                useViewExecution({
                    context: "customers",
                    debouncedSearch: "",
                    defaultViewId: props.defaultViewId,
                }),
            {
                wrapper: Wrapper,
                initialProps: { defaultViewId: 50 as number | null },
            }
        );

        await waitFor(() => {
            expect(result.current.selectedViewId).toBe(50);
        });

        // Delete flow: clear selection while parent still briefly passes the deleted id.
        result.current.setSelectedViewIdInternal?.(null, "delete-report:50");

        await waitFor(() => {
            expect(result.current.selectedViewId).toBe(100);
        });

        // Parent eventually clears the stale prop (onViewChange(null)).
        rerender({ defaultViewId: null });

        await waitFor(() => {
            expect(result.current.selectedViewId).toBe(100);
        });
    });
});
