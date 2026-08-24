"use client";
import {
    AccountBalance as AccountBalanceIcon,
    Assessment as AssessmentIcon,
    BarChart as BarChartIcon,
    Business as BusinessIcon,
    CalendarToday as CalendarTodayIcon,
    CloudUpload as CloudUploadIcon,
    Dashboard as DashboardIcon,
    Mail as EmailIcon,
    Gavel as GavelIcon,
    MenuOpen as MenuOpenIcon,
    Message as MessageIcon,
    MonitorHeart as MonitorHeartIcon,
    People as PeopleIcon,
    Person as PersonIcon,
    Schedule as ScheduleIcon,
    Settings as SettingsIcon,
    ViewList as ViewListIcon
} from "@mui/icons-material";
import {
    Box,
    Chip,
    CircularProgress,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import FollowUpReminder from "@/app/[locale]/app/agents/components/FollowUpReminder";
import AccessDenied from "@/components/AccessDenied";
import AppHeader from "@/components/AppHeader";
import { SessionInitializer } from "@/components/SessionInitializer";
import ViewAsBanner from "@/components/ViewAsBanner";
import { useSessionState } from "@/hooks/useSessionState";
import { CreditInsuranceNavIcon } from "@/shared/components/CreditInsuranceNavIcon";
import SpinnerOverlay from "@/shared/layout-components/spinner/SpinnerOverlay";
import { SpinnerProvider } from "@/shared/layout-components/spinner/SpinnerProvider";
import { ToastProvider, useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    getDefaultLandingPage,
    getFirstAccessiblePage,
    isAppRouteAccessible,
    normalizeAppPathname,
} from "@/shared/utils/navigation";
import { getLocalizedPath } from "@/utils/navigationUtils";
import AppUrls from "@/utils/appUrls";

import ReactQueryProvider from "./ReactQueryProvider";

const drawerWidth = 210;

// Global fix for aria-hidden accessibility issues with Material-UI components
const useAriaHiddenFix = () => {
    useEffect(() => {
        const fixAriaHiddenIssues = () => {
            // Find all elements with aria-hidden="true"
            const hiddenElements = document.querySelectorAll(
                '[aria-hidden="true"]'
            );

            hiddenElements.forEach((element) => {
                // Check if this element contains a focused element
                const activeElement = document.activeElement as HTMLElement;
                if (!activeElement) return;

                const isAncestorOfFocused = element.contains(activeElement);
                if (!isAncestorOfFocused) return;

                // Check if the focused element is interactive (button, input, etc.)
                // Also check if it's a Menu/Popover paper that can contain focusable elements
                const isInteractiveElement =
                    activeElement.tagName === "BUTTON" ||
                    activeElement.tagName === "INPUT" ||
                    activeElement.tagName === "TEXTAREA" ||
                    activeElement.tagName === "SELECT" ||
                    activeElement.tagName === "A" ||
                    activeElement.getAttribute("role") === "button" ||
                    activeElement.getAttribute("role") === "menu" ||
                    activeElement.getAttribute("role") === "listbox" ||
                    activeElement.getAttribute("tabindex") !== null ||
                    activeElement.classList.contains("MuiButtonBase-root") ||
                    activeElement.classList.contains("MuiIconButton-root") ||
                    activeElement.classList.contains("MuiMenu-paper") ||
                    activeElement.classList.contains("MuiPopover-paper") ||
                    activeElement.querySelector(
                        "button, input, [role='menuitem'], [role='option']"
                    ) !== null;

                // Only fix if the focused element is interactive
                if (!isInteractiveElement) return;

                // Exception: Don't remove aria-hidden from backdrop elements as they should remain hidden
                const isBackdrop =
                    element.classList.contains("MuiBackdrop-root") ||
                    element.getAttribute("data-backdrop") === "true";

                // Remove aria-hidden from any ancestor of the focused element (including modal/dialog
                // roots and MUI Box). Per WAI-ARIA, a focused element must not be hidden from
                // assistive technology; only skip the backdrop.
                if (!isBackdrop) {
                    element.removeAttribute("aria-hidden");
                }
            });
        };

        // Run immediately
        fixAriaHiddenIssues();

        // Set up mutation observer to watch for changes
        const observer = new MutationObserver(() => {
            fixAriaHiddenIssues();
        });

        // Observe changes to the document
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["aria-hidden"],
            subtree: true,
            childList: true,
        });

        // Also observe focus changes
        const handleFocus = () => {
            setTimeout(fixAriaHiddenIssues, 0);
        };
        document.addEventListener("focusin", handleFocus);
        document.addEventListener("focusout", handleFocus);

        return () => {
            observer.disconnect();
            document.removeEventListener("focusin", handleFocus);
            document.removeEventListener("focusout", handleFocus);
        };
    }, []);
};

