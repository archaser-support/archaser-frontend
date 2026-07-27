import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, beforeEach, describe, it, expect } from "vitest";

vi.mock("@mui/icons-material", () => {
    const MockIcon = () => <span data-testid="mock-icon" />;
    return {
        Add: MockIcon,
        Clear: MockIcon,
        ContentCopy: MockIcon,
        Delete: MockIcon,
        Edit: MockIcon,
        FileDownload: MockIcon,
        Refresh: MockIcon,
        Search: MockIcon,
        Settings: MockIcon,
        Share: MockIcon,
        StarBorder: MockIcon,
        Star: MockIcon,
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
        i18n: { language: "en" },
    }),
}));

vi.mock("next-auth/react", () => ({
    useSession: () => ({
        data: { user: { id: "u1", account_id: 1, role: "Admin" } },
        status: "authenticated",
    }),
}));

vi.mock("axios", () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { permissions: [], reports: [] } }),
    },
}));

import EndlessScrollToolbar from "@/shared/layout-components/grid/EndlessScrollToolbar";

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

describe("EndlessScrollToolbar (reports)", () => {
    let Wrapper: ReturnType<typeof createWrapper>;

    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();
        Wrapper = createWrapper();
    });

    it("should call onSearchChange when user submits search (Enter) or clear", async () => {
        const onSearchChange = vi.fn();
        const user = userEvent.setup();

        render(
            <EndlessScrollToolbar
                searchValue=""
                onSearchChange={onSearchChange}
            />,
            { wrapper: Wrapper }
        );

        const searchInput = screen.getByPlaceholderText("common.search_placeholder");
        await user.type(searchInput, "test");
        await user.keyboard("{Enter}");
        expect(onSearchChange).toHaveBeenCalledWith("test");
    });

    it("should not call onSearchChange when searchDisabled is true", () => {
        const onSearchChange = vi.fn();

        render(
            <EndlessScrollToolbar
                searchValue=""
                onSearchChange={onSearchChange}
                searchDisabled
            />,
            { wrapper: Wrapper }
        );

        const searchInputs = screen.getAllByPlaceholderText("common.search_placeholder");
        const disabledSearchInput = searchInputs.find((el) => (el as HTMLInputElement).disabled);
        expect(disabledSearchInput).toBeDefined();
        expect(disabledSearchInput).toBeDisabled();
        expect(onSearchChange).not.toHaveBeenCalled();
    });

    it("should render with reportSelector and reportContext without crashing", () => {
        render(
            <EndlessScrollToolbar
                searchValue=""
                onSearchChange={vi.fn()}
                reportSelector
                reportContext="customers"
                selectedReportId={null}
                onReportChange={vi.fn()}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.getByPlaceholderText("Select Report")).toBeInTheDocument();
    });

    it("should accept selectedReportId as number or string", () => {
        const { rerender } = render(
            <EndlessScrollToolbar
                searchValue=""
                onSearchChange={vi.fn()}
                reportSelector
                reportContext="customers"
                selectedReportId={99}
                onReportChange={vi.fn()}
            />,
            { wrapper: Wrapper }
        );
        rerender(
            <EndlessScrollToolbar
                searchValue=""
                onSearchChange={vi.fn()}
                reportSelector
                reportContext="customers"
                selectedReportId="99"
                onReportChange={vi.fn()}
            />
        );
    });
});
