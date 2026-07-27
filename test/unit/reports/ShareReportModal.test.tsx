import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { vi, beforeEach, describe, it, expect } from "vitest";

vi.mock("@mui/icons-material", () => {
    const M = () => null;
    return {
        Add: M,
        Delete: M,
        DragHandle: M,
        Edit: M,
        Group: M,
        Person: M,
        Share: M,
        Visibility: M,
    };
});
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("next-auth/react", () => ({
    useSession: () => ({ data: { user: {} }, status: "authenticated" }),
}));
vi.mock("axios", () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }));
vi.mock("@/shared/layout-components/toast/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

// Same approach as DragDropFieldSelector: mock the heavy dependency so it is never loaded (avoids hang).
// AppDialog and its hooks (useAppDialog, MUI icons) can hang in test env when loaded.
vi.mock("@/shared/layout-components/modal/AppDialog", () => ({
    default: function MockAppDialog({
        open,
        onClose,
        children,
    }: {
        open: boolean;
        onClose: () => void;
        children?: React.ReactNode;
    }) {
        if (!open) return null;
        return (
            <div role="dialog" data-testid="app-dialog">
                <button onClick={onClose} aria-label="close" />
                {children}
            </div>
        );
    },
}));

import ShareReportModal from "@/components/reports/ShareReportModal";

const theme = createTheme();

function Wrapper({ children }: { children: React.ReactNode }) {
    const q = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
        <ThemeProvider theme={theme}>
            <QueryClientProvider client={q}>{children}</QueryClientProvider>
        </ThemeProvider>
    );
}

describe("ShareReportModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();
    });

    it("should render when open with reportId, reportName, accountId", () => {
        render(
            <ShareReportModal
                open
                onClose={vi.fn()}
                reportId={1}
                reportName="Test Report"
                accountId={1}
            />,
            { wrapper: Wrapper }
        );
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("sections.share_with")).toBeInTheDocument();
    });

    it("should render dialog with close option", () => {
        const onClose = vi.fn();
        render(
            <ShareReportModal
                open
                onClose={onClose}
                reportId={1}
                reportName="R"
                accountId={1}
            />,
            { wrapper: Wrapper }
        );
        const dialogs = screen.getAllByTestId("app-dialog");
        expect(dialogs.length).toBeGreaterThanOrEqual(1);
        expect(dialogs[0]).toBeInTheDocument();
    });
});
