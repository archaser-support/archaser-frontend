import AppUrls from "../../utils/appUrls";

import {
    type AccountProducts,
    isCreditOnlyAccount,
    isFileImportVisible,
} from "./accountProducts";

export type { AccountProducts };
export { isFileImportVisible };

export const ARCHASER_ADMIN_ACCOUNT_ID = 10013;

export function isArchaserAdminAccount(
    accountId: number | string | null | undefined
): boolean {
    return Number(accountId) === ARCHASER_ADMIN_ACCOUNT_ID;
}

export function getDefaultLandingPage(
    accountId: number | string | null | undefined
): string {
    if (isArchaserAdminAccount(accountId)) {
        return AppUrls.ACCOUNTS || "/app/admin/accounts";
    }

    return AppUrls.DASHBOARD || "/app/dashboard";
}

export interface NavItem {
    label: string;
    href: string;
    permission?: string;
    show?: (
        permissions: string[],
        accountId: number | string,
        accountProducts?: AccountProducts
    ) => boolean;
}

export interface NavSection {
    header: string;
    items: NavItem[];
    show?: (
        permissions: string[],
        accountId: number | string,
        accountProducts?: AccountProducts
    ) => boolean;
}

export const sidebarStructure: NavSection[] = [
    {
        header: "actions.navigation_admin",
        show: (_perms, accountId) => isArchaserAdminAccount(accountId),
        items: [
            {
                label: "actions.navigation_accounts",
                href: AppUrls.ACCOUNTS || "/app/admin/accounts",
            },
            {
                label: "actions.navigation_sms_management",
                href: AppUrls.SMS_MANAGEMENT || "/app/admin/sms",
            },
            {
                label: "Email Campaign Report",
                href: AppUrls.EMAIL_CAMPAIGN_REPORT || "/app/admin/email-campaign-report",
            },
            {
                label: "actions.navigation_cron_jobs",
                href: AppUrls.CRON_JOBS || "/app/admin/cron-jobs",
            },
            {
                label: "actions.navigation_reports",
                href: AppUrls.REPORTS || "/app/reports",
            },
        ],
    },
    {
        header: "actions.navigation_main",
        show: (permissions, accountId) =>
            (permissions.includes("view_customers") || Number(accountId) !== 10013) &&
            Number(accountId) !== 10013,
        items: [
            {
                label: "actions.navigation_dashboard",
                href: AppUrls.DASHBOARD || "/app/dashboard",
                permission: "view_financial_dashboard",
                show: (_permissions, accountId, accountProducts) =>
                    Number(accountId) !== 10013 &&
                    !isCreditOnlyAccount(accountProducts),
            },
            {
                label: "actions.navigation_operation_dashboard",
                href: AppUrls.OPERATION_DASHBOARD || "/app/operation-dashboard",
                permission: "view_operation_dashboard",
                show: (_permissions, _accountId, accountProducts) =>
                    !isCreditOnlyAccount(accountProducts),
            },
            {
                label: "actions.navigation_credit_dashboard",
                href: AppUrls.CREDIT_DASHBOARD || "/app/credit-dashboard",
                permission: "view_credit_dashboard",
                show: (_permissions, _accountId, accountProducts) =>
                    accountProducts?.has_credit_insurance === true,
            },
            {
                label: "actions.navigation_credit_portfolio_health",
                href:
                    AppUrls.CREDIT_PORTFOLIO_HEALTH ||
                    "/app/credit-portfolio-health",
                permission: "view_credit_dashboard",
                show: (_permissions, _accountId, accountProducts) =>
                    accountProducts?.has_credit_insurance === true,
            },
            {
                label: "actions.navigation_control_center",
                href: AppUrls.CONTROL_CENTER || "/app/control-center",
                show: (_permissions, _accountId, accountProducts) =>
                    !isCreditOnlyAccount(accountProducts),
            },
            {
                label: "actions.navigation_reports",
                href: AppUrls.REPORTS || "/app/reports",
                permission: "view_reports",
            },
            {
                label: "actions.navigation_customers",
                href: AppUrls.CUSTOMERS || "/app/customers",
            },
        ],
    },
    {
        header: "actions.navigation_categories",
        show: (permissions, accountId, accountProducts) =>
            (permissions.includes("view_customers") || Number(accountId) !== 10013) &&
            Number(accountId) !== 10013 &&
            !isCreditOnlyAccount(accountProducts),
        items: [
            {
                label: "actions.navigation_disputes",
                href: AppUrls.DISPUTES || "/app/disputes",
            },
            {
                label: "actions.navigation_agents",
                href: AppUrls.AGENTS || "/app/agents",
            },
            {
                label: "actions.navigation_legal",
                href: "/app/legal",
            },
            {
                label: "actions.navigation_promise_to_pay",
                href: AppUrls.PROMISE_TO_PAY_INTERNAL || "/app/promise-to-pay",
            },
        ],
    },
    {
        header: "actions.navigation_settings",
        show: (permissions, accountId, accountProducts) =>
            (permissions.includes("view_settings") ||
                (permissions.includes("view_activity_sequences") &&
                    accountProducts?.has_collection !== false) ||
                permissions.includes("view_system_logs") ||
                (isFileImportVisible(accountProducts) &&
                    permissions.some((p) => p.startsWith("import_")))) &&
            (Number(accountId) === 10013 || Number(accountId) !== 10013), // logic from layout: (!hideForCustomer || effectiveUser.account_id === 10013)
        items: [
            {
                label: "actions.navigation_settings",
                href: "/app/settings",
                permission: "view_settings",
            },
            {
                label: "actions.navigation_activity_sequences",
                href: AppUrls.ACTIVITY_SEQUENCE || "/app/activitySequences",
                permission: "view_activity_sequences",
                show: (_permissions, _accountId, accountProducts) =>
                    accountProducts?.has_collection !== false,
            },
            {
                label: "actions.navigation_import",
                href: AppUrls.IMPORT || "/app/import",
                show: (permissions, _accountId, accountProducts) =>
                    isFileImportVisible(accountProducts) &&
                    permissions.some((p) => p.startsWith("import_")),
            },
        ],
    },
];

