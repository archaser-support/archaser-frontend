// Import jest-dom matchers for toBeInTheDocument and other DOM matchers
import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi, beforeEach, afterEach } from "vitest";

// Mock Next.js router
vi.mock("next/router", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
        reload: vi.fn(),
        pathname: "/",
        query: {},
        asPath: "/",
    }),
}));

// Mock Next.js navigation (for App Router)
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/",
    useParams: () => ({}),
}));

// Mock react-i18next with comprehensive translation support
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => {
            // Comprehensive translation map for all test scenarios
            const translations: Record<string, string> = {
                // User fields
                "user.fields.first_name": "First Name",
                "user.fields.last_name": "Last Name",
                "user.fields.email": "Email",
                "user.fields.mobile": "Mobile",
                "user.fields.role": "Role",
                "user.fields.status": "Status",
                "user.fields.name": "Name",
                "user.fields.language": "Language",
                "user.fields.timezone": "Timezone",
                "user.fields.locale": "Locale",
                "user.fields.account_id": "Customer ID",
                "user.fields.last_login": "Last Login",
                "user.fields.created_at": "Created At",
                "user.fields.modified_at": "Updated At",

                // User sections
                "user.sections.personal_information": "Personal Information",
                "user.sections.role_and_settings": "Role and Settings",
                "user.sections.location": "Location",
                "user.sections.account_information": "Account Information",
                "user.sections.status": "Status",

                // User messages and errors
                "user.error_loading_user": "Error Loading User",
                "user.user_not_found": "User Not Found",
                "user.user_not_found_description": "The user you're looking for could not be found",
                "user.no_users_found": "No users found",

                // User validation messages
                "user.validation.email_already_exists": "Email already exists",
                "user.validation.this_field_is_required": "This field is required",
                "user.validation.invalid_email": "Invalid email format",
                "user.validation.email_required": "Email is required",
                "user.validation.first_name_required": "First name is required",
                "user.validation.last_name_required": "Last name is required",
                "user.validation.role_required": "Role is required",
                "user.validation.email_cannot_contain_spaces": "Email cannot contain spaces",
                "user.validation.invalid_email_format": "Invalid email format",
                "user.validation.email_cannot_start_with_at": "Email cannot start with @",
                "user.validation.email_must_include_domain": "Email must include a domain",
                "user.validation.email_too_long": "Email is too long",
                "user.validation.domain_too_long": "Domain is too long",
                "user.validation.email_cannot_contain_consecutive_dots": "Email cannot contain consecutive dots",
                "user.validation.invalid_domain_format": "Invalid domain format",
                "user.validation.invalid_top_level_domain": "Invalid top-level domain",
                "user.validation.invalid_local_part": "Invalid email format",

                // User profile messages
                "user.profile.email_readonly_message": "Email cannot be changed for your own profile",
                "user.profile.cannot_deactivate_self": "You cannot deactivate your own account",
                "user.profile.profile_updated": "Profile updated successfully",
                "user.profile.profile_update_failed": "Failed to update profile",

                // User status
                "user.status.active": "Active",
                "user.status.inactive": "Inactive",
                "user.status.unnamed_user": "Unnamed User",

                // Common actions
                "common.actions.edit": "Edit",
                "common.actions.save": "Save",
                "common.actions.cancel": "Cancel",
                "common.actions.create": "Create",
                "common.actions.update": "Update",
                "common.actions.delete": "Delete",
                "common.actions.add": "Add",
                "common.actions.back": "Back",
                "common.actions.next": "Next",
                "common.actions.previous": "Previous",
                "common.actions.submit": "Submit",
                "common.actions.close": "Close",
                "common.actions.confirm": "Confirm",
                "common.actions.done": "Done",
                "common.actions.filter": "Filter",
                "common.actions.search": "Search",
                "common.actions.clear": "Clear",
                "common.actions.assign": "Assign",

                // Common status
                "common.status.success": "Success",
                "common.status.error": "Error",
                "common.status.warning": "Warning",
                "common.status.info": "Information",
                "common.status.active": "Active",
                "common.status.inactive": "Inactive",

                // Common validation
                "common.validation.required": "This field is required",
                "common.validation.invalidEmail": "Please enter a valid email address",
                "common.validation.minLength": "Must be at least {{count}} characters",
                "common.validation.maxLength": "Must be at most {{count}} characters",
                "common.validation.passwordMismatch": "Passwords do not match",

                // Common messages
                "common.messages.noResults": "No results found",
                "common.messages.noData": "No data available",
                "dashboard.loading": "Loading dashboard...",
                "common.messages.error": "An error occurred",
                "common.messages.success": "Operation completed successfully",

                // Settings
                "settings.title": "Settings",
                "settings.management": "Settings Management",
                "settings.description": "Manage your application settings",

                // Navigation and breadcrumbs
                "navigation.home": "Home",
                "navigation.dashboard": "Dashboard",
                "navigation.users": "Users",
                "navigation.settings": "Settings",
                "navigation.profile": "Profile",
                "navigation.logout": "Logout",

                // Form labels and placeholders
                "form.placeholder.first_name": "Enter first name",
                "form.placeholder.last_name": "Enter last name",
                "form.placeholder.email": "Enter email address",
                "form.placeholder.mobile": "Enter mobile number",
                "form.placeholder.search": "Search...",
                "form.placeholder.filter": "Filter...",

                // Time and date
                "time.justNow": "just now",
                "time.minutesAgo": "{{count}}m ago",
                "time.hoursAgo": "{{count}}h ago",
                "time.daysAgo": "{{count}}d ago",
                "time.weeksAgo": "{{count}}w ago",
                "time.monthsAgo": "{{count}}mo ago",
                "time.yearsAgo": "{{count}}y ago",
            };
            return translations[key] || key;
        },
        i18n: {
            changeLanguage: vi.fn(),
            language: "en",
        },
    }),
    initReactI18next: {
        type: "3rdParty",
        init: vi.fn(),
    },
    I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
    Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
    useSession: () => ({
        data: {
            user: {
                id: "test-user-id",
                email: "test@example.com",
                name: "Test User",
                role: "Admin",
                account_id: 1,
            },
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        status: "authenticated",
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
    getSession: vi.fn(),
    getCsrfToken: vi.fn(),
    getProviders: vi.fn(),
}));

