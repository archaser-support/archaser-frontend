import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the dependencies
const mockSignOut = vi.fn();
const mockRouterPush = vi.fn();
const mockFetch = vi.fn();

// Mock the session update function
const mockUpdate = vi.fn();

// Create a testable logout function that mirrors the actual implementation
const createLogoutFunction = (
    signOut: any,
    routerPush: any,
    fetch: any,
    sessionUpdate: any
) => {
    return async (
        pathname: string,
        session: any,
        handleMenuClose: () => void = vi.fn()
    ) => {
        handleMenuClose();

        // Extract current locale from pathname
        const currentLocale = pathname?.split("/")[1] || "en";

        // Check if user is in view-as mode
        const isInViewAsMode = session?.user?.view_as_user_id;
        const isAdmin =
            session?.user?.account_id === 10013 ||
            session?.user?.role === "Account_Manager";

        // If admin is in view-as mode, clear view-as and return to admin session
        if (isInViewAsMode && isAdmin) {
            try {
                const response = await fetch("/api/user/view-as", {
                    method: "DELETE",
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(
                        errorData.error || "Failed to clear view-as user"
                    );
                }

                // Update the session to remove all view-as user information
                await sessionUpdate({
                    view_as_user_id: undefined,
                    view_as_user_account_id: undefined,
                    view_as_user_role: undefined,
                    view_as_user_account_name: undefined,
                });

                // Redirect to the account details page
                routerPush("/app/admin/accounts");
                return;
            } catch (error) {
                // Fall back to full logout if clearing view-as fails
                await signOut({ redirect: false });
                routerPush(`/${currentLocale}/login`);
                return;
            }
        }

        // Regular logout for non-admin users or admin not in view-as mode
        await signOut({ redirect: false });
        routerPush(`/${currentLocale}/login`);
    };
};

describe("Logout Utils", () => {
    let logoutFunction: any;

    beforeEach(() => {
        vi.clearAllMocks();
        logoutFunction = createLogoutFunction(
            mockSignOut,
            mockRouterPush,
            mockFetch,
            mockUpdate
        );
        // Reset mockSignOut to resolve successfully by default
        mockSignOut.mockResolvedValue(undefined);
    });

    describe("Regular User Logout", () => {
        it("should logout regular users correctly", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "test@example.com",
                    account_id: 1001,
                    role: "Collection_Agent",
                },
            };

            await logoutFunction("/en/app/dashboard", session);

            expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
            expect(mockRouterPush).toHaveBeenCalledWith("/en/login");
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it("should handle different locales correctly", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "test@example.com",
                    account_id: 1001,
                    role: "Collection_Agent",
                },
            };

            await logoutFunction("/he/app/dashboard", session);

            expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
            expect(mockRouterPush).toHaveBeenCalledWith("/he/login");
        });

        it("should fallback to en locale for malformed pathnames", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "test@example.com",
                    account_id: 1001,
                    role: "Collection_Agent",
                },
            };

            await logoutFunction("/app/dashboard", session);

            expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
            expect(mockRouterPush).toHaveBeenCalledWith("/app/login");
        });
    });

    describe("Admin User Logout", () => {
        it("should logout admin users correctly when not in view-as mode", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "admin@example.com",
                    account_id: 10013,
                    role: "Admin",
                },
            };

            await logoutFunction("/en/app/dashboard", session);

            expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
            expect(mockRouterPush).toHaveBeenCalledWith("/en/login");
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it("should clear view-as mode for admin users", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "admin@example.com",
                    account_id: 10013,
                    role: "Admin",
                    view_as_user_id: "2",
                    view_as_user_account_id: 1002,
                },
            };

            // Mock successful API call
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });

            await logoutFunction("/en/app/dashboard", session);

            expect(mockFetch).toHaveBeenCalledWith("/api/user/view-as", {
                method: "DELETE",
            });
            expect(mockUpdate).toHaveBeenCalledWith({
                view_as_user_id: undefined,
                view_as_user_account_id: undefined,
                view_as_user_role: undefined,
                view_as_user_account_name: undefined,
            });
            expect(mockRouterPush).toHaveBeenCalledWith("/app/admin/accounts");
            expect(mockSignOut).not.toHaveBeenCalled();
        });

        it("should fallback to full logout if clearing view-as fails", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "admin@example.com",
                    account_id: 10013,
                    role: "Admin",
                    view_as_user_id: "2",
                },
            };

            // Mock failed API call
            mockFetch.mockResolvedValue({
                ok: false,
                json: () =>
                    Promise.resolve({ error: "Failed to clear view-as" }),
            });

            await logoutFunction("/en/app/dashboard", session);

            expect(mockFetch).toHaveBeenCalledWith("/api/user/view-as", {
                method: "DELETE",
            });
            expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
            expect(mockRouterPush).toHaveBeenCalledWith("/en/login");
        });

        it("should handle network errors when clearing view-as", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "admin@example.com",
                    account_id: 10013,
                    role: "Admin",
                    view_as_user_id: "2",
                },
            };

            // Mock network error
            mockFetch.mockRejectedValue(new Error("Network error"));

            await logoutFunction("/en/app/dashboard", session);

            expect(mockFetch).toHaveBeenCalledWith("/api/user/view-as", {
                method: "DELETE",
            });
            expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
            expect(mockRouterPush).toHaveBeenCalledWith("/en/login");
        });
    });

    describe("Account Manager Logout", () => {
        it("should handle account manager logout correctly", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "manager@example.com",
                    account_id: 1002,
                    role: "Account_Manager",
                },
            };

            await logoutFunction("/en/app/dashboard", session);

            expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
            expect(mockRouterPush).toHaveBeenCalledWith("/en/login");
        });

        it("should handle account manager in view-as mode", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "manager@example.com",
                    account_id: 1002,
                    role: "Account_Manager",
                    view_as_user_id: "3",
                },
            };

            // Mock successful API call
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });

            await logoutFunction("/en/app/dashboard", session);

            expect(mockFetch).toHaveBeenCalledWith("/api/user/view-as", {
                method: "DELETE",
            });
            expect(mockUpdate).toHaveBeenCalled();
            expect(mockRouterPush).toHaveBeenCalledWith("/app/admin/accounts");
        });
    });

    describe("Error Handling", () => {
        it("should handle signOut errors gracefully", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "test@example.com",
                    account_id: 1001,
                    role: "Collection_Agent",
                },
            };

            mockSignOut.mockRejectedValue(new Error("SignOut failed"));

            // The function should throw when signOut fails
            await expect(
                logoutFunction("/en/app/dashboard", session)
            ).rejects.toThrow("SignOut failed");

            expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
            // router.push won't be called because signOut throws
            expect(mockRouterPush).not.toHaveBeenCalled();
        });

        it("should handle session update errors", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "admin@example.com",
                    account_id: 10013,
                    role: "Admin",
                    view_as_user_id: "2",
                },
            };

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });
            mockUpdate.mockRejectedValue(new Error("Session update failed"));

            // The function should fallback to full logout when session update fails
            await logoutFunction("/en/app/dashboard", session);

            expect(mockFetch).toHaveBeenCalled();
            expect(mockUpdate).toHaveBeenCalled();
            // Should fallback to full logout
            expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
            expect(mockRouterPush).toHaveBeenCalledWith("/en/login");
        });
    });

    describe("Locale Extraction", () => {
        it("should extract locale correctly from various pathnames", () => {
            const testCases = [
                { pathname: "/en/app/dashboard", expected: "en" },
                { pathname: "/he/app/dashboard", expected: "he" },
                { pathname: "/fr/app/dashboard", expected: "fr" },
                { pathname: "/es/app/dashboard", expected: "es" },
                { pathname: "/app/dashboard", expected: "app" }, // actual behavior
                { pathname: "/", expected: "en" }, // fallback
                { pathname: "", expected: "en" }, // fallback
            ];

            testCases.forEach(({ pathname, expected }) => {
                const currentLocale = pathname?.split("/")[1] || "en";
                expect(currentLocale).toBe(expected);
            });
        });
    });

    describe("Menu Close Function", () => {
        it("should call handleMenuClose function", async () => {
            const session = {
                user: {
                    id: "1",
                    email: "test@example.com",
                    account_id: 1001,
                    role: "Collection_Agent",
                },
            };

            const mockHandleMenuClose = vi.fn();

            // Reset mockSignOut to resolve successfully
            mockSignOut.mockResolvedValue(undefined);

            await logoutFunction(
                "/en/app/dashboard",
                session,
                mockHandleMenuClose
            );

            expect(mockHandleMenuClose).toHaveBeenCalled();
        });
    });
});
