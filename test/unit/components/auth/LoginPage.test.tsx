import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import LoginPage from "@/app/[locale]/(auth)/login/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
    signIn: vi.fn(),
    getSession: vi.fn(),
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: { [key: string]: string } = {
                "login.title": "Log In",
                "login.welcomeBack": "Welcome back! Please enter your details.",
                "login.form.email.label": "Email",
                "login.form.email.placeholder": "Enter your email address",
                "login.form.email.required":
                    "Please enter a valid email address.",
                "login.form.password.label": "Password",
                "login.form.password.placeholder": "Enter your password",
                "login.form.password.required": "Password is required.",
                "login.actions.login": "Log In",
                "login.actions.forgotPassword": "Forgot password?",
                "login.messages.invalidCredentials":
                    "Invalid email or password.",
                "login.messages.accountInactive":
                    "Your account is currently inactive. Please contact support.",
                "login.messages.magicLinkOnly":
                    "This email is registered for magic link login only",
                "login.messages.loggingIn": "Logging in...",
                "login.messages.error":
                    "An error occurred during login. Please try again.",
                "login.messages.success":
                    "Successfully logged in! Redirecting...",
            };
            return translations[key] || key;
        },
        i18n: {
            changeLanguage: vi.fn(),
            language: "en",
        },
    }),
}));

// Mock i18nConfig
vi.mock("@/i18nConfig", () => ({
    default: {
        defaultLocale: "en",
    },
}));

// Mock AppUrls
vi.mock("@/utils/appUrls", () => ({
    default: {
        DASHBOARD: "/dashboard",
    },
}));

// Mock components
vi.mock("@/components/BackgroundPattern", () => {
    const BackgroundPattern = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="background-pattern">{children}</div>
    );
    return { default: BackgroundPattern };
});

vi.mock("@/components/LoadingOverlay", () => {
    const LoadingOverlay = ({
        open,
        message,
    }: {
        open: boolean;
        message: string;
    }) => (open ? <div data-testid="loading-overlay">{message}</div> : null);
    return { default: LoadingOverlay };
});

vi.mock("@/components/SuccessAnimation", () => {
    const SuccessAnimation = ({
        open,
        message,
    }: {
        open: boolean;
        message: string;
    }) => (open ? <div data-testid="success-animation">{message}</div> : null);
    return { default: SuccessAnimation };
});

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
        }),
        useMediaQuery: () => false,
    };
});