const AppLayout = ({ children }: any) => {
    const { t } = useTranslation(["common"]);
    const theme = useTheme();

    // Helper function to generate appealing tooltips for menu items
    const getMenuTooltip = (item: { label: string; href: string }) => {
        const tooltips: Record<string, string> = {
            // Admin section
            "/app/admin/dashboard": t(
                "tooltips.admin_dashboard",
                "System-wide analytics and performance insights"
            ),
            "/app/admin/accounts": t(
                "tooltips.manage_accounts",
                "Manage accounts, users, and system configurations"
            ),
            "/app/admin/logs": t(
                "tooltips.system_logs",
                "Monitor system activity and troubleshoot issues"
            ),
            "/app/admin/sms": t(
                "tooltips.sms_management",
                "Configure SMS providers and messaging settings"
            ),
            "/app/admin/email-campaign-report": t(
                "tooltips.email_campaigns",
                "Track email campaign performance and analytics"
            ),
            "/app/admin/cron-jobs": t(
                "tooltips.cron_jobs",
                "Monitor scheduled tasks and automated processes"
            ),


            // Main section
            "/app/dashboard": t(
                "tooltips.dashboard",
                "Your business overview with key metrics and insights"
            ),
            "/app/control-center": t(
                "tooltips.control_center",
                "Monitor system health and resolve critical issues"
            ),
            "/app/customers": t(
                "tooltips.customers",
                "Manage your customer database and relationships"
            ),

            // Categories section
            "/app/disputes": t(
                "tooltips.disputes",
                "Track and resolve customer disputes efficiently"
            ),
            "/app/agents": t(
                "tooltips.agents",
                "View collection agents and their performance metrics"
            ),
            "/app/legal": t(
                "tooltips.legal",
                "Access legal documents and manage case files"
            ),
            "/app/promise-to-pay": t(
                "tooltips.promise_to_pay",
                "Manage payment promises and track commitments"
            ),

            // Settings section
            "/app/settings": t(
                "tooltips.settings",
                "Configure system settings, preferences, and integrations"
            ),
            "/app/activitySequences": t(
                "tooltips.activity_sequences",
                "Design and manage automated workflow sequences"
            ),

            // Import section - consolidated page
            "/app/import": t(
                "tooltips.import",
                "Import data from CSV or Excel files"
            ),
        };

        // Try exact match first
        if (tooltips[item.href]) {
            return tooltips[item.href];
        }

        // Try partial match for dynamic routes
        for (const [key, value] of Object.entries(tooltips)) {
            if (item.href.startsWith(key)) {
                return value;
            }
        }

        // Fallback: return a generic tooltip based on label
        return item.label;
    };

    // Apply global aria-hidden fix for Popovers
    useAriaHiddenFix();
    const pathname = usePathname();
    const router = useRouter();
    const params = useParams();
    const currentLocale = (params?.locale as string) || "en";
    const toNavHref = useCallback(
        (href: string) => getLocalizedPath(currentLocale, href),
        [currentLocale]
    );
    const [mobileOpen, setMobileOpen] = useState(false);
    // Load sidebar state from session (inverted: sidebar_collapsed means collapsed=true, sidebarOpen means open=true)
    // Fallback to localStorage for backward compatibility, default to true if not set
    const [sidebarOpen, setSidebarOpen] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("sidebarOpen");
            return saved !== null ? saved === "true" : true;
        }
        return true;
    });
    const { session, status, update, isSessionReady } = useSessionState();

    // Determine if user's language is Hebrew for RTL layout
    const isHebrewUser = session?.user?.language === "Hebrew";

    // Language change is now handled in TranslationsProvider
    const [mounted, setMounted] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { showToast } = useToast();
    const [activeMenuItem, setActiveMenuItem] = useState<string | null>(null);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [isTogglingSidebar, setIsTogglingSidebar] = useState(false);
    const [lastUserToggle, setLastUserToggle] = useState<boolean | null>(null);

    // Add CSS animation for pulse effect
    useEffect(() => {
        const style = document.createElement("style");
        style.textContent = `
            @keyframes pulse {
                0%, 100% {
                    opacity: 0.1;
                }
                50% {
                    opacity: 0.2;
                }
            }
            
            @keyframes menuItemActive {
                0% {
                    transform: translateX(0) scale(1);
                    box-shadow: none;
                }
                50% {
                    transform: translateX(0) scale(1.05);
                    box-shadow: none;
                }
                100% {
                    transform: translateX(0) scale(1.02);
                    box-shadow: none;
                }
            }
            
            .menu-item-active {
                animation: menuItemActive 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Initialize sidebar state from session when session becomes available
    useEffect(() => {
        // Don't override user's immediate toggle action
        if (isTogglingSidebar) {
            return;
        }
        // Don't override if user has manually toggled and local state differs from session
        if (lastUserToggle !== null) {
            const sessionSidebarOpen =
                session?.user?.sidebar_collapsed === undefined
                    ? true
                    : !session?.user?.sidebar_collapsed;
            // Only sync if the session value matches what the user set
            // This prevents the session from overriding a user action
            if (lastUserToggle === sessionSidebarOpen) {
                // Session has caught up, clear the flag
                setLastUserToggle(null);
            } else {
                // Session still has old value, don't override user's action
                return;
            }
        }
        if (isSessionReady && session?.user?.id) {
            // Use session value if available (inverted: sidebar_collapsed means collapsed=true)
            const sessionSidebarOpen =
                session.user.sidebar_collapsed === undefined
                    ? true
                    : !session.user.sidebar_collapsed;
            setSidebarOpen(sessionSidebarOpen);
        }
    }, [
        isSessionReady,
        session?.user?.id,
        session?.user?.sidebar_collapsed,
        isTogglingSidebar,
        lastUserToggle,
    ]);

    // Prevent hydration mismatch by only rendering after mount
    useEffect(() => {
        setMounted(true);

        // Check for fresh login and force refresh if needed
        if (typeof window !== "undefined") {
            const freshLogin = localStorage.getItem("freshLogin");
            const loginTimestamp = localStorage.getItem("loginTimestamp");

            if (freshLogin === "true" && loginTimestamp) {
                const loginTime = parseInt(loginTimestamp);
                const now = Date.now();
                const timeDiff = now - loginTime;

                // If login was within the last 30 seconds, force refresh
                if (timeDiff < 30000) {
                    // Clear the flag
                    localStorage.removeItem("freshLogin");
                    localStorage.removeItem("loginTimestamp");

                    // Force refresh the sidebar
                    setTimeout(() => {
                        forceRefreshSidebar();
                    }, 100);
                }
            }
        }
    }, []);

    // React Query's broadcastQueryClient already handles syncing queries across tabs
    // No need for a custom broadcast listener since React Query broadcasts automatically
    // when queries are invalidated or refetched

    // Track active menu item and apply animation
    useEffect(() => {
        if (pathname && pathname !== activeMenuItem) {
            setActiveMenuItem(pathname);
        }
    }, [pathname, activeMenuItem]);

    // Fetch collection agents for view-as functionality
    useEffect(() => {
        const fetchCollectionAgents = async () => {
            // Fetch collection agents for Collection Managers, System Administrators, and ARchaser Admins (account_id 10013)
            // Temporary backward compatibility: also check for old "Account_Manager" role during migration
            if (
                session?.user?.role !== "Collection_Manager" &&
                session?.user?.role !== "Collection Manager" &&
                session?.user?.role !== "System_Administrator" &&
                session?.user?.role !== "System Administrator" &&
                session?.user?.role !== "Account_Manager" &&
                session?.user?.account_id !== 10013
            )
                return;

            try {
                setLoading(true);
                const response = await apiFetch("/api/entities/users/collection-agents"
                );
                if (!response.ok) {
                    // Silently handle 403 (Forbidden) - expected for users without permissions
                    if (response.status === 403) {
                        setUsers([]);
                        return;
                    }
                    throw new Error("Failed to fetch collection agents");
                }
                const data = await response.json();
                setUsers(data);
            } catch (err) {
                // Only set error for unexpected errors, not permission issues
                if (err instanceof Error && !err.message.includes("403")) {
                    setError(err.message);
                } else {
                    // Silently handle permission errors
                    setUsers([]);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchCollectionAgents();
    }, [session?.user?.role, session?.user?.account_id]);

    const { data: controlCenterStats } = useQuery({
        queryKey: ["controlCenterStats"],
        queryFn: async () => {
            const response = await api.get(
                "/api/system/control-center?operation=stats"
            );
            return response.data;
        },
        refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
        refetchOnWindowFocus: true, // Refetch when window regains focus
        staleTime: 1000 * 60 * 2, // Consider data stale after 2 minutes
        enabled: mounted && status === "authenticated", // Only run query after component is mounted and user is authenticated
    });

    const controlCenterIssueCount = useMemo(() => {
        if (!controlCenterStats) return 0;
        return (
            (controlCenterStats.noContacts?.active || 0) +
            (controlCenterStats.invalidContacts?.active || 0) +
            (controlCenterStats.invoicesWithoutCustomer?.active ||
                controlCenterStats.invoicesWithoutCustomer?.active ||
                0) +
            (controlCenterStats.orphanCreditInvoices?.active || 0)
        );
    }, [controlCenterStats]);

    // Helper function to get user display name
    const getUserDisplayName = (user: any) => {
        if (!user) {
            return null;
        }

        // Try first_name + last_name first
        if (user.first_name && user.last_name) {
            return `${user.first_name} ${user.last_name}`;
        }

        // Fall back to name field
        if (user.name) {
            return user.name;
        }

        // Fall back to email
        if (user.email) {
            return user.email;
        }

        return "Unknown User";
    };

    // Find the user being viewed as
    const viewAsUser = users.find(
        (u) => u.id === session?.user?.view_as_user_id
    );

    // Check if the found user has a display name
    const viewAsUserName = viewAsUser ? getUserDisplayName(viewAsUser) : null;

    // If we have a view_as_user_id but can't find the user in our list, or if the user doesn't have a name, fetch that specific user
    // Use React Query for better caching and error handling
    const shouldFetchUser =
        !!session?.user?.view_as_user_id && (!viewAsUser || !viewAsUserName);

    const queryClient = useQueryClient();

    const {
        data: viewAsUserDetails,
        isLoading: isLoadingViewAsUser,
        error: viewAsUserError,
        refetch: refetchViewAsUser,
    } = useQuery({
        queryKey: ["view-as-user", session?.user?.view_as_user_id],
        queryFn: async () => {
            const userId = session?.user?.view_as_user_id;
            if (!userId) {
                return null;
            }
            const response = await apiFetch(`/api/entities/users/${userId}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Failed to fetch user: ${response.status} - ${errorText}`
                );
            }
            const userData = await response.json();
            return userData;
        },
        enabled: shouldFetchUser,
        staleTime: 0, // Don't cache - always refetch
        retry: 1,
        refetchOnWindowFocus: false,
    });

    // Use either the user from the list or the fetched details
    const currentViewAsUser = viewAsUser || viewAsUserDetails;

    // Get the current view-as user's display name
    let currentViewAsUserName = getUserDisplayName(currentViewAsUser);

    // If we don't have a name yet, try to get it from the session
    if (!currentViewAsUserName && session?.user?.view_as_user_name) {
        currentViewAsUserName = session.user.view_as_user_name;
    }

    // If we have an error, show a fallback message
    if (viewAsUserError && !currentViewAsUserName) {
        currentViewAsUserName = `User ${session?.user?.view_as_user_id}`;
    }

    // Determine the effective user and their permissions
    const getEffectiveUser = () => {
        // Use view-as user if available, otherwise use the actual session user
        const role = session?.user?.view_as_user_id
            ? session?.user?.view_as_user_role
            : session?.user?.role;

        const accountId = session?.user?.view_as_user_id
            ? session?.user?.view_as_user_account_id
            : session?.user?.account_id;

        return {
            id: session?.user?.view_as_user_id || session?.user?.id,
            role: role,
            account_id: accountId,
            // Role-based flags removed - use permissions instead
            // Only keep account_id check for system admin
            isSystemAdmin: accountId === 10013,
        };
    };

    const effectiveUser = getEffectiveUser();

    // Fetch user permissions
    const { data: userPermissionsData, isLoading: isLoadingPermissions } =
        useQuery<{ permissions: string[] }>({
            queryKey: [
                "user-permissions",
                session?.user?.id,
                effectiveUser.role,
                effectiveUser.account_id,
            ],
            queryFn: async () => {
                const response = await api.get("/api/permissions/me");
                return response.data;
            },
            enabled: !!session?.user && status === "authenticated",
            staleTime: 0, // Don't cache - always fetch fresh permissions
            gcTime: 0, // Don't keep in cache
            refetchOnWindowFocus: true, // Refetch when window regains focus
            refetchOnMount: true, // Always refetch on mount
        });

    const { data: effectiveAccountProducts, isLoading: isLoadingAccountProducts } = useQuery<{
        has_collection?: boolean;
        has_credit_insurance?: boolean;
        has_file_import?: boolean;
    }>({
        queryKey: ["account-products", effectiveUser.account_id],
        queryFn: async () => {
            if (!effectiveUser.account_id) {
                return {
                    has_collection: true,
                    has_credit_insurance: false,
                    has_file_import: true,
                };
            }
            const response = await api.get(
                `/api/entities/accounts/${effectiveUser.account_id}`
            );
            return {
                has_collection:
                    response.data?.has_collection !== undefined
                        ? response.data.has_collection
                        : true,
                has_credit_insurance:
                    response.data?.has_credit_insurance === true,
                has_file_import: response.data?.has_file_import !== false,
            };
        },
        enabled: !!effectiveUser.account_id,
        staleTime: 60 * 1000,
    });

    const { isLoading: isLoadingAccountTheme } = useQuery({
        queryKey: ["account-theme-colors", effectiveUser.account_id],
        queryFn: async () => {
            if (!effectiveUser.account_id) return null;
            const response = await api.get(
                `/api/entities/accounts/${effectiveUser.account_id}`
            );
            return {
                primary_color: response.data?.primary_color ?? null,
                secondary_color: response.data?.secondary_color ?? null,
                chart_palette_color: response.data?.chart_palette_color ?? null,
            };
        },
        enabled: !!effectiveUser.account_id && status === "authenticated",
        staleTime: 60 * 1000,
    });

    const hasCollectionProduct =
        effectiveAccountProducts?.has_collection !== undefined
            ? !!effectiveAccountProducts.has_collection
            : true;
    const hasCreditInsuranceProduct =
        effectiveAccountProducts?.has_credit_insurance === true;
    const hasFileImportProduct =
        effectiveAccountProducts?.has_file_import !== false;
    const isCreditOnlyAccount =
        !hasCollectionProduct && hasCreditInsuranceProduct;

    // Only use permissions if they've been loaded (don't use empty array as fallback)
    const userPermissions = userPermissionsData?.permissions;

    // Permission checks - replace all role-based checks with permission-based checks
    // Only check permissions if they've been loaded, otherwise default to false
    const hasViewActivitySequencesPermission = userPermissions
        ? userPermissions.includes("view_activity_sequences")
        : false;
    const hasViewSettingsPermission = userPermissions
        ? userPermissions.includes("view_settings")
        : false;
    const hasViewSystemLogsPermission = userPermissions
        ? userPermissions.includes("view_system_logs")
        : false;
    const hasImportCustomerPermission = userPermissions
        ? userPermissions.includes("import_customer")
        : false;
    const hasImportInvoicePermission = userPermissions
        ? userPermissions.includes("import_invoice")
        : false;
    const hasImportContactPermission = userPermissions
        ? userPermissions.includes("import_contact")
        : false;
    const hasImportPaymentPermission = userPermissions
        ? userPermissions.includes("import_payment")
        : false;
    const hasViewCustomersPermission = userPermissions
        ? userPermissions.includes("view_customers")
        : false;
    const hasViewOperationDashboardPermission = userPermissions
        ? userPermissions.includes("view_operation_dashboard")
        : false;
    const hasViewFinancialDashboardPermission = userPermissions
        ? userPermissions.includes("view_financial_dashboard")
        : false;
    const hasViewCreditDashboardPermission = userPermissions
        ? userPermissions.includes("view_credit_dashboard")
        : false;
    const hasViewReportsPermission = userPermissions
        ? userPermissions.includes("view_reports")
        : false;

    // Admin section - only for account_id 10013 (system admin account)
    // This is a special case that should remain role-based as it's about system-level access
    const shouldShowAdminSection = effectiveUser.account_id === 10013;

    // Settings section - show if user has view_settings permission
    const shouldShowSettingsSection = hasViewSettingsPermission;

    // Import section - show if File Import product is on and user has any import permission
    const shouldShowImportSection =
        hasFileImportProduct &&
        (hasImportCustomerPermission ||
            hasImportInvoicePermission ||
            hasImportContactPermission ||
            hasImportPaymentPermission);

    // Main section - show if user has view_customers permission (or if they're not system admin)
    const shouldShowMainSection =
        hasViewCustomersPermission || effectiveUser.account_id !== 10013;

    // Hide categories, settings, and import sections for customer ID 10013
    const hideForCustomer = effectiveUser.account_id === 10013;

    const handleViewAsChange = async (userId: string) => {
        if (!userId) {
            // Clear view-as
            await handleClearViewAs();
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await apiFetch("/api/entities/users/view-as", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });
            const successData = await response.json();
            const { permissions, viewAsUserAccountId } = successData;

            let accountProducts: {
                has_collection?: boolean;
                has_credit_insurance?: boolean;
                has_file_import?: boolean;
            } | undefined;
            if (viewAsUserAccountId) {
                try {
                    const accountResponse = await api.get(
                        `/api/entities/accounts/${viewAsUserAccountId}`
                    );
                    accountProducts = {
                        has_collection:
                            accountResponse.data?.has_collection !== undefined
                                ? accountResponse.data.has_collection
                                : true,
                        has_credit_insurance:
                            accountResponse.data?.has_credit_insurance === true,
                        has_file_import:
                            accountResponse.data?.has_file_import !== false,
                    };
                } catch {
                    accountProducts = undefined;
                }
            }

            // Update the session
            const updatedSession = await update({ view_as_user_id: userId });

            // Determine the first accessible page based on the target user's permissions
            const redirectPath = getFirstAccessiblePage(
                permissions || [],
                viewAsUserAccountId,
                accountProducts
            );

            // Redirect to the calculated page after switching to view-as user
            // Use window.location to ensure a full page reload with the new session
            const currentLocale = (params?.locale as string) || "en";
            window.location.href = `/${currentLocale}${redirectPath}`;
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            showToast(error || "An error occurred", "error", 4000);
        } finally {
            setLoading(false);
        }
    };

    const handleClearViewAs = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiFetch("/api/entities/users/view-as", {
                method: "DELETE",
            });

            if (!response.ok) {
                const errorData = await response
                    .json()
                    .catch(() => ({ error: "Unknown error" }));
                throw new Error(
                    errorData.error || "Failed to clear view-as user"
                );
            }

            // Clear any cached view-as user details immediately using query client
            queryClient.setQueryData(
                ["view-as-user", session?.user?.view_as_user_id],
                null
            );
            queryClient.invalidateQueries({ queryKey: ["view-as-user"] });

            // Show success message
            showToast(
                t("messages.view_as_cleared_success", { ns: "users" }) ||
                "View as cleared successfully",
                "success",
                1500
            );

            // Update the session to remove all view-as user information
            try {
                await update({
                    view_as_user_id: null,
                    view_as_user_account_id: null,
                    view_as_user_role: null,
                    view_as_user_account_name: null,
                    view_as_user_name: null,
                });
            } catch {
                // Even if session update fails, proceed with redirect
            }

            const currentLocale = (params?.locale as string) || "en";
            const landingPath = getDefaultLandingPage(session?.user?.account_id);
            setTimeout(() => {
                window.location.href = `/${currentLocale}${landingPath}`;
            }, 300);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            showToast(error || "An error occurred", "error", 4000);
            setLoading(false);
        }
    };

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleSidebarToggle = () => {
        const newState = !sidebarOpen;
        setIsTogglingSidebar(true);
        setSidebarOpen(newState);
        // Track the user's manual toggle to prevent session from overriding it
        setLastUserToggle(newState);
        // Save to localStorage for backward compatibility
        if (typeof window !== "undefined") {
            localStorage.setItem("sidebarOpen", String(newState));
        }
        // Save to database if user is logged in (non-blocking, fire and forget)
        // Don't update session to avoid triggering reload - session will sync on next page load
        if (session?.user?.id) {
            const sidebarCollapsed = !newState; // Inverted: sidebarOpen=true means sidebar_collapsed=false
            // Fire and forget - don't await to prevent blocking
            apiFetch(`/api/entities/users/${session.user.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    sidebar_collapsed: sidebarCollapsed,
                }),
            })
                .then(async (response) => {
                    if (!response.ok) {
                        const errorData = await response
                            .json()
                            .catch(() => ({}));
                        console.error(
                            "Failed to save sidebar preference:",
                            response.status,
                            errorData.error || response.statusText
                        );
                    }
                    // Don't call update() - it causes page reload
                    // Session will sync from database on next page load
                })
                .catch((error) => {
                    console.error("Error saving sidebar preference:", error);
                })
                .finally(() => {
                    // Reset flag after API call completes
                    setTimeout(() => {
                        setIsTogglingSidebar(false);
                    }, 300);
                });
        } else {
            setIsTogglingSidebar(false);
        }
    };

    const forceRefreshSidebar = () => {
        setForceUpdate((prev) => prev + 1);
    };

    const handleLogout = async () => {
        const { clearNestAccessToken } = await import("@/utils/nestAuth");
        clearNestAccessToken();
        try {
            await signOut({ redirect: false });
        } catch {
            // NextAuth may be unavailable depending on deploy mode
        }
        router.push(`/${currentLocale}/login`);
    };

    const sidebarSections = useMemo(() => {
        // Admin section visibility is determined by permission checks above
        if (isLoadingAccountProducts) {
            return [];
        }

        const sections = [
            // Admin section - only show if effective user is admin AND not in view-as mode
            ...(shouldShowAdminSection
                ? [
                    {
                        header: t("actions.navigation_admin"),
                        items: [

                            {
                                label: t("actions.navigation_accounts"),
                                icon: <BusinessIcon />,
                                href:
                                    AppUrls.ACCOUNTS || "/app/admin/accounts",
                            },

                            {
                                label: t("actions.navigation_sms_management"),
                                icon: <MessageIcon />,
                                href:
                                    AppUrls.SMS_MANAGEMENT ||
                                    "/app/admin/sms",
                            },
                            {
                                label: "Email Campaign Report",
                                icon: <EmailIcon />,
                                href:
                                    AppUrls.EMAIL_CAMPAIGN_REPORT ||
                                    "/app/admin/email-campaign-report",
                            },
                            {
                                label: t("actions.navigation_cron_jobs"),
                                icon: <ScheduleIcon />,
                                href:
                                    AppUrls.CRON_JOBS ||
                                    "/app/admin/cron-jobs",
                            },

                            {
                                label: t("actions.navigation_reports"),
                                icon: <AssessmentIcon />,
                                href: AppUrls.REPORTS || "/app/reports",
                            },
                        ],
                    },
                ]
                : []),
            // Main section - available to users with view_customers permission or non-system-admin accounts (hidden for account 10013)
            ...(shouldShowMainSection && !hideForCustomer
                ? [
                    {
                        header: t("actions.navigation_main"),
                        items: [
                            // Financial Dashboard - hidden for account 10013 regardless of permissions
                            ...(hasViewFinancialDashboardPermission &&
                                effectiveUser.account_id != null &&
                                Number(effectiveUser.account_id) !== 10013
                                && !isCreditOnlyAccount
                                ? [
                                    {
                                        label: t(
                                            "actions.navigation_dashboard"
                                        ),
                                        icon: <DashboardIcon />,
                                        href:
                                            AppUrls.DASHBOARD ||
                                            "/app/dashboard",
                                    },
                                ]
                                : []),
                            ...(hasViewOperationDashboardPermission
                                && !isCreditOnlyAccount
                                ? [
                                    {
                                        label: t(
                                            "actions.navigation_operation_dashboard"
                                        ),
                                        icon: <BarChartIcon />,
                                        href:
                                            AppUrls.OPERATION_DASHBOARD ||
                                            "/app/operation-dashboard",
                                    },
                                ]
                                : []),
                            ...(hasCreditInsuranceProduct &&
                            hasViewCreditDashboardPermission
                                ? [
                                    {
                                        label: t(
                                            "actions.navigation_credit_dashboard"
                                        ),
                                        icon: <CreditInsuranceNavIcon />,
                                        href:
                                            AppUrls.CREDIT_DASHBOARD ||
                                            "/app/credit-dashboard",
                                    },
                                    {
                                        label: t(
                                            "actions.navigation_credit_portfolio_health",
                                            {
                                                defaultValue:
                                                    "Portfolio Health",
                                            }
                                        ),
                                        icon: <CreditInsuranceNavIcon />,
                                        href:
                                            AppUrls.CREDIT_PORTFOLIO_HEALTH ||
                                            "/app/credit-portfolio-health",
                                    },
                                ]
                                : []),
                            ...(!isCreditOnlyAccount
                                ? [
                                    {
                                        label: t("actions.navigation_control_center"),
                                        icon: <MonitorHeartIcon />,
                                        href:
                                            AppUrls.CONTROL_CENTER ||
                                            "/app/control-center",
                                        badge: controlCenterIssueCount,
                                    },
                                ]
                                : []),
                            ...(hasViewReportsPermission
                                ? [
                                    {
                                        label: t(
                                            "actions.navigation_reports"
                                        ),
                                        icon: <AssessmentIcon />,
                                        href:
                                            AppUrls.REPORTS ||
                                            "/app/reports",
                                    },
                                ]
                                : []),
                            {
                                label: t("actions.navigation_customers"),
                                icon: <PeopleIcon />,
                                href: AppUrls.CUSTOMERS || "/app/customers",
                            },
                        ],
                    },
                ]
                : []),
            // Categories section - available to users with view_customers permission or non-system-admin accounts (hidden for account 10013)
            ...(shouldShowMainSection && !hideForCustomer && !isCreditOnlyAccount
                ? [
                    {
                        header: t("actions.navigation_categories"),
                        items: [
                            {
                                label: t("actions.navigation_disputes"),
                                icon: <GavelIcon />,
                                href: AppUrls.DISPUTES || "/app/disputes",
                            },
                            {
                                label: t("actions.navigation_agents"),
                                icon: <PersonIcon />,
                                href: AppUrls.AGENTS || "/app/agents",
                            },
                            {
                                label: t("actions.navigation_legal"),
                                icon: <AccountBalanceIcon />,
                                href: "/app/legal",
                            },
                            {
                                label: t("actions.navigation_promise_to_pay"),
                                icon: <CalendarTodayIcon />,
                                href:
                                    AppUrls.PROMISE_TO_PAY_INTERNAL ||
                                    "/app/promise-to-pay",
                            },
                        ],
                    },
                ]
                : []),
            // Settings section - available to users with view_settings permission
            // Activity Sequences: view_activity_sequences permission + collection product on account
            // Logs is included as a sub-item but has independent visibility based on view_system_logs permission
            // Import is included as a sub-item but has independent visibility based on import permissions
            ...(((userPermissions && hasViewSettingsPermission) ||
                (userPermissions &&
                    hasViewActivitySequencesPermission &&
                    hasCollectionProduct) ||
                (userPermissions && hasViewSystemLogsPermission) ||
                (shouldShowImportSection && !hideForCustomer)) &&
                (!hideForCustomer || effectiveUser.account_id === 10013)
                ? [
                    {
                        header: t("actions.navigation_settings"),
                        items: [
                            ...(userPermissions && hasViewSettingsPermission
                                ? [
                                    {
                                        label: t(
                                            "actions.navigation_settings"
                                        ),
                                        icon: <SettingsIcon />,
                                        href: "/app/settings",
                                    },
                                ]
                                : []),
                            ...(userPermissions &&
                                hasViewActivitySequencesPermission &&
                                hasCollectionProduct
                                ? [
                                    {
                                        label: t(
                                            "actions.navigation_activity_sequences"
                                        ),
                                        icon: <ViewListIcon />,
                                        href:
                                            AppUrls.ACTIVITY_SEQUENCE ||
                                            "/app/activitySequences",
                                    },
                                ]
                                : []),
                            ...(shouldShowImportSection && !hideForCustomer
                                ? [
                                    {
                                        label: t("actions.navigation_import"),
                                        icon: <CloudUploadIcon />,
                                        href: AppUrls.IMPORT || "/app/import",
                                    },
                                ]
                                : []),

                        ],
                    },
                ]
                : []),
        ];

        return sections;
    }, [
        t,
        controlCenterIssueCount,
        hasViewFinancialDashboardPermission,
        effectiveUser.account_id,
        effectiveUser,
        session?.user?.account_id,
        hasViewActivitySequencesPermission,
        hasCollectionProduct,
        shouldShowSettingsSection,
        shouldShowImportSection,
        shouldShowMainSection,
        shouldShowAdminSection,
        hideForCustomer,
        hasImportInvoicePermission,
        hasImportPaymentPermission,
        hasImportCustomerPermission,
        hasImportContactPermission,
        hasViewReportsPermission,
        userPermissionsData,
        isCreditOnlyAccount,
        isLoadingAccountProducts,
        hasFileImportProduct,
    ]);

    // Force refresh sidebar when view-as state changes
    useEffect(() => {
        forceRefreshSidebar();
    }, [session?.user?.view_as_user_id]);

    // Monitor session changes and force refresh sidebar when session becomes authenticated
    useEffect(() => {
        if (status === "authenticated" && session && isSessionReady) {
            // Force refresh sidebar when session becomes authenticated and ready
            forceRefreshSidebar();
        }
    }, [session, status, isSessionReady]);

    const drawerKey = `drawer-${session?.user?.view_as_user_id || "admin"}-${forceUpdate}`;

    const drawer = (
        <Box
            key={drawerKey}
            sx={{
                height: "100%",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                direction: isHebrewUser ? "rtl" : "ltr",
                overflow: "hidden",
                boxSizing: "border-box",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarOpen ? "space-between" : "center",
                    p: 1,
                    minHeight: "64px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                    background: isHebrewUser
                        ? "linear-gradient(225deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)"
                        : "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                    flexDirection: "row",
                }}
            >
                {sidebarOpen && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            order: isHebrewUser ? 1 : 1,
                        }}
                    >
                        <img
                            src="/assets/images/brand-logos/logo.png"
                            alt="ARchaser"
                            style={{
                                height: "40px",
                                width: "auto",
                                maxWidth: "120px",
                            }}
                            onError={(e) => {
                                // Fallback if image fails to load
                                e.currentTarget.style.display = 'none';
                                console.error('Logo failed to load');
                            }}
                        />
                    </Box>
                )}
                <IconButton
                    onClick={handleSidebarToggle}
                    sx={{
                        color: "rgba(255, 255, 255, 0.9)",
                        transition: "all 0.3s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: sidebarOpen ? "auto" : "32px",
                        height: sidebarOpen ? "auto" : "32px",
                        order: isHebrewUser ? 2 : 2,
                        marginLeft: sidebarOpen
                            ? isHebrewUser
                                ? "0"
                                : "auto"
                            : "0",
                        marginRight: sidebarOpen
                            ? isHebrewUser
                                ? "auto"
                                : "0"
                            : "0",
                        "&:hover": {
                            backgroundColor: "rgba(255, 255, 255, 0.15)",
                            color: "white",
                            transform: "scale(1.05)",
                        },
                        "& .MuiSvgIcon-root": {
                            transform: (() => {
                                const shouldFlip =
                                    (sidebarOpen && isHebrewUser) ||
                                    (!sidebarOpen && !isHebrewUser);
                                return shouldFlip ? "scaleX(-1)" : "none";
                            })(),
                        },
                    }}
                >
                    {sidebarOpen ? <MenuOpenIcon /> : <MenuOpenIcon />}
                </IconButton>
            </Box>
            <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.1)" }} />

            <Box
                sx={{
                    flexGrow: 1,
                    overflow: "hidden",
                    py: 0,
                    width: "100%",
                    maxWidth: "100%",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Regular sections - scrollable */}
                <Box
                    sx={{
                        flexGrow: 1,
                        overflowY: "auto",
                        overflowX: "hidden",
                        py: 0,
                        width: "100%",
                        maxWidth: "100%",
                        "&::-webkit-scrollbar": {
                            display: "none",
                        },
                        msOverflowStyle: "none",
                        scrollbarWidth: "none",
                    }}
                >
                    {sidebarSections
                        .filter(
                            (section) =>
                                section.header !==
                                t("actions.navigation_settings")
                        )
                        .map((section, sectionIndex) => (
                            <Box
                                key={`${section.header}-${session?.user?.view_as_user_id || "admin"}-${sectionIndex}`}
                                sx={{
                                    mb: 1,
                                    mt: sectionIndex === 0 ? 0 : 0,
                                    width: "100%",
                                    maxWidth: "100%",
                                    overflow: "hidden",
                                    ...((section.header ===
                                        t("actions.navigation_import") ||
                                        section.header ===
                                        t(
                                            "actions.navigation_categories"
                                        )) &&
                                        !sidebarOpen && {
                                        pt: 1,
                                        borderTop:
                                            "1px solid rgba(255, 255, 255, 0.1)",
                                    }),
                                }}
                            >
                                {sidebarOpen && (
                                    <Typography
                                        variant="overline"
                                        sx={{
                                            px: 1,
                                            pt: 0,
                                            pb: 0.25,
                                            color: "rgba(255, 255, 255, 0.6)",
                                            fontSize: isHebrewUser
                                                ? "0.8rem"
                                                : "0.7rem",
                                            fontWeight: 600,
                                            letterSpacing: "0.1em",
                                            textTransform: "uppercase",
                                            textAlign: isHebrewUser
                                                ? "right"
                                                : "left",
                                            direction: isHebrewUser
                                                ? "rtl"
                                                : "ltr",
                                        }}
                                    >
                                        {section.header}
                                    </Typography>
                                )}
                                <List
                                    className="drawer-nav"
                                    sx={{
                                        p: 0,
                                        overflow: "hidden",
                                        width: "100%",
                                    }}
                                >
                                    {section.items.map((item, itemIndex) => {
                                        // Extract path without locale prefix for comparison
                                        const pathWithoutLocale =
                                            pathname?.replace(
                                                /^\/[a-z]{2}/,
                                                ""
                                            ) || "";

                                        // More robust active state detection
                                        const isActive =
                                            pathWithoutLocale &&
                                            (pathWithoutLocale === item.href ||
                                                pathWithoutLocale.startsWith(
                                                    `${item.href}/`
                                                ) ||
                                                (item.href ===
                                                    "/app/dashboard" &&
                                                    pathWithoutLocale ===
                                                    "/app") ||
                                                (item.href ===
                                                    "/app/admin/accounts" &&
                                                    pathWithoutLocale.startsWith(
                                                        "/app/admin/accounts/"
                                                    )));
                                        const isNewlyActive =
                                            isActive &&
                                            activeMenuItem === pathname;

                                        return (
                                            <Tooltip
                                                key={itemIndex}
                                                title={getMenuTooltip(item)}
                                                placement="bottom"
                                                disableHoverListener={
                                                    sidebarOpen
                                                }
                                                arrow
                                                enterDelay={300}
                                                leaveDelay={100}
                                                PopperProps={{
                                                    sx: {
                                                        "& .MuiTooltip-tooltip":
                                                        {
                                                            direction:
                                                                isHebrewUser
                                                                    ? "rtl"
                                                                    : "ltr",
                                                        },
                                                        "& .MuiTooltip-arrow": {
                                                            ...(isHebrewUser && {
                                                                transform:
                                                                    "scaleX(-1)",
                                                            }),
                                                        },
                                                    },
                                                }}
                                            >
                                                <ListItemButton
                                                    component={Link}
                                                    href={toNavHref(item.href)}
                                                    className={
                                                        isNewlyActive
                                                            ? "menu-item-active"
                                                            : ""
                                                    }
                                                    sx={{
                                                        mx: sidebarOpen
                                                            ? 0.25
                                                            : 0,
                                                        px: sidebarOpen ? 0 : 2,
                                                        // Consistent left/start padding for all items, extra right/end padding only for items with badges > 0
                                                        ...(sidebarOpen && {
                                                            ...(isHebrewUser
                                                                ? {
                                                                    pr: 1, // RTL: consistent padding from right border (start)
                                                                    pl:
                                                                        item.badge !==
                                                                            undefined &&
                                                                            item.badge !==
                                                                            null &&
                                                                            item.badge >
                                                                            0
                                                                            ? 1
                                                                            : 0, // RTL: extra padding on left (end) for badge space
                                                                }
                                                                : {
                                                                    pl: 1, // LTR: consistent padding from left border (start)
                                                                    pr:
                                                                        item.badge !==
                                                                            undefined &&
                                                                            item.badge !==
                                                                            null &&
                                                                            item.badge >
                                                                            0
                                                                            ? 1
                                                                            : 0, // LTR: extra padding on right (end) for badge space
                                                                }),
                                                        }),
                                                        // RTL-specific margin handling for Hebrew users
                                                        ...(isHebrewUser &&
                                                            sidebarOpen && {
                                                            marginInlineStart:
                                                                "8px",
                                                            marginInlineEnd:
                                                                "4px",
                                                        }),
                                                        maxWidth: "100%",
                                                        width: "100%",
                                                        boxSizing: "border-box",
                                                        overflow: "hidden",
                                                        // Override theme margin that causes overflow
                                                        margin: "0 !important",
                                                        "&.MuiListItemButton-root":
                                                        {
                                                            margin: "0 !important",
                                                        },
                                                        justifyContent:
                                                            sidebarOpen
                                                                ? "flex-start"
                                                                : "center",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        mb: 0.125,
                                                        borderRadius:
                                                            theme.navMenu
                                                                .listItemBorderRadius,
                                                        minHeight: 48,
                                                        position: "relative",
                                                        transition:
                                                            "all 0.2s ease",
                                                        color: isActive
                                                            ? "white"
                                                            : "rgba(255, 255, 255, 0.8)",
                                                        backgroundColor:
                                                            isActive
                                                                ? "rgba(255, 255, 255, 0.15)"
                                                                : "transparent",
                                                        border: "1px solid transparent",
                                                        boxShadow: "none",
                                                        transform:
                                                            "translateX(0)",
                                                        "&:hover": {
                                                            backgroundColor:
                                                                isActive
                                                                    ? "rgba(255, 255, 255, 0.2)"
                                                                    : "rgba(255, 255, 255, 0.1)",
                                                            transform:
                                                                "translateX(0)",
                                                            boxShadow: "none",
                                                            "& .menu-icon": {
                                                                transform:
                                                                    "scale(1.15) rotate(5deg)",
                                                            },
                                                        },
                                                        filter: isActive
                                                            ? "none"
                                                            : "none",
                                                    }}
                                                >
                                                    <ListItemIcon
                                                        sx={{
                                                            minWidth:
                                                                sidebarOpen
                                                                    ? 40
                                                                    : 0,
                                                            color: "inherit",
                                                            transition:
                                                                "all 0.3s ease",
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                            // Add padding for Hebrew users to create space from page border and between icon and text
                                                            ...(isHebrewUser &&
                                                                sidebarOpen && {
                                                                paddingInlineStart:
                                                                    "8px",
                                                                paddingInlineEnd:
                                                                    "12px",
                                                            }),
                                                            "& .menu-icon": {
                                                                color: isActive
                                                                    ? "white"
                                                                    : "rgba(255, 255, 255, 0.8)",
                                                                transition:
                                                                    "all 0.3s ease",
                                                            },
                                                            "& svg": {
                                                                color: isActive
                                                                    ? "white"
                                                                    : "rgba(255, 255, 255, 0.8)",
                                                            },
                                                        }}
                                                    >
                                                        <span
                                                            className="menu-icon"
                                                            style={{
                                                                display:
                                                                    "inline-flex",
                                                                alignItems:
                                                                    "center",
                                                                justifyContent:
                                                                    "center",
                                                                transition:
                                                                    "all 0.3s ease",
                                                            }}
                                                        >
                                                            {item.icon}
                                                        </span>
                                                    </ListItemIcon>
                                                    {sidebarOpen && (
                                                        <ListItemText
                                                            primary={item.label}
                                                            sx={{
                                                                "& .MuiListItemText-primary":
                                                                {
                                                                    fontSize:
                                                                        isHebrewUser
                                                                            ? "0.9rem"
                                                                            : "0.8rem",
                                                                    fontWeight:
                                                                        isActive
                                                                            ? 600
                                                                            : 500,
                                                                    letterSpacing:
                                                                        isActive
                                                                            ? "0.02em"
                                                                            : "normal",
                                                                    transition:
                                                                        "all 0.2s ease",
                                                                    color: isActive
                                                                        ? "#ffffff"
                                                                        : "inherit",
                                                                    // Apply theme-based RTL alignment with proper typography
                                                                    ...(isHebrewUser
                                                                        ? {
                                                                            textAlign:
                                                                                "right !important",
                                                                            direction:
                                                                                "rtl !important",
                                                                        }
                                                                        : {
                                                                            textAlign:
                                                                                "left !important",
                                                                            direction:
                                                                                "ltr !important",
                                                                        }),
                                                                },
                                                            }}
                                                        />
                                                    )}
                                                    {item.badge !== undefined &&
                                                        item.badge !== null &&
                                                        item.badge > 0 &&
                                                        sidebarOpen && (
                                                            <Chip
                                                                label={
                                                                    item.badge
                                                                }
                                                                size="small"
                                                                sx={{
                                                                    ml: 1,
                                                                    mr: 0,
                                                                    backgroundColor:
                                                                        "#f44336",
                                                                    color: "white",
                                                                    fontSize:
                                                                        "0.7rem",
                                                                    fontWeight: 600,
                                                                    height: 20,
                                                                    minWidth: 20,
                                                                    border: isActive
                                                                        ? "1px solid rgba(255, 255, 255, 0.2)"
                                                                        : "none",
                                                                    boxShadow:
                                                                        isActive
                                                                            ? "0 1px 3px rgba(0, 0, 0, 0.1)"
                                                                            : "0 2px 4px rgba(0, 0, 0, 0.2)",
                                                                    "& .MuiChip-label":
                                                                    {
                                                                        px: 1,
                                                                        color: "inherit",
                                                                    },
                                                                }}
                                                            />
                                                        )}
                                                </ListItemButton>
                                            </Tooltip>
                                        );
                                    })}
                                </List>
                            </Box>
                        ))}
                </Box>

                {/* Settings section - fixed at bottom */}
                {sidebarSections
                    .filter(
                        (section) =>
                            section.header === t("actions.navigation_settings")
                    )
                    .map((section, sectionIndex) => (
                        <Box
                            key={`${section.header}-${session?.user?.view_as_user_id || "admin"}-${sectionIndex}`}
                            sx={{
                                mt: "auto",
                                pt: 1,
                                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                                width: "100%",
                                maxWidth: "100%",
                                overflow: "hidden",
                            }}
                        >
                            {sidebarOpen && (
                                <Typography
                                    variant="overline"
                                    sx={{
                                        px: 1,
                                        pt: 0,
                                        pb: 0.25,
                                        color: "rgba(255, 255, 255, 0.6)",
                                        fontSize: isHebrewUser
                                            ? "0.8rem"
                                            : "0.7rem",
                                        fontWeight: 600,
                                        letterSpacing: "0.1em",
                                        textTransform: "uppercase",
                                        textAlign: isHebrewUser
                                            ? "right"
                                            : "left",
                                        direction: isHebrewUser ? "rtl" : "ltr",
                                    }}
                                >
                                    {section.header}
                                </Typography>
                            )}
                            <List
                                className="drawer-nav"
                                sx={{
                                    p: 0,
                                    overflow: "hidden",
                                    width: "100%",
                                }}
                            >
                                {section.items.map((item, itemIndex) => {
                                    // Extract path without locale prefix for comparison
                                    const pathWithoutLocale =
                                        pathname?.replace(/^\/[a-z]{2}/, "") ||
                                        "";

                                    // More robust active state detection
                                    const isActive =
                                        pathWithoutLocale &&
                                        (pathWithoutLocale === item.href ||
                                            pathWithoutLocale.startsWith(
                                                `${item.href}/`
                                            ) ||
                                            (item.href === "/app/dashboard" &&
                                                pathWithoutLocale === "/app") ||
                                            (item.href ===
                                                "/app/admin/accounts" &&
                                                pathWithoutLocale.startsWith(
                                                    "/app/admin/accounts/"
                                                )));
                                    const isNewlyActive =
                                        isActive && activeMenuItem === pathname;

                                    return (
                                        <Tooltip
                                            key={itemIndex}
                                            title={getMenuTooltip(item)}
                                            placement="bottom"
                                            disableHoverListener={sidebarOpen}
                                            arrow
                                            enterDelay={300}
                                            leaveDelay={100}
                                            PopperProps={{
                                                sx: {
                                                    "& .MuiTooltip-tooltip": {
                                                        direction: isHebrewUser
                                                            ? "rtl"
                                                            : "ltr",
                                                    },
                                                },
                                            }}
                                        >
                                            <ListItemButton
                                                component={Link}
                                                href={toNavHref(item.href)}
                                                className={
                                                    isNewlyActive
                                                        ? "menu-item-active"
                                                        : ""
                                                }
                                                sx={{
                                                    mx: sidebarOpen ? 0.25 : 0,
                                                    px: sidebarOpen ? 0 : 2,
                                                    // Consistent left/start padding for all items, extra right/end padding only for items with badges > 0
                                                    ...(sidebarOpen && {
                                                        ...(isHebrewUser
                                                            ? {
                                                                pr: 1, // RTL: consistent padding from right border (start)
                                                                pl:
                                                                    item.badge !==
                                                                        undefined &&
                                                                        item.badge !==
                                                                        null &&
                                                                        item.badge >
                                                                        0
                                                                        ? 1
                                                                        : 0, // RTL: extra padding on left (end) for badge space
                                                            }
                                                            : {
                                                                pl: 1, // LTR: consistent padding from left border (start)
                                                                pr:
                                                                    item.badge !==
                                                                        undefined &&
                                                                        item.badge !==
                                                                        null &&
                                                                        item.badge >
                                                                        0
                                                                        ? 1
                                                                        : 0, // LTR: extra padding on right (end) for badge space
                                                            }),
                                                    }),
                                                    // RTL-specific margin handling for Hebrew users
                                                    ...(isHebrewUser &&
                                                        sidebarOpen && {
                                                        marginInlineStart:
                                                            "8px",
                                                        marginInlineEnd:
                                                            "4px",
                                                    }),
                                                    maxWidth: "100%",
                                                    width: "100%",
                                                    boxSizing: "border-box",
                                                    overflow: "hidden",
                                                    // Override theme margin that causes overflow
                                                    margin: "0 !important",
                                                    "&.MuiListItemButton-root":
                                                    {
                                                        margin: "0 !important",
                                                    },
                                                    justifyContent: sidebarOpen
                                                        ? "flex-start"
                                                        : "center",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    mb: 0.125,
                                                    borderRadius:
                                                        theme.navMenu
                                                            .listItemBorderRadius,
                                                    minHeight: 48,
                                                    position: "relative",
                                                    transition: "all 0.2s ease",
                                                    color: isActive
                                                        ? "white"
                                                        : "rgba(255, 255, 255, 0.8)",
                                                    backgroundColor: isActive
                                                        ? "rgba(255, 255, 255, 0.15)"
                                                        : "transparent",
                                                    border: "1px solid transparent",
                                                    boxShadow: "none",
                                                    transform: "translateX(0)",
                                                    "&:hover": {
                                                        backgroundColor:
                                                            isActive
                                                                ? "rgba(255, 255, 255, 0.2)"
                                                                : "rgba(255, 255, 255, 0.1)",
                                                        transform:
                                                            "translateX(0)",
                                                        boxShadow: "none",
                                                        "& .menu-icon": {
                                                            transform:
                                                                "scale(1.15) rotate(5deg)",
                                                        },
                                                    },
                                                    filter: isActive
                                                        ? "none"
                                                        : "none",
                                                }}
                                            >
                                                <ListItemIcon
                                                    sx={{
                                                        minWidth: sidebarOpen
                                                            ? 40
                                                            : 0,
                                                        color: "inherit",
                                                        transition:
                                                            "all 0.3s ease",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        // Add padding for Hebrew users to create space from page border and between icon and text
                                                        ...(isHebrewUser &&
                                                            sidebarOpen && {
                                                            paddingInlineStart:
                                                                "8px",
                                                            paddingInlineEnd:
                                                                "12px",
                                                        }),
                                                        "& .menu-icon": {
                                                            color: isActive
                                                                ? "white"
                                                                : "rgba(255, 255, 255, 0.8)",
                                                            transition:
                                                                "all 0.3s ease",
                                                        },
                                                        "& svg": {
                                                            color: isActive
                                                                ? "white"
                                                                : "rgba(255, 255, 255, 0.8)",
                                                        },
                                                    }}
                                                >
                                                    <span
                                                        className="menu-icon"
                                                        style={{
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                            transition:
                                                                "all 0.3s ease",
                                                        }}
                                                    >
                                                        {item.icon}
                                                    </span>
                                                </ListItemIcon>
                                                {sidebarOpen && (
                                                    <ListItemText
                                                        primary={item.label}
                                                        sx={{
                                                            "& .MuiListItemText-primary":
                                                            {
                                                                fontSize:
                                                                    isHebrewUser
                                                                        ? "0.9rem"
                                                                        : "0.8rem",
                                                                fontWeight:
                                                                    isActive
                                                                        ? 600
                                                                        : 500,
                                                                letterSpacing:
                                                                    isActive
                                                                        ? "0.02em"
                                                                        : "normal",
                                                                transition:
                                                                    "all 0.2s ease",
                                                                color: isActive
                                                                    ? "#ffffff"
                                                                    : "inherit",
                                                                // Apply theme-based RTL alignment with proper typography
                                                                ...(isHebrewUser
                                                                    ? {
                                                                        textAlign:
                                                                            "right !important",
                                                                        direction:
                                                                            "rtl !important",
                                                                    }
                                                                    : {
                                                                        textAlign:
                                                                            "left !important",
                                                                        direction:
                                                                            "ltr !important",
                                                                    }),
                                                            },
                                                        }}
                                                    />
                                                )}
                                                {item.badge !== undefined &&
                                                    item.badge !== null &&
                                                    item.badge > 0 &&
                                                    sidebarOpen && (
                                                        <Chip
                                                            label={item.badge}
                                                            size="small"
                                                            sx={{
                                                                ml: 1,
                                                                mr: 0,
                                                                backgroundColor:
                                                                    "#f44336",
                                                                color: "white",
                                                                fontSize:
                                                                    "0.7rem",
                                                                fontWeight: 600,
                                                                height: 20,
                                                                minWidth: 20,
                                                                border: isActive
                                                                    ? "1px solid rgba(255, 255, 255, 0.2)"
                                                                    : "none",
                                                                boxShadow:
                                                                    isActive
                                                                        ? "0 1px 3px rgba(0, 0, 0, 0.1)"
                                                                        : "0 2px 4px rgba(0, 0, 0, 0.2)",
                                                                "& .MuiChip-label":
                                                                {
                                                                    px: 1,
                                                                    color: "inherit",
                                                                },
                                                            }}
                                                        />
                                                    )}
                                            </ListItemButton>
                                        </Tooltip>
                                    );
                                })}
                            </List>
                        </Box>
                    ))}
            </Box>
        </Box>
    );

    const pathWithoutLocale = pathname
        ? normalizeAppPathname(pathname)
        : "";

    const isRouteAccessResolved =
        userPermissions !== undefined && !isLoadingAccountProducts;

    const isCurrentRouteAccessible =
        !pathWithoutLocale.startsWith("/app") ||
        !isRouteAccessResolved ||
        isAppRouteAccessible(
            pathWithoutLocale,
            userPermissions ?? [],
            effectiveUser.account_id ?? 0,
            effectiveAccountProducts
        );

    const shouldBlockLayoutRender =
        status === "authenticated" &&
        isSessionReady &&
        (isLoadingAccountProducts ||
            isLoadingAccountTheme ||
            isLoadingPermissions);

    if (shouldBlockLayoutRender) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    width: "100%",
                }}
            >
                <CircularProgress size={36} />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                direction: isHebrewUser ? "rtl" : "ltr",
            }}
        >
            {/* View As Banner - Full width above header */}
            <ViewAsBanner
                currentViewAsUserName={currentViewAsUserName}
                onClearViewAs={handleClearViewAs}
                isHebrewUser={isHebrewUser}
                isViewAsActive={!!session?.user?.view_as_user_id}
            />
            <Box
                sx={{
                    display: "flex",
                    flexDirection: isHebrewUser ? "row-reverse" : "row",
                    width: "100%",
                }}
            >
                <AppHeader
                    onDrawerToggle={handleDrawerToggle}
                    session={session}
                    effectiveUser={effectiveUser}
                    currentViewAsUser={currentViewAsUser}
                    currentViewAsUserName={currentViewAsUserName}
                    controlCenterIssueCount={controlCenterIssueCount}
                    collectionAgents={users}
                    loading={loading}
                    handleViewAsChange={handleViewAsChange}
                    handleClearViewAs={handleClearViewAs}
                    handleLogout={handleLogout}
                    isHebrewUser={isHebrewUser}
                    sidebarOpen={sidebarOpen}
                />
                <Box
                    component="nav"
                    sx={{
                        width: { sm: sidebarOpen ? drawerWidth : 61 },
                        flexShrink: { sm: 0 },
                        order: isHebrewUser ? 2 : 1,
                    }}
                >
                    <Drawer
                        variant="temporary"
                        open={mobileOpen}
                        onClose={handleDrawerToggle}
                        ModalProps={{
                            keepMounted: true,
                        }}
                        sx={{
                            display: { xs: "block", sm: "none" },
                            "& .MuiDrawer-paper": {
                                boxSizing: "border-box",
                                width: drawerWidth,
                                backgroundColor: theme.palette.primary.main,
                                backgroundImage: isHebrewUser
                                    ? `linear-gradient(225deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.main} 65%, ${theme.palette.secondary.main} 100%)`
                                    : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.main} 65%, ${theme.palette.secondary.main} 100%)`,
                                borderRight: isHebrewUser
                                    ? "none"
                                    : `1px solid ${theme.palette.primary.dark}`,
                                borderLeft: isHebrewUser
                                    ? `1px solid ${theme.palette.primary.dark}`
                                    : "none",
                                borderRadius: 0,
                                top: session?.user?.view_as_user_id
                                    ? "40px"
                                    : 0,
                                left: isHebrewUser ? "auto" : 0,
                                right: isHebrewUser ? 0 : "auto",
                                height: session?.user?.view_as_user_id
                                    ? "calc(100vh - 40px)"
                                    : "100vh",
                                border: "none",
                                boxShadow: "none",
                                zIndex: (theme) => theme.zIndex.drawer,
                            },
                        }}
                    >
                        {drawer}
                    </Drawer>
                    <Drawer
                        variant="permanent"
                        sx={{
                            display: { xs: "none", sm: "block" },
                            "& .MuiDrawer-paper": {
                                boxSizing: "border-box",
                                width: sidebarOpen ? drawerWidth : 61,
                                overflow: "hidden",
                                transition: theme.transitions.create("width", {
                                    easing: theme.transitions.easing.sharp,
                                    duration:
                                        theme.transitions.duration
                                            .enteringScreen,
                                }),
                                overflowX: "hidden",
                                backgroundColor: theme.palette.primary.main,
                                backgroundImage: isHebrewUser
                                    ? `linear-gradient(225deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.main} 65%, ${theme.palette.secondary.main} 100%)`
                                    : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.main} 65%, ${theme.palette.secondary.main} 100%)`,
                                borderRight: isHebrewUser
                                    ? "none"
                                    : `1px solid ${theme.palette.primary.dark}`,
                                borderLeft: isHebrewUser
                                    ? `1px solid ${theme.palette.primary.dark}`
                                    : "none",
                                borderRadius: 0,
                                top: session?.user?.view_as_user_id
                                    ? "40px"
                                    : 0,
                                left: isHebrewUser ? "auto" : 0,
                                right: isHebrewUser ? 0 : "auto",
                                height: session?.user?.view_as_user_id
                                    ? "calc(100vh - 40px)"
                                    : "100vh",
                                border: "none",
                                boxShadow: "none",
                                zIndex: (theme) => theme.zIndex.drawer,
                            },
                        }}
                        open
                    >
                        {drawer}
                    </Drawer>
                </Box>
                <Box
                    component="main"
                    sx={{
                        flexGrow: 1,
                        minWidth: 0,
                        px: { xs: 1, sm: 1.5 },
                        py: { xs: 1, sm: 1.5 },
                        marginTop: session?.user?.view_as_user_id
                            ? "104px"
                            : "64px", // 64px header + 40px banner when visible
                        width: "100%",
                        maxWidth: "100%",
                        overflow: "auto", // Enable scrolling within main content area
                        height: session?.user?.view_as_user_id
                            ? "calc(100vh - 104px)"
                            : "calc(100vh - 64px)", // Account for banner when visible
                        boxSizing: "border-box",
                        order: isHebrewUser ? 1 : 2,
                        direction: isHebrewUser ? "rtl" : "ltr",
                        transition: theme.transitions.create(
                            ["margin", "width", "height"],
                            {
                                easing: theme.transitions.easing.sharp,
                                duration:
                                    theme.transitions.duration.leavingScreen,
                            }
                        ),
                    }}
                >
                    {!isCurrentRouteAccessible ? (
                        <AccessDenied />
                    ) : (
                        children
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default function AppShell({ children }: any) {
    return (
        <ToastProvider>
            <SessionInitializer>
                <ReactQueryProvider>
                    <SpinnerProvider>
                        <AppLayout>{children}</AppLayout>
                        <SpinnerOverlay />
                        <FollowUpReminder />
                    </SpinnerProvider>
                </ReactQueryProvider>
            </SessionInitializer>
        </ToastProvider>
    );
}
