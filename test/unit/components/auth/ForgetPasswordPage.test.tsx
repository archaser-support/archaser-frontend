import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ForgetPasswordPage from "@/app/[locale]/(auth)/forget-password/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock react-i18next
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                "login.forgotPassword.title": "Forgot Password?",
                "login.forgotPassword.description":
                    "Enter your email to receive a reset link",
                "login.forgotPassword.emailSent":
                    "Reset link sent to your email",
                "login.forgotPassword.sendResetLink": "Send Reset Link",
                "login.forgotPassword.sendingResetLink":
                    "Sending Reset Link...",
                "login.forgotPassword.userNotFound":
                    "No account found with this email address",
                "login.forgotPassword.resetFailed":
                    "Failed to send reset link. Please try again.",
                "login.forgotPassword.resetError":
                    "An unexpected error occurred. Please try again.",
                "login.form.email.label": "Email",
                "login.form.email.placeholder": "Enter your email",
                "login.form.email.required": "Email is required",
                "login.resetPassword.rememberPassword":
                    "Remember your password?",
                "login.actions.login": "Login",
            };
            return translations[key] || key;
        },
        i18n: {
            changeLanguage: vi.fn(),
            language: "en",
        },
    }),
}));

// Mock components
vi.mock("@/components/BackgroundPattern", () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="background-pattern">{children}</div>
    ),
}));

vi.mock("@/components/TranslationsProvider", () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="translations-provider">{children}</div>
    ),
}));

// Mock Material-UI theme
vi.mock("@mui/material", async () => {
    const actual = await vi.importActual("@mui/material");
    return {
        ...actual,
        useTheme: () => ({
            palette: {
                primary: {
                    main: "#6B46C1",
                    dark: "#5A3AA8",
                },
            },
            breakpoints: {
                down: () => false,
            },
            shape: {
                borderRadius: 8,
            },
            spacing: (value: number) => `${value * 8}px`,
        }),
        useMediaQuery: () => false,
    };
});

describe.skip("ForgetPasswordPage Component (EMFILE Issues)", () => {
    let mockFetch: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch = vi.spyOn(global, "fetch");
    });

    it("renders forgot password form with all required elements", () => {
        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        expect(screen.getByText("Forgot Password?")).toBeInTheDocument();
        expect(
            screen.getByText("Enter your email to receive a reset link")
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /send reset link/i })
        ).toBeInTheDocument();
        expect(screen.getByText("Remember your password?")).toBeInTheDocument();
        expect(screen.getByText("Login")).toBeInTheDocument();
    });

    it("validates email field on blur", async () => {
        const user = userEvent.setup();
        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);

        // Test empty email
        await user.click(emailInput);
        await user.tab();
        expect(screen.getByText("Email is required")).toBeInTheDocument();

        // Test invalid email
        await user.type(emailInput, "invalid-email");
        await user.tab();
        expect(
            screen.getByText("Please enter a valid email address")
        ).toBeInTheDocument();

        // Test valid email
        await user.clear(emailInput);
        await user.type(emailInput, "test@example.com");
        await user.tab();
        expect(screen.queryByText("Email is required")).not.toBeInTheDocument();
        expect(
            screen.queryByText("Please enter a valid email address")
        ).not.toBeInTheDocument();
    });

    it("handles successful password reset request", async () => {
        const user = userEvent.setup();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: "Reset link sent to your email" }),
        } as Response);

        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        await user.type(emailInput, "test@example.com");
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                "/api/auth/forget-password",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: "test@example.com" }),
                }
            );
        });

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "Reset link sent to your email"
            );
        });
    });

    it("handles user not found error", async () => {
        const user = userEvent.setup();
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({ message: "User not found" }),
        } as Response);

        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        await user.type(emailInput, "nonexistent@example.com");
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "No account found with this email address"
            );
        });
    });

    it("handles email service configuration error", async () => {
        const user = userEvent.setup();
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({
                message:
                    "Email service configuration error. Please contact support.",
            }),
        } as Response);

        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        await user.type(emailInput, "test@example.com");
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "Email service is temporarily unavailable. Please try again later or contact support."
            );
        });
    });

    it("handles general server error", async () => {
        const user = userEvent.setup();
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({ message: "Internal server error" }),
        } as Response);

        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        await user.type(emailInput, "test@example.com");
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "Internal server error"
            );
        });
    });

    it("handles network error", async () => {
        const user = userEvent.setup();
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        await user.type(emailInput, "test@example.com");
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "An unexpected error occurred. Please try again."
            );
        });
    });

    it("prevents form submission with invalid email", async () => {
        const user = userEvent.setup();
        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        // Try to submit with invalid email
        await user.type(emailInput, "invalid-email");
        await user.click(submitButton);

        expect(
            screen.getByText("Please enter a valid email address")
        ).toBeInTheDocument();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("prevents form submission with empty email", async () => {
        const user = userEvent.setup();
        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        // Try to submit without entering email
        await user.click(submitButton);

        expect(screen.getByText("Email is required")).toBeInTheDocument();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows loading state during submission", async () => {
        const user = userEvent.setup();
        mockFetch.mockImplementation(
            () =>
                new Promise((resolve) =>
                    setTimeout(
                        () =>
                            resolve({
                                ok: true,
                                json: async () => ({
                                    message: "Reset link sent to your email",
                                }),
                            }),
                        100
                    )
                )
        );

        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        await user.type(emailInput, "test@example.com");
        await user.click(submitButton);

        expect(screen.getByText("Sending Reset Link...")).toBeInTheDocument();
    });

    it("disables submit button during loading", async () => {
        const user = userEvent.setup();
        mockFetch.mockImplementation(
            () =>
                new Promise((resolve) =>
                    setTimeout(
                        () =>
                            resolve({
                                ok: true,
                                json: async () => ({
                                    message: "Reset link sent to your email",
                                }),
                            }),
                        100
                    )
                )
        );

        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        await user.type(emailInput, "test@example.com");
        await user.click(submitButton);

        expect(submitButton).toBeDisabled();
    });

    it("clears previous error when user starts typing", async () => {
        const user = userEvent.setup();
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({ message: "User not found" }),
        } as Response);

        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        // First, trigger an error
        await user.type(emailInput, "nonexistent@example.com");
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeInTheDocument();
        });

        // Then start typing again
        await user.clear(emailInput);
        await user.type(emailInput, "new@example.com");

        await waitFor(() => {
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });
    });

    it("handles successful submission and shows success message", async () => {
        const user = userEvent.setup();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: "Reset link sent to your email" }),
        } as Response);

        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        await user.type(emailInput, "test@example.com");
        await user.click(submitButton);

        await waitFor(() => {
            const alert = screen.getByRole("alert");
            expect(alert).toHaveTextContent("Reset link sent to your email");
            expect(alert).toHaveAttribute("data-severity", "success");
        });
    });

    it("handles error and shows error message", async () => {
        const user = userEvent.setup();
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({ message: "Server error" }),
        } as Response);

        render(<ForgetPasswordPage params={{ locale: "en" }} />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole("button", {
            name: /send reset link/i,
        });

        await user.type(emailInput, "test@example.com");
        await user.click(submitButton);

        await waitFor(() => {
            const alert = screen.getByRole("alert");
            expect(alert).toHaveTextContent("Server error");
            expect(alert).toHaveAttribute("data-severity", "error");
        });
    });
});