describe.skip("LoginPage Component (EMFILE Issues)", () => {
    let mockSignIn: any;
    let mockGetSession: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        mockSignIn = vi.spyOn(require("next-auth/react"), "signIn");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        mockGetSession = vi.spyOn(require("next-auth/react"), "getSession");
    });

    it("renders login form with all required elements", () => {
        render(<LoginPage />);

        expect(screen.getByText("Log In")).toBeInTheDocument();
        expect(
            screen.getByText("Welcome back! Please enter your details.")
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText("Enter your password")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
        expect(screen.getByText("Forgot password?")).toBeInTheDocument();
    });

    it("validates email field on blur", async () => {
        const user = userEvent.setup();
        render(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);

        // Test empty email
        await user.click(emailInput);
        await user.tab();
        expect(
            screen.getByText("Please enter a valid email address.")
        ).toBeInTheDocument();

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
        expect(
            screen.queryByText("Please enter a valid email address.")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText("Please enter a valid email address")
        ).not.toBeInTheDocument();
    });

    it("validates password field on blur", async () => {
        const user = userEvent.setup();
        render(<LoginPage />);

        const passwordInput = screen.getByPlaceholderText(
            "Enter your password"
        );

        // Test empty password
        await user.click(passwordInput);
        await user.tab();
        expect(screen.getByText("Password is required.")).toBeInTheDocument();

        // Test valid password
        await user.type(passwordInput, "password123");
        await user.tab();
        expect(
            screen.queryByText("Password is required.")
        ).not.toBeInTheDocument();
    });

    it("toggles password visibility", async () => {
        const user = userEvent.setup();
        render(<LoginPage />);

        const passwordInput = screen.getByPlaceholderText(
            "Enter your password"
        );
        const visibilityToggle = screen.getByLabelText(
            /toggle password visibility/i
        );

        // Password should be hidden by default
        expect(passwordInput).toHaveAttribute("type", "password");

        // Click to show password
        await user.click(visibilityToggle);
        expect(passwordInput).toHaveAttribute("type", "text");

        // Click to hide password again
        await user.click(visibilityToggle);
        expect(passwordInput).toHaveAttribute("type", "password");
    });

    it("handles successful login", async () => {
        const user = userEvent.setup();
        mockSignIn.mockResolvedValue({ error: null });
        mockGetSession.mockResolvedValue({
            user: { language: "English" },
        });

        render(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByPlaceholderText(
            "Enter your password"
        );
        const loginButton = screen.getByRole("button", { name: /log in/i });

        await user.type(emailInput, "test@example.com");
        await user.type(passwordInput, "password123");
        await user.click(loginButton);

        await waitFor(() => {
            expect(mockSignIn).toHaveBeenCalledWith("credentials", {
                email: "test@example.com",
                password: "password123",
                redirect: false,
            });
        });

        await waitFor(() => {
            expect(screen.getByTestId("success-animation")).toBeInTheDocument();
        });
    });

    it("handles invalid credentials error", async () => {
        const user = userEvent.setup();
        mockSignIn.mockResolvedValue({ error: "Invalid credentials" });

        render(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByPlaceholderText(
            "Enter your password"
        );
        const loginButton = screen.getByRole("button", { name: /log in/i });

        await user.type(emailInput, "test@example.com");
        await user.type(passwordInput, "wrongpassword");
        await user.click(loginButton);

        await waitFor(() => {
            expect(
                screen.getByText("Invalid email or password.")
            ).toBeInTheDocument();
        });
    });

    it("handles inactive account error", async () => {
        const user = userEvent.setup();
        mockSignIn.mockResolvedValue({ error: "inactive" });

        render(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByPlaceholderText(
            "Enter your password"
        );
        const loginButton = screen.getByRole("button", { name: /log in/i });

        await user.type(emailInput, "test@example.com");
        await user.type(passwordInput, "password123");
        await user.click(loginButton);

        await waitFor(() => {
            expect(
                screen.getByText(
                    "Your account is currently inactive. Please contact support."
                )
            ).toBeInTheDocument();
        });
    });

    it("handles magic link only error", async () => {
        const user = userEvent.setup();
        mockSignIn.mockResolvedValue({ error: "magic link" });

        render(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByPlaceholderText(
            "Enter your password"
        );
        const loginButton = screen.getByRole("button", { name: /log in/i });

        await user.type(emailInput, "test@example.com");
        await user.type(passwordInput, "password123");
        await user.click(loginButton);

        await waitFor(() => {
            expect(
                screen.getByText(
                    "This email is registered for magic link login only"
                )
            ).toBeInTheDocument();
        });
    });

    it("prevents form submission with invalid data", async () => {
        const user = userEvent.setup();
        render(<LoginPage />);

        const loginButton = screen.getByRole("button", { name: /log in/i });

        // Try to submit without entering any data
        await user.click(loginButton);

        expect(
            screen.getByText("Please enter a valid email address.")
        ).toBeInTheDocument();
        expect(screen.getByText("Password is required.")).toBeInTheDocument();
        expect(mockSignIn).not.toHaveBeenCalled();
    });

    it("shows loading state during login", async () => {
        const user = userEvent.setup();

        // Create a promise that doesn't resolve immediately
        let resolveSignIn: (value: any) => void;
        const signInPromise = new Promise((resolve) => {
            resolveSignIn = resolve;
        });
        mockSignIn.mockReturnValue(signInPromise);

        render(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByPlaceholderText(
            "Enter your password"
        );
        const loginButton = screen.getByRole("button", { name: /log in/i });

        await user.type(emailInput, "test@example.com");
        await user.type(passwordInput, "password123");

        // Debug: Check if form validation is working
        expect(emailInput).toHaveValue("test@example.com");
        expect(passwordInput).toHaveValue("password123");

        // Submit the form
        await user.click(loginButton);

        // Check that the button shows loading state
        await waitFor(() => {
            expect(screen.getByText("Logging in...")).toBeInTheDocument();
        });

        // Resolve the promise to complete the test
        resolveSignIn!({ error: null });
    });

    it("disables login button during loading", async () => {
        const user = userEvent.setup();

        // Create a promise that doesn't resolve immediately
        let resolveSignIn: (value: any) => void;
        const signInPromise = new Promise((resolve) => {
            resolveSignIn = resolve;
        });
        mockSignIn.mockReturnValue(signInPromise);

        render(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByPlaceholderText(
            "Enter your password"
        );
        const loginButton = screen.getByRole("button", { name: /log in/i });

        await user.type(emailInput, "test@example.com");
        await user.type(passwordInput, "password123");
        await user.click(loginButton);

        // Wait for the loading state to be set and check that the button is disabled
        await waitFor(() => {
            expect(loginButton).toBeDisabled();
        });

        // Also verify the loading text is shown
        await waitFor(() => {
            const loadingOverlay = screen.getByTestId("loading-overlay");
            expect(loadingOverlay).toBeInTheDocument();
            expect(loadingOverlay).toHaveTextContent("Logging in...");
        });

        // Resolve the promise to complete the test
        resolveSignIn!({ error: null });
    });
});
