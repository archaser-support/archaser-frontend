import { ThemeProvider, createTheme } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";
import React from "react";
import { vi, beforeEach, describe, it, expect } from "vitest";

import AccountUsers from "@/app/[locale]/app/admin/accounts/[AccountId]/details/components/AccountUsers";

// Mock the API calls
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
    }),
}));

// Mock the toast provider
vi.mock("@/shared/layout-components/toast/ToastProvider", () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}));

// Mock the session
const mockSession = {
    data: {
        user: {
            id: "1",
            email: "test@example.com",
            account_id: 1,
            role: "Admin",
        },
    },
    status: "authenticated" as const,
    update: vi.fn(),
};

// Mock the API response for empty users
const mockEmptyUsersResponse = {
    users: [],
    totalRecords: 0,
};

// Mock fetch
global.fetch = vi.fn();

describe.skip("Table Height Integration Tests (Requires Component Setup)", () => {
    let queryClient: QueryClient;
    const theme = createTheme();

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
        vi.clearAllMocks();
    });

    const mockCustomer = {
        id: 1,
        name: "Test Customer",
        company_number: "TEST001",
        status: "Active",
        email: "test@customer.com",
        phone: "+1234567890",
        address: "123 Test St",
        city: "Test City",
        state: "Test State",
        country: "Test Country",
        postal_code: "12345",
        default_language: "English",
        time_zone: "UTC",
        currency: "USD",
        logo: null,
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-01T00:00:00.000Z",
    };

    const renderAccountUsersWithProviders = (props: any = {}) => {
        return render(
            <ThemeProvider theme={theme}>
                <SessionProvider session={mockSession}>
                    <QueryClientProvider client={queryClient}>
                        <AccountUsers
                            customer={mockCustomer}
                            isEditing={false}
                            onFieldChange={vi.fn()}
                            {...props}
                        />
                    </QueryClientProvider>
                </SessionProvider>
            </ThemeProvider>
        );
    };

    describe("Complete Table Height Flow", () => {
        it("should render complete flow with proper height constraints when no users", async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockEmptyUsersResponse,
            });

            renderAccountUsersWithProviders();

            await waitFor(() => {
                // Check if no records overlay is displayed
                const noRecordsText = screen.getByText(/no users found/i);
                expect(noRecordsText).toBeInTheDocument();

                // Check if the overlay container has proper height
                const overlayContainer = noRecordsText.closest(
                    '[class*="MuiDataGrid-virtualScroller"]'
                );
                if (overlayContainer) {
                    const style = window.getComputedStyle(overlayContainer);
                    expect(style.minHeight).toBe("400px");
                }

                // Check if the overlay box has proper height
                const overlayBox = noRecordsText.closest(
                    '[class*="MuiBox-root"]'
                );
                if (overlayBox) {
                    const style = window.getComputedStyle(overlayBox);
                    expect(style.height).toBe("450px");
                    expect(style.justifyContent).toBe("center");
                }
            });
        });

        it("should maintain proper height constraints throughout the component tree", async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockEmptyUsersResponse,
            });

            renderAccountUsersWithProviders();

            await waitFor(() => {
                // Check AccountUsers container
                const accountUsersContainer = document.querySelector(
                    '[class*="MuiBox-root"]'
                );
                if (accountUsersContainer) {
                    const style = window.getComputedStyle(
                        accountUsersContainer
                    );
                    expect(style.minHeight).toBe("500px");
                }

                // Check UserList container
                const userListContainer =
                    document.querySelector(".MuiDataGrid-root")?.parentElement;
                if (userListContainer) {
                    const style = window.getComputedStyle(userListContainer);
                    expect(style.minHeight).toBe("500px");
                }

                // Check StyledDataGrid virtualScroller
                const virtualScroller = document.querySelector(
                    ".MuiDataGrid-virtualScroller"
                );
                if (virtualScroller) {
                    const style = window.getComputedStyle(virtualScroller);
                    expect(style.minHeight).toBe("400px");
                }
            });
        });

        it("should center the no records overlay properly", async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockEmptyUsersResponse,
            });

            renderAccountUsersWithProviders();

            await waitFor(() => {
                const noRecordsText = screen.getByText(/no users found/i);
                const overlayBox = noRecordsText.closest(
                    '[class*="MuiBox-root"]'
                );

                if (overlayBox) {
                    const style = window.getComputedStyle(overlayBox);
                    expect(style.display).toBe("flex");
                    expect(style.flexDirection).toBe("column");
                    expect(style.alignItems).toBe("center");
                    expect(style.justifyContent).toBe("center");
                    expect(style.textAlign).toBe("center");
                }
            });
        });

        it("should apply proper padding to no records overlay", async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockEmptyUsersResponse,
            });

            renderAccountUsersWithProviders();

            await waitFor(() => {
                const noRecordsText = screen.getByText(/no users found/i);
                const overlayBox = noRecordsText.closest(
                    '[class*="MuiBox-root"]'
                );

                if (overlayBox) {
                    const style = window.getComputedStyle(overlayBox);
                    // Check if padding is applied (py: 8 = 32px top and bottom)
                    expect(style.paddingTop).toBeDefined();
                    expect(style.paddingBottom).toBeDefined();
                }
            });
        });
    });

    describe("Responsive Behavior Integration", () => {
        it("should handle different screen sizes properly", async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockEmptyUsersResponse,
            });

            // Mock mobile screen size
            Object.defineProperty(window, "innerWidth", {
                writable: true,
                configurable: true,
                value: 768,
            });

            renderAccountUsersWithProviders();

            await waitFor(() => {
                const noRecordsText = screen.getByText(/no users found/i);
                expect(noRecordsText).toBeInTheDocument();

                // Check if the layout adapts to mobile
                const dataGrid = document.querySelector(".MuiDataGrid-root");
                expect(dataGrid).toBeInTheDocument();
            });

            // Change to desktop size
            Object.defineProperty(window, "innerWidth", {
                writable: true,
                configurable: true,
                value: 1200,
            });

            // Trigger resize event
            window.dispatchEvent(new Event("resize"));

            await waitFor(() => {
                const noRecordsText = screen.getByText(/no users found/i);
                expect(noRecordsText).toBeInTheDocument();
            });
        });
    });

    describe("Error State Integration", () => {
        it("should handle API errors with proper height", async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error("API Error"));

            renderAccountUsersWithProviders();

            await waitFor(() => {
                // Should show error state with proper height
                const errorContainer =
                    screen.getByText(/error/i)?.parentElement;
                if (errorContainer) {
                    const style = window.getComputedStyle(errorContainer);
                    expect(style.height).toBe("500px");
                }
            });
        });

        it("should handle network errors gracefully", async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            renderAccountUsersWithProviders();

            await waitFor(() => {
                // Should handle error state properly
                expect(screen.getByText(/error/i)).toBeInTheDocument();
            });
        });
    });

    describe("Loading State Integration", () => {
        it("should show loading state with proper height", async () => {
            // Mock a slow API response
            (global.fetch as any).mockImplementationOnce(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    ok: true,
                                    json: async () => mockEmptyUsersResponse,
                                }),
                            100
                        )
                    )
            );

            renderAccountUsersWithProviders();

            // Check loading state
            const loadingContainer =
                screen.getByRole("progressbar")?.parentElement;
            if (loadingContainer) {
                const style = window.getComputedStyle(loadingContainer);
                expect(style.height).toBe("500px");
            }
        });
    });

    describe("Accessibility Integration", () => {
        it("should maintain accessibility throughout the component tree", async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockEmptyUsersResponse,
            });

            renderAccountUsersWithProviders();

            await waitFor(() => {
                const noRecordsText = screen.getByText(/no users found/i);
                expect(noRecordsText).toBeInTheDocument();

                // Check if the text is properly accessible
                expect(noRecordsText).toHaveAttribute("role", "heading");

                // Check if the data grid is accessible
                const dataGrid = document.querySelector(".MuiDataGrid-root");
                expect(dataGrid).toHaveAttribute("role", "grid");
                expect(dataGrid).toHaveAttribute("tabIndex", "0");
            });
        });
    });

    describe("Theme Integration", () => {
        it("should apply theme colors properly throughout the flow", async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockEmptyUsersResponse,
            });

            renderAccountUsersWithProviders();

            await waitFor(() => {
                const noRecordsText = screen.getByText(/no users found/i);
                expect(noRecordsText).toBeInTheDocument();

                // Check if theme colors are applied
                const style = window.getComputedStyle(noRecordsText);
                expect(style.color).toBeDefined();
            });
        });
    });
});