export function getFirstAccessiblePage(
    permissions: string[],
    accountId: number | string,
    accountProducts?: AccountProducts
): string {
    for (const section of sidebarStructure) {
        if (section.show && !section.show(permissions, accountId, accountProducts)) {
            continue;
        }

        for (const item of section.items) {
            if (item.permission && !permissions.includes(item.permission)) {
                continue;
            }
            if (item.show && !item.show(permissions, accountId, accountProducts)) {
                continue;
            }
            return item.href;
        }
    }

    return AppUrls.CUSTOMERS || "/app/customers";
}

/** Strip locale prefix from an app pathname (`/en/app/dashboard` → `/app/dashboard`). */
export function normalizeAppPathname(pathname: string): string {
    const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/)/, "") || pathname;
    const normalized = withoutLocale.replace(/\/$/, "") || "/app";
    return normalized === "" ? "/app" : normalized;
}

type SupplementaryAppRoute = {
    prefix: string;
    canAccess: (
        permissions: string[],
        accountId: number | string,
        accountProducts?: AccountProducts
    ) => boolean;
};

/** Routes reachable by permission but not listed as top-level sidebar items. */
const supplementaryAppRoutes: SupplementaryAppRoute[] = [
    {
        prefix: "/app/logs",
        canAccess: (permissions) => permissions.includes("view_system_logs"),
    },
    {
        prefix: AppUrls.SYSTEM_LOGS || "/app/admin/logs",
        canAccess: (permissions) => permissions.includes("view_system_logs"),
    },
];

export function getAccessibleAppRoutePrefixes(
    permissions: string[],
    accountId: number | string,
    accountProducts?: AccountProducts
): string[] {
    const prefixes: string[] = [];

    for (const section of sidebarStructure) {
        if (section.show && !section.show(permissions, accountId, accountProducts)) {
            continue;
        }

        for (const item of section.items) {
            if (item.permission && !permissions.includes(item.permission)) {
                continue;
            }
            if (item.show && !item.show(permissions, accountId, accountProducts)) {
                continue;
            }
            prefixes.push(item.href);
        }
    }

    for (const route of supplementaryAppRoutes) {
        if (route.canAccess(permissions, accountId, accountProducts)) {
            prefixes.push(route.prefix);
        }
    }

    return prefixes;
}

/**
 * Whether the current in-app path is allowed for this user/account product mix.
 * Uses the same rules as sidebar visibility and post-login landing.
 */
export function isAppRouteAccessible(
    pathname: string,
    permissions: string[],
    accountId: number | string,
    accountProducts?: AccountProducts
): boolean {
    const path = normalizeAppPathname(pathname);

    if (!path.startsWith("/app")) {
        return true;
    }

    if (path === "/app") {
        return true;
    }

    const prefixes = getAccessibleAppRoutePrefixes(
        permissions,
        accountId,
        accountProducts
    );

    return prefixes.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    );
}