// Mock window resize - only if window is defined (jsdom environment)
if (typeof window !== "undefined") {
    Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
    });
}

// Mock fetch globally
global.fetch = vi.fn();

// Mock @mui/icons-material to prevent EMFILE errors
vi.mock("@mui/icons-material", () => {
    const mockIcon = (props: any) =>
        React.createElement("span", {
            "data-testid": "mock-icon",
            ...props,
        });
    return new Proxy(
        {},
        {
            get: () => mockIcon,
        }
    );
});

// Mock @mui/x-data-grid
vi.mock("@mui/x-data-grid", () => ({
    DataGrid: vi.fn((props) => {
        return React.createElement("div", {
            "data-testid": "data-grid",
            ...props,
        });
    }),
    GridToolbar: vi.fn((props) => {
        return React.createElement("div", {
            "data-testid": "grid-toolbar",
            ...props,
        });
    }),
    GridToolbarColumnsButton: vi.fn((props) => {
        return React.createElement("div", {
            "data-testid": "grid-toolbar-columns-button",
            ...props,
        });
    }),
    GridToolbarFilterButton: vi.fn((props) => {
        return React.createElement("div", {
            "data-testid": "grid-toolbar-filter-button",
            ...props,
        });
    }),
    GridToolbarDensitySelector: vi.fn((props) => {
        return React.createElement("div", {
            "data-testid": "grid-toolbar-density-selector",
            ...props,
        });
    }),
    GridToolbarExport: vi.fn((props) => {
        return React.createElement("div", {
            "data-testid": "grid-toolbar-export",
            ...props,
        });
    }),
    GridToolbarQuickFilter: vi.fn((props) => {
        return React.createElement("div", {
            "data-testid": "grid-toolbar-quick-filter",
            ...props,
        });
    }),
}));

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
} as Storage;
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
} as Storage;
global.sessionStorage = sessionStorageMock;

// Mock window.matchMedia - only if window is defined (jsdom environment)
if (typeof window !== "undefined") {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock MutationObserver
global.MutationObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(),
}));

// Setup test environment
beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Reset localStorage and sessionStorage
    localStorageMock.clear();
    sessionStorageMock.clear();

    // Reset fetch mock
    (global.fetch as any).mockClear();
});

afterEach(() => {
    // Clean up after each test
    vi.clearAllTimers();
});
